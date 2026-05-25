-- =====================================================
-- VPN Gaming Platform - Full Database Initialization
-- PostgreSQL 15+
-- =====================================================
-- Seed data is kept in seeds/seed.sql and should be run separately when needed.

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- USERS AND AUTH
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email CITEXT NOT NULL,
    display_name TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    status TEXT NOT NULL DEFAULT 'active',
    balance BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT ck_users_role CHECK (role IN ('user', 'admin', 'moderator')),
    CONSTRAINT ck_users_status CHECK (status IN ('pending', 'active', 'suspended', 'banned')),
    CONSTRAINT ck_users_balance_non_negative CHECK (balance >= 0)
);

CREATE TABLE IF NOT EXISTS credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_credentials_user_id UNIQUE (user_id),
    CONSTRAINT ck_credentials_password_hash_not_empty CHECK (password_hash <> '')
);

CREATE TABLE IF NOT EXISTS identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    subject TEXT NOT NULL,
    access_token_enc BYTEA,
    refresh_token_enc BYTEA,
    expires_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    CONSTRAINT uq_identities_provider_subject UNIQUE (provider, subject),
    CONSTRAINT ck_identities_provider CHECK (provider IN ('google', 'github', 'facebook', 'oauth'))
);

CREATE TABLE IF NOT EXISTS email_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_email_verifications_token_hash UNIQUE (token_hash),
    CONSTRAINT ck_email_verifications_consumed_before_expiry CHECK (consumed_at IS NULL OR consumed_at <= expires_at)
);

CREATE TABLE IF NOT EXISTS password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_password_resets_token_hash UNIQUE (token_hash),
    CONSTRAINT ck_password_resets_consumed_before_expiry CHECK (consumed_at IS NULL OR consumed_at <= expires_at)
);

CREATE TABLE IF NOT EXISTS revoked_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_revoked_tokens_token_hash UNIQUE (token_hash)
);

-- =====================================================
-- MACHINES AND SESSIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS machines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL,
    region TEXT,
    ping_ms INTEGER,
    gpu TEXT,
    status TEXT NOT NULL DEFAULT 'idle',
    last_heartbeat TIMESTAMPTZ,
    location TEXT,
    CONSTRAINT uq_machines_code UNIQUE (code),
    CONSTRAINT ck_machines_status CHECK (status IN ('idle', 'busy', 'maintenance', 'offline')),
    CONSTRAINT ck_machines_ping_non_negative CHECK (ping_ms IS NULL OR ping_ms >= 0)
);

CREATE TABLE IF NOT EXISTS service_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price_cents BIGINT NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'VND',
    duration_days INTEGER NOT NULL DEFAULT 30,
    data_limit_gb INTEGER,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_service_plans_code UNIQUE (code),
    CONSTRAINT ck_service_plans_price_non_negative CHECK (price_cents >= 0),
    CONSTRAINT ck_service_plans_currency_vnd CHECK (currency = 'VND'),
    CONSTRAINT ck_service_plans_duration_positive CHECK (duration_days > 0),
    CONSTRAINT ck_service_plans_data_limit_positive CHECK (data_limit_gb IS NULL OR data_limit_gb > 0)
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES service_plans(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'active',
    start_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    end_at TIMESTAMPTZ,
    auto_renew BOOLEAN NOT NULL DEFAULT false,
    canceled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_subscriptions_status CHECK (status IN ('active', 'canceled', 'expired')),
    CONSTRAINT ck_subscriptions_valid_period CHECK (end_at IS NULL OR end_at > start_at)
);

CREATE TABLE IF NOT EXISTS vpn_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    machine_id UUID REFERENCES machines(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'active',
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    ip_address INET,
    bytes_up BIGINT NOT NULL DEFAULT 0,
    bytes_down BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT ck_vpn_sessions_status CHECK (status IN ('active', 'stopped', 'failed')),
    CONSTRAINT ck_vpn_sessions_valid_period CHECK (ended_at IS NULL OR ended_at > started_at),
    CONSTRAINT ck_vpn_sessions_bytes_up_non_negative CHECK (bytes_up >= 0),
    CONSTRAINT ck_vpn_sessions_bytes_down_non_negative CHECK (bytes_down >= 0)
);

CREATE TABLE IF NOT EXISTS machine_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    session_id UUID REFERENCES vpn_sessions(id) ON DELETE SET NULL,
    level TEXT NOT NULL DEFAULT 'info',
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_machine_logs_level CHECK (level IN ('debug', 'info', 'warning', 'error'))
);

-- =====================================================
-- BILLING
-- =====================================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    order_id TEXT NOT NULL,
    request_id TEXT NOT NULL,
    amount BIGINT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'VND',
    provider TEXT NOT NULL DEFAULT 'momo',
    status TEXT NOT NULL DEFAULT 'pending',
    message TEXT,
    pay_url TEXT,
    trans_id TEXT,
    extra_data TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ,
    CONSTRAINT uq_payments_order_id UNIQUE (order_id),
    CONSTRAINT uq_payments_request_id UNIQUE (request_id),
    CONSTRAINT ck_payments_amount_positive CHECK (amount > 0),
    CONSTRAINT ck_payments_currency_vnd CHECK (currency = 'VND'),
    CONSTRAINT ck_payments_status CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS topup_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    amount BIGINT NOT NULL,
    balance_before BIGINT NOT NULL DEFAULT 0,
    balance_after BIGINT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    provider TEXT NOT NULL DEFAULT 'momo',
    description TEXT,
    trans_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT uq_topup_transactions_payment_id UNIQUE (payment_id),
    CONSTRAINT ck_topup_transactions_amount_positive CHECK (amount > 0),
    CONSTRAINT ck_topup_transactions_balance_before_non_negative CHECK (balance_before >= 0),
    CONSTRAINT ck_topup_transactions_balance_after_non_negative CHECK (balance_after >= 0),
    CONSTRAINT ck_topup_transactions_status CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled')),
    CONSTRAINT ck_topup_transactions_completed_after_created CHECK (completed_at IS NULL OR completed_at >= created_at)
);

-- =====================================================
-- ADMIN
-- =====================================================
CREATE TABLE IF NOT EXISTS admin_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    singleton_key BOOLEAN NOT NULL DEFAULT true,
    password_min_length INTEGER NOT NULL DEFAULT 8,
    password_require_upper BOOLEAN NOT NULL DEFAULT true,
    password_require_lower BOOLEAN NOT NULL DEFAULT true,
    password_require_digit BOOLEAN NOT NULL DEFAULT true,
    lockout_max_attempts INTEGER NOT NULL DEFAULT 5,
    lockout_minutes INTEGER NOT NULL DEFAULT 10,
    min_topup_amount BIGINT NOT NULL DEFAULT 10000,
    session_timeout_hours INTEGER NOT NULL DEFAULT 24,
    snapshot_retention_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_admin_settings_singleton UNIQUE (singleton_key),
    CONSTRAINT ck_admin_settings_password_min_length CHECK (password_min_length BETWEEN 8 AND 128),
    CONSTRAINT ck_admin_settings_lockout_max_attempts CHECK (lockout_max_attempts BETWEEN 1 AND 20),
    CONSTRAINT ck_admin_settings_lockout_minutes CHECK (lockout_minutes BETWEEN 1 AND 1440),
    CONSTRAINT ck_admin_settings_min_topup_amount CHECK (min_topup_amount >= 10000),
    CONSTRAINT ck_admin_settings_session_timeout_hours CHECK (session_timeout_hours BETWEEN 1 AND 168),
    CONSTRAINT ck_admin_settings_snapshot_retention_count CHECK (snapshot_retention_count BETWEEN 1 AND 10)
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS ix_users_status ON users(status);
CREATE INDEX IF NOT EXISTS ix_users_created_at ON users(created_at);

CREATE INDEX IF NOT EXISTS ix_identities_user_id ON identities(user_id);
CREATE INDEX IF NOT EXISTS ix_identities_last_login_at ON identities(last_login_at);

CREATE INDEX IF NOT EXISTS ix_email_verifications_user_id ON email_verifications(user_id);
CREATE INDEX IF NOT EXISTS ix_email_verifications_expires_at ON email_verifications(expires_at);

CREATE INDEX IF NOT EXISTS ix_password_resets_user_id ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS ix_password_resets_expires_at ON password_resets(expires_at);

CREATE INDEX IF NOT EXISTS ix_revoked_tokens_expires_at ON revoked_tokens(expires_at);

CREATE INDEX IF NOT EXISTS ix_machines_status ON machines(status);
CREATE INDEX IF NOT EXISTS ix_machines_region_status ON machines(region, status);
CREATE INDEX IF NOT EXISTS ix_machines_ping_ms ON machines(ping_ms);

CREATE INDEX IF NOT EXISTS ix_service_plans_active ON service_plans(active);

CREATE INDEX IF NOT EXISTS ix_subscriptions_user_status ON subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS ix_subscriptions_plan ON subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS ix_subscriptions_end_at ON subscriptions(end_at);
CREATE UNIQUE INDEX IF NOT EXISTS ux_subscriptions_one_active_user
    ON subscriptions(user_id)
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS ix_payments_user_status ON payments(user_id, status);
CREATE INDEX IF NOT EXISTS ix_payments_subscription_id ON payments(subscription_id);
CREATE INDEX IF NOT EXISTS ix_payments_provider ON payments(provider);
CREATE INDEX IF NOT EXISTS ix_payments_created_at ON payments(created_at);

CREATE INDEX IF NOT EXISTS ix_vpn_sessions_user ON vpn_sessions(user_id);
CREATE INDEX IF NOT EXISTS ix_vpn_sessions_machine ON vpn_sessions(machine_id);
CREATE INDEX IF NOT EXISTS ix_vpn_sessions_status ON vpn_sessions(status);
CREATE INDEX IF NOT EXISTS ix_vpn_sessions_started_at ON vpn_sessions(started_at);
CREATE UNIQUE INDEX IF NOT EXISTS ux_vpn_sessions_one_active_machine
    ON vpn_sessions(machine_id)
    WHERE machine_id IS NOT NULL AND status = 'active' AND ended_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_machine_logs_machine ON machine_logs(machine_id);
CREATE INDEX IF NOT EXISTS ix_machine_logs_session ON machine_logs(session_id);
CREATE INDEX IF NOT EXISTS ix_machine_logs_level ON machine_logs(level);
CREATE INDEX IF NOT EXISTS ix_machine_logs_created_at ON machine_logs(created_at);

CREATE INDEX IF NOT EXISTS ix_topup_transactions_user_id ON topup_transactions(user_id);
CREATE INDEX IF NOT EXISTS ix_topup_transactions_status ON topup_transactions(status);
CREATE INDEX IF NOT EXISTS ix_topup_transactions_created_at ON topup_transactions(created_at);
CREATE INDEX IF NOT EXISTS ix_topup_transactions_provider ON topup_transactions(provider);

-- =====================================================
-- VIEWS
-- =====================================================
CREATE OR REPLACE VIEW active_users AS
SELECT
    u.id,
    u.email,
    u.display_name,
    u.role,
    u.balance,
    u.created_at,
    COUNT(vs.id) AS total_sessions,
    MAX(vs.started_at) AS last_session_at
FROM users u
LEFT JOIN vpn_sessions vs ON u.id = vs.user_id
WHERE u.status = 'active'
GROUP BY u.id, u.email, u.display_name, u.role, u.balance, u.created_at;

CREATE OR REPLACE VIEW machine_stats AS
SELECT
    m.id,
    m.code,
    m.region,
    m.gpu,
    m.status,
    COUNT(vs.id) AS total_sessions,
    COUNT(vs.id) FILTER (WHERE vs.status = 'active' AND vs.ended_at IS NULL) AS active_sessions,
    AVG(EXTRACT(EPOCH FROM (COALESCE(vs.ended_at, now()) - vs.started_at))) AS avg_session_duration_sec
FROM machines m
LEFT JOIN vpn_sessions vs ON m.id = vs.machine_id
GROUP BY m.id, m.code, m.region, m.gpu, m.status;

CREATE OR REPLACE VIEW revenue_daily AS
SELECT
    date_trunc('day', created_at)::date AS revenue_date,
    COUNT(*) AS transaction_count,
    COALESCE(SUM(amount), 0) AS total_amount
FROM topup_transactions
WHERE status = 'succeeded'
GROUP BY date_trunc('day', created_at)::date;

-- =====================================================
-- GRANTS AND COMMENTS
-- =====================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vpn_user') THEN
        EXECUTE 'GRANT USAGE ON SCHEMA public TO vpn_user';
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO vpn_user';
        EXECUTE 'GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO vpn_user';
        EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO vpn_user';
        EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO vpn_user';
    END IF;
END $$;

COMMENT ON TABLE users IS 'Application users and account balance.';
COMMENT ON COLUMN users.email IS 'Case-insensitive email address via CITEXT.';
COMMENT ON COLUMN users.balance IS 'Account balance in VND.';
COMMENT ON TABLE credentials IS 'One password credential row per local user.';
COMMENT ON TABLE identities IS 'OAuth identities linked to users.';
COMMENT ON TABLE email_verifications IS 'Email verification tokens stored as hashes.';
COMMENT ON TABLE password_resets IS 'Password reset tokens stored as hashes.';
COMMENT ON TABLE revoked_tokens IS 'JWT revocation list keyed by token hash.';
COMMENT ON TABLE machines IS 'Cloud gaming or VPN machines available to users.';
COMMENT ON TABLE service_plans IS 'Purchasable service plans; price_cents currently stores VND amount.';
COMMENT ON TABLE subscriptions IS 'User plan ownership windows.';
COMMENT ON TABLE vpn_sessions IS 'User machine sessions and traffic counters.';
COMMENT ON TABLE machine_logs IS 'Operational logs emitted by machines or sessions.';
COMMENT ON TABLE payments IS 'External payment attempts, primarily MoMo.';
COMMENT ON TABLE topup_transactions IS 'Balance top-up ledger entries.';
COMMENT ON COLUMN topup_transactions.balance_before IS 'Balance snapshot before this top-up is applied.';
COMMENT ON COLUMN topup_transactions.balance_after IS 'Balance snapshot after this top-up is applied.';
COMMENT ON TABLE admin_settings IS 'Persisted admin-configurable security and operation settings.';
COMMENT ON VIEW active_users IS 'Active users with last VPN session summary.';
COMMENT ON VIEW machine_stats IS 'Machine utilization summary based on vpn_sessions.';
COMMENT ON VIEW revenue_daily IS 'Succeeded top-up revenue grouped by day.';

SELECT 'Database schema initialization completed' AS "Status";
