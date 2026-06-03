-- Restrict user roles to user/admin.

BEGIN;

UPDATE users
SET role = 'user'
WHERE role NOT IN ('user', 'admin');

ALTER TABLE users
    DROP CONSTRAINT IF EXISTS ck_users_role;

ALTER TABLE users
    ADD CONSTRAINT ck_users_role CHECK (role IN ('user', 'admin')) NOT VALID;

ALTER TABLE users
    VALIDATE CONSTRAINT ck_users_role;

DROP INDEX IF EXISTS uq_single_admin_role;

COMMIT;
