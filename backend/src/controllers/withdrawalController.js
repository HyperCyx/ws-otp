const { v4: uuidv4 } = require('uuid');
const { getBalance, lockBalance, finalizeWithdrawal, TX_TYPES } = require('../services/walletService');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const MAX_AMOUNT = parseFloat(process.env.MAX_WITHDRAWAL_AMOUNT || '500');

async function getMinAmount() {
  try {
    const [row] = await query(`SELECT value FROM app_settings WHERE key = 'min_withdrawal_amount'`);
    return row ? parseFloat(row.value) : 1;
  } catch { return 1; }
}

async function createWithdrawal(req, res, next) {
  const userId = req.user.id;
  const { amount, method, address } = req.body;
  const amountF = parseFloat(amount);

  try {
    // Validate against DB min amount
    const minAmount = await getMinAmount();
    if (amountF < minAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum withdrawal amount is $${minAmount}`,
      });
    }

    // Check payment method is enabled
    const [pm] = await query(
      `SELECT is_enabled FROM payment_methods WHERE method_id = ?`,
      [method]
    );
    if (!pm || !pm.is_enabled) {
      return res.status(400).json({
        success: false,
        message: 'This payment method is currently unavailable.',
      });
    }

    const [pendingWd] = await query(
      `SELECT id FROM withdrawals WHERE user_id = ? AND status = 'pending'`,
      [userId]
    );
    if (pendingWd) {
      return res.status(409).json({
        success: false,
        message: 'You have a pending withdrawal. Please wait for it to be processed.',
      });
    }

    const wallet = await getBalance(userId);
    const available = parseFloat(wallet.balance) - parseFloat(wallet.locked_balance);

    if (available < amountF) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: $${available.toFixed(4)}`,
      });
    }

    const lockRef = `wd:lock:${uuidv4()}`;

    await lockBalance(userId, amountF, lockRef);

    const insertResult = await query(
      `INSERT INTO withdrawals (user_id, amount, method, address, status, lock_tx_ref)
       VALUES (?, ?, ?, ?, 'pending', ?)
       RETURNING id`,
      [userId, amountF, method, address, lockRef]
    );

    const insertedId = insertResult[0].id;

    logger.info('Withdrawal created', { userId, amount: amountF, method, id: insertedId });

    res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted. Admin will review within 24 hours.',
      data: { id: insertedId, amount: amountF, method, status: 'pending' },
    });
  } catch (err) {
    next(err);
  }
}

async function listWithdrawals(req, res, next) {
  const userId = req.user.id;
  const page = Math.max(1, parseInt(req.query.page || '1'));
  const limit = Math.min(50, parseInt(req.query.limit || '20'));
  const offset = (page - 1) * limit;

  try {
    const rows = await query(
      `SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );
    const [countRow] = await query(
      'SELECT COUNT(*) as total FROM withdrawals WHERE user_id = ?',
      [userId]
    );

    res.json({
      success: true,
      data: rows,
      pagination: { page, limit, total: countRow.total, pages: Math.ceil(countRow.total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

async function cancelWithdrawal(req, res, next) {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const [wd] = await query(
      `SELECT * FROM withdrawals WHERE id = ? AND user_id = ? AND status = 'pending'`,
      [id, userId]
    );
    if (!wd) {
      return res.status(404).json({ success: false, message: 'Pending withdrawal not found' });
    }

    await finalizeWithdrawal(userId, wd.amount, wd.lock_tx_ref, false);
    await query(
      `UPDATE withdrawals SET status = 'cancelled', updated_at = NOW() WHERE id = ?`,
      [id]
    );

    res.json({ success: true, message: 'Withdrawal cancelled and balance restored' });
  } catch (err) {
    next(err);
  }
}

module.exports = { createWithdrawal, listWithdrawals, cancelWithdrawal };
