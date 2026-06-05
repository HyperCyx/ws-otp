const { v4: uuidv4 } = require('uuid');
const { credit, debit, finalizeWithdrawal, TX_TYPES } = require('../services/walletService');
const { del: redisDel } = require('../config/redis');
const { query } = require('../config/database');
const { logAdminAction } = require('../utils/adminLogger');
const logger = require('../utils/logger');
const { clearCountryToken, getTokenForCountry, startCountryTokenRefresher, stopCountryTokenRefresher, deleteNumberForCountry } = require('../services/externalApi');

async function getDashboardStats(req, res, next) {
  try {
    const [userStats] = await query(`
      SELECT
        COUNT(*) as total_users,
        SUM(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 ELSE 0 END) as new_today
      FROM users WHERE is_admin = 0`);

    const [activationStats] = await query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'invalid' THEN 1 ELSE 0 END) as invalid,
        SUM(CASE WHEN status IN ('pending','in_progress','otp_uploaded') THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'success' THEN payout_amount ELSE 0 END) as total_payouts,
        SUM(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 ELSE 0 END) as today_count
      FROM activations`);

    const [walletStats] = await query(`
      SELECT
        SUM(balance)         as total_balance,
        SUM(locked_balance)  as total_locked,
        SUM(total_earned)    as total_earned,
        SUM(total_withdrawn) as total_withdrawn
      FROM wallets`);

    const [pendingWithdrawals] = await query(`
      SELECT COUNT(*) as count, SUM(amount) as total
      FROM withdrawals WHERE status = 'pending'`);

    // ── Today's payouts ────────────────────────────────────────────────────
    const [todayPayouts] = await query(`
      SELECT
        COALESCE(SUM(payout_amount), 0) as amount,
        COUNT(*) as count
      FROM activations
      WHERE status = 'success'
        AND DATE(created_at) = CURRENT_DATE`);

    // ── Top 10 countries by total activations ──────────────────────────────
    const topCountries = await query(`
      SELECT
        cp.country_name,
        cp.flag_emoji,
        cp.cc,
        COUNT(a.id)                                                    AS total,
        SUM(CASE WHEN a.status = 'success' THEN 1 ELSE 0 END)         AS success,
        COALESCE(SUM(CASE WHEN a.status = 'success' THEN a.payout_amount ELSE 0 END), 0) AS payout
      FROM activations a
      JOIN country_prices cp ON cp.id = a.country_price_id
      GROUP BY cp.country_name, cp.flag_emoji, cp.cc
      ORDER BY total DESC
      LIMIT 10`);

    res.json({
      success: true,
      data: {
        users: userStats,
        activations: activationStats,
        wallet: walletStats,
        pending_withdrawals: pendingWithdrawals,
        today_payouts: todayPayouts,
        top_countries: topCountries,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getRevenueChart(req, res, next) {
  const days = Math.min(30, parseInt(req.query.days || '7'));
  try {
    const rows = await query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as activations,
        SUM(CASE WHEN status = 'success' THEN payout_amount ELSE 0 END) as revenue,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful
      FROM activations
      WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function listUsers(req, res, next) {
  const page = Math.max(1, parseInt(req.query.page || '1'));
  const limit = Math.min(100, parseInt(req.query.limit || '25'));
  const offset = (page - 1) * limit;
  const search = req.query.search || '';

  try {
    const likeParam = `%${search}%`;
    const rows = await query(
      `SELECT u.*, w.balance, w.total_earned, w.total_withdrawn,
              (SELECT COUNT(*) FROM activations WHERE user_id = u.id) as activation_count
       FROM users u
       LEFT JOIN wallets w ON w.user_id = u.id
       WHERE u.is_admin = 0
         AND (? = '' OR u.username ILIKE ? OR u.first_name ILIKE ? OR CAST(u.telegram_id AS TEXT) ILIKE ?)
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
      [search, likeParam, likeParam, likeParam, limit, offset]
    );

    const [countRow] = await query(
      `SELECT COUNT(*) as total FROM users WHERE is_admin = 0
       AND (? = '' OR username ILIKE ? OR first_name ILIKE ? OR CAST(telegram_id AS TEXT) ILIKE ?)`,
      [search, likeParam, likeParam, likeParam]
    );

    res.json({ success: true, data: rows, pagination: { page, limit, total: countRow.total, pages: Math.ceil(countRow.total / limit) } });
  } catch (err) {
    next(err);
  }
}

async function getUser(req, res, next) {
  const { id } = req.params;
  try {
    const [user] = await query(
      `SELECT u.*, w.balance, w.total_earned, w.total_withdrawn, w.locked_balance
       FROM users u LEFT JOIN wallets w ON w.user_id = u.id WHERE u.id = ?`,
      [id]
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // ── Aggregate activation stats ─────────────────────────────────────────
    const [activationStats] = await query(
      `SELECT
         COUNT(*)                                                            AS total,
         SUM(CASE WHEN status = 'success'                   THEN 1 ELSE 0 END) AS success,
         SUM(CASE WHEN status = 'failed'                    THEN 1 ELSE 0 END) AS failed,
         SUM(CASE WHEN status = 'expired'                   THEN 1 ELSE 0 END) AS expired,
         SUM(CASE WHEN status IN ('pending','in_progress','otp_uploaded') THEN 1 ELSE 0 END) AS active,
         COALESCE(SUM(CASE WHEN status = 'success' THEN payout_amount ELSE 0 END), 0) AS total_earned_activations,
         SUM(CASE WHEN DATE(created_at) = CURRENT_DATE     THEN 1 ELSE 0 END) AS today_count
       FROM activations WHERE user_id = ?`,
      [id]
    );

    // ── Country breakdown (top 10 countries this user submitted numbers from)
    const countryBreakdown = await query(
      `SELECT
         cp.country_name,
         cp.flag_emoji,
         cp.cc,
         COUNT(a.id)                                                          AS total,
         SUM(CASE WHEN a.status = 'success' THEN 1 ELSE 0 END)               AS success,
         COALESCE(SUM(CASE WHEN a.status = 'success' THEN a.payout_amount ELSE 0 END), 0) AS payout
       FROM activations a
       JOIN country_prices cp ON cp.id = a.country_price_id
       WHERE a.user_id = ?
       GROUP BY cp.country_name, cp.flag_emoji, cp.cc
       ORDER BY total DESC
       LIMIT 10`,
      [id]
    );

    // ── Recent activations (last 15, with country info) ────────────────────
    const recentActivations = await query(
      `SELECT a.id, a.phone_full, a.status, a.payout_amount, a.created_at,
              cp.country_name, cp.flag_emoji
       FROM activations a
       LEFT JOIN country_prices cp ON cp.id = a.country_price_id
       WHERE a.user_id = ?
       ORDER BY a.created_at DESC LIMIT 15`,
      [id]
    );

    // ── Recent withdrawals (last 10) ───────────────────────────────────────
    const recentWithdrawals = await query(
      `SELECT id, amount, method, address, status, created_at, admin_note
       FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`,
      [id]
    );

    // ── Withdrawal aggregate ───────────────────────────────────────────────
    const [withdrawalStats] = await query(
      `SELECT
         COUNT(*)                                                            AS total,
         SUM(CASE WHEN status = 'approved'  THEN 1 ELSE 0 END)              AS approved,
         SUM(CASE WHEN status = 'pending'   THEN 1 ELSE 0 END)              AS pending,
         SUM(CASE WHEN status = 'rejected'  THEN 1 ELSE 0 END)              AS rejected,
         COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) AS total_withdrawn_amount
       FROM withdrawals WHERE user_id = ?`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...user,
        activation_stats: activationStats,
        country_breakdown: countryBreakdown,
        withdrawal_stats: withdrawalStats,
        recentActivations,
        recentWithdrawals,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function toggleBan(req, res, next) {
  const adminId = req.user.id;
  const { id } = req.params;
  const { ban, reason } = req.body;

  try {
    const [user] = await query('SELECT id, is_banned FROM users WHERE id = ? AND is_admin = 0', [id]);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const newBanState = ban ? 1 : 0;
    await query(
      `UPDATE users SET is_banned = ?, ban_reason = ?, updated_at = NOW() WHERE id = ?`,
      [newBanState, reason || null, id]
    );

    await logAdminAction(adminId, ban ? 'ban_user' : 'unban_user', 'user', id, { reason }, req.ip);
    res.json({ success: true, message: ban ? 'User banned' : 'User unbanned' });
  } catch (err) {
    next(err);
  }
}

async function adjustBalance(req, res, next) {
  const adminId = req.user.id;
  const { userId } = req.params;
  const { amount, note } = req.body;
  const amountF = parseFloat(amount);

  try {
    const [user] = await query('SELECT id FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const ref = `admin:adj:${adminId}:${uuidv4()}`;
    const type = TX_TYPES.ADMIN_ADJUSTMENT;

    if (amountF > 0) {
      await credit(userId, Math.abs(amountF), type, ref, { admin_id: adminId }, note);
    } else {
      await debit(userId, Math.abs(amountF), type, ref, { admin_id: adminId }, note);
    }

    await logAdminAction(adminId, 'adjust_balance', 'user', userId, { amount: amountF, note }, req.ip);
    res.json({ success: true, message: `Balance adjusted by $${amountF.toFixed(4)}` });
  } catch (err) {
    next(err);
  }
}

async function listActivations(req, res, next) {
  const page = Math.max(1, parseInt(req.query.page || '1'));
  const limit = Math.min(100, parseInt(req.query.limit || '25'));
  const offset = (page - 1) * limit;
  const status = req.query.status || null;

  try {
    let sql = `SELECT a.*, u.username, u.first_name, cp.country_name, cp.flag_emoji
               FROM activations a
               JOIN users u ON u.id = a.user_id
               LEFT JOIN country_prices cp ON cp.id = a.country_price_id
               WHERE 1=1`;
    const params = [];

    if (status) { sql += ' AND a.status = ?'; params.push(status); }
    sql += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = await query(sql, params);
    const [countRow] = await query(
      `SELECT COUNT(*) as total FROM activations${status ? ' WHERE status = ?' : ''}`,
      status ? [status] : []
    );

    res.json({ success: true, data: rows, pagination: { page, limit, total: countRow.total, pages: Math.ceil(countRow.total / limit) } });
  } catch (err) {
    next(err);
  }
}

async function getActivation(req, res, next) {
  try {
    const [row] = await query(
      `SELECT a.*, u.username, u.first_name, cp.country_name, cp.flag_emoji
       FROM activations a
       JOIN users u ON u.id = a.user_id
       LEFT JOIN country_prices cp ON cp.id = a.country_price_id
       WHERE a.id = ?`,
      [req.params.id]
    );
    if (!row) return res.status(404).json({ success: false, message: 'Activation not found' });
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
}

async function deleteActivation(req, res, next) {
  const adminId = req.user.id;
  const activationId = parseInt(req.params.id, 10);

  if (!Number.isInteger(activationId) || activationId < 1) {
    return res.status(400).json({ success: false, message: 'Invalid activation ID' });
  }

  try {
    const [row] = await query(
      `SELECT id, user_id, phone_full, phone_cc, phone_local, status
       FROM activations WHERE id = ?`,
      [activationId]
    );

    if (!row) {
      return res.status(404).json({ success: false, message: 'Activation not found' });
    }

    if (['success', 'otp_uploaded'].includes(row.status)) {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete an activation that has already been processed',
      });
    }

    // Delete from external API for any non-terminal status
    if (!['failed', 'invalid', 'expired'].includes(row.status)) {
      try {
        await deleteNumberForCountry(row.phone_cc, row.phone_local);
        logger.info('Number deleted from external API by admin', { activationId, phone: row.phone_full });
      } catch (apiErr) {
        logger.warn('External delete failed during admin delete (continuing anyway)', {
          activationId,
          error: apiErr.message,
        });
      }
    }

    await query('DELETE FROM activations WHERE id = ?', [activationId]);

    // Notify the user's live session
    const { emitToUser } = require('../services/socketService');
    await emitToUser(row.user_id, 'activation:update', {
      id: activationId,
      status: 'deleted',
      message: 'Your activation was removed by the admin.',
    });

    await logAdminAction(adminId, 'delete_activation', 'activation', activationId, {
      phone_full: row.phone_full,
      phone_cc: row.phone_cc,
      phone_local: row.phone_local,
      status: row.status,
    }, req.ip);

    res.json({ success: true, message: `Activation #${activationId} deleted` });
  } catch (err) {
    next(err);
  }
}

async function getWithdrawalStats(req, res, next) {
  try {
    const { date } = req.query;

    // Today's approved withdrawals
    const [todayStats] = await query(`
      SELECT
        COALESCE(SUM(amount), 0) AS amount,
        COUNT(*) AS count
      FROM withdrawals
      WHERE status = 'approved'
        AND DATE(updated_at) = CURRENT_DATE`);

    // All-time approved withdrawals
    const [totalStats] = await query(`
      SELECT
        COALESCE(SUM(amount), 0) AS amount,
        COUNT(*) AS count
      FROM withdrawals
      WHERE status = 'approved'`);

    // Yesterday's approved withdrawals
    const [yesterdayStats] = await query(`
      SELECT
        COALESCE(SUM(amount), 0) AS amount,
        COUNT(*) AS count
      FROM withdrawals
      WHERE status = 'approved'
        AND DATE(updated_at) = CURRENT_DATE - INTERVAL '1 day'`);

    // Last 7 days approved withdrawals
    const [sevenDayStats] = await query(`
      SELECT
        COALESCE(SUM(amount), 0) AS amount,
        COUNT(*) AS count
      FROM withdrawals
      WHERE status = 'approved'
        AND updated_at >= CURRENT_DATE - INTERVAL '7 days'`);

    // Custom date stats (optional)
    let customStats = null;
    if (date && typeof date === 'string' && date.trim().length > 0) {
      const [customRow] = await query(`
        SELECT
          COALESCE(SUM(amount), 0) AS amount,
          COUNT(*) AS count
        FROM withdrawals
        WHERE status = 'approved'
          AND DATE(updated_at) = ?`, [date.trim()]);
      customStats = {
        date: date.trim(),
        amount: customRow.amount,
        count: customRow.count,
      };
    }

    res.json({
      success: true,
      data: {
        today:      todayStats,
        total:      totalStats,
        yesterday:  yesterdayStats,
        seven_days: sevenDayStats,
        custom:     customStats,
      },
    });
  } catch (err) {
    next(err);
  }
}


async function listWithdrawals(req, res, next) {
  const page = Math.max(1, parseInt(req.query.page || '1'));
  const limit = Math.min(100, parseInt(req.query.limit || '25'));
  const offset = (page - 1) * limit;
  const status = req.query.status || 'pending';

  try {
    const rows = await query(
      `SELECT w.*, u.username, u.first_name, u.telegram_id
       FROM withdrawals w
       JOIN users u ON u.id = w.user_id
       WHERE w.status = ?
       ORDER BY w.created_at ASC
       LIMIT ? OFFSET ?`,
      [status, limit, offset]
    );

    const [countRow] = await query(
      'SELECT COUNT(*) as total FROM withdrawals WHERE status = ?',
      [status]
    );

    res.json({ success: true, data: rows, pagination: { page, limit, total: countRow.total } });
  } catch (err) {
    next(err);
  }
}

async function reviewWithdrawal(req, res, next) {
  const adminId = req.user.id;
  const { id } = req.params;
  const { action, admin_note } = req.body;
  const approved = action === 'approve';

  try {
    const [wd] = await query(
      `SELECT * FROM withdrawals WHERE id = ? AND status = 'pending'`,
      [id]
    );
    if (!wd) return res.status(404).json({ success: false, message: 'Pending withdrawal not found' });

    await finalizeWithdrawal(wd.user_id, wd.amount, wd.lock_tx_ref, approved);

    await query(
      `UPDATE withdrawals
       SET status = ?, admin_note = ?, reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [approved ? 'approved' : 'rejected', admin_note || null, adminId, id]
    );

    await logAdminAction(
      adminId,
      approved ? 'approve_withdrawal' : 'reject_withdrawal',
      'withdrawal', id,
      { amount: wd.amount, method: wd.method, note: admin_note },
      req.ip
    );

    res.json({ success: true, message: `Withdrawal ${action}d successfully` });
  } catch (err) {
    next(err);
  }
}

async function listPrices(req, res, next) {
  try {
    const rows = await query(
      `SELECT * FROM country_prices ORDER BY country_name ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function updatePrice(req, res, next) {
  const adminId = req.user.id;
  const { cc } = req.params;
  const { payout_amount, is_active } = req.body;

  try {
    const updates = [];
    const params = [];

    if (payout_amount !== undefined) { updates.push('payout_amount = ?'); params.push(payout_amount); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }

    if (!updates.length) return res.status(400).json({ success: false, message: 'Nothing to update' });

    params.push(cc);
    await query(`UPDATE country_prices SET ${updates.join(', ')}, updated_at = NOW() WHERE cc = ?`, params);

    await redisDel('countries:active');

    await logAdminAction(adminId, 'update_price', 'country_price', null, { cc, payout_amount, is_active }, req.ip);
    res.json({ success: true, message: 'Price updated' });
  } catch (err) {
    next(err);
  }
}

async function getCountryCredentials(req, res, next) {
  try {
    const rows = await query(
      `SELECT cp.cc, cp.country_name, cp.flag_emoji, cp.iso_code,
              cp.api_account, cp.api_identity,
              CASE WHEN cp.api_password IS NOT NULL THEN true ELSE false END AS has_password,
              ctc.expires_at AS token_expires_at,
              CASE
                WHEN ctc.expires_at IS NOT NULL AND ctc.expires_at > NOW() THEN 'active'
                ELSE 'none'
              END AS token_status
       FROM country_prices cp
       LEFT JOIN country_token_cache ctc ON ctc.cc = cp.cc
       ORDER BY cp.country_name ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function updateCountryCredentials(req, res, next) {
  const adminId = req.user.id;
  const { cc } = req.params;
  const { api_account, api_password, api_identity } = req.body;

  if (!api_account) {
    return res.status(400).json({ success: false, message: 'api_account is required' });
  }

  try {
    const [country] = await query(
      `SELECT cc, api_password AS existing_password FROM country_prices WHERE cc = ?`,
      [cc]
    );
    if (!country) return res.status(404).json({ success: false, message: `Country cc=${cc} not found` });

    const passwordToSave = (api_password && api_password.trim())
      ? api_password.trim()
      : country.existing_password;

    if (!passwordToSave) {
      return res.status(400).json({ success: false, message: 'api_password is required (no existing password to keep)' });
    }

    await query(
      `UPDATE country_prices
       SET api_account = ?, api_password = ?, api_identity = ?, updated_at = NOW()
       WHERE cc = ?`,
      [api_account.trim(), passwordToSave, api_identity || 'Member', cc]
    );

    await clearCountryToken(cc);

    try {
      await startCountryTokenRefresher(cc, api_account.trim(), passwordToSave, api_identity || 'Member');
    } catch (loginErr) {
      await logAdminAction(adminId, 'update_country_credentials', 'country_price', null, { cc, api_account, login_ok: false }, req.ip);
      return res.json({ success: true, warning: true, message: `Credentials saved for +${cc} but login failed: ${loginErr.message}` });
    }

    await logAdminAction(adminId, 'update_country_credentials', 'country_price', null, { cc, api_account, api_identity }, req.ip);
    res.json({ success: true, message: `Credentials updated for +${cc}. Token generated and auto-refresh scheduled.` });
  } catch (err) {
    next(err);
  }
}

async function removeCountryCredentials(req, res, next) {
  const adminId = req.user.id;
  const { cc } = req.params;

  try {
    await query(
      `UPDATE country_prices SET api_account = NULL, api_password = NULL, api_identity = 'Member', updated_at = NOW() WHERE cc = ?`,
      [cc]
    );
    stopCountryTokenRefresher(cc);
    await clearCountryToken(cc);
    await logAdminAction(adminId, 'remove_country_credentials', 'country_price', null, { cc }, req.ip);
    res.json({ success: true, message: `Credentials removed for +${cc}. Auto-refresh stopped. Country will be unavailable until new credentials are set.` });
  } catch (err) {
    next(err);
  }
}

async function addCountry(req, res, next) {
  const adminId = req.user.id;
  const { cc, country_name, iso_code, flag_emoji, payout_amount, api_account, api_password, api_identity } = req.body;

  try {
    const [existing] = await query('SELECT cc FROM country_prices WHERE cc = ?', [cc.trim()]);
    if (existing) {
      return res.status(409).json({ success: false, message: `Country +${cc} already exists` });
    }

    await query(
      `INSERT INTO country_prices (cc, country_name, iso_code, flag_emoji, payout_amount, is_active, api_account, api_password, api_identity)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [
        cc.trim(), country_name.trim(), iso_code.trim().toUpperCase(),
        flag_emoji || null, parseFloat(payout_amount) || 0,
        api_account.trim(), api_password.trim(), api_identity || 'Member',
      ]
    );

    await redisDel('countries:active');

    // Start the scheduled token refresher (logs in immediately + schedules proactive renewal)
    try {
      await startCountryTokenRefresher(cc.trim(), api_account.trim(), api_password.trim(), api_identity || 'Member');
    } catch (loginErr) {
      logger.warn(`Country +${cc} added but initial login failed — credentials may be wrong`, { error: loginErr.message });
      await logAdminAction(adminId, 'add_country', 'country_price', null, { cc, country_name, api_account, login_ok: false }, req.ip);
      return res.status(201).json({
        success: true,
        warning: true,
        message: `Country +${cc} added but initial login failed. Check credentials. Error: ${loginErr.message}`,
      });
    }

    await logAdminAction(adminId, 'add_country', 'country_price', null, { cc, country_name, api_account, login_ok: true }, req.ip);
    res.status(201).json({ success: true, message: `Country +${cc} (${country_name}) added, token generated and auto-refresh scheduled.` });
  } catch (err) {
    next(err);
  }
}

async function deleteCountry(req, res, next) {
  const adminId = req.user.id;
  const { cc } = req.params;

  try {
    const [country] = await query('SELECT cc, country_name FROM country_prices WHERE cc = ?', [cc]);
    if (!country) return res.status(404).json({ success: false, message: `Country +${cc} not found` });

    const [activeRow] = await query(
      `SELECT COUNT(*) as cnt FROM activations WHERE phone_cc = ? AND status IN ('pending', 'in_progress', 'otp_uploaded')`,
      [cc]
    );
    if (parseInt(activeRow.cnt) > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete — ${activeRow.cnt} active activation(s) still using this country`,
      });
    }

    stopCountryTokenRefresher(cc);
    await clearCountryToken(cc);
    await query('DELETE FROM country_prices WHERE cc = ?', [cc]);
    await redisDel('countries:active');

    await logAdminAction(adminId, 'delete_country', 'country_price', null, { cc, country_name: country.country_name }, req.ip);
    res.json({ success: true, message: `Country +${cc} (${country.country_name}) deleted.` });
  } catch (err) {
    next(err);
  }
}

async function getApiLogs(req, res, next) {
  const page = Math.max(1, parseInt(req.query.page || '1'));
  const limit = Math.min(100, parseInt(req.query.limit || '50'));
  const offset = (page - 1) * limit;

  try {
    const rows = await query(
      `SELECT * FROM api_logs ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    const [countRow] = await query('SELECT COUNT(*) as total FROM api_logs');
    res.json({ success: true, data: rows, pagination: { page, limit, total: countRow.total } });
  } catch (err) {
    next(err);
  }
}

async function getAdminLogs(req, res, next) {
  const page = Math.max(1, parseInt(req.query.page || '1'));
  const limit = Math.min(100, parseInt(req.query.limit || '50'));
  const offset = (page - 1) * limit;

  try {
    const rows = await query(
      `SELECT al.*, u.username, u.first_name
       FROM admin_logs al
       JOIN users u ON u.id = al.admin_id
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    const [countRow] = await query('SELECT COUNT(*) as total FROM admin_logs');
    res.json({ success: true, data: rows, pagination: { page, limit, total: countRow.total } });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDashboardStats, getRevenueChart, getWithdrawalStats,
  listUsers, getUser, toggleBan, adjustBalance,
  listActivations, getActivation, deleteActivation, bulkDeleteActivations,
  listWithdrawals, reviewWithdrawal,
  listPrices, updatePrice,
  getCountryCredentials, updateCountryCredentials, removeCountryCredentials,
  addCountry, deleteCountry,
  getApiLogs, getAdminLogs, clearApiLogs, clearAdminLogs,
  listPaymentMethods, togglePaymentMethod,
  getSettings, updateSetting, sendBroadcast,
};

async function bulkDeleteActivations(req, res, next) {
  const adminId = req.user.id;
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, message: 'ids must be a non-empty array' });
  }

  // Validate all entries are positive integers
  const parsed = ids.map((id) => parseInt(id, 10));
  if (parsed.some((id) => !Number.isInteger(id) || id < 1)) {
    return res.status(400).json({ success: false, message: 'All ids must be positive integers' });
  }

  // Deduplicate
  const uniqueIds = [...new Set(parsed)];

  try {
    // Fetch all requested activations in one query
    const placeholders = uniqueIds.map(() => '?').join(',');
    const rows = await query(
      `SELECT id, user_id, phone_full, phone_cc, phone_local, status FROM activations WHERE id IN (${placeholders})`,
      uniqueIds
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No activations found for the given ids' });
    }

    // Separate processed (skip) vs deletable
    const skipped = rows.filter((r) => ['success', 'otp_uploaded'].includes(r.status));
    const deletable = rows.filter((r) => !['success', 'otp_uploaded'].includes(r.status));

    if (deletable.length === 0) {
      return res.status(409).json({
        success: false,
        message: `All selected activations have already been processed (${skipped.length} skipped). Cannot delete.`,
      });
    }

    // Call external API delete for non-terminal active statuses
    const activeStatuses = ['pending', 'in_progress'];
    await Promise.allSettled(
      deletable
        .filter((r) => activeStatuses.includes(r.status))
        .map(async (r) => {
          try {
            await deleteNumberForCountry(r.phone_cc, r.phone_local);
          } catch (apiErr) {
            logger.warn('External delete failed during bulk admin delete (continuing)', {
              activationId: r.id,
              error: apiErr.message,
            });
          }
        })
    );

    const deletableIds = deletable.map((r) => r.id);
    const delPlaceholders = deletableIds.map(() => '?').join(',');
    await query(`DELETE FROM activations WHERE id IN (${delPlaceholders})`, deletableIds);

    // Notify each affected user's live session
    const { emitToUser } = require('../services/socketService');
    await Promise.allSettled(
      deletable.map((r) =>
        emitToUser(r.user_id, 'activation:update', {
          id: r.id,
          status: 'deleted',
          message: 'Your activation was removed by the admin.',
        })
      )
    );

    await logAdminAction(adminId, 'bulk_delete_activations', 'activation', null, {
      requested_ids: uniqueIds,
      deleted_ids: deletableIds,
      skipped_ids: skipped.map((r) => r.id),
    }, req.ip);

    res.json({
      success: true,
      message: `Deleted ${deletableIds.length} activation(s)${skipped.length ? `. Skipped ${skipped.length} already-processed.` : '.'}`,
      data: { deleted: deletableIds.length, skipped: skipped.length },
    });
  } catch (err) {
    next(err);
  }
}

async function clearApiLogs(req, res, next) {
  const adminId = req.user.id;
  try {
    const [countRow] = await query('SELECT COUNT(*) as total FROM api_logs');
    await query('DELETE FROM api_logs');
    await logAdminAction(adminId, 'clear_api_logs', 'api_logs', null, { deleted: countRow.total }, req.ip);
    res.json({ success: true, message: `Cleared ${countRow.total} API log(s)` });
  } catch (err) { next(err); }
}

async function clearAdminLogs(req, res, next) {
  const adminId = req.user.id;
  try {
    const [countRow] = await query('SELECT COUNT(*) as total FROM admin_logs');
    await query('DELETE FROM admin_logs');
    // Re-insert a single log entry so the action itself is recorded
    await logAdminAction(adminId, 'clear_admin_logs', 'admin_logs', null, { deleted: countRow.total }, req.ip);
    res.json({ success: true, message: `Cleared ${countRow.total} admin log(s)` });
  } catch (err) { next(err); }
}

async function listPaymentMethods(req, res, next) {
  try {
    const rows = await query('SELECT * FROM payment_methods ORDER BY id');
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

async function getSettings(req, res, next) {
  try {
    const rows = await query('SELECT key, value, updated_at FROM app_settings ORDER BY key');
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

async function updateSetting(req, res, next) {
  const { key } = req.params;
  const { value } = req.body;
  const allowed = ['default_language', 'min_withdrawal_amount', 'startup_message', 'bot_welcome_message', 'startup_message_enabled', 'maintenance_mode'];
  if (!allowed.includes(key)) {
    return res.status(400).json({ success: false, message: 'Unknown setting key' });
  }
  if (value === undefined || value === null) {
    return res.status(400).json({ success: false, message: 'value is required' });
  }
  if (key === 'default_language' && !['en', 'ru'].includes(value)) {
    return res.status(400).json({ success: false, message: 'Language must be en or ru' });
  }
  if (key === 'min_withdrawal_amount' && (isNaN(parseFloat(value)) || parseFloat(value) < 0.01)) {
    return res.status(400).json({ success: false, message: 'min_withdrawal_amount must be >= 0.01' });
  }
  if (key === 'startup_message_enabled' && !['0', '1'].includes(String(value))) {
    return res.status(400).json({ success: false, message: 'startup_message_enabled must be 0 or 1' });
  }
  if (key === 'maintenance_mode' && !['0', '1'].includes(String(value))) {
    return res.status(400).json({ success: false, message: 'maintenance_mode must be 0 or 1' });
  }
  try {
    await query(
      `UPDATE app_settings SET value = ?, updated_at = NOW() WHERE key = ?`,
      [String(value), key]
    );
    await logAdminAction(req.user.id, 'update_setting', 'app_settings', null, { key, value });
    res.json({ success: true, data: { key, value } });
  } catch (err) { next(err); }
}

async function togglePaymentMethod(req, res, next) {
  const { methodId } = req.params;
  const { is_enabled } = req.body;
  if (typeof is_enabled !== 'boolean') {
    return res.status(400).json({ success: false, message: 'is_enabled must be a boolean' });
  }
  try {
    const result = await query(
      `UPDATE payment_methods SET is_enabled = ?, updated_at = NOW() WHERE method_id = ? RETURNING *`,
      [is_enabled, methodId]
    );
    if (!result.length) {
      return res.status(404).json({ success: false, message: 'Payment method not found' });
    }
    const adminId = req.user.id;
    await logAdminAction(adminId, is_enabled ? 'enable_payment_method' : 'disable_payment_method',
      'payment_method', null, { method_id: methodId });
    res.json({ success: true, data: result[0] });
  } catch (err) { next(err); }
}

async function sendBroadcast(req, res, next) {
  const adminId = req.user.id;
  const { message } = req.body;
  
  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, message: 'Message is required' });
  }

  try {
    // Fetch all active, non-admin, non-banned platform users who have a telegram_id
    const users = await query(
      'SELECT id, telegram_id, first_name FROM users WHERE is_admin = 0 AND is_banned = 0'
    );

    if (!users.length) {
      return res.json({ success: true, sent_count: 0, message: 'No active users to broadcast to.' });
    }

    const { sendMessage } = require('../services/telegramBot');
    
    let sentCount = 0;
    let failCount = 0;
    
    // Broadcast concurrently in small batches to respect Telegram API rate limits (max 30 msgs/sec)
    const batchSize = 15;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (u) => {
          try {
            const formatted = message.replace(/{first_name}/g, u.first_name || 'there');
            await sendMessage(u.telegram_id, formatted);
            sentCount++;
          } catch (err) {
            failCount++;
            logger.warn(`Failed to send broadcast to user telegram_id=${u.telegram_id}`, { error: err.message });
          }
        })
      );
      // Small sleep between batches to stay safe
      if (i + batchSize < users.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    await logAdminAction(adminId, 'send_broadcast', 'users', null, { message, sent_count: sentCount, fail_count: failCount }, req.ip);

    res.json({
      success: true,
      message: `Broadcast complete. Successfully sent to ${sentCount} users (Failed: ${failCount}).`,
      data: { sentCount, failCount }
    });
  } catch (err) {
    next(err);
  }
}
