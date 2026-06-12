from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import get_settings
from app.core.logging import get_logger

settings = get_settings()
logger = get_logger(__name__)

engine = create_engine(
    settings.sqlalchemy_database_url,
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def init_database():
    """Initialize database: create pgcrypto extension and all tables."""
    # Attempt to ensure pgcrypto extension; continue if DB user lacks permission.
    with engine.begin() as conn:
        try:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto"))
        except SQLAlchemyError as exc:
            logger.warning("Could not ensure pgcrypto extension: %s", exc)
    
    # Import models to ensure they're registered with Base
    from app import models  # noqa: F401
    
    # Create all tables
    Base.metadata.create_all(bind=engine)

    # Existing deployments may already have tables; create_all will not add new columns.
    with engine.begin() as conn:
        try:
            conn.execute(text("""
                ALTER TABLE users
                    ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0,
                    ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
                    ADD COLUMN IF NOT EXISTS last_failed_login_at TIMESTAMPTZ
            """))
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_users_locked_until
                    ON users(locked_until)
                    WHERE locked_until IS NOT NULL
            """))
            conn.execute(text("""
                ALTER TABLE machines
                    ADD COLUMN IF NOT EXISTS cooldown_until TIMESTAMPTZ,
                    ADD COLUMN IF NOT EXISTS base_rate_per_minute INTEGER NOT NULL DEFAULT 0,
                    ADD COLUMN IF NOT EXISTS trial_eligible BOOLEAN NOT NULL DEFAULT false
            """))
            conn.execute(text("UPDATE machines SET status = 'running' WHERE status = 'busy'"))
            conn.execute(text("""
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
                WHERE COALESCE(base_rate_per_minute, 0) = 0
            """))
            conn.execute(text("""
                UPDATE machines
                SET trial_eligible = true
                WHERE code IN (
                    'VN-01',
                    'VN-02',
                    'SG-01',
                    'VN-TRIAL-HAN-3070',
                    'VN-TRIAL-HCM-3070',
                    'HK-TRIAL-3080-01',
                    'HK-TRIAL-3080-02',
                    'KR-TRIAL-3080-01'
                )
            """))
            conn.execute(text("""
                ALTER TABLE machines DROP CONSTRAINT IF EXISTS ck_machines_status
            """))
            conn.execute(text("""
                ALTER TABLE machines
                    ADD CONSTRAINT ck_machines_status
                    CHECK (status IN ('idle', 'busy', 'running', 'suspended', 'maintenance', 'offline'))
            """))
            conn.execute(text("""
                ALTER TABLE vpn_sessions
                    ADD COLUMN IF NOT EXISTS billing_tier TEXT,
                    ADD COLUMN IF NOT EXISTS play_rate_per_minute INTEGER NOT NULL DEFAULT 0,
                    ADD COLUMN IF NOT EXISTS billing_started_at TIMESTAMPTZ,
                    ADD COLUMN IF NOT EXISTS last_billed_at TIMESTAMPTZ,
                    ADD COLUMN IF NOT EXISTS charged_minutes INTEGER NOT NULL DEFAULT 0,
                    ADD COLUMN IF NOT EXISTS charged_amount BIGINT NOT NULL DEFAULT 0,
                    ADD COLUMN IF NOT EXISTS free_minutes_used INTEGER NOT NULL DEFAULT 0,
                    ADD COLUMN IF NOT EXISTS trial_eligible BOOLEAN NOT NULL DEFAULT false,
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
                    ADD COLUMN IF NOT EXISTS refund_status TEXT NOT NULL DEFAULT 'none'
            """))
            conn.execute(text("""
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
                    event_type TEXT NOT NULL DEFAULT 'charge',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )
            """))
            conn.execute(text("""
                ALTER TABLE session_billing_events
                    ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'charge'
            """))
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_session_billing_events_user_day
                    ON session_billing_events(user_id, billing_day)
            """))
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_vpn_sessions_snapshot_retained
                    ON vpn_sessions(user_id, snapshot_retained, ended_at)
            """))
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_session_billing_events_session
                    ON session_billing_events(session_id)
            """))
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_support_tickets_user_status
                    ON support_tickets(user_id, status)
            """))
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_support_tickets_status_created
                    ON support_tickets(status, created_at)
            """))
            conn.execute(text("""
                ALTER TABLE admin_settings DROP CONSTRAINT IF EXISTS ck_admin_settings_snapshot_retention_count
            """))
            conn.execute(text("""
                ALTER TABLE admin_settings
                    ADD CONSTRAINT ck_admin_settings_snapshot_retention_count
                    CHECK (snapshot_retention_count BETWEEN 1 AND 20)
            """))
        except SQLAlchemyError as exc:
            logger.warning("Could not ensure billing schema: %s", exc)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
