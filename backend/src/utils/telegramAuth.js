const crypto = require('crypto');

/**
 * Validate Telegram Web App initData string.
 * Spec: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * @param {string} initData - Raw initData query string from Telegram.WebApp.initData
 * @param {string} botToken - Your Telegram Bot Token
 * @param {number} [maxAgeSeconds=86400] - Reject if older than this (default 24h)
 * @returns {{ valid: boolean, user: object|null, error: string|null }}
 */
function validateTelegramInitData(initData, botToken, maxAgeSeconds = 86400) {
  if (!initData || !botToken) {
    return { valid: false, user: null, error: 'Missing initData or botToken' };
  }

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');

    if (!hash) {
      return { valid: false, user: null, error: 'No hash in initData' };
    }

    params.delete('hash');

    // Sort keys alphabetically and build check string
    const checkArr = [];
    const sortedKeys = [...params.keys()].sort();
    for (const key of sortedKeys) {
      checkArr.push(`${key}=${params.get(key)}`);
    }
    const checkString = checkArr.join('\n');

    // HMAC-SHA256 with key = HMAC-SHA256("WebAppData", botToken)
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(checkString)
      .digest('hex');

    if (expectedHash !== hash) {
      return { valid: false, user: null, error: 'Hash mismatch — invalid initData' };
    }

    // Check auth_date freshness
    const authDate = parseInt(params.get('auth_date') || '0', 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > maxAgeSeconds) {
      return { valid: false, user: null, error: 'initData expired' };
    }

    // Parse user object
    let user = null;
    const userStr = params.get('user');
    if (userStr) {
      user = JSON.parse(userStr);
    }

    return { valid: true, user, error: null };
  } catch (err) {
    return { valid: false, user: null, error: `Validation error: ${err.message}` };
  }
}

/**
 * Generate a secure random token string.
 */
function generateToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Hash a value with SHA-256.
 */
function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

module.exports = { validateTelegramInitData, generateToken, sha256 };
