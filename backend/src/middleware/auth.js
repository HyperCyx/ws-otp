const jwt = require('jsonwebtoken');
const { validateTelegramInitData } = require('../utils/telegramAuth');
const { query } = require('../config/database');
const { getOrCreateWallet } = require('../services/walletService');
const logger = require('../utils/logger');
const https = require('https');
const http = require('http');

/**
 * Follow HTTP redirects for a URL and return the final resolved URL.
 * Used to unwrap Telegram's t.me/i/userpic/... redirect to the real CDN URL.
 * Resolves in < 1s; fails silently — returns original URL on any error.
 */
function resolveRedirectUrl(url, maxRedirects = 5) {
  return new Promise((resolve) => {
    if (!url || maxRedirects <= 0) return resolve(url);

    const mod = url.startsWith('https') ? https : http;
    const req = mod.request(url, { method: 'HEAD', timeout: 3000 }, (res) => {
      const location = res.headers && res.headers.location;
      const isRedirect = res.statusCode === 301 || res.statusCode === 302 ||
                         res.statusCode === 307 || res.statusCode === 308;
      if (location && isRedirect) {
        const next = location.startsWith('http') ? location : new URL(location, url).href;
        resolve(resolveRedirectUrl(next, maxRedirects - 1));
      } else {
        resolve(url);
      }
    });
    req.on('error', () => resolve(url));
    req.on('timeout', () => { req.destroy(); resolve(url); });
    req.end();
  });
}

async function telegramAuthMiddleware(req, res, next) {
  const { initData } = req.body;

  if (!initData) {
    return res.status(400).json({ success: false, message: 'initData is required' });
  }

  const { valid, user: tgUser, error } = validateTelegramInitData(
    initData,
    process.env.TELEGRAM_BOT_TOKEN
  );

  if (!valid) {
    logger.warn('Invalid Telegram initData', { error, ip: req.ip, initDataSnippet: String(initData).slice(0, 200) });
    const message = process.env.NODE_ENV === 'production'
      ? 'Invalid Telegram authentication'
      : `Invalid Telegram authentication: ${error}`;
    return res.status(401).json({ success: false, message });
  }

  if (!tgUser?.id) {
    return res.status(400).json({ success: false, message: 'No user data in initData' });
  }

  const adminIds = (process.env.ADMIN_TELEGRAM_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const isAdminUser = adminIds.includes(String(tgUser.id)) ? 1 : 0;

  try {
    // Resolve Telegram's t.me/i/userpic redirect to the real CDN photo URL
    let resolvedPhotoUrl = tgUser.photo_url || null;
    if (resolvedPhotoUrl && resolvedPhotoUrl.includes('t.me/i/userpic')) {
      try {
        resolvedPhotoUrl = await resolveRedirectUrl(resolvedPhotoUrl);
        logger.info('Resolved photo URL', { from: tgUser.photo_url, to: resolvedPhotoUrl });
      } catch (e) {
        logger.warn('Could not resolve photo URL redirect', { url: tgUser.photo_url });
      }
    }

    await query(
      `INSERT INTO users (telegram_id, username, first_name, last_name, photo_url, is_admin, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())
       ON CONFLICT (telegram_id) DO UPDATE SET
         username     = COALESCE(EXCLUDED.username, users.username),
         first_name   = EXCLUDED.first_name,
         last_name    = EXCLUDED.last_name,
         photo_url    = COALESCE(EXCLUDED.photo_url, users.photo_url),
         is_admin     = GREATEST(users.is_admin, EXCLUDED.is_admin),
         last_seen_at = NOW(),
         updated_at   = NOW()`,
      [
        tgUser.id,
        tgUser.username || null,
        tgUser.first_name || '',
        tgUser.last_name || null,
        resolvedPhotoUrl,
        isAdminUser,
      ]
    );

    const [dbUser] = await query(
      'SELECT * FROM users WHERE telegram_id = ?',
      [tgUser.id]
    );

    if (dbUser.is_banned) {
      return res.status(403).json({ success: false, message: 'Account banned', reason: dbUser.ban_reason });
    }

    await getOrCreateWallet(dbUser.id);

    const token = jwt.sign(
      {
        userId: dbUser.id,
        telegramId: dbUser.telegram_id,
        isAdmin: dbUser.is_admin === 1,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    req.dbUser = dbUser;
    req.authToken = token;
    next();
  } catch (err) {
    logger.error('Auth middleware error', { error: err.message });
    next(err);
  }
}

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authorization token required' });
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const [user] = await query('SELECT * FROM users WHERE id = ?', [payload.userId]);

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    if (user.is_banned) {
      return res.status(403).json({ success: false, message: 'Account suspended', reason: user.ban_reason });
    }

    req.user = {
      id: user.id,
      telegramId: user.telegram_id,
      isAdmin: user.is_admin === 1,
      username: user.username,
      firstName: user.first_name,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    next(err);
  }
}

function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
}

module.exports = { telegramAuthMiddleware, requireAuth, requireAdmin };
