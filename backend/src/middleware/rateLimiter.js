const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { getRedis } = require('../config/redis');
const logger = require('../utils/logger');

function createLimiter(options) {
  const store = (() => {
    try {
      return new RedisStore({
        sendCommand: (...args) => getRedis().call(...args),
        prefix: `rl:${options.prefix || 'default'}:`,
      });
    } catch {
      logger.warn('Redis store unavailable for rate limiter, using memory store');
      return undefined; // Falls back to express-rate-limit MemoryStore
    }
  })();

  return rateLimit({
    windowMs: options.windowMs || parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    max: options.max || parseInt(process.env.RATE_LIMIT_MAX || '100'),
    standardHeaders: true,
    legacyHeaders: false,
    store,
    keyGenerator: (req) => {
      // Rate limit by user ID if authenticated, else by IP
      return req.user?.id ? `user:${req.user.id}` : req.ip;
    },
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', { ip: req.ip, userId: req.user?.id, path: req.path });
      res.status(429).json({
        success: false,
        message: 'Too many requests. Please slow down.',
        retryAfter: Math.ceil(options.windowMs / 1000),
      });
    },
  });
}

// General API limiter
const apiLimiter = createLimiter({
  prefix: 'api',
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
});

// Activation-specific limiter (stricter)
const activationLimiter = createLimiter({
  prefix: 'activation',
  windowMs: 900000, // 15 minutes
  max: parseInt(process.env.ACTIVATION_RATE_LIMIT || '10'),
});

// Auth limiter (very strict)
const authLimiter = createLimiter({
  prefix: 'auth',
  windowMs: 60000, // 1 minute
  max: 5,
});

// OTP upload limiter
const otpLimiter = createLimiter({
  prefix: 'otp',
  windowMs: 60000,
  max: 10,
});

// Withdrawal limiter
const withdrawalLimiter = createLimiter({
  prefix: 'withdrawal',
  windowMs: 3600000, // 1 hour
  max: 5,
});

module.exports = {
  apiLimiter,
  activationLimiter,
  authLimiter,
  otpLimiter,
  withdrawalLimiter,
};

