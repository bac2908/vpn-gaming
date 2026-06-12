from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import case, func, or_
from sqlalchemy.orm import Session

from app import models


class AdminRepository:
    def __init__(self, db: Session):
        self.db = db

    ADMIN_ADJUSTMENT_PROVIDERS = ("admin", "admin_debit")

    def list_users(
        self,
        page: int,
        page_size: int,
        email: str | None,
        role: str | None,
        status: str | None,
    ) -> tuple[list[models.User], int]:
        query = self.db.query(models.User)
        if email:
            query = query.filter(models.User.email.ilike(f"%{email}%"))
        if role:
            query = query.filter(models.User.role == role)
        if status:
            if status == "inactive":
                query = query.filter(models.User.status != "active")
            else:
                query = query.filter(models.User.status == status)

        total = query.count()
        items = (
            query.order_by(models.User.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return items, total

    def get_user_by_id(self, user_id: UUID) -> models.User | None:
        return self.db.query(models.User).filter(models.User.id == user_id).first()

    def create_admin_topup(
        self,
        user: models.User,
        amount: int,
        description: str | None,
    ) -> tuple[models.TopupTransaction, int, int]:
        old_balance = user.balance or 0
        new_balance = old_balance + amount
        user.balance = new_balance
        self.db.add(user)

        topup = models.TopupTransaction(
            user_id=user.id,
            amount=abs(amount),
            balance_before=old_balance,
            balance_after=new_balance,
            status="succeeded",
            provider="admin" if amount > 0 else "admin_debit",
            description=description,
            completed_at=datetime.now(timezone.utc),
        )
        self.db.add(topup)
        return topup, old_balance, new_balance

    def list_machines(
        self,
        page: int,
        page_size: int,
        region: str | None,
        gpu: str | None,
        status: str | None,
    ) -> tuple[list[models.Machine], int]:
        query = self.db.query(models.Machine)
        if region:
            query = query.filter(models.Machine.region.ilike(f"%{region}%"))
        if gpu:
            query = query.filter(models.Machine.gpu.ilike(f"%{gpu}%"))
        if status:
            query = query.filter(models.Machine.status == status)

        total = query.count()
        items = (
            query.order_by(models.Machine.region, models.Machine.code)
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return items, total

    def get_machine_by_id(self, machine_id: UUID) -> models.Machine | None:
        return self.db.query(models.Machine).filter(models.Machine.id == machine_id).first()

    def get_machine_by_code(self, code: str) -> models.Machine | None:
        return self.db.query(models.Machine).filter(models.Machine.code == code).first()

    def create_machine(
        self,
        code: str,
        region: str | None,
        ping_ms: int | None,
        gpu: str | None,
        status: str,
        location: str | None,
        base_rate_per_minute: int,
        trial_eligible: bool,
    ) -> models.Machine:
        machine = models.Machine(
            code=code,
            region=region,
            ping_ms=ping_ms,
            gpu=gpu,
            status=status,
            location=location,
            base_rate_per_minute=base_rate_per_minute,
            trial_eligible=trial_eligible,
        )
        self.db.add(machine)
        return machine

    def has_active_session_for_machine(self, machine_id: UUID) -> bool:
        active_session = (
            self.db.query(models.VpnSession)
            .filter(
                models.VpnSession.machine_id == machine_id,
                models.VpnSession.status == "active",
                models.VpnSession.ended_at.is_(None),
            )
            .first()
        )
        return active_session is not None

    def dashboard_summary(self) -> dict:
        total_users = self.db.query(models.User).count()
        active_users = self.db.query(models.User).filter(models.User.status == "active").count()
        pending_users = self.db.query(models.User).filter(models.User.status == "pending").count()

        total_machines = self.db.query(models.Machine).count()
        idle_machines = self.db.query(models.Machine).filter(models.Machine.status == "idle").count()
        busy_machines = self.db.query(models.Machine).filter(models.Machine.status.in_(("busy", "running", "suspended"))).count()
        maintenance_machines = self.db.query(models.Machine).filter(models.Machine.status == "maintenance").count()

        total_sessions = self.db.query(models.VpnSession).count()
        active_sessions = (
            self.db.query(models.VpnSession)
            .filter(models.VpnSession.status == "active", models.VpnSession.ended_at.is_(None))
            .count()
        )

        total_revenue = (
            self._successful_revenue_query(self.db.query(models.TopupTransaction))
            .with_entities(func.sum(models.TopupTransaction.amount))
            .scalar()
            or 0
        )

        today = datetime.utcnow().date()
        today_revenue = (
            self._successful_revenue_query(self.db.query(models.TopupTransaction))
            .filter(func.date(models.TopupTransaction.created_at) == today)
            .with_entities(func.sum(models.TopupTransaction.amount))
            .scalar()
            or 0
        )

        first_day_of_month = today.replace(day=1)
        month_revenue = (
            self._successful_revenue_query(self.db.query(models.TopupTransaction))
            .filter(models.TopupTransaction.created_at >= first_day_of_month)
            .with_entities(func.sum(models.TopupTransaction.amount))
            .scalar()
            or 0
        )

        recent_transactions = (
            self.db.query(models.TopupTransaction)
            .order_by(models.TopupTransaction.created_at.desc())
            .limit(5)
            .all()
        )

        return {
            "total_users": total_users,
            "active_users": active_users,
            "pending_users": pending_users,
            "total_machines": total_machines,
            "idle_machines": idle_machines,
            "busy_machines": busy_machines,
            "maintenance_machines": maintenance_machines,
            "total_sessions": total_sessions,
            "active_sessions": active_sessions,
            "total_revenue": total_revenue,
            "today_revenue": today_revenue,
            "month_revenue": month_revenue,
            "recent_transactions": recent_transactions,
        }

    def machine_statistics(self) -> dict:
        total = self.db.query(models.Machine).count()
        idle = self.db.query(models.Machine).filter(models.Machine.status == "idle").count()
        busy = self.db.query(models.Machine).filter(models.Machine.status.in_(("busy", "running", "suspended"))).count()
        maintenance = self.db.query(models.Machine).filter(models.Machine.status == "maintenance").count()

        region_stats = (
            self.db.query(
                models.Machine.region,
                func.count(models.Machine.id).label("count"),
                func.count(case((models.Machine.status == "idle", 1))).label("idle"),
                func.count(case((models.Machine.status.in_(("busy", "running", "suspended")), 1))).label("busy"),
            )
            .group_by(models.Machine.region)
            .all()
        )

        gpu_stats = (
            self.db.query(models.Machine.gpu, func.count(models.Machine.id).label("count"))
            .group_by(models.Machine.gpu)
            .all()
        )

        avg_ping = self.db.query(func.avg(models.Machine.ping_ms)).scalar() or 0

        return {
            "total": total,
            "idle": idle,
            "busy": busy,
            "maintenance": maintenance,
            "avg_ping": round(avg_ping, 1),
            "by_region": [{"region": r[0] or "Unknown", "total": r[1], "idle": r[2], "busy": r[3]} for r in region_stats],
            "by_gpu": [{"gpu": g[0] or "Unknown", "count": g[1]} for g in gpu_stats],
        }

    def list_sessions(
        self,
        page: int,
        page_size: int,
        status_filter: str | None,
        user_id: UUID | None,
        machine_id: UUID | None,
        user_email: str | None = None,
        machine_code: str | None = None,
    ) -> tuple[list[models.VpnSession], int]:
        query = self.db.query(models.VpnSession)
        if status_filter:
            query = query.filter(models.VpnSession.status == status_filter)
        if user_id:
            query = query.filter(models.VpnSession.user_id == user_id)
        if machine_id:
            query = query.filter(models.VpnSession.machine_id == machine_id)
        if user_email:
            query = query.join(models.User, models.VpnSession.user_id == models.User.id)
            query = query.filter(models.User.email.ilike(f"%{user_email.strip()}%"))
        if machine_code:
            query = query.join(models.Machine, models.VpnSession.machine_id == models.Machine.id)
            query = query.filter(models.Machine.code.ilike(f"%{machine_code.strip()}%"))

        total = query.count()
        items = (
            query.order_by(models.VpnSession.started_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return items, total

    def get_users_by_ids(self, user_ids: list[UUID]) -> dict[UUID, models.User]:
        if not user_ids:
            return {}
        items = self.db.query(models.User).filter(models.User.id.in_(user_ids)).all()
        return {item.id: item for item in items}

    def get_machines_by_ids(self, machine_ids: list[UUID]) -> dict[UUID, models.Machine]:
        if not machine_ids:
            return {}
        items = self.db.query(models.Machine).filter(models.Machine.id.in_(machine_ids)).all()
        return {item.id: item for item in items}

    def get_session_by_id(self, session_id: UUID) -> models.VpnSession | None:
        return self.db.query(models.VpnSession).filter(models.VpnSession.id == session_id).first()

    def list_transactions(
        self,
        page: int,
        page_size: int,
        user_id: UUID | None,
        user_email: str | None,
        status: str | None,
        provider: str | None,
        date_from: datetime | None,
        date_to: datetime | None,
        search: str | None = None,
    ) -> tuple[list[models.TopupTransaction], int]:
        query = self.db.query(models.TopupTransaction)
        query = self._filter_transactions(query, user_id, user_email, status, provider, date_from, date_to, search)

        total = query.count()
        items = (
            query.order_by(models.TopupTransaction.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return items, total

    def list_transactions_for_export(
        self,
        user_id: UUID | None,
        user_email: str | None,
        status: str | None,
        provider: str | None,
        date_from: datetime | None,
        date_to: datetime | None,
        search: str | None = None,
    ) -> list[models.TopupTransaction]:
        query = self.db.query(models.TopupTransaction)
        query = self._filter_transactions(query, user_id, user_email, status, provider, date_from, date_to, search)

        return query.order_by(models.TopupTransaction.created_at.desc()).all()

    def _filter_transactions(
        self,
        query,
        user_id: UUID | None,
        user_email: str | None,
        status: str | None,
        provider: str | None,
        date_from: datetime | None,
        date_to: datetime | None,
        search: str | None,
    ):
        joined_user = False
        if user_id:
            query = query.filter(models.TopupTransaction.user_id == user_id)
        if user_email:
            query = query.join(models.User, models.TopupTransaction.user_id == models.User.id)
            joined_user = True
            query = query.filter(models.User.email.ilike(f"%{user_email.strip()}%"))
        if status:
            query = query.filter(models.TopupTransaction.status == status)
        if provider:
            if provider == "admin_adjustment":
                query = query.filter(models.TopupTransaction.provider.in_(self.ADMIN_ADJUSTMENT_PROVIDERS))
            else:
                query = query.filter(models.TopupTransaction.provider == provider)
        if date_from:
            query = query.filter(models.TopupTransaction.created_at >= date_from)
        if date_to:
            query = query.filter(models.TopupTransaction.created_at <= date_to)

        search_term = (search or "").strip()
        if search_term:
            if not joined_user:
                query = query.outerjoin(models.User, models.TopupTransaction.user_id == models.User.id)
            like = f"%{search_term}%"
            query = query.filter(
                or_(
                    models.User.email.ilike(like),
                    models.TopupTransaction.description.ilike(like),
                    models.TopupTransaction.trans_id.ilike(like),
                )
            )
        return query

    def get_transaction_by_id(self, transaction_id: str) -> models.TopupTransaction | None:
        return self.db.query(models.TopupTransaction).filter(models.TopupTransaction.id == transaction_id).first()

    def revenue_statistics(
        self,
        date_from: datetime | None,
        date_to: datetime | None,
    ) -> dict:
        base_query = self.db.query(models.TopupTransaction)
        if date_from:
            base_query = base_query.filter(models.TopupTransaction.created_at >= date_from)
        if date_to:
            base_query = base_query.filter(models.TopupTransaction.created_at <= date_to)

        succeeded = self._successful_revenue_query(base_query)
        failed = base_query.filter(models.TopupTransaction.status == "failed")
        admin_credit = base_query.filter(
            models.TopupTransaction.status == "succeeded",
            models.TopupTransaction.provider == "admin",
        )
        admin_debit = base_query.filter(
            models.TopupTransaction.status == "succeeded",
            models.TopupTransaction.provider == "admin_debit",
        )

        total_revenue = succeeded.with_entities(func.sum(models.TopupTransaction.amount)).scalar() or 0
        total_success = succeeded.count()
        total_failed = failed.count()
        admin_credit_total = admin_credit.with_entities(func.sum(models.TopupTransaction.amount)).scalar() or 0
        admin_debit_total = admin_debit.with_entities(func.sum(models.TopupTransaction.amount)).scalar() or 0

        daily = (
            self.db.query(
                func.date(models.TopupTransaction.created_at).label("date"),
                func.sum(models.TopupTransaction.amount).label("amount"),
            )
            .filter(
                models.TopupTransaction.status == "succeeded",
                models.TopupTransaction.provider.notin_(self.ADMIN_ADJUSTMENT_PROVIDERS),
            )
        )
        if date_from:
            daily = daily.filter(models.TopupTransaction.created_at >= date_from)
        if date_to:
            daily = daily.filter(models.TopupTransaction.created_at <= date_to)
        daily = daily.group_by(func.date(models.TopupTransaction.created_at)).order_by(func.date(models.TopupTransaction.created_at)).all()

        return {
            "total_revenue": total_revenue,
            "total_success": total_success,
            "total_failed": total_failed,
            "admin_credit_total": admin_credit_total,
            "admin_debit_total": admin_debit_total,
            "daily": [{"date": str(day[0]), "amount": day[1]} for day in daily],
        }

    def _successful_revenue_query(self, query):
        return query.filter(
            models.TopupTransaction.status == "succeeded",
            models.TopupTransaction.provider.notin_(self.ADMIN_ADJUSTMENT_PROVIDERS),
        )

    def get_admin_settings(self) -> models.AdminSettings | None:
        return self.db.query(models.AdminSettings).order_by(models.AdminSettings.created_at.asc()).first()

    def create_default_admin_settings(self) -> models.AdminSettings:
        settings = models.AdminSettings()
        self.db.add(settings)
        return settings

    def update_admin_settings(self, settings: models.AdminSettings, payload: dict) -> models.AdminSettings:
        for key, value in payload.items():
            setattr(settings, key, value)
        self.db.add(settings)
        return settings

    def commit(self) -> None:
        self.db.commit()

    def rollback(self) -> None:
        self.db.rollback()

    def refresh(self, instance: object) -> None:
        self.db.refresh(instance)
