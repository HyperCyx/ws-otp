const logger = require('../utils/logger');
const { getNumberListForCountry, uploadOtp, deleteNumberForCountry } = require('../services/externalApi');
const { credit, TX_TYPES } = require('../services/walletService');
const { query } = require('../config/database');
const { getSocketServer, emitToUser } = require('../services/socketService');

const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '8000');
const MAX_POLL_ATTEMPTS = parseInt(process.env.MAX_POLL_ATTEMPTS || '75');
const POLL_CONCURRENCY = parseInt(process.env.POLL_CONCURRENCY || '5');

const EXT_STATUS = {
  SUCCESS: 1,
  IN_PROGRESS: 2,
  INVALID: 3,
  RETRY_LATER: 4,
  WRONG_OTP: 6,
};

function normalizeDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function resolveExternalStatus(match) {
  const rawStatus = match?.registrationStatus;

  if (rawStatus === null || rawStatus === undefined || rawStatus === '') {
    return null;
  }

  const normalized = normalizeText(rawStatus);

  if (/^\d+$/.test(normalized)) {
    const numeric = parseInt(normalized, 10);
    if ([EXT_STATUS.SUCCESS, EXT_STATUS.IN_PROGRESS, EXT_STATUS.INVALID, EXT_STATUS.RETRY_LATER, EXT_STATUS.WRONG_OTP].includes(numeric)) {
      return numeric;
    }
  }

  return null;
}

function getOtpFromMatch(match) {
  return (
    match?.latestCode ??
    match?.otp ??
    match?.code ??
    match?.otpCode ??
    match?.smsCode ??
    match?.otp_code ??
    match?.verificationCode ??
    match?.verification_code ??
    null
  );
}

function matchesActivationNumber(match, activation) {
  const activationValues = [
    activation?.phone_full,
    activation?.phone_local,
    activation?.phone_cc && activation?.phone_local ? `+${activation.phone_cc}${activation.phone_local}` : null,
  ]
    .filter(Boolean)
    .map(normalizeDigits)
    .filter(Boolean);

  const providerValues = [
    match?.phoneNum,
    match?.phone,
    match?.phoneFull,
    match?.phone_full,
    match?.phoneNumber,
    match?.msisdn,
    match?.number,
  ]
    .filter(Boolean)
    .map(normalizeDigits)
    .filter(Boolean);

  return providerValues.some((providerValue) =>
    activationValues.some((activationValue) =>
      providerValue === activationValue || providerValue.endsWith(activationValue) || activationValue.endsWith(providerValue)
    )
  );
}

function extractNumberList(response) {
  const queue = [response, response?.data, response?.list, response?.rows, response?.records, response?.items];
  const seen = new Set();

  while (queue.length > 0) {
    const candidate = queue.shift();

    if (!candidate || seen.has(candidate)) {
      continue;
    }

    seen.add(candidate);

    if (Array.isArray(candidate)) {
      return candidate;
    }

    if (Array.isArray(candidate?.data)) {
      return candidate.data;
    }

    if (Array.isArray(candidate?.list)) {
      return candidate.list;
    }

    if (Array.isArray(candidate?.rows)) {
      return candidate.rows;
    }

    if (Array.isArray(candidate?.records)) {
      return candidate.records;
    }

    if (Array.isArray(candidate?.items)) {
      return candidate.items;
    }

    if (typeof candidate === 'object') {
      queue.push(candidate.data, candidate.list, candidate.rows, candidate.records, candidate.items);
    }
  }

  return [];
}

const OTP_SUBMIT_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

// ── Simple In-Memory Queue (replaces Bull/Redis) ───────────────────────────
const pendingJobs    = new Map(); // activationId -> poll timeoutHandle
const otpTimeoutJobs = new Map(); // activationId -> 2-min OTP deadline handle

async function processActivation(activationId) {
  const [activation] = await query(
    'SELECT * FROM activations WHERE id = ?',
    [activationId]
  );

  if (!activation) {
    logger.warn('Polling: activation not found', { activationId });
    return;
  }

  if (['success', 'invalid', 'failed', 'expired'].includes(activation.status)) {
    logger.info('Polling: activation already resolved, skipping', { activationId, status: activation.status });
    return;
  }

  if (activation.poll_attempts >= MAX_POLL_ATTEMPTS) {
    try {
      const finalResponse = await getNumberListForCountry(activation.phone_cc, 1, 200);
      const finalNumbers = extractNumberList(finalResponse);
      const finalMatch = finalNumbers.find((n) => matchesActivationNumber(n, activation));

      if (finalMatch) {
        const finalStatus = resolveExternalStatus(finalMatch);
        const finalOtp = getOtpFromMatch(finalMatch);

        if (finalOtp && !activation.otp_code) {
          await query(
            `UPDATE activations
             SET otp_code = ?, otp_uploaded_at = NOW(), status = 'otp_uploaded', updated_at = NOW()
             WHERE id = ?`,
            [String(finalOtp), activationId]
          );
        }

        if (finalStatus === EXT_STATUS.SUCCESS) {
          await handleSuccess({ ...activation, otp_code: finalOtp || activation.otp_code });
          return;
        }

        if (finalStatus === EXT_STATUS.IN_PROGRESS) {
          // Same rule: keep in_progress, show hint if latestCode present
          await scheduleNextPoll(activationId, POLL_INTERVAL_MS);
          await emitToUser(activation.user_id, 'activation:update', {
            id: activationId,
            status: 'in_progress',
            message: finalOtp
              ? `OTP hint: ${finalOtp} — please verify and submit the code.`
              : 'Waiting for OTP — enter the code when you receive it.',
            otp: finalOtp ? String(finalOtp) : undefined,
          });
          return;
        }

        if (finalStatus === EXT_STATUS.RETRY_LATER) {
          // Status 4: retry with back-off even at max attempts
          await scheduleNextPoll(activationId, POLL_INTERVAL_MS * 3);
          return;
        }

        if (finalStatus === EXT_STATUS.INVALID) {
          await markActivation(activationId, 'invalid');
          await emitToUser(activation.user_id, 'activation:update', {
            id: activationId,
            status: 'invalid',
            message: 'Invalid phone number — no payout.',
          });
          return;
        }

        if (finalStatus === EXT_STATUS.WRONG_OTP) {
          await query(
            `UPDATE activations
             SET status = 'in_progress', otp_code = NULL, otp_uploaded_at = NULL, updated_at = NOW()
             WHERE id = ?`,
            [activationId]
          );
          await scheduleNextPoll(activationId, POLL_INTERVAL_MS);
          await emitToUser(activation.user_id, 'activation:update', {
            id: activationId,
            status: 'in_progress',
            otp: null,
            message: 'Wrong OTP — please re-enter the correct code.',
          });
          return;
        }

        if (finalStatus !== null) {
          await markActivation(activationId, 'failed');
          await emitToUser(activation.user_id, 'activation:update', {
            id: activationId,
            status: 'failed',
            message: `Activation ended with provider status ${finalMatch?.registrationStatus ?? finalStatus}.`,
          });
          return;
        }

        if (finalOtp) {
          await scheduleNextPoll(activationId, POLL_INTERVAL_MS * 2);
          await emitToUser(activation.user_id, 'activation:update', {
            id: activationId,
            status: 'otp_uploaded',
            message: 'OTP received — waiting for verification...',
            otp: String(finalOtp),
          });
          return;
        }
      }
    } catch (err) {
      logger.warn('Final poll check failed before expiring activation', { activationId, error: err.message });
    }

    logger.warn('Polling: max attempts reached, marking expired', { activationId });
    await markActivation(activationId, 'expired', null);
    await emitToUser(activation.user_id, 'activation:update', {
      id: activationId,
      status: 'expired',
      message: 'Activation timed out — no response from the network',
    });
    return;
  }

  await query(
    'UPDATE activations SET poll_attempts = poll_attempts + 1, updated_at = NOW() WHERE id = ?',
    [activationId]
  );

  try {
    const response = await getNumberListForCountry(activation.phone_cc, 1, 200);
    const numbers = extractNumberList(response);

    const match = numbers.find((n) => matchesActivationNumber(n, activation));

    if (!match) {
      await scheduleNextPoll(activationId, POLL_INTERVAL_MS);
      return;
    }

    const extStatus = resolveExternalStatus(match);
    const possibleOtp = getOtpFromMatch(match);
    const hasOtp = Boolean(possibleOtp);

    await query(
      'UPDATE activations SET external_status = ?, updated_at = NOW() WHERE id = ?',
      [extStatus, activationId]
    );

    if (extStatus === EXT_STATUS.SUCCESS) {
      await handleSuccess(activation);
    } else if (extStatus === EXT_STATUS.IN_PROGRESS) {
      // Status 2: Keep in_progress. Only emit if there is a NEW hint code the
      // user hasn't seen yet — otherwise poll silently to avoid disrupting typing.
      await scheduleNextPoll(activationId, POLL_INTERVAL_MS);
      const newHint = hasOtp && String(possibleOtp) !== String(activation.otp_code || '');
      if (newHint) {
        await emitToUser(activation.user_id, 'activation:update', {
          id: activationId,
          status: 'in_progress',
          message: `OTP hint: ${possibleOtp} — please verify and submit the code.`,
          otp: String(possibleOtp),
        });
      }
      // No emit when nothing changed — UI stays stable so user can type undisturbed
    } else if (extStatus === EXT_STATUS.RETRY_LATER) {
      // Status 4: Too Many Requests — retry with back-off, do NOT remove the activation
      logger.warn('Polling: provider says retry later (status 4), backing off', { activationId });
      await scheduleNextPoll(activationId, POLL_INTERVAL_MS * 3);
    } else if (extStatus === EXT_STATUS.INVALID) {
      // Status 3: Invalid Number — mark invalid, keep record, no payout
      await markActivation(activationId, 'invalid');
      await emitToUser(activation.user_id, 'activation:update', {
        id: activationId,
        status: 'invalid',
        message: 'Invalid phone number — no payout.',
      });
      logger.info('Polling: activation marked invalid (status 3)', { activationId });
    } else if (extStatus === EXT_STATUS.WRONG_OTP) {
      // Status 6: Wrong OTP — pause polling, wait for user to submit a new OTP
      await query(
        `UPDATE activations
         SET status = 'awaiting_otp', otp_code = NULL, otp_uploaded_at = NULL, updated_at = NOW()
         WHERE id = ?`,
        [activationId]
      );
      // Do NOT schedule next poll — polling resumes only when user submits a new OTP
      await emitToUser(activation.user_id, 'activation:update', {
        id: activationId,
        status: 'awaiting_otp',
        otp: null,
        wrongOtp: true,
      });
      logger.info('Polling: wrong OTP (status 6), paused — waiting for user to re-enter OTP', { activationId });
    } else if (extStatus !== null) {
      // Unknown non-null terminal status — mark failed, keep record
      await markActivation(activationId, 'failed');
      await emitToUser(activation.user_id, 'activation:update', {
        id: activationId,
        status: 'failed',
        message: `Activation ended with provider status ${match?.registrationStatus ?? extStatus}.`,
      });
      logger.warn('Polling: unknown terminal status, marked failed', { activationId, extStatus, rawStatus: match?.registrationStatus ?? null });
    } else {
      // Status unknown / null — keep polling
      logger.warn('Unknown external status', { activationId, extStatus, rawStatus: match?.registrationStatus ?? null });
      await scheduleNextPoll(activationId, POLL_INTERVAL_MS);
      if (hasOtp) {
        await emitToUser(activation.user_id, 'activation:update', {
          id: activationId,
          status: 'otp_uploaded',
          message: 'OTP received — waiting for verification...',
          otp: String(possibleOtp),
        });
      }
    }
  } catch (err) {
    logger.error('Polling worker error', { activationId, error: err.message });
    await scheduleNextPoll(activationId, POLL_INTERVAL_MS * 2);
  }
}

// ── Handlers ───────────────────────────────────────────────────────────────

async function handleSuccess(activation) {
  const { id: activationId, user_id: userId, payout_amount, credit_tx_ref } = activation;

  if (credit_tx_ref) {
    logger.warn('Already credited, skipping duplicate', { activationId });
    return;
  }

  const txRef = `act:reward:${activationId}`;

  try {
    await credit(
      userId,
      payout_amount,
      TX_TYPES.ACTIVATION_REWARD,
      txRef,
      { activation_id: activationId },
      `OTP activation reward for ${activation.phone_full}`
    );

    await query(
      `UPDATE activations
       SET status = 'success', completed_at = NOW(), credited_at = NOW(), credit_tx_ref = ?
       WHERE id = ?`,
      [txRef, activationId]
    );

    await emitToUser(userId, 'activation:update', {
      id: activationId,
      status: 'success',
      payout: payout_amount,
      message: `Success! $${parseFloat(payout_amount).toFixed(4)} credited to your wallet`,
    });

    await emitToUser(userId, 'wallet:update', { refresh: true });
    logger.info('Activation success, wallet credited', { activationId, userId, amount: payout_amount });
  } catch (err) {
    logger.error('Failed to credit wallet for activation', { activationId, userId, error: err.message });
    await scheduleNextPoll(activationId, 5000);
  }
}

async function deleteActivationRecord(activation, message, extra = {}) {
  await query('DELETE FROM activations WHERE id = ?', [activation.id]);
  await emitToUser(activation.user_id, 'activation:update', {
    id: activation.id,
    status: 'deleted',
    message,
  });
  logger.info('Activation deleted after non-in-progress status', {
    activationId: activation.id,
    status: activation.external_status ?? null,
    ...extra,
  });
}

function buildDeletionMessage(rawStatus, finalStatus) {
  const statusLabel = rawStatus ?? finalStatus ?? 'unknown';
  if (finalStatus === EXT_STATUS.RETRY_LATER || statusLabel === EXT_STATUS.RETRY_LATER) {
    return 'Activation removed because the provider returned code 4. This number is bad and will not be taken.';
  }

  return `Activation removed because the provider returned status ${statusLabel} instead of 2 (in progress). This number is not being taken.`;
}

async function markActivation(activationId, status) {
  await query(
    `UPDATE activations SET status = ?, completed_at = NOW(), updated_at = NOW() WHERE id = ?`,
    [status, activationId]
  );
}

// ── Job Scheduling ─────────────────────────────────────────────────────────

async function scheduleNextPoll(activationId, delayMs = POLL_INTERVAL_MS) {
  if (pendingJobs.has(activationId)) {
    clearTimeout(pendingJobs.get(activationId));
  }
  const handle = setTimeout(async () => {
    pendingJobs.delete(activationId);
    try {
      await processActivation(activationId);
    } catch (err) {
      logger.error('Unhandled poll error', { activationId, error: err.message });
    }
  }, delayMs);
  pendingJobs.set(activationId, handle);
}

// ── OTP Submit Deadline (2 minutes from submission) ────────────────────────

function scheduleOtpTimeout(activationId, createdAt) {
  if (otpTimeoutJobs.has(activationId)) return; // already scheduled

  const elapsed = createdAt ? Date.now() - new Date(createdAt).getTime() : 0;
  const remaining = Math.max(0, OTP_SUBMIT_TIMEOUT_MS - elapsed);

  const handle = setTimeout(async () => {
    otpTimeoutJobs.delete(activationId);
    try {
      const [activation] = await query(
        `SELECT a.*, u.telegram_id, u.username, u.first_name
         FROM activations a
         JOIN users u ON u.id = a.user_id
         WHERE a.id = ? AND a.otp_code IS NULL AND a.status IN ('pending','in_progress','awaiting_otp')`,
        [activationId]
      );
      if (!activation) return; // already resolved or OTP was submitted

      logger.info('OTP deadline reached — deleting number from provider', { activationId });

      try {
        await deleteNumberForCountry(activation.phone_cc, activation.phone_local);
      } catch (apiErr) {
        logger.warn('External delete failed during OTP timeout', { activationId, error: apiErr.message });
      }

      // Cancel any pending poll
      if (pendingJobs.has(activationId)) {
        clearTimeout(pendingJobs.get(activationId));
        pendingJobs.delete(activationId);
      }

      await query('DELETE FROM activations WHERE id = ?', [activationId]);
      await emitToUser(activation.user_id, 'activation:update', {
        id: activationId,
        status: 'deleted',
        message: 'Number deleted — no OTP submitted within 2 minutes.',
      });

      logger.info('Activation auto-deleted after 2-minute OTP timeout', { activationId });
    } catch (err) {
      logger.error('OTP timeout handler error', { activationId, error: err.message });
    }
  }, remaining);

  otpTimeoutJobs.set(activationId, handle);
  logger.info(`OTP deadline scheduled in ${Math.round(remaining / 1000)}s`, { activationId });
}

function cancelOtpTimeout(activationId) {
  if (otpTimeoutJobs.has(activationId)) {
    clearTimeout(otpTimeoutJobs.get(activationId));
    otpTimeoutJobs.delete(activationId);
    logger.info('OTP deadline cancelled (OTP submitted)', { activationId });
  }
}

async function startPollingForActivation(activationId, createdAt) {
  await scheduleNextPoll(activationId, POLL_INTERVAL_MS);
  scheduleOtpTimeout(activationId, createdAt || new Date());
  logger.info('Polling started for activation', { activationId });
}

// Resume polling for all active activations after a server restart
async function resumePollingOnStartup() {
  try {
    const activeActivations = await query(
      `SELECT id, status, created_at FROM activations WHERE status IN ('pending', 'in_progress', 'otp_uploaded', 'awaiting_otp')`
    );
    if (!activeActivations.length) {
      logger.info('No active activations to resume on startup');
      return;
    }
    for (const row of activeActivations) {
      // Stagger restarts so they don't all fire at once
      const jitter = Math.floor(Math.random() * 5000);
      if (['pending', 'in_progress', 'otp_uploaded'].includes(row.status)) {
        await scheduleNextPoll(row.id, POLL_INTERVAL_MS + jitter);
      }
      // Re-arm the 2-minute OTP deadline for activations that haven't submitted an OTP yet
      if (['pending', 'in_progress', 'awaiting_otp'].includes(row.status)) {
        scheduleOtpTimeout(row.id, row.created_at);
      }
    }
    logger.info(`Resumed polling for ${activeActivations.length} active activation(s) after startup`);
  } catch (err) {
    logger.error('Failed to resume polling on startup', { error: err.message });
  }
}

// ── Standalone Worker Entry ────────────────────────────────────────────────
if (require.main === module) {
  require('dotenv').config();
  const { connectDB } = require('../config/database');
  const { connectRedis } = require('../config/redis');

  (async () => {
    await connectDB();
    await connectRedis();
    logger.info(`🔧 Polling worker started | concurrency=${POLL_CONCURRENCY} | interval=${POLL_INTERVAL_MS}ms`);
  })();
}

module.exports = { startPollingForActivation, scheduleNextPoll, resumePollingOnStartup, cancelOtpTimeout };
