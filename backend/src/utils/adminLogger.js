const { query } = require('../config/database');
const logger = require('./logger');

async function logAdminAction(adminId, action, targetType = null, targetId = null, meta = null, ipAddress = null) {
  try {
    await query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, meta, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        adminId,
        action,
        targetType || null,
        targetId || null,
        meta ? JSON.stringify(meta) : null,
        ipAddress || null,
      ]
    );
    logger.info('Admin action logged', { adminId, action, targetType, targetId });
  } catch (err) {
    logger.warn('Failed to write admin_log', { error: err.message });
  }
}

module.exports = { logAdminAction };
