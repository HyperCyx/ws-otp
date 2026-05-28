const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { withdrawalLimiter } = require('../middleware/rateLimiter');
const { validateWithdrawal } = require('../middleware/validate');
const withdrawalController = require('../controllers/withdrawalController');

router.use(requireAuth);

/** POST /api/withdrawals — Request a new withdrawal */
router.post('/', withdrawalLimiter, validateWithdrawal, withdrawalController.createWithdrawal);

/** GET /api/withdrawals — List user's withdrawals */
router.get('/', withdrawalController.listWithdrawals);

/** DELETE /api/withdrawals/:id — Cancel a pending withdrawal */
router.delete('/:id', withdrawalController.cancelWithdrawal);

module.exports = router;
