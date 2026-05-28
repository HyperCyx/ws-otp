const express = require('express');
const router = express.Router();
const { telegramAuthMiddleware } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

/**
 * POST /api/auth/telegram
 * Validates Telegram initData, upserts user, returns JWT + user profile.
 */
router.post('/telegram', authLimiter, telegramAuthMiddleware, (req, res) => {
  const { dbUser, authToken } = req;
  res.json({
    success: true,
    data: {
      token: authToken,
      user: {
        id: dbUser.id,
        telegramId: String(dbUser.telegram_id),
        username: dbUser.username,
        firstName: dbUser.first_name,
        lastName: dbUser.last_name,
        photoUrl: dbUser.photo_url,
        isAdmin: dbUser.is_admin === 1,
      },
    },
  });
});

module.exports = router;
