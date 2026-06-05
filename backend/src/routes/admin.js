const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const {
  validateAdminPriceUpdate,
  validateAdminBalanceAdjust,
  validateWithdrawalReview,
  validateCountryCredentials,
  validateAddCountry,
} = require('../middleware/validate');
const adminController = require('../controllers/adminController');

router.use(requireAuth, requireAdmin);

// ── Dashboard Stats ────────────────────────────────────────────────────────
router.get('/stats', adminController.getDashboardStats);
router.get('/revenue', adminController.getRevenueChart);
router.get('/withdrawal-stats', adminController.getWithdrawalStats);

// ── User Management ────────────────────────────────────────────────────────
router.get('/users', adminController.listUsers);
router.get('/users/:id', adminController.getUser);
router.patch('/users/:id/ban', adminController.toggleBan);
router.post('/users/:userId/balance', validateAdminBalanceAdjust, adminController.adjustBalance);

// ── Activation Management ──────────────────────────────────────────────────
router.get('/activations', adminController.listActivations);
router.get('/activations/:id', adminController.getActivation);
router.delete('/activations', adminController.bulkDeleteActivations);   // bulk — must be before /:id
router.delete('/activations/:id', adminController.deleteActivation);

// ── Withdrawal Management ──────────────────────────────────────────────────
router.get('/withdrawals', adminController.listWithdrawals);
router.post('/withdrawals/:id/review', validateWithdrawalReview, adminController.reviewWithdrawal);

// ── Country Pricing ────────────────────────────────────────────────────────
router.get('/prices', adminController.listPrices);
router.patch('/prices/:cc', validateAdminPriceUpdate, adminController.updatePrice);

// ── Country Management (add / delete entire country) ───────────────────────
router.post('/countries', validateAddCountry, adminController.addCountry);
router.delete('/countries/:cc', adminController.deleteCountry);

// ── Country API Credentials ────────────────────────────────────────────────
router.get('/country-credentials', adminController.getCountryCredentials);
router.post('/country-credentials/:cc', validateCountryCredentials, adminController.updateCountryCredentials);
router.delete('/country-credentials/:cc', adminController.removeCountryCredentials);

// ── App Settings & Broadcast ────────────────────────────────────────────────
router.get('/settings', adminController.getSettings);
router.patch('/settings/:key', adminController.updateSetting);
router.post('/broadcast', adminController.sendBroadcast);

// ── Payment Methods ────────────────────────────────────────────────────────
router.get('/payment-methods', adminController.listPaymentMethods);
router.patch('/payment-methods/:methodId', adminController.togglePaymentMethod);

// ── Logs ───────────────────────────────────────────────────────────────────
router.get('/api-logs', adminController.getApiLogs);
router.delete('/api-logs', adminController.clearApiLogs);
router.get('/admin-logs', adminController.getAdminLogs);
router.delete('/admin-logs', adminController.clearAdminLogs);

module.exports = router;
