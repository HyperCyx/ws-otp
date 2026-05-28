-- ============================================================
-- OTP Activation Platform - MySQL Schema
-- Charset: utf8mb4 | Engine: InnoDB | Version: 8.0+
-- ============================================================

CREATE DATABASE IF NOT EXISTS `otp_activation`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `otp_activation`;

-- ── Users ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `users` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `telegram_id`   BIGINT UNSIGNED NOT NULL,
  `username`      VARCHAR(100)    DEFAULT NULL,
  `first_name`    VARCHAR(150)    NOT NULL DEFAULT '',
  `last_name`     VARCHAR(150)    DEFAULT NULL,
  `photo_url`     TEXT            DEFAULT NULL,
  `is_admin`      TINYINT(1)      NOT NULL DEFAULT 0,
  `is_banned`     TINYINT(1)      NOT NULL DEFAULT 0,
  `ban_reason`    VARCHAR(500)    DEFAULT NULL,
  `last_seen_at`  TIMESTAMP       NULL DEFAULT NULL,
  `created_at`    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_telegram_id` (`telegram_id`),
  INDEX `idx_username` (`username`),
  INDEX `idx_is_admin` (`is_admin`),
  INDEX `idx_is_banned` (`is_banned`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Wallets ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `wallets` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`         BIGINT UNSIGNED NOT NULL,
  `balance`         DECIMAL(18,4)   NOT NULL DEFAULT '0.0000',
  `locked_balance`  DECIMAL(18,4)   NOT NULL DEFAULT '0.0000',
  `total_earned`    DECIMAL(18,4)   NOT NULL DEFAULT '0.0000',
  `total_withdrawn` DECIMAL(18,4)   NOT NULL DEFAULT '0.0000',
  `created_at`      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_wallet_user` (`user_id`),
  CONSTRAINT `fk_wallet_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CHECK (`balance` >= 0),
  CHECK (`locked_balance` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Wallet Transactions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `wallet_transactions` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`       BIGINT UNSIGNED NOT NULL,
  `amount`        DECIMAL(18,4)   NOT NULL,
  `type`          ENUM(
                    'activation_reward',
                    'withdrawal',
                    'admin_adjustment',
                    'refund',
                    'withdrawal_lock',
                    'withdrawal_unlock'
                  ) NOT NULL,
  `ref`           VARCHAR(100)    NOT NULL COMMENT 'Idempotency key — unique per logical operation',
  `status`        ENUM('pending','completed','failed','reversed') NOT NULL DEFAULT 'completed',
  `balance_before` DECIMAL(18,4)  NOT NULL DEFAULT '0.0000',
  `balance_after`  DECIMAL(18,4)  NOT NULL DEFAULT '0.0000',
  `meta`          JSON            DEFAULT NULL COMMENT 'Extra context: activation_id, admin_id, etc.',
  `note`          VARCHAR(500)    DEFAULT NULL,
  `created_at`    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tx_ref` (`ref`),
  INDEX `idx_tx_user` (`user_id`),
  INDEX `idx_tx_type` (`type`),
  INDEX `idx_tx_status` (`status`),
  INDEX `idx_tx_created` (`created_at`),
  CONSTRAINT `fk_tx_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Country Prices ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `country_prices` (
  `id`              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `cc`              VARCHAR(5)      NOT NULL COMMENT 'Country calling code, e.g. 7',
  `country_name`    VARCHAR(100)    NOT NULL,
  `iso_code`        VARCHAR(3)      NOT NULL COMMENT 'ISO 3166-1 alpha-2 or alpha-3',
  `flag_emoji`      VARCHAR(10)     DEFAULT NULL,
  `payout_amount`   DECIMAL(10,4)   NOT NULL DEFAULT '0.0000',
  `is_active`       TINYINT(1)      NOT NULL DEFAULT 1,
  `api_account`     VARCHAR(100)    DEFAULT NULL COMMENT 'External API account for this country (NULL = use global)',
  `api_password`    VARCHAR(200)    DEFAULT NULL COMMENT 'External API password for this country (NULL = use global)',
  `api_identity`    VARCHAR(50)     DEFAULT 'Member' COMMENT 'External API identity field for this country',
  `created_at`      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cc` (`cc`),
  INDEX `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Activations ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `activations` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`           BIGINT UNSIGNED NOT NULL,
  `phone_full`        VARCHAR(25)     NOT NULL COMMENT 'Full number with country code',
  `phone_cc`          VARCHAR(5)      NOT NULL COMMENT 'Country calling code',
  `phone_local`       VARCHAR(20)     NOT NULL COMMENT 'Number without country code',
  `country_price_id`  INT UNSIGNED    DEFAULT NULL,
  `payout_amount`     DECIMAL(10,4)   NOT NULL DEFAULT '0.0000',
  `status`            ENUM(
                        'pending',
                        'in_progress',
                        'otp_uploaded',
                        'success',
                        'invalid',
                        'failed',
                        'expired'
                      ) NOT NULL DEFAULT 'pending',
  `otp_code`          VARCHAR(20)     DEFAULT NULL,
  `otp_uploaded_at`   TIMESTAMP       NULL DEFAULT NULL,
  `poll_attempts`     INT UNSIGNED    NOT NULL DEFAULT 0,
  `external_status`   TINYINT UNSIGNED DEFAULT NULL COMMENT '1=success,2=progress,3=invalid,6=wrong_otp',
  `api_add_response`  JSON            DEFAULT NULL,
  `completed_at`      TIMESTAMP       NULL DEFAULT NULL,
  `credited_at`       TIMESTAMP       NULL DEFAULT NULL,
  `credit_tx_ref`     VARCHAR(100)    DEFAULT NULL,
  `created_at`        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_act_user` (`user_id`),
  INDEX `idx_act_status` (`status`),
  INDEX `idx_act_phone` (`phone_full`),
  INDEX `idx_act_created` (`created_at`),
  UNIQUE KEY `uq_credit_ref` (`credit_tx_ref`),
  CONSTRAINT `fk_act_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_act_price` FOREIGN KEY (`country_price_id`) REFERENCES `country_prices` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Withdrawals ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `withdrawals` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`     BIGINT UNSIGNED NOT NULL,
  `amount`      DECIMAL(18,4)   NOT NULL,
  `method`      ENUM('binance_id','usdt_trc20','usdt_bep20') NOT NULL,
  `address`     VARCHAR(500)    NOT NULL,
  `status`      ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  `admin_note`  VARCHAR(1000)   DEFAULT NULL,
  `reviewed_by` BIGINT UNSIGNED DEFAULT NULL,
  `reviewed_at` TIMESTAMP       NULL DEFAULT NULL,
  `lock_tx_ref` VARCHAR(100)    DEFAULT NULL COMMENT 'Reference to balance lock transaction',
  `created_at`  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_wd_user` (`user_id`),
  INDEX `idx_wd_status` (`status`),
  INDEX `idx_wd_created` (`created_at`),
  CONSTRAINT `fk_wd_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wd_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Admin Audit Logs ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `admin_logs` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `admin_id`    BIGINT UNSIGNED NOT NULL,
  `action`      VARCHAR(100)    NOT NULL,
  `target_type` VARCHAR(50)     DEFAULT NULL,
  `target_id`   BIGINT UNSIGNED DEFAULT NULL,
  `meta`        JSON            DEFAULT NULL,
  `ip_address`  VARCHAR(45)     DEFAULT NULL,
  `created_at`  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_alog_admin` (`admin_id`),
  INDEX `idx_alog_action` (`action`),
  INDEX `idx_alog_created` (`created_at`),
  CONSTRAINT `fk_alog_admin` FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── External API Logs ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `api_logs` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `endpoint`    VARCHAR(200)    NOT NULL,
  `method`      VARCHAR(10)     NOT NULL DEFAULT 'GET',
  `request_data` JSON           DEFAULT NULL,
  `response_data` JSON          DEFAULT NULL,
  `status_code` SMALLINT        DEFAULT NULL,
  `duration_ms` INT             DEFAULT NULL,
  `error`       TEXT            DEFAULT NULL,
  `created_at`  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_apilog_endpoint` (`endpoint`),
  INDEX `idx_apilog_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Token Cache (global) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `token_cache` (
  `key_name`    VARCHAR(100)    NOT NULL,
  `value`       TEXT            NOT NULL,
  `expires_at`  TIMESTAMP       NOT NULL,
  `created_at`  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Per-Country Token Cache ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `country_token_cache` (
  `cc`         VARCHAR(5)   NOT NULL COMMENT 'Country calling code',
  `token`      TEXT         NOT NULL COMMENT 'Bearer token from external API',
  `expires_at` TIMESTAMP    NOT NULL,
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`cc`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ────────────────────────────────────────────────────────────────────────────
-- Seed: Default country prices
-- ────────────────────────────────────────────────────────────────────────────
INSERT IGNORE INTO `country_prices`
  (`cc`, `country_name`, `iso_code`, `flag_emoji`, `payout_amount`, `is_active`)
VALUES
  ('7',   'Russia',       'RU',  '🇷🇺', 0.3000, 1),
  ('62',  'Indonesia',    'ID',  '🇮🇩', 0.5000, 1),
  ('91',  'India',        'IN',  '🇮🇳', 0.2500, 1),
  ('1',   'USA / Canada', 'US',  '🇺🇸', 0.4000, 1),
  ('55',  'Brazil',       'BR',  '🇧🇷', 0.3500, 1),
  ('971', 'UAE',          'AE',  '🇦🇪', 0.6000, 1),
  ('44',  'UK',           'GB',  '🇬🇧', 0.4500, 1),
  ('49',  'Germany',      'DE',  '🇩🇪', 0.4000, 1),
  ('86',  'China',        'CN',  '🇨🇳', 0.4500, 1),
  ('20',  'Egypt',        'EG',  '🇪🇬', 0.2000, 1),
  ('92',  'Pakistan',     'PK',  '🇵🇰', 0.2000, 1),
  ('880', 'Bangladesh',   'BD',  '🇧🇩', 0.2000, 1),
  ('84',  'Vietnam',      'VN',  '🇻🇳', 0.3000, 1),
  ('380', 'Ukraine',      'UA',  '🇺🇦', 0.3000, 1),
  ('998', 'Uzbekistan',   'UZ',  '🇺🇿', 0.2500, 1);
