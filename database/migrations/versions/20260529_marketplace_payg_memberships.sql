-- Marketplace PAYG pricing: machine-owned rates, trial quota, membership benefits.

ALTER TABLE machines
    ADD COLUMN IF NOT EXISTS base_rate_per_minute INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS trial_eligible BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE vpn_sessions
    ADD COLUMN IF NOT EXISTS trial_eligible BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE machines DROP CONSTRAINT IF EXISTS ck_machines_base_rate_non_negative;
ALTER TABLE machines
    ADD CONSTRAINT ck_machines_base_rate_non_negative
    CHECK (base_rate_per_minute >= 0);

UPDATE machines
SET base_rate_per_minute = CASE
    WHEN gpu ILIKE '%4090%' THEN 250
    WHEN gpu ILIKE '%4080%' THEN 140
    WHEN gpu ILIKE '%3090%' THEN 120
    WHEN gpu ILIKE '%3080%' THEN 100
    WHEN gpu ILIKE '%3070%' THEN 80
    WHEN gpu ILIKE '%3060%' THEN 50
    WHEN gpu ILIKE '%2060%' THEN 50
    WHEN gpu ILIKE '%T4%' THEN 50
    ELSE 80
END
WHERE COALESCE(base_rate_per_minute, 0) = 0;

UPDATE machines SET trial_eligible = false;

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
    base_rate_per_minute = EXCLUDED.base_rate_per_minute,
    trial_eligible = EXCLUDED.trial_eligible,
    last_heartbeat = EXCLUDED.last_heartbeat;

UPDATE service_plans
SET description = CASE code
    WHEN 'basic' THEN '15% PAYG discount, light priority queue, 1 active snapshot, VN/SG preferred routing'
    WHEN 'pro' THEN '25% PAYG discount, priority queue, 5 active snapshots, longer sessions, APAC preferred routing'
    WHEN 'premium' THEN '36% PAYG discount, instant reserve queue, 20 active snapshots, global preferred routing, VIP support'
    ELSE description
END
WHERE code IN ('basic', 'pro', 'premium');

CREATE INDEX IF NOT EXISTS ix_machines_trial_eligible
    ON machines(trial_eligible, status);
CREATE INDEX IF NOT EXISTS ix_machines_base_rate
    ON machines(base_rate_per_minute);
