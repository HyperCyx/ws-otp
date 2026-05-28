const { v4: uuidv4 } = require('uuid');
const { withTransaction, query } = require('../config/database');
const { del: redisDel } = require('../config/redis');
const logger = require('../utils/logger');

const TX_TYPES = {
  ACTIVATION_REWARD: 'activation_reward',
  WITHDRAWAL: 'withdrawal',
  ADMIN_ADJUSTMENT: 'admin_adjustment',
  REFUND: 'refund',
  WITHDRAWAL_LOCK: 'withdrawal_lock',
  WITHDRAWAL_UNLOCK: 'withdrawal_unlock',
};

async function getOrCreateWallet(userId, conn) {
  const execute = conn
    ? async (sql, params) => {
        const [rows] = await conn.execute(sql, params);
        return rows;
      }
    : query;

  const rows = await execute(
    'SELECT * FROM wallets WHERE user_id = ? FOR SHARE',
    [userId]
  );

  if (rows.length > 0) return rows[0];

  await execute(
    'INSERT INTO wallets (user_id) VALUES (?)',
    [userId]
  );

  const newRows = await execute(
    'SELECT * FROM wallets WHERE user_id = ?',
    [userId]
  );
  return newRows[0];
}

async function getBalance(userId) {
  const rows = await query(
    'SELECT balance, locked_balance, total_earned, total_withdrawn FROM wallets WHERE user_id = ?',
    [userId]
  );
  if (!rows.length) return { balance: '0.0000', locked_balance: '0.0000', total_earned: '0.0000', total_withdrawn: '0.0000' };
  return rows[0];
}

async function credit(userId, amount, type, ref, meta = null, note = null) {
  return withTransaction(async (conn) => {
    const [existingRows] = await conn.execute(
      'SELECT id FROM wallet_transactions WHERE ref = ?',
      [ref]
    );
    if (existingRows.length > 0) {
      logger.warn('Duplicate credit attempt blocked', { ref, userId });
      return { duplicate: true };
    }

    const [walletRows] = await conn.execute(
      'SELECT id, balance FROM wallets WHERE user_id = ? FOR UPDATE',
      [userId]
    );

    let wallet;
    if (!walletRows.length) {
      await conn.execute('INSERT INTO wallets (user_id) VALUES (?)', [userId]);
      const [newWallet] = await conn.execute(
        'SELECT id, balance FROM wallets WHERE user_id = ? FOR UPDATE',
        [userId]
      );
      wallet = newWallet[0];
    } else {
      wallet = walletRows[0];
    }

    const amountDecimal = parseFloat(amount);
    const balanceBefore = parseFloat(wallet.balance);
    const balanceAfter = balanceBefore + amountDecimal;

    await conn.execute(
      `UPDATE wallets
       SET balance = balance + ?, total_earned = total_earned + ?, updated_at = NOW()
       WHERE user_id = ?`,
      [amountDecimal, amountDecimal, userId]
    );

    await conn.execute(
      `INSERT INTO wallet_transactions
         (user_id, amount, type, ref, status, balance_before, balance_after, meta, note)
       VALUES (?, ?, ?, ?, 'completed', ?, ?, ?, ?)`,
      [userId, amountDecimal, type, ref, balanceBefore, balanceAfter, meta ? JSON.stringify(meta) : null, note]
    );

    await redisDel(`balance:${userId}`);

    logger.info('Wallet credited', { userId, amount: amountDecimal, type, ref, balanceAfter });
    return { success: true, balanceBefore, balanceAfter };
  });
}

async function debit(userId, amount, type, ref, meta = null, note = null) {
  return withTransaction(async (conn) => {
    const [existingRows] = await conn.execute(
      'SELECT id FROM wallet_transactions WHERE ref = ?',
      [ref]
    );
    if (existingRows.length > 0) {
      logger.warn('Duplicate debit attempt blocked', { ref, userId });
      return { duplicate: true };
    }

    const [walletRows] = await conn.execute(
      'SELECT id, balance, locked_balance FROM wallets WHERE user_id = ? FOR UPDATE',
      [userId]
    );

    if (!walletRows.length) throw new Error('Wallet not found');
    const wallet = walletRows[0];

    const amountDecimal = parseFloat(amount);
    const availableBalance = parseFloat(wallet.balance) - parseFloat(wallet.locked_balance);

    if (availableBalance < amountDecimal) {
      throw new Error(`Insufficient balance. Available: ${availableBalance.toFixed(4)}, Required: ${amountDecimal.toFixed(4)}`);
    }

    const balanceBefore = parseFloat(wallet.balance);
    const balanceAfter = balanceBefore - amountDecimal;

    await conn.execute(
      `UPDATE wallets SET balance = balance - ?, updated_at = NOW() WHERE user_id = ?`,
      [amountDecimal, userId]
    );

    await conn.execute(
      `INSERT INTO wallet_transactions
         (user_id, amount, type, ref, status, balance_before, balance_after, meta, note)
       VALUES (?, ?, ?, ?, 'completed', ?, ?, ?, ?)`,
      [userId, -amountDecimal, type, ref, balanceBefore, balanceAfter, meta ? JSON.stringify(meta) : null, note]
    );

    await redisDel(`balance:${userId}`);

    logger.info('Wallet debited', { userId, amount: amountDecimal, type, ref, balanceAfter });
    return { success: true, balanceBefore, balanceAfter };
  });
}

async function lockBalance(userId, amount, ref) {
  return withTransaction(async (conn) => {
    const [walletRows] = await conn.execute(
      'SELECT id, balance, locked_balance FROM wallets WHERE user_id = ? FOR UPDATE',
      [userId]
    );

    if (!walletRows.length) throw new Error('Wallet not found');
    const wallet = walletRows[0];

    const amountDecimal = parseFloat(amount);
    const availableBalance = parseFloat(wallet.balance) - parseFloat(wallet.locked_balance);

    if (availableBalance < amountDecimal) {
      throw new Error('Insufficient available balance for withdrawal');
    }

    await conn.execute(
      `UPDATE wallets SET locked_balance = locked_balance + ?, updated_at = NOW() WHERE user_id = ?`,
      [amountDecimal, userId]
    );

    await conn.execute(
      `INSERT INTO wallet_transactions
         (user_id, amount, type, ref, status, balance_before, balance_after, meta, note)
       VALUES (?, ?, 'withdrawal_lock', ?, 'completed', ?, ?, ?, 'Balance locked for withdrawal')`,
      [userId, -amountDecimal, ref, parseFloat(wallet.balance), parseFloat(wallet.balance), JSON.stringify({ withdrawal_ref: ref })]
    );

    await redisDel(`balance:${userId}`);
    return { success: true };
  });
}

async function finalizeWithdrawal(userId, amount, ref, approved) {
  return withTransaction(async (conn) => {
    const amountDecimal = parseFloat(amount);

    if (approved) {
      await conn.execute(
        `UPDATE wallets
         SET balance = balance - ?, locked_balance = locked_balance - ?,
             total_withdrawn = total_withdrawn + ?, updated_at = NOW()
         WHERE user_id = ?`,
        [amountDecimal, amountDecimal, amountDecimal, userId]
      );

      await conn.execute(
        `INSERT INTO wallet_transactions
           (user_id, amount, type, ref, status, balance_before, balance_after, note)
         SELECT $1, $2, 'withdrawal', $3, 'completed', balance + $4, balance, 'Withdrawal approved'
         FROM wallets WHERE user_id = $5`,
        [userId, -amountDecimal, ref + ':final', amountDecimal, userId]
      );
    } else {
      await conn.execute(
        `UPDATE wallets SET locked_balance = locked_balance - ?, updated_at = NOW() WHERE user_id = ?`,
        [amountDecimal, userId]
      );

      await conn.execute(
        `INSERT INTO wallet_transactions
           (user_id, amount, type, ref, status, note)
         VALUES (?, ?, 'withdrawal_unlock', ?, 'completed', 'Withdrawal rejected — balance unlocked')`,
        [userId, amountDecimal, ref + ':unlock']
      );
    }

    await redisDel(`balance:${userId}`);
    return { success: true };
  });
}

module.exports = {
  TX_TYPES,
  getBalance,
  getOrCreateWallet,
  credit,
  debit,
  lockBalance,
  finalizeWithdrawal,
};
