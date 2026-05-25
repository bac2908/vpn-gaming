-- =====================================================
-- VPN Gaming Platform - Grants and Documentation
-- PostgreSQL 15+
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
