-- Add support ticket workflow and persistent login lockout fields.

BEGIN;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_failed_login_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS ix_users_locked_until
    ON users(locked_until)
    WHERE locked_until IS NOT NULL;

CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    detail TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    admin_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

ALTER TABLE support_tickets
    DROP CONSTRAINT IF EXISTS ck_support_tickets_category,
    ADD CONSTRAINT ck_support_tickets_category
        CHECK (category IN ('payment', 'technical', 'account', 'other'));

ALTER TABLE support_tickets
    DROP CONSTRAINT IF EXISTS ck_support_tickets_status,
    ADD CONSTRAINT ck_support_tickets_status
        CHECK (status IN ('open', 'in_progress', 'resolved', 'closed'));

CREATE INDEX IF NOT EXISTS ix_support_tickets_user_status
    ON support_tickets(user_id, status);

CREATE INDEX IF NOT EXISTS ix_support_tickets_status_created
    ON support_tickets(status, created_at);

COMMIT;
