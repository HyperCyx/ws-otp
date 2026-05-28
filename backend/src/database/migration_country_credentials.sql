-- ============================================================
-- Migration: Per-Country External API Credentials
-- Run once against the otp_activation database
-- ============================================================

USE `otp_activation`;

-- Add api_account and api_password columns to country_prices
-- (NULL means "use global credentials from .env")
ALTER TABLE `country_prices`
  ADD COLUMN IF NOT EXISTS `api_account`  VARCHAR(100) DEFAULT NULL
    COMMENT 'External API account for this country (NULL = use global)',
  ADD COLUMN IF NOT EXISTS `api_password` VARCHAR(200) DEFAULT NULL
    COMMENT 'External API password for this country (NULL = use global)',
  ADD COLUMN IF NOT EXISTS `api_identity` VARCHAR(50)  DEFAULT 'Member'
    COMMENT 'External API identity field for this country';

-- Per-country token cache (mirrors token_cache but keyed by cc)
CREATE TABLE IF NOT EXISTS `country_token_cache` (
  `cc`         VARCHAR(5)   NOT NULL COMMENT 'Country calling code',
  `token`      TEXT         NOT NULL COMMENT 'Bearer token from external API',
  `expires_at` TIMESTAMP    NOT NULL,
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`cc`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
