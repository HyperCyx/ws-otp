const { parsePhone, isSupportedCountry } = require('../services/phoneParser');
const { addNumber, uploadOtpForCountry, deleteNumberForCountry, getCountryCreds } = require('../services/externalApi');
const { startPollingForActivation, scheduleNextPoll, cancelOtpTimeout } = require('../workers/pollingWorker');
const { query, withTransaction } = require('../config/database');
const logger = require('../utils/logger');

async function createActivation(req, res, next) {
  const { phone } = req.body;
  const userId = req.user.id;

  try {
    const parsed = parsePhone(phone);
    if (!parsed.valid) {
      return res.status(400).json({ success: false, message: `Invalid phone number: ${parsed.error}` });
    }

    const { cc, localNumber, phoneFull } = parsed;

    const countries = await query(
      'SELECT id, payout_amount FROM country_prices WHERE cc = ? AND is_active = 1',
      [cc]
    );

    if (!countries.length) {
      return res.status(400).json({
        success: false,
        message: `Country code +${cc} is not supported. Check available countries.`,
      });
    }

    const countryPrice = countries[0];

    // Reject if no API credentials configured for this country
    const creds = await getCountryCreds(cc);
    if (!creds) {
      return res.status(503).json({
        success: false,
        message: `+${cc} is not ready — no API credentials configured. Contact the admin.`,
      });
    }

    const [existingActive] = await query(
      `SELECT id FROM activations
       WHERE user_id = $1 AND phone_full = $2 AND status IN ('pending','in_progress','otp_uploaded')`,
      [userId, phoneFull]
    );

    if (existingActive) {
      return res.status(409).json({
        success: false,
        message: 'You already have an active activation for this number',
        activationId: existingActive.id,
      });
    }

    // ── Cooldown check: reject if this number failed within the last 3 minutes ──
    const COOLDOWN_MS = 3 * 60 * 1000;
    const [cooldown] = await query(
      `SELECT failed_at, fail_reason FROM number_cooldowns
       WHERE user_id = $1 AND phone_full = $2
         AND failed_at > NOW() - INTERVAL '3 minutes'`,
      [userId, phoneFull]
    );
    if (cooldown) {
      const failedAt = new Date(cooldown.failed_at).getTime();
      const remainingMs = Math.max(0, COOLDOWN_MS - (Date.now() - failedAt));
      const remainingSec = Math.ceil(remainingMs / 1000);
      return res.status(429).json({
        success: false,
        message: `This number is temporarily blocked. Please wait ${Math.ceil(remainingSec / 60)} minute(s) before trying again.`,
        cooldown: true,
        cooldown_remaining_seconds: remainingSec,
      });
    }

    let apiResponse;
    try {
      apiResponse = await addNumber(cc, localNumber);
    } catch (apiErr) {
      logger.warn('External addNumber API returned an error, but activation will still be tracked', {
        phone: phoneFull,
        error: apiErr.message,
        status: apiErr.response?.status,
      });

      apiResponse = {
        degraded: true,
        error: apiErr.message,
        status: apiErr.response?.status || null,
      };
    }

    const apiAddMeta = {
      requested: true,
      source: 'addNum',
      degraded: Boolean(apiResponse?.degraded),
    };

    const insertResult = await query(
      `INSERT INTO activations
         (user_id, phone_full, phone_cc, phone_local, country_price_id, payout_amount, status, api_add_response)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
       RETURNING id`,
      [
        userId,
        phoneFull,
        cc,
        localNumber,
        countryPrice.id,
        countryPrice.payout_amount,
        JSON.stringify(apiAddMeta),
      ]
    );

    const activationId = insertResult[0].id;

    await startPollingForActivation(activationId, new Date());

    logger.info('Activation created', { userId, activationId, phone: phoneFull });

    res.status(201).json({
      success: true,
      data: {
        id: activationId,
        phone: phoneFull,
        cc,
        status: 'pending',
        payout: parseFloat(countryPrice.payout_amount).toFixed(4),
        message: 'Number submitted. Waiting for `registrationStatus` from the network...',
      },
    });
  } catch (err) {
    next(err);
  }
}

async function listActivations(req, res, next) {
  const userId = req.user.id;
  const page = Math.max(1, parseInt(req.query.page || '1'));
  const limit = Math.min(50, parseInt(req.query.limit || '20'));
  const offset = (page - 1) * limit;

  try {
    const rows = await query(
      `SELECT a.*, cp.country_name, cp.flag_emoji, cp.iso_code
       FROM activations a
       LEFT JOIN country_prices cp ON cp.id = a.country_price_id
       WHERE a.user_id = $1
       ORDER BY a.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const [countRow] = await query(
      'SELECT COUNT(*) as total FROM activations WHERE user_id = $1',
      [userId]
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total: countRow.total,
        pages: Math.ceil(countRow.total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getActivation(req, res, next) {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const [activation] = await query(
      `SELECT a.*, cp.country_name, cp.flag_emoji, cp.iso_code
       FROM activations a
       LEFT JOIN country_prices cp ON cp.id = a.country_price_id
       WHERE a.id = $1 AND a.user_id = $2`,
      [id, userId]
    );

    if (!activation) {
      return res.status(404).json({ success: false, message: 'Activation not found' });
    }

    res.json({ success: true, data: activation });
  } catch (err) {
    next(err);
  }
}

async function submitOtp(req, res, next) {
  const userId = req.user.id;
  const { id } = req.params;
  const { otp } = req.body;

  try {
    // Bug-fix: use withTransaction so SELECT FOR UPDATE actually holds the lock
    // for the duration of the check+update, preventing duplicate OTP submissions.
    let activation;
    await withTransaction(async (conn) => {
      const [rows] = await conn.execute(
        `SELECT * FROM activations WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [id, userId]
      );
      activation = Array.isArray(rows) ? rows[0] : rows;

      if (!activation) return; // handled after transaction

      // OTP can only be submitted when registrationStatus = 2 (IN_PROGRESS)
      if (activation.status !== 'in_progress') return; // handled after transaction
      if (activation.otp_code) return;                  // handled after transaction

      await conn.execute(
        `UPDATE activations
         SET otp_code = $1, otp_uploaded_at = NOW(), status = 'otp_uploaded', updated_at = NOW()
         WHERE id = $2`,
        [otp, id]
      );
    });

    if (!activation) {
      return res.status(404).json({ success: false, message: 'Activation not found' });
    }

    if (activation.status !== 'in_progress') {
      return res.status(409).json({
        success: false,
        message: activation.status === 'pending'
          ? 'OTP cannot be submitted yet — waiting for the provider to confirm the number (status must be IN_PROGRESS).'
          : `Cannot submit OTP — activation is ${activation.status}`,
      });
    }

    if (activation.otp_code) {
      return res.status(409).json({
        success: false,
        message: 'OTP already submitted for this activation',
      });
    }

    // Upload to external provider
    try {
      await uploadOtpForCountry(activation.phone_cc, activation.phone_local, otp);
    } catch (apiErr) {
      // Rollback the DB update by resetting status back to in_progress
      await query(
        `UPDATE activations SET otp_code = NULL, status = 'in_progress', updated_at = NOW() WHERE id = $1`,
        [id]
      );
      logger.error('OTP upload API failed', { activationId: id, error: apiErr.message });
      return res.status(502).json({
        success: false,
        message: 'Failed to submit OTP to the provider. Please try again.',
      });
    }

    // OTP submitted — cancel the 2-minute deletion deadline
    cancelOtpTimeout(Number(id));

    // Check result 5 seconds after OTP submit
    await scheduleNextPoll(Number(id), 5000);

    logger.info('OTP submitted', { activationId: id, userId });

    res.json({
      success: true,
      message: 'OTP submitted. Verifying with the provider...',
      data: { activationId: id, status: 'otp_uploaded' },
    });
  } catch (err) {
    next(err);
  }
}

async function cancelActivation(req, res, next) {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const [activation] = await query(
      `SELECT * FROM activations WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (!activation) {
      return res.status(404).json({ success: false, message: 'Activation not found' });
    }

    if (['success', 'failed', 'invalid', 'expired', 'deleted'].includes(activation.status)) {
      return res.status(409).json({
        success: false,
        message: `Cannot cancel — activation is already ${activation.status}`,
      });
    }

    // Cancel the 2-minute OTP deadline timer
    cancelOtpTimeout(Number(id));

    // Delete from DB immediately — don't wait for the external API
    await query('DELETE FROM activations WHERE id = $1', [id]);

    // Fire-and-forget external API delete (retries happen in background, don't block the user)
    deleteNumberForCountry(activation.phone_cc, activation.phone_local)
      .then(() => logger.info('Number deleted from external API on user cancel', { activationId: id }))
      .catch((apiErr) => logger.warn('External delete failed during user cancel', {
        activationId: id,
        error: apiErr.message,
      }));

    logger.info('Activation cancelled by user', { activationId: id, userId });
    res.json({ success: true, message: 'Activation cancelled and number removed.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { createActivation, listActivations, getActivation, submitOtp, cancelActivation };
