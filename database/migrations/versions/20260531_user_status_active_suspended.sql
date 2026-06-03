-- Restrict user statuses to active/suspended while preserving pending for payments.

BEGIN;

UPDATE users
SET status = 'active'
WHERE status = 'pending';

UPDATE users
SET status = 'suspended'
WHERE status = 'banned';

ALTER TABLE users
    DROP CONSTRAINT IF EXISTS ck_users_status;

ALTER TABLE users
    ADD CONSTRAINT ck_users_status CHECK (status IN ('active', 'suspended')) NOT VALID;

ALTER TABLE users
    VALIDATE CONSTRAINT ck_users_status;

COMMIT;
