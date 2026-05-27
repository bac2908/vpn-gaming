from uuid import UUID

from sqlalchemy import case, func
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
                status_rank.asc(),
                models.Machine.ping_ms.asc().nulls_last(),
                gpu_rank.desc(),
                models.Machine.region,
                models.Machine.code,
            )

        items = query.offset((page - 1) * page_size).limit(page_size).all()
        return items, total

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
            )
            .order_by(models.VpnSession.ended_at.desc())
            .first()
        )

    def create_active_session(
        self,
        user_id: UUID,
        machine_id: UUID,
        subscription_id: UUID | None = None,
    ) -> models.VpnSession:
        session = models.VpnSession(
            user_id=user_id,
            machine_id=machine_id,
            subscription_id=subscription_id,
            status="active",
        )
        self.db.add(session)
        return session

    def set_machine_status(self, machine: models.Machine, status: str) -> None:
        machine.status = status
        self.db.add(machine)

    def commit(self) -> None:
        self.db.commit()

    def refresh(self, instance: object) -> None:
        self.db.refresh(instance)
