-- =====================================================
-- VPN Gaming Platform - Seed Data
-- PostgreSQL 15+
-- =====================================================
-- Run after init.sql:
--   psql -U vpn_user -d vpn_app -f seeds/seed.sql
--
-- Default demo credentials:
--   Admin: admin@example.com / Bn2908#2004
--   Demo:  demo@example.com  / demo123456

-- =====================================================
-- SERVICE PLANS
-- =====================================================
INSERT INTO service_plans (code, name, description, price_cents, currency, duration_days, data_limit_gb, active)
VALUES
    ('basic', 'Basic', '15% PAYG discount, light priority queue, 1 active snapshot, VN/SG preferred routing', 49000, 'VND', 30, 50, true),
    ('pro', 'Pro', '25% PAYG discount, priority queue, 5 active snapshots, longer sessions, APAC preferred routing', 99000, 'VND', 30, 100, true),
    ('premium', 'Premium', '36% PAYG discount, instant reserve queue, 20 active snapshots, global preferred routing, VIP support', 199000, 'VND', 30, NULL, true)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price_cents = EXCLUDED.price_cents,
    currency = EXCLUDED.currency,
    duration_days = EXCLUDED.duration_days,
    data_limit_gb = EXCLUDED.data_limit_gb,
    active = EXCLUDED.active;

-- =====================================================
-- MACHINES
-- =====================================================
INSERT INTO machines (code, region, location, ping_ms, gpu, status, last_heartbeat, base_rate_per_minute, trial_eligible)
VALUES
    ('VN-TRIAL-HAN-3070', 'Vietnam', 'Hanoi - Trial Node', 20, 'NVIDIA RTX 3070', 'idle', now(), 80, true),
    ('VN-TRIAL-HCM-3070', 'Vietnam', 'Ho Chi Minh City - Trial Node', 22, 'NVIDIA RTX 3070', 'idle', now(), 80, true),
    ('HK-TRIAL-3080-01', 'Hong Kong', 'Hong Kong - Trial Node 1', 38, 'NVIDIA RTX 3080', 'idle', now(), 100, true),
    ('HK-TRIAL-3080-02', 'Hong Kong', 'Hong Kong - Trial Node 2', 40, 'NVIDIA RTX 3080', 'idle', now(), 100, true),
    ('KR-TRIAL-3080-01', 'South Korea', 'Seoul - Trial Node', 55, 'NVIDIA RTX 3080', 'idle', now(), 100, true),
    ('SG-3080-01', 'Singapore', 'Singapore RTX3080 - Data Center 1', 32, 'NVIDIA RTX 3080', 'idle', now(), 100, false),
    ('SG-3080-02', 'Singapore', 'Singapore RTX3080 - Data Center 2', 35, 'NVIDIA RTX 3080', 'idle', now(), 100, false),
    ('JP-3080-01', 'Japan', 'Tokyo RTX3080 - Data Center 1', 45, 'NVIDIA RTX 3080', 'idle', now(), 105, false),
    ('JP-3080-02', 'Japan', 'Tokyo RTX3080 - Data Center 2', 48, 'NVIDIA RTX 3080', 'idle', now(), 105, false),
    ('KR-3080-01', 'South Korea', 'Seoul RTX3080 - Data Center', 58, 'NVIDIA RTX 3080', 'idle', now(), 100, false),
    ('SG-4080-01', 'Singapore', 'Singapore RTX4080 - Data Center 1', 28, 'NVIDIA RTX 4080', 'idle', now(), 140, false),
    ('SG-4080-02', 'Singapore', 'Singapore RTX4080 - Data Center 2', 30, 'NVIDIA RTX 4080', 'idle', now(), 140, false),
    ('JP-T4-01', 'Japan', 'Tokyo T4 - Data Center 1', 50, 'NVIDIA T4', 'idle', now(), 60, false),
    ('JP-T4-02', 'Japan', 'Tokyo T4 - Data Center 2', 52, 'NVIDIA T4', 'idle', now(), 60, false),
    ('AU-T4-01', 'Australia', 'Sydney T4 - Data Center 1', 90, 'NVIDIA T4', 'idle', now(), 55, false),
    ('AU-T4-02', 'Australia', 'Sydney T4 - Data Center 2', 95, 'NVIDIA T4', 'idle', now(), 55, false),
    ('US-T4-01', 'United States', 'San Jose T4 - Data Center 1', 160, 'NVIDIA T4', 'idle', now(), 50, false),
    ('US-T4-02', 'United States', 'San Jose T4 - Data Center 2', 165, 'NVIDIA T4', 'idle', now(), 50, false),
    ('US-T4-03', 'United States', 'San Jose T4 - Data Center 3', 170, 'NVIDIA T4', 'idle', now(), 50, false),
    ('US-T4-04', 'United States', 'San Jose T4 - Data Center 4', 175, 'NVIDIA T4', 'idle', now(), 50, false)
ON CONFLICT (code) DO UPDATE SET
    region = EXCLUDED.region,
    location = EXCLUDED.location,
    ping_ms = EXCLUDED.ping_ms,
    gpu = EXCLUDED.gpu,
    status = EXCLUDED.status,
    last_heartbeat = EXCLUDED.last_heartbeat,
    base_rate_per_minute = EXCLUDED.base_rate_per_minute,
    trial_eligible = EXCLUDED.trial_eligible;

-- =====================================================
-- USERS AND CREDENTIALS
-- =====================================================
INSERT INTO users (email, display_name, role, status, balance)
VALUES
    ('admin@example.com', 'System Administrator', 'admin', 'active', 0),
    ('demo@example.com', 'Demo User Account', 'user', 'active', 500000)
ON CONFLICT (email) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    balance = GREATEST(users.balance, EXCLUDED.balance);

INSERT INTO credentials (user_id, password_hash)
SELECT u.id, '$2b$12$PUKl.NkKcenbZ429HA5lAOn1NJpEcoryBoftIW5kCwp3b92MqdIWW'
FROM users u
WHERE u.email = 'admin@example.com'
ON CONFLICT (user_id) DO UPDATE SET password_hash = EXCLUDED.password_hash;

INSERT INTO credentials (user_id, password_hash)
SELECT u.id, '$2b$12$ha34lQE6VWr2MclRg1D/XeefqfwS1/usYejwPztruu.s8q3bSOiHC'
FROM users u
WHERE u.email = 'demo@example.com'
ON CONFLICT (user_id) DO UPDATE SET password_hash = EXCLUDED.password_hash;

INSERT INTO identities (user_id, provider, subject, access_token_enc, last_login_at)
SELECT u.id, 'google', 'demo-google-subject-12345', 'encrypted_token_data'::bytea, now()
FROM users u
WHERE u.email = 'demo@example.com'
ON CONFLICT (provider, subject) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    last_login_at = EXCLUDED.last_login_at;

-- =====================================================
-- SUBSCRIPTIONS
-- =====================================================
INSERT INTO subscriptions (user_id, plan_id, status, start_at, end_at, auto_renew)
SELECT u.id, sp.id, 'active', now() - INTERVAL '3 days', now() + INTERVAL '27 days', false
FROM users u
JOIN service_plans sp ON sp.code = 'basic'
WHERE u.email = 'demo@example.com'
AND NOT EXISTS (
    SELECT 1
    FROM subscriptions s
    WHERE s.user_id = u.id
      AND s.status = 'active'
      AND s.end_at > now()
);

-- =====================================================
-- PAYMENTS AND TOP-UP LEDGER
-- =====================================================
INSERT INTO payments (user_id, order_id, request_id, amount, currency, provider, status, message, trans_id, extra_data, created_at, updated_at)
SELECT u.id, 'SEED-MOMO-ORDER-001', 'SEED-MOMO-REQ-001', 500000, 'VND', 'momo', 'succeeded', 'Seed successful payment', 'MOMO-20260301-001', '', now() - INTERVAL '2 days', now() - INTERVAL '2 days'
FROM users u
WHERE u.email = 'demo@example.com'
ON CONFLICT (order_id) DO NOTHING;

INSERT INTO payments (user_id, order_id, request_id, amount, currency, provider, status, message, extra_data, created_at)
SELECT u.id, 'SEED-MOMO-ORDER-002', 'SEED-MOMO-REQ-002', 100000, 'VND', 'momo', 'pending', 'Seed pending payment', '', now() - INTERVAL '1 day'
FROM users u
WHERE u.email = 'demo@example.com'
ON CONFLICT (order_id) DO NOTHING;

INSERT INTO topup_transactions (user_id, payment_id, amount, balance_before, balance_after, status, provider, description, trans_id, created_at, completed_at)
SELECT u.id, p.id, p.amount, 0, 500000, 'succeeded', 'momo', 'Seed successful top-up', p.trans_id, p.created_at, p.updated_at
FROM users u
JOIN payments p ON p.order_id = 'SEED-MOMO-ORDER-001'
WHERE u.email = 'demo@example.com'
ON CONFLICT (payment_id) DO NOTHING;

INSERT INTO topup_transactions (user_id, payment_id, amount, balance_before, balance_after, status, provider, description, created_at)
SELECT u.id, p.id, p.amount, u.balance, u.balance, 'pending', 'momo', 'Seed pending top-up', p.created_at
FROM users u
JOIN payments p ON p.order_id = 'SEED-MOMO-ORDER-002'
WHERE u.email = 'demo@example.com'
ON CONFLICT (payment_id) DO NOTHING;

-- =====================================================
-- VPN SESSIONS
-- =====================================================
INSERT INTO vpn_sessions (user_id, subscription_id, machine_id, status, started_at, ended_at, ip_address, bytes_up, bytes_down)
SELECT u.id, s.id, m.id, 'stopped', TIMESTAMPTZ '2026-03-01 10:00:00+07', TIMESTAMPTZ '2026-03-01 11:30:00+07', '10.8.0.12', 420000000, 2100000000
FROM users u
JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
JOIN machines m ON m.code = 'SG-3080-01'
WHERE u.email = 'demo@example.com'
AND NOT EXISTS (
    SELECT 1
    FROM vpn_sessions vs
    WHERE vs.user_id = u.id
      AND vs.machine_id = m.id
      AND vs.started_at = TIMESTAMPTZ '2026-03-01 10:00:00+07'
);

INSERT INTO vpn_sessions (user_id, subscription_id, machine_id, status, started_at, ip_address, bytes_up, bytes_down)
SELECT u.id, s.id, m.id, 'active', now() - INTERVAL '30 minutes', '10.8.0.24', 12000000, 85000000
FROM users u
JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
JOIN machines m ON m.code = 'JP-3080-01'
WHERE u.email = 'demo@example.com'
AND NOT EXISTS (
    SELECT 1
    FROM vpn_sessions vs
    WHERE vs.machine_id = m.id
      AND vs.status = 'active'
      AND vs.ended_at IS NULL
);

-- =====================================================
-- MACHINE LOGS AND ADMIN SETTINGS
-- =====================================================
INSERT INTO machine_logs (machine_id, level, message)
SELECT m.id, 'info', 'Seed startup health check completed'
FROM machines m
WHERE m.code = 'SG-3080-01'
AND NOT EXISTS (
    SELECT 1
    FROM machine_logs ml
    WHERE ml.machine_id = m.id
      AND ml.message = 'Seed startup health check completed'
);

INSERT INTO machine_logs (machine_id, level, message)
SELECT m.id, 'info', 'Seed active demo session attached'
FROM machines m
WHERE m.code = 'JP-3080-01'
AND NOT EXISTS (
    SELECT 1
    FROM machine_logs ml
    WHERE ml.machine_id = m.id
      AND ml.message = 'Seed active demo session attached'
);

INSERT INTO admin_settings (
    password_min_length,
    password_require_upper,
    password_require_lower,
    password_require_digit,
    lockout_max_attempts,
    lockout_minutes,
    min_topup_amount,
    session_timeout_hours,
    snapshot_retention_count
)
SELECT 8, true, true, true, 5, 10, 10000, 24, 1
WHERE NOT EXISTS (SELECT 1 FROM admin_settings);

-- =====================================================
-- SUMMARY
-- =====================================================
SELECT 'Database seed completed successfully' AS "Status";
SELECT 'Machines' AS "Category", COUNT(*) AS "Count" FROM machines
UNION ALL
SELECT 'Users', COUNT(*) FROM users
UNION ALL
SELECT 'Service Plans', COUNT(*) FROM service_plans
UNION ALL
SELECT 'Subscriptions', COUNT(*) FROM subscriptions
UNION ALL
SELECT 'Payments', COUNT(*) FROM payments
UNION ALL
SELECT 'Top-up Transactions', COUNT(*) FROM topup_transactions
UNION ALL
SELECT 'VPN Sessions', COUNT(*) FROM vpn_sessions
UNION ALL
SELECT 'Machine Logs', COUNT(*) FROM machine_logs
UNION ALL
SELECT 'Admin Settings', COUNT(*) FROM admin_settings
ORDER BY "Category";
