const { body, param, query, validationResult } = require('express-validator');

/**
 * Centralized validation error handler.
 * Use after any validation chain.
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

// ── Validation Schemas ─────────────────────────────────────────────────────

const validateActivation = [
  body('phone')
    .isString()
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^\+?[1-9]\d{6,14}$/).withMessage('Invalid phone number format'),
  handleValidationErrors,
];

const validateOtpUpload = [
  param('id')
    .isInt({ min: 1 }).withMessage('Invalid activation ID'),
  body('otp')
    .isString()
    .trim()
    .notEmpty().withMessage('OTP code is required')
    .matches(/^\d{6,8}$/).withMessage('OTP must be 6–8 digits'),
  handleValidationErrors,
];

const validateWithdrawal = [
  body('amount')
    .isFloat({ min: 0.01, max: parseFloat(process.env.MAX_WITHDRAWAL_AMOUNT || '500') })
    .withMessage('Amount must be a positive number'),
  body('method')
    .isIn(['binance_id', 'usdt_trc20', 'usdt_bep20']).withMessage('Invalid withdrawal method'),
  body('address')
    .isString()
    .trim()
    .notEmpty().withMessage('Withdrawal address is required')
    .isLength({ min: 6, max: 200 }).withMessage('Address must be 6–200 characters'),
  handleValidationErrors,
];

const validateAdminPriceUpdate = [
  param('cc').isString().trim().notEmpty().withMessage('Country code required'),
  body('payout_amount')
    .optional({ nullable: true })
    .isFloat({ min: 0, max: 1000 }).withMessage('Payout amount must be between 0 and 1000'),
  body('is_active')
    .optional()
    .isBoolean().withMessage('is_active must be boolean'),
  body().custom((_, { req }) => {
    if (req.body.payout_amount === undefined && req.body.is_active === undefined) {
      throw new Error('Nothing to update — provide payout_amount or is_active');
    }
    return true;
  }),
  handleValidationErrors,
];

const validateAdminBalanceAdjust = [
  param('userId').isInt({ min: 1 }).withMessage('Invalid user ID'),
  body('amount')
    .isFloat().withMessage('Amount must be a number')
    .custom((val) => val !== 0).withMessage('Amount cannot be zero'),
  body('note')
    .isString().trim()
    .notEmpty().withMessage('Note is required for admin adjustments')
    .isLength({ max: 500 }),
  handleValidationErrors,
];

const validateWithdrawalReview = [
  param('id').isInt({ min: 1 }).withMessage('Invalid withdrawal ID'),
  body('action')
    .isIn(['approve', 'reject']).withMessage('Action must be approve or reject'),
  body('admin_note')
    .optional()
    .isString().trim().isLength({ max: 1000 }),
  handleValidationErrors,
];

const validateCountryCredentials = [
  param('cc').isString().trim().notEmpty().withMessage('Country code is required'),
  body('api_account')
    .isString().trim()
    .notEmpty().withMessage('api_account (username) is required')
    .isLength({ max: 100 }).withMessage('api_account too long'),
  body('api_password')
    .optional({ checkFalsy: true }) // Allow empty string — backend keeps existing
    .isString()
    .isLength({ max: 200 }).withMessage('api_password too long'),
  body('api_identity')
    .optional()
    .isString().trim().isLength({ max: 50 }),
  handleValidationErrors,
];


const validateAddCountry = [
  body('cc').isString().trim().notEmpty().withMessage('Country calling code is required').isLength({ max: 5 }),
  body('country_name').isString().trim().notEmpty().withMessage('Country name is required').isLength({ max: 100 }),
  body('iso_code').isString().trim().notEmpty().withMessage('ISO code is required').isLength({ min: 2, max: 3 }),
  body('api_account').isString().trim().notEmpty().withMessage('API account (username) is required').isLength({ max: 100 }),
  body('api_password').isString().trim().notEmpty().withMessage('API password is required').isLength({ max: 200 }),
  body('flag_emoji').optional().isString().isLength({ max: 10 }),
  body('payout_amount').optional().isFloat({ min: 0, max: 1000 }),
  body('api_identity').optional().isString().trim().isLength({ max: 50 }),
  handleValidationErrors,
];

module.exports = {
  handleValidationErrors,
  validateActivation,
  validateOtpUpload,
  validateWithdrawal,
  validateAdminPriceUpdate,
  validateAdminBalanceAdjust,
  validateWithdrawalReview,
  validateCountryCredentials,
  validateAddCountry,
};
