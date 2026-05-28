const { query } = require('../config/database');
const logger = require('./logger');

async function logApiCall(endpoint, method, requestData, responseData, statusCode, durationMs, error = null) {
  try {
    await query(
      `INSERT INTO api_logs (endpoint, method, request_data, response_data, status_code, duration_ms, error)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        endpoint,
        method,
        requestData ? JSON.stringify(requestData) : null,
        responseData ? JSON.stringify(responseData) : null,
        statusCode || null,
        durationMs || null,
        error || null,
      ]
    );
  } catch (err) {
    logger.warn('Failed to write api_log', { error: err.message });
  }
}

module.exports = { logApiCall };
