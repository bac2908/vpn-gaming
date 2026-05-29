-- =====================================================
-- VPN Gaming Platform - Indexes
-- PostgreSQL 15+
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
CREATE INDEX IF NOT EXISTS ix_machines_trial_eligible ON machines(trial_eligible, status);
CREATE INDEX IF NOT EXISTS ix_machines_base_rate ON machines(base_rate_per_minute);

CREATE INDEX IF NOT EXISTS ix_service_plans_active ON service_plans(active);

CREATE INDEX IF NOT EXISTS ix_subscriptions_user_status ON subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS ix_subscriptions_plan ON subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS ix_subscriptions_end_at ON subscriptions(end_at);

CREATE INDEX IF NOT EXISTS ix_payments_user_status ON payments(user_id, status);
CREATE INDEX IF NOT EXISTS ix_payments_subscription_id ON payments(subscription_id);
CREATE INDEX IF NOT EXISTS ix_payments_provider ON payments(provider);
CREATE INDEX IF NOT EXISTS ix_payments_created_at ON payments(created_at);

CREATE INDEX IF NOT EXISTS ix_vpn_sessions_user ON vpn_sessions(user_id);
CREATE INDEX IF NOT EXISTS ix_vpn_sessions_machine ON vpn_sessions(machine_id);
CREATE INDEX IF NOT EXISTS ix_vpn_sessions_status ON vpn_sessions(status);
CREATE INDEX IF NOT EXISTS ix_vpn_sessions_started_at ON vpn_sessions(started_at);
CREATE INDEX IF NOT EXISTS ix_vpn_sessions_snapshot_retained ON vpn_sessions(user_id, snapshot_retained, ended_at);
CREATE UNIQUE INDEX IF NOT EXISTS ux_vpn_sessions_one_active_machine
    ON vpn_sessions(machine_id)
    WHERE machine_id IS NOT NULL AND status = 'active' AND ended_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_session_billing_events_user_day ON session_billing_events(user_id, billing_day);
CREATE INDEX IF NOT EXISTS ix_session_billing_events_session ON session_billing_events(session_id);
CREATE INDEX IF NOT EXISTS ix_session_billing_events_created_at ON session_billing_events(created_at);

CREATE INDEX IF NOT EXISTS ix_machine_logs_machine ON machine_logs(machine_id);
CREATE INDEX IF NOT EXISTS ix_machine_logs_session ON machine_logs(session_id);
CREATE INDEX IF NOT EXISTS ix_machine_logs_level ON machine_logs(level);
CREATE INDEX IF NOT EXISTS ix_machine_logs_created_at ON machine_logs(created_at);

CREATE INDEX IF NOT EXISTS ix_topup_transactions_user_id ON topup_transactions(user_id);
CREATE INDEX IF NOT EXISTS ix_topup_transactions_status ON topup_transactions(status);
CREATE INDEX IF NOT EXISTS ix_topup_transactions_created_at ON topup_transactions(created_at);
CREATE INDEX IF NOT EXISTS ix_topup_transactions_provider ON topup_transactions(provider);
