const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getCountries: fetchCountries } = require('../services/externalApi');
const { query } = require('../config/database');
const { get: redisGet, set: redisSet } = require('../config/redis');

router.use(requireAuth);

/**
 * GET /api/countries
 * Returns active countries with payout amounts.
 * Caches DB result for 5 minutes.
 */
router.get('/', async (req, res, next) => {
  try {
    const cacheKey = 'countries:active';
    const cached = await redisGet(cacheKey);
    if (cached) return res.json({ success: true, data: cached });

    const countries = await query(
      `SELECT cc, country_name, iso_code, flag_emoji, payout_amount
       FROM country_prices
       WHERE is_active = 1
       ORDER BY country_name ASC`
    );

    await redisSet(cacheKey, countries, 300); // 5 min cache
    res.json({ success: true, data: countries });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
