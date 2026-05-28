const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const walletController = require('../controllers/walletController');

router.use(requireAuth);

/** GET /api/wallet — Get balance + stats */
router.get('/', walletController.getWallet);

/** GET /api/wallet/transactions — Transaction history */
router.get('/transactions', walletController.getTransactions);

module.exports = router;
