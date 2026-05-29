-- Add pay-per-minute billing metadata and daily billing ledger.

ALTER TABLE vpn_sessions
    ADD COLUMN IF NOT EXISTS billing_tier TEXT,
    ADD COLUMN IF NOT EXISTS play_rate_per_minute INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS billing_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_billed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS charged_minutes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS charged_amount BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS free_minutes_used INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS session_billing_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES vpn_sessions(id) ON DELETE SET NULL,
    machine_id UUID REFERENCES machines(id) ON DELETE SET NULL,
    billing_day DATE NOT NULL,
    tier TEXT NOT NULL,
    charged_minutes INTEGER NOT NULL DEFAULT 0,
    free_minutes INTEGER NOT NULL DEFAULT 0,
    amount BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_session_billing_events_user_day
    ON session_billing_events(user_id, billing_day);
CREATE INDEX IF NOT EXISTS ix_session_billing_events_session
    ON session_billing_events(session_id);
CREATE INDEX IF NOT EXISTS ix_session_billing_events_created_at
    ON session_billing_events(created_at);

UPDATE service_plans
SET price_cents = CASE code
    WHEN 'basic' THEN 49000
    WHEN 'pro' THEN 99000
    WHEN 'premium' THEN 199000
    ELSE price_cents
END,
description = CASE code
    WHEN 'basic' THEN 'RTX 3070, VN server, snapshot, light priority queue'
    WHEN 'pro' THEN 'RTX 4080, VN + SG server, realtime resume, priority queue'
    WHEN 'premium' THEN 'RTX 4090, global server, 20 active snapshots with archive, VIP support'
    ELSE description
END
WHERE code IN ('basic', 'pro', 'premium');

INSERT INTO machines (code, region, location, ping_ms, gpu, status, last_heartbeat)
VALUES ('VN-3060-01', 'Vietnam', 'Ho Chi Minh City - Free Tier Node', 9, 'NVIDIA RTX 3060', 'idle', now())
ON CONFLICT (code) DO UPDATE SET
    region = EXCLUDED.region,
    location = EXCLUDED.location,
    ping_ms = EXCLUDED.ping_ms,
    gpu = EXCLUDED.gpu,
    last_heartbeat = EXCLUDED.last_heartbeat;
