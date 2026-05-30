-- ============================================================
-- OTP Activation Platform — Full Schema
-- Compatible with Neon PostgreSQL
-- ============================================================

-- Users
CREATE TABLE IF NOT EXISTS users (
  id           BIGSERIAL PRIMARY KEY,
  telegram_id  BIGINT      NOT NULL,
  username     VARCHAR(100),
  first_name   VARCHAR(150) NOT NULL DEFAULT '',
  last_name    VARCHAR(150),
  photo_url    TEXT,
  is_admin     SMALLINT    NOT NULL DEFAULT 0,
  is_banned    SMALLINT    NOT NULL DEFAULT 0,
  ban_reason   VARCHAR(500),
  last_seen_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_telegram_id    ON users (telegram_id);
CREATE INDEX        IF NOT EXISTS idx_users_is_admin ON users (is_admin);
CREATE INDEX        IF NOT EXISTS idx_users_is_banned ON users (is_banned);
CREATE INDEX        IF NOT EXISTS idx_users_username  ON users (username);

-- Wallets
CREATE TABLE IF NOT EXISTS wallets (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT  NOT NULL,
  balance         NUMERIC NOT NULL DEFAULT 0.0000,
  locked_balance  NUMERIC NOT NULL DEFAULT 0.0000,
  total_earned    NUMERIC NOT NULL DEFAULT 0.0000,
  total_withdrawn NUMERIC NOT NULL DEFAULT 0.0000,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_user ON wallets (user_id);

-- Wallet Transactions
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id             BIGSERIAL PRIMARY KEY,
  user_id        BIGINT      NOT NULL,
  amount         NUMERIC     NOT NULL,
  type           VARCHAR(30) NOT NULL,
  ref            VARCHAR(100) NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'completed',
  balance_before NUMERIC     NOT NULL DEFAULT 0.0000,
  balance_after  NUMERIC     NOT NULL DEFAULT 0.0000,
  meta           JSONB,
  note           VARCHAR(500),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tx_ref    ON wallet_transactions (ref);
CREATE INDEX        IF NOT EXISTS idx_tx_user    ON wallet_transactions (user_id);
CREATE INDEX        IF NOT EXISTS idx_tx_type    ON wallet_transactions (type);
CREATE INDEX        IF NOT EXISTS idx_tx_status  ON wallet_transactions (status);
CREATE INDEX        IF NOT EXISTS idx_tx_created ON wallet_transactions (created_at);

-- Country Prices
CREATE TABLE IF NOT EXISTS country_prices (
  id           SERIAL PRIMARY KEY,
  cc           VARCHAR(5)   NOT NULL,
  country_name VARCHAR(100) NOT NULL,
  iso_code     VARCHAR(3)   NOT NULL,
  flag_emoji   VARCHAR(10),
  payout_amount NUMERIC     NOT NULL DEFAULT 0.0000,
  is_active    SMALLINT     NOT NULL DEFAULT 1,
  api_account  VARCHAR(100),
  api_password VARCHAR(200),
  api_identity VARCHAR(50)  DEFAULT 'Member',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cc              ON country_prices (cc);
CREATE INDEX        IF NOT EXISTS idx_country_is_active ON country_prices (is_active);

-- Country Token Cache
CREATE TABLE IF NOT EXISTS country_token_cache (
  cc         VARCHAR(5)  PRIMARY KEY,
  token      TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Token Cache (general)
CREATE TABLE IF NOT EXISTS token_cache (
  key_name   VARCHAR(100) PRIMARY KEY,
  value      TEXT         NOT NULL,
  expires_at TIMESTAMPTZ  NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Activations
CREATE TABLE IF NOT EXISTS activations (
  id               BIGSERIAL PRIMARY KEY,
  user_id          BIGINT       NOT NULL,
  phone_full       VARCHAR(25)  NOT NULL,
  phone_cc         VARCHAR(5)   NOT NULL,
  phone_local      VARCHAR(20)  NOT NULL,
  country_price_id INTEGER,
  payout_amount    NUMERIC      NOT NULL DEFAULT 0.0000,
  status           VARCHAR(20)  NOT NULL DEFAULT 'pending',
  otp_code         VARCHAR(20),
  otp_uploaded_at  TIMESTAMPTZ,
  poll_attempts    INTEGER      NOT NULL DEFAULT 0,
  external_status  SMALLINT,
  api_add_response JSONB,
  completed_at     TIMESTAMPTZ,
  credited_at      TIMESTAMPTZ,
  credit_tx_ref    VARCHAR(100),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_ref  ON activations (credit_tx_ref) WHERE credit_tx_ref IS NOT NULL;
CREATE INDEX        IF NOT EXISTS idx_act_user    ON activations (user_id);
CREATE INDEX        IF NOT EXISTS idx_act_status  ON activations (status);
CREATE INDEX        IF NOT EXISTS idx_act_phone   ON activations (phone_full);
CREATE INDEX        IF NOT EXISTS idx_act_created ON activations (created_at);

-- Number Cooldowns (3-minute block after status 3, 4, or 6 failures)
CREATE TABLE IF NOT EXISTS number_cooldowns (
  id          BIGSERIAL    PRIMARY KEY,
  user_id     BIGINT       NOT NULL,
  phone_full  VARCHAR(25)  NOT NULL,
  failed_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  fail_reason VARCHAR(30),
  UNIQUE (user_id, phone_full)
);
CREATE INDEX IF NOT EXISTS idx_nc_user  ON number_cooldowns (user_id);
CREATE INDEX IF NOT EXISTS idx_nc_phone ON number_cooldowns (phone_full);

-- Withdrawals
CREATE TABLE IF NOT EXISTS withdrawals (
  id          BIGSERIAL    PRIMARY KEY,
  user_id     BIGINT       NOT NULL,
  amount      NUMERIC      NOT NULL,
  method      VARCHAR(20)  NOT NULL,
  address     VARCHAR(500) NOT NULL,
  status      VARCHAR(20)  NOT NULL DEFAULT 'pending',
  admin_note  VARCHAR(1000),
  reviewed_by BIGINT,
  reviewed_at TIMESTAMPTZ,
  lock_tx_ref VARCHAR(100),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wd_user    ON withdrawals (user_id);
CREATE INDEX IF NOT EXISTS idx_wd_status  ON withdrawals (status);
CREATE INDEX IF NOT EXISTS idx_wd_created ON withdrawals (created_at);

-- Admin Logs
CREATE TABLE IF NOT EXISTS admin_logs (
  id          BIGSERIAL    PRIMARY KEY,
  admin_id    BIGINT       NOT NULL,
  action      VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id   BIGINT,
  meta        JSONB,
  ip_address  VARCHAR(45),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alog_admin   ON admin_logs (admin_id);
CREATE INDEX IF NOT EXISTS idx_alog_action  ON admin_logs (action);
CREATE INDEX IF NOT EXISTS idx_alog_created ON admin_logs (created_at);

-- API Logs
CREATE TABLE IF NOT EXISTS api_logs (
  id            BIGSERIAL    PRIMARY KEY,
  endpoint      VARCHAR(200) NOT NULL,
  method        VARCHAR(10)  NOT NULL DEFAULT 'GET',
  request_data  JSONB,
  response_data JSONB,
  status_code   SMALLINT,
  duration_ms   INTEGER,
  error         TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_apilog_endpoint ON api_logs (endpoint);
CREATE INDEX IF NOT EXISTS idx_apilog_created  ON api_logs (created_at);

-- Payment Methods
CREATE TABLE IF NOT EXISTS payment_methods (
  id         SERIAL       PRIMARY KEY,
  method_id  VARCHAR(50)  NOT NULL,
  label      VARCHAR(100) NOT NULL,
  is_enabled BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ  DEFAULT NOW(),
  updated_at TIMESTAMPTZ  DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS payment_methods_method_id_key ON payment_methods (method_id);

-- App Settings
CREATE TABLE IF NOT EXISTS app_settings (
  key        VARCHAR(80)  PRIMARY KEY,
  value      TEXT         NOT NULL,
  updated_at TIMESTAMPTZ  DEFAULT NOW()
);

-- ── Seed Data ────────────────────────────────────────────────────────────────

-- Payment methods
INSERT INTO payment_methods (method_id, label, is_enabled) VALUES
  ('usdt_trc20', 'USDT TRC20', TRUE),
  ('usdt_bep20', 'USDT BEP20', TRUE),
  ('binance_id', 'Binance ID', TRUE)
ON CONFLICT (method_id) DO NOTHING;

-- App settings
INSERT INTO app_settings (key, value) VALUES
  ('default_language',      'en'),
  ('min_withdrawal_amount', '1')
ON CONFLICT (key) DO NOTHING;
