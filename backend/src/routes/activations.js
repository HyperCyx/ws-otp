const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { activationLimiter, otpLimiter } = require('../middleware/rateLimiter');
const { validateActivation, validateOtpUpload } = require('../middleware/validate');
const activationController = require('../controllers/activationController');

// All routes require authentication
router.use(requireAuth);

/**
 * POST /api/activations
 * Submit a new phone number for activation.
 */
router.post('/', activationLimiter, validateActivation, activationController.createActivation);

/**
 * GET /api/activations
 * List user's activations with pagination.
 */
router.get('/', activationController.listActivations);

/**
 * GET /api/activations/:id
 * Get a specific activation.
 */
router.get('/:id', activationController.getActivation);

/**
 * POST /api/activations/:id/otp
 * Submit OTP code for an activation.
 */
router.post('/:id/otp', otpLimiter, validateOtpUpload, activationController.submitOtp);

/**
 * DELETE /api/activations/:id
 * User cancels their own active activation — deletes number from provider.
 */
router.delete('/:id', activationController.cancelActivation);

module.exports = router;
