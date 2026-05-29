-- Session state machine and production safety policy.

ALTER TABLE machines
    ADD COLUMN IF NOT EXISTS cooldown_until TIMESTAMPTZ;

UPDATE machines SET status = 'running' WHERE status = 'busy';

ALTER TABLE machines DROP CONSTRAINT IF EXISTS ck_machines_status;
ALTER TABLE machines
    ADD CONSTRAINT ck_machines_status
    CHECK (status IN ('idle', 'busy', 'running', 'suspended', 'maintenance', 'offline'));

ALTER TABLE vpn_sessions
    ADD COLUMN IF NOT EXISTS lifecycle_state TEXT NOT NULL DEFAULT 'running',
    ADD COLUMN IF NOT EXISTS billing_state TEXT NOT NULL DEFAULT 'free',
    ADD COLUMN IF NOT EXISTS connection_state TEXT NOT NULL DEFAULT 'connected',
    ADD COLUMN IF NOT EXISTS last_client_heartbeat_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_stream_activity_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS disconnected_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS idle_warning_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS stop_reason TEXT,
    ADD COLUMN IF NOT EXISTS max_session_seconds INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS grace_period_seconds INTEGER NOT NULL DEFAULT 300,
    ADD COLUMN IF NOT EXISTS idle_warning_seconds INTEGER NOT NULL DEFAULT 600,
    ADD COLUMN IF NOT EXISTS idle_stop_seconds INTEGER NOT NULL DEFAULT 900,
    ADD COLUMN IF NOT EXISTS cooldown_seconds INTEGER NOT NULL DEFAULT 60,
    ADD COLUMN IF NOT EXISTS queue_priority INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS max_concurrent_sessions INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS snapshot_active_limit INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS snapshot_retained BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS snapshot_archived_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS refunded_amount BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS refund_reason TEXT,
    ADD COLUMN IF NOT EXISTS refund_status TEXT NOT NULL DEFAULT 'none';

ALTER TABLE session_billing_events
    ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'charge';

CREATE INDEX IF NOT EXISTS ix_vpn_sessions_snapshot_retained
    ON vpn_sessions(user_id, snapshot_retained, ended_at);

ALTER TABLE admin_settings DROP CONSTRAINT IF EXISTS ck_admin_settings_snapshot_retention_count;
ALTER TABLE admin_settings
    ADD CONSTRAINT ck_admin_settings_snapshot_retention_count
    CHECK (snapshot_retention_count BETWEEN 1 AND 20);
