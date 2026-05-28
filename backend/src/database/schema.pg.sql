-- ============================================================
-- OTP Activation Platform - PostgreSQL Schema
-- ============================================================

-- ── Users ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL       NOT NULL,
  telegram_id   BIGINT          NOT NULL,
  username      VARCHAR(100)    DEFAULT NULL,
  first_name    VARCHAR(150)    NOT NULL DEFAULT '',
  last_name     VARCHAR(150)    DEFAULT NULL,
  photo_url     TEXT            DEFAULT NULL,
  is_admin      SMALLINT        NOT NULL DEFAULT 0,
  is_banned     SMALLINT        NOT NULL DEFAULT 0,
  ban_reason    VARCHAR(500)    DEFAULT NULL,
  last_seen_at  TIMESTAMPTZ     NULL DEFAULT NULL,
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  CONSTRAINT uq_telegram_id UNIQUE (telegram_id)
);
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users (is_admin);
CREATE INDEX IF NOT EXISTS idx_users_is_banned ON users (is_banned);

-- ── Wallets ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallets (
  id              BIGSERIAL       NOT NULL,
  user_id         BIGINT          NOT NULL,
  balance         NUMERIC(18,4)   NOT NULL DEFAULT 0.0000,
  locked_balance  NUMERIC(18,4)   NOT NULL DEFAULT 0.0000,
  total_earned    NUMERIC(18,4)   NOT NULL DEFAULT 0.0000,
  total_withdrawn NUMERIC(18,4)   NOT NULL DEFAULT 0.0000,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  CONSTRAINT uq_wallet_user UNIQUE (user_id),
  CONSTRAINT fk_wallet_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_balance CHECK (balance >= 0),
  CONSTRAINT chk_locked_balance CHECK (locked_balance >= 0)
);

-- ── Wallet Transactions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id            BIGSERIAL       NOT NULL,
  user_id       BIGINT          NOT NULL,
  amount        NUMERIC(18,4)   NOT NULL,
  type          VARCHAR(30)     NOT NULL,
  ref           VARCHAR(100)    NOT NULL,
  status        VARCHAR(20)     NOT NULL DEFAULT 'completed',
  balance_before NUMERIC(18,4)  NOT NULL DEFAULT 0.0000,
  balance_after  NUMERIC(18,4)  NOT NULL DEFAULT 0.0000,
  meta          JSONB           DEFAULT NULL,
  note          VARCHAR(500)    DEFAULT NULL,
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  CONSTRAINT uq_tx_ref UNIQUE (ref),
  CONSTRAINT fk_tx_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_tx_user ON wallet_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_tx_type ON wallet_transactions (type);
CREATE INDEX IF NOT EXISTS idx_tx_status ON wallet_transactions (status);
CREATE INDEX IF NOT EXISTS idx_tx_created ON wallet_transactions (created_at);

-- ── Country Prices ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS country_prices (
  id              SERIAL          NOT NULL,
  cc              VARCHAR(5)      NOT NULL,
  country_name    VARCHAR(100)    NOT NULL,
  iso_code        VARCHAR(3)      NOT NULL,
  flag_emoji      VARCHAR(10)     DEFAULT NULL,
  payout_amount   NUMERIC(10,4)   NOT NULL DEFAULT 0.0000,
  is_active       SMALLINT        NOT NULL DEFAULT 1,
  api_account     VARCHAR(100)    DEFAULT NULL,
  api_password    VARCHAR(200)    DEFAULT NULL,
  api_identity    VARCHAR(50)     DEFAULT 'Member',
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  CONSTRAINT uq_cc UNIQUE (cc)
);
CREATE INDEX IF NOT EXISTS idx_country_is_active ON country_prices (is_active);

-- ── Activations ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activations (
  id                BIGSERIAL       NOT NULL,
  user_id           BIGINT          NOT NULL,
  phone_full        VARCHAR(25)     NOT NULL,
  phone_cc          VARCHAR(5)      NOT NULL,
  phone_local       VARCHAR(20)     NOT NULL,
  country_price_id  INT             DEFAULT NULL,
  payout_amount     NUMERIC(10,4)   NOT NULL DEFAULT 0.0000,
  status            VARCHAR(20)     NOT NULL DEFAULT 'pending',
  otp_code          VARCHAR(20)     DEFAULT NULL,
  otp_uploaded_at   TIMESTAMPTZ     NULL DEFAULT NULL,
  poll_attempts     INT             NOT NULL DEFAULT 0,
  external_status   SMALLINT        DEFAULT NULL,
  api_add_response  JSONB           DEFAULT NULL,
  completed_at      TIMESTAMPTZ     NULL DEFAULT NULL,
  credited_at       TIMESTAMPTZ     NULL DEFAULT NULL,
  credit_tx_ref     VARCHAR(100)    DEFAULT NULL,
  created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  CONSTRAINT uq_credit_ref UNIQUE (credit_tx_ref),
  CONSTRAINT fk_act_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_act_price FOREIGN KEY (country_price_id) REFERENCES country_prices (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_act_user ON activations (user_id);
CREATE INDEX IF NOT EXISTS idx_act_status ON activations (status);
CREATE INDEX IF NOT EXISTS idx_act_phone ON activations (phone_full);
CREATE INDEX IF NOT EXISTS idx_act_created ON activations (created_at);

-- ── Withdrawals ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS withdrawals (
  id          BIGSERIAL       NOT NULL,
  user_id     BIGINT          NOT NULL,
  amount      NUMERIC(18,4)   NOT NULL,
  method      VARCHAR(20)     NOT NULL,
  address     VARCHAR(500)    NOT NULL,
  status      VARCHAR(20)     NOT NULL DEFAULT 'pending',
  admin_note  VARCHAR(1000)   DEFAULT NULL,
  reviewed_by BIGINT          DEFAULT NULL,
  reviewed_at TIMESTAMPTZ     NULL DEFAULT NULL,
  lock_tx_ref VARCHAR(100)    DEFAULT NULL,
  created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  CONSTRAINT fk_wd_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_wd_reviewer FOREIGN KEY (reviewed_by) REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_wd_user ON withdrawals (user_id);
CREATE INDEX IF NOT EXISTS idx_wd_status ON withdrawals (status);
CREATE INDEX IF NOT EXISTS idx_wd_created ON withdrawals (created_at);

-- ── Admin Audit Logs ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_logs (
  id          BIGSERIAL       NOT NULL,
  admin_id    BIGINT          NOT NULL,
  action      VARCHAR(100)    NOT NULL,
  target_type VARCHAR(50)     DEFAULT NULL,
  target_id   BIGINT          DEFAULT NULL,
  meta        JSONB           DEFAULT NULL,
  ip_address  VARCHAR(45)     DEFAULT NULL,
  created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  CONSTRAINT fk_alog_admin FOREIGN KEY (admin_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_alog_admin ON admin_logs (admin_id);
CREATE INDEX IF NOT EXISTS idx_alog_action ON admin_logs (action);
CREATE INDEX IF NOT EXISTS idx_alog_created ON admin_logs (created_at);

-- ── External API Logs ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_logs (
  id            BIGSERIAL       NOT NULL,
  endpoint      VARCHAR(200)    NOT NULL,
  method        VARCHAR(10)     NOT NULL DEFAULT 'GET',
  request_data  JSONB           DEFAULT NULL,
  response_data JSONB           DEFAULT NULL,
  status_code   SMALLINT        DEFAULT NULL,
  duration_ms   INT             DEFAULT NULL,
  error         TEXT            DEFAULT NULL,
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_apilog_endpoint ON api_logs (endpoint);
CREATE INDEX IF NOT EXISTS idx_apilog_created ON api_logs (created_at);

-- ── Token Cache (global) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS token_cache (
  key_name    VARCHAR(100)    NOT NULL,
  value       TEXT            NOT NULL,
  expires_at  TIMESTAMPTZ     NOT NULL,
  created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  PRIMARY KEY (key_name)
);

-- ── Per-Country Token Cache ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS country_token_cache (
  cc          VARCHAR(5)      NOT NULL,
  token       TEXT            NOT NULL,
  expires_at  TIMESTAMPTZ     NOT NULL,
  created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cc)
);

-- ── Seed: Default country prices ────────────────────────────────────────────
INSERT INTO country_prices (cc, country_name, iso_code, flag_emoji, payout_amount, is_active)
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
  ('998', 'Uzbekistan',   'UZ',  '🇺🇿', 0.2500, 1)
ON CONFLICT (cc) DO NOTHING;
