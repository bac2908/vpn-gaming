from datetime import date, datetime
from uuid import UUID

from sqlalchemy import case, func, or_
from sqlalchemy.orm import Session

from app import models


class MachineRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_machines(
        self,
        page: int,
        page_size: int,
        region: str | None,
        gpu: str | None,
        status: str | None,
        min_ping: int | None,
        max_ping: int | None,
        sort: str,
    ) -> tuple[list[models.Machine], int]:
        query = self.db.query(models.Machine)
        if region:
            query = query.filter(models.Machine.region.ilike(f"%{region}%"))
        if gpu:
            query = query.filter(models.Machine.gpu.ilike(f"%{gpu}%"))
        if status:
            query = query.filter(models.Machine.status == status)
        if min_ping is not None:
            query = query.filter(models.Machine.ping_ms >= min_ping)
        if max_ping is not None:
            query = query.filter(models.Machine.ping_ms <= max_ping)

        total = query.count()

        status_rank = case((models.Machine.status == "idle", 0), else_=1)
        gpu_rank = case(
            (models.Machine.gpu.ilike("%4080%"), 4),
            (models.Machine.gpu.ilike("%4090%"), 5),
            (models.Machine.gpu.ilike("%3080%"), 3),
            (models.Machine.gpu.ilike("%3070%"), 2),
            (models.Machine.gpu.ilike("%T4%"), 1),
            else_=0,
        )

        if sort == "ping":
            query = query.order_by(
                models.Machine.ping_ms.asc().nulls_last(),
                models.Machine.region,
                models.Machine.code,
            )
        else:
            query = query.order_by(
                models.Machine.ping_ms.asc().nulls_last(),
                status_rank.asc(),
                gpu_rank.desc(),
                models.Machine.region,
                models.Machine.code,
            )

        items = query.offset((page - 1) * page_size).limit(page_size).all()
        return items, total

    def release_expired_machine_cooldowns(self, now: datetime) -> int:
        machines = (
            self.db.query(models.Machine)
            .filter(
                models.Machine.status == "suspended",
                models.Machine.cooldown_until.is_not(None),
                models.Machine.cooldown_until <= now,
            )
            .all()
        )
        for machine in machines:
            machine.status = "idle"
            machine.cooldown_until = None
            self.db.add(machine)
        return len(machines)

    def get_machine_by_id(self, machine_id: UUID) -> models.Machine | None:
        return self.db.query(models.Machine).filter(models.Machine.id == machine_id).first()

    def get_active_session_for_machine(self, machine_id: UUID) -> models.VpnSession | None:
        return (
            self.db.query(models.VpnSession)
            .filter(
                models.VpnSession.machine_id == machine_id,
                models.VpnSession.status == "active",
                models.VpnSession.ended_at.is_(None),
            )
            .order_by(models.VpnSession.started_at.desc())
            .first()
        )

    def get_active_session_for_user(self, user_id: UUID) -> models.VpnSession | None:
        return (
            self.db.query(models.VpnSession)
            .filter(
                models.VpnSession.user_id == user_id,
                models.VpnSession.status == "active",
                models.VpnSession.ended_at.is_(None),
            )
            .order_by(models.VpnSession.started_at.desc())
            .first()
        )

    def get_session_by_id(self, session_id: UUID) -> models.VpnSession | None:
        return self.db.query(models.VpnSession).filter(models.VpnSession.id == session_id).first()

    def list_active_billable_sessions(self) -> list[models.VpnSession]:
        return (
            self.db.query(models.VpnSession)
            .filter(
                models.VpnSession.status == "active",
                models.VpnSession.ended_at.is_(None),
                models.VpnSession.billing_tier.is_not(None),
                models.VpnSession.billing_started_at.is_not(None),
            )
            .all()
        )

    def list_user_sessions(
        self,
        user_id: UUID,
        page: int,
        page_size: int,
        status_filter: str | None,
        machine_id: UUID | None,
        date_from,
        date_to,
        sort: str,
    ) -> tuple[list[models.VpnSession], int]:
        query = self.db.query(models.VpnSession).filter(models.VpnSession.user_id == user_id)
        if status_filter:
            query = query.filter(models.VpnSession.status == status_filter)
        if machine_id:
            query = query.filter(models.VpnSession.machine_id == machine_id)
        if date_from:
            query = query.filter(models.VpnSession.started_at >= date_from)
        if date_to:
            query = query.filter(models.VpnSession.started_at <= date_to)

        total = query.count()
        order_clause = models.VpnSession.started_at.asc() if sort == "oldest" else models.VpnSession.started_at.desc()
        items = (
            query.order_by(order_clause, models.VpnSession.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return items, total

    def get_machines_by_ids(self, machine_ids: list[UUID]) -> dict[UUID, models.Machine]:
        if not machine_ids:
            return {}
        items = self.db.query(models.Machine).filter(models.Machine.id.in_(machine_ids)).all()
        return {item.id: item for item in items}

    def get_latest_ended_session_ids_for_user(
        self,
        user_id: UUID,
        machine_ids: list[UUID],
    ) -> dict[UUID, UUID]:
        if not machine_ids:
            return {}

        subquery = (
            self.db.query(
                models.VpnSession.machine_id.label("machine_id"),
                func.max(models.VpnSession.ended_at).label("max_ended_at"),
            )
            .filter(
                models.VpnSession.user_id == user_id,
                models.VpnSession.machine_id.in_(machine_ids),
                models.VpnSession.ended_at.is_not(None),
                models.VpnSession.snapshot_retained.is_(True),
            )
            .group_by(models.VpnSession.machine_id)
            .subquery()
        )

        rows = (
            self.db.query(models.VpnSession.id, models.VpnSession.machine_id)
            .join(
                subquery,
                (models.VpnSession.machine_id == subquery.c.machine_id)
                & (models.VpnSession.ended_at == subquery.c.max_ended_at),
            )
            .all()
        )
        return {row.machine_id: row.id for row in rows}

    def has_session_log(self, session_id: UUID, message: str) -> bool:
        return (
            self.db.query(models.MachineLog)
            .filter(models.MachineLog.session_id == session_id, models.MachineLog.message == message)
            .first()
            is not None
        )

    def add_session_log(
        self,
        machine_id: UUID,
        session_id: UUID,
        message: str,
        level: str = "info",
    ) -> models.MachineLog:
        log = models.MachineLog(machine_id=machine_id, session_id=session_id, message=message, level=level)
        self.db.add(log)
        return log

    def get_last_ended_session_for_user_machine(self, machine_id: UUID, user_id: UUID) -> models.VpnSession | None:
        return (
            self.db.query(models.VpnSession)
            .filter(
                models.VpnSession.machine_id == machine_id,
                models.VpnSession.user_id == user_id,
                models.VpnSession.ended_at.is_not(None),
                models.VpnSession.snapshot_retained.is_(True),
            )
            .order_by(models.VpnSession.ended_at.desc())
            .first()
        )

    def count_active_sessions_for_user(self, user_id: UUID) -> int:
        return (
            self.db.query(models.VpnSession)
            .filter(
                models.VpnSession.user_id == user_id,
                models.VpnSession.status == "active",
                models.VpnSession.ended_at.is_(None),
            )
            .count()
        )

    def get_active_subscription_for_user(self, user_id: UUID) -> models.Subscription | None:
        now = datetime.utcnow()
        return (
            self.db.query(models.Subscription)
            .filter(
                models.Subscription.user_id == user_id,
                models.Subscription.status == "active",
                or_(models.Subscription.end_at.is_(None), models.Subscription.end_at > now),
            )
            .order_by(models.Subscription.created_at.desc())
            .first()
        )

    def get_daily_billing_totals(self, user_id: UUID, billing_day: date) -> tuple[int, int]:
        net_amount = func.sum(
            case(
                (models.SessionBillingEvent.event_type == "refund", -models.SessionBillingEvent.amount),
                else_=models.SessionBillingEvent.amount,
            )
        )
        amount, free_minutes = (
            self.db.query(
                func.coalesce(net_amount, 0),
                func.coalesce(func.sum(models.SessionBillingEvent.free_minutes), 0),
            )
            .filter(
                models.SessionBillingEvent.user_id == user_id,
                models.SessionBillingEvent.billing_day == billing_day,
            )
            .one()
        )
        return int(amount or 0), int(free_minutes or 0)

    def add_billing_event(
        self,
        user_id: UUID,
        session_id: UUID | None,
        machine_id: UUID | None,
        billing_day: date,
        tier: str,
        charged_minutes: int,
        free_minutes: int,
        amount: int,
        event_type: str = "charge",
    ) -> models.SessionBillingEvent:
        event = models.SessionBillingEvent(
            user_id=user_id,
            session_id=session_id,
            machine_id=machine_id,
            billing_day=billing_day,
            tier=tier,
            charged_minutes=charged_minutes,
            free_minutes=free_minutes,
            amount=amount,
            event_type=event_type,
        )
        self.db.add(event)
        return event

    def list_retained_snapshots_for_user(self, user_id: UUID) -> list[models.VpnSession]:
        return (
            self.db.query(models.VpnSession)
            .filter(
                models.VpnSession.user_id == user_id,
                models.VpnSession.snapshot_retained.is_(True),
                models.VpnSession.ended_at.is_not(None),
            )
            .order_by(models.VpnSession.ended_at.desc(), models.VpnSession.started_at.desc())
            .all()
        )

    def create_active_session(
        self,
        user_id: UUID,
        machine_id: UUID,
        subscription_id: UUID | None = None,
        billing_tier: str | None = None,
        play_rate_per_minute: int = 0,
        billing_started_at=None,
        lifecycle_state: str = "running",
        billing_state: str = "free",
        connection_state: str = "connected",
        max_session_seconds: int = 0,
        grace_period_seconds: int = 300,
        idle_warning_seconds: int = 600,
        idle_stop_seconds: int = 900,
        cooldown_seconds: int = 60,
        queue_priority: int = 0,
        max_concurrent_sessions: int = 1,
        snapshot_active_limit: int = 0,
        trial_eligible: bool = False,
    ) -> models.VpnSession:
        session = models.VpnSession(
            user_id=user_id,
            machine_id=machine_id,
            subscription_id=subscription_id,
            status="active",
            billing_tier=billing_tier,
            play_rate_per_minute=play_rate_per_minute,
            billing_started_at=billing_started_at,
            last_billed_at=billing_started_at,
            lifecycle_state=lifecycle_state,
            billing_state=billing_state,
            connection_state=connection_state,
            last_client_heartbeat_at=billing_started_at,
            last_stream_activity_at=billing_started_at,
            max_session_seconds=max_session_seconds,
            grace_period_seconds=grace_period_seconds,
            idle_warning_seconds=idle_warning_seconds,
            idle_stop_seconds=idle_stop_seconds,
            cooldown_seconds=cooldown_seconds,
            queue_priority=queue_priority,
            max_concurrent_sessions=max_concurrent_sessions,
            snapshot_active_limit=snapshot_active_limit,
            trial_eligible=trial_eligible,
            snapshot_retained=False,
        )
        self.db.add(session)
        return session

    def set_machine_status(self, machine: models.Machine, status: str) -> None:
        machine.status = status
        if status == "idle":
            machine.cooldown_until = None
        self.db.add(machine)

    def commit(self) -> None:
        self.db.commit()

    def refresh(self, instance: object) -> None:
        self.db.refresh(instance)
