const { getBalance } = require('../services/walletService');
const { query } = require('../config/database');

async function getWallet(req, res, next) {
  const userId = req.user.id;
  try {
    const wallet = await getBalance(userId);
    res.json({ success: true, data: wallet });
  } catch (err) {
    next(err);
  }
}

async function getTransactions(req, res, next) {
  const userId = req.user.id;
  const page = Math.max(1, parseInt(req.query.page || '1'));
  const limit = Math.min(50, parseInt(req.query.limit || '20'));
  const offset = (page - 1) * limit;
  const type = req.query.type || null;

  try {
    let sql = `SELECT * FROM wallet_transactions WHERE user_id = ?`;
    const params = [userId];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = await query(sql, params);

    const [countRow] = await query(
      `SELECT COUNT(*) as total FROM wallet_transactions WHERE user_id = ?${type ? ' AND type = ?' : ''}`,
      type ? [userId, type] : [userId]
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

module.exports = { getWallet, getTransactions };
