import logging
from datetime import datetime
from uuid import UUID

from fastapi import HTTPException, status

from app import models, schemas
from app.pricing import base_rate_for_gpu
from app.repositories.admin_repository import AdminRepository
from app.services.machine_service import MachineService


class AdminService:
    def __init__(self, db):
        self.repo = AdminRepository(db)
        self.logger = logging.getLogger(__name__)

    def list_users(
        self,
        page: int,
        page_size: int,
        email: str | None,
        role: str | None,
        status_filter: str | None,
    ) -> schemas.UsersPage:
        items, total = self.repo.list_users(page, page_size, email, role, status_filter)
        return schemas.UsersPage(items=items, total=total, page=page, page_size=page_size)

    def update_user(self, user_id: UUID, payload: schemas.UserUpdateRequest) -> schemas.AdminUserOut:
        user = self.repo.get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay nguoi dung")

        if payload.display_name is not None:
            user.display_name = payload.display_name
        if payload.role is not None:
            user.role = payload.role
        if payload.status is not None:
            user.status = payload.status

        self.repo.commit()
        self.repo.refresh(user)
        return user

    def topup_user(
        self,
        user_id: UUID,
        payload: schemas.AdminTopupRequest,
        admin_user: models.User,
    ) -> schemas.TopupTransactionOut:
        user = self.repo.get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay nguoi dung")

        if payload.amount <= 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="So tien phai lon hon 0")

        description = payload.description or f"Admin {admin_user.email} nap tien"
        topup, _, new_balance = self.repo.create_admin_topup(user, payload.amount, description)
        self.repo.commit()
        self.repo.refresh(topup)

        self.logger.info(
            "Admin topup: admin=%s, user=%s, amount=%d, new_balance=%d",
            admin_user.email,
            user.email,
            payload.amount,
            new_balance,
        )
        return topup

    def list_machines(
        self,
        page: int,
        page_size: int,
        region: str | None,
        gpu: str | None,
        status_filter: str | None,
    ) -> schemas.MachinesPage:
        items, total = self.repo.list_machines(page, page_size, region, gpu, status_filter)
        return schemas.MachinesPage(items=items, total=total, page=page, page_size=page_size)

    def create_machine(self, payload: schemas.MachineCreateRequest) -> schemas.MachineOut:
        existing = self.repo.get_machine_by_code(payload.code)
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ma may da ton tai")

        machine = self.repo.create_machine(
            code=payload.code,
            region=payload.region,
            ping_ms=payload.ping_ms,
            gpu=payload.gpu,
            status=payload.status or "idle",
            location=payload.location,
            base_rate_per_minute=payload.base_rate_per_minute or base_rate_for_gpu(payload.gpu),
            trial_eligible=bool(payload.trial_eligible),
        )
        self.repo.commit()
        self.repo.refresh(machine)
        return machine

    def update_machine(self, machine_id: UUID, payload: schemas.MachineUpdateRequest) -> schemas.MachineOut:
        machine = self.repo.get_machine_by_id(machine_id)
        if not machine:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay may")

        if payload.region is not None:
            machine.region = payload.region
        if payload.ping_ms is not None:
            machine.ping_ms = payload.ping_ms
        if payload.gpu is not None:
            machine.gpu = payload.gpu
        if payload.status is not None:
            machine.status = payload.status
        if payload.location is not None:
            machine.location = payload.location
        if payload.base_rate_per_minute is not None:
            machine.base_rate_per_minute = payload.base_rate_per_minute
        if payload.trial_eligible is not None:
            machine.trial_eligible = payload.trial_eligible

        self.repo.commit()
        self.repo.refresh(machine)
        return machine

    def dashboard(self) -> schemas.AdminDashboardOut:
        data = self.repo.dashboard_summary()
        return schemas.AdminDashboardOut(
            total_users=data["total_users"],
            active_users=data["active_users"],
            pending_users=data["pending_users"],
            total_machines=data["total_machines"],
            idle_machines=data["idle_machines"],
            busy_machines=data["busy_machines"],
            maintenance_machines=data["maintenance_machines"],
            total_sessions=data["total_sessions"],
            active_sessions=data["active_sessions"],
            total_revenue=data["total_revenue"],
            today_revenue=data["today_revenue"],
            month_revenue=data["month_revenue"],
            recent_transactions=[schemas.TopupTransactionOut.from_orm(item) for item in data["recent_transactions"]],
        )

    def machine_statistics(self) -> schemas.MachineStatisticsOut:
        data = self.repo.machine_statistics()
        return schemas.MachineStatisticsOut(**data)

    def delete_machine(self, machine_id: UUID) -> schemas.MessageResponse:
        machine = self.repo.get_machine_by_id(machine_id)
        if not machine:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay may")

        if self.repo.has_active_session_for_machine(machine_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Khong the xoa may dang co session active",
            )

        machine_code = machine.code
        self.repo.db.delete(machine)
        self.repo.commit()
        return schemas.MessageResponse(message=f"Da xoa may {machine_code}")

    def list_sessions(
        self,
        page: int,
        page_size: int,
        status_filter: str | None,
        user_id: UUID | None,
        machine_id: UUID | None,
    ) -> schemas.SessionsPage:
        items, total = self.repo.list_sessions(page, page_size, status_filter, user_id, machine_id)

        user_ids = [item.user_id for item in items if item.user_id is not None]
        machine_ids = [item.machine_id for item in items if item.machine_id is not None]
        users_map = self.repo.get_users_by_ids(user_ids)
        machines_map = self.repo.get_machines_by_ids(machine_ids)

        result_items = []
        for item in items:
            user = users_map.get(item.user_id) if item.user_id else None
            machine = machines_map.get(item.machine_id) if item.machine_id else None
            result_items.append(
                schemas.AdminSessionOut(
                    id=item.id,
                    user_id=item.user_id,
                    user_email=user.email if user else None,
                    machine_id=item.machine_id,
                    machine_code=machine.code if machine else None,
                    status=item.status,
                    started_at=item.started_at,
                    ended_at=item.ended_at,
                    ip_address=item.ip_address,
                    bytes_up=item.bytes_up,
                    bytes_down=item.bytes_down,
                    billing_tier=item.billing_tier,
                    play_rate_per_minute=item.play_rate_per_minute or 0,
                    charged_minutes=item.charged_minutes or 0,
                    charged_amount=item.charged_amount or 0,
                    free_minutes_used=item.free_minutes_used or 0,
                    lifecycle_state=item.lifecycle_state or "running",
                    billing_state=item.billing_state or "free",
                    connection_state=item.connection_state or "connected",
                    stop_reason=item.stop_reason,
                    refunded_amount=item.refunded_amount or 0,
                    refund_status=item.refund_status or "none",
                )
            )

        return schemas.SessionsPage(items=result_items, total=total, page=page, page_size=page_size)

    def stop_session(self, session_id: UUID) -> schemas.MessageResponse:
        MachineService(self.repo.db).stop_session_as_admin(session_id)
        return schemas.MessageResponse(message="Da dung session")

    def fail_session(self, session_id: UUID, payload: schemas.AdminSessionFailRequest) -> schemas.MessageResponse:
        MachineService(self.repo.db).fail_session_as_admin(session_id, payload.reason or "vm_failed")
        return schemas.MessageResponse(message="Da danh dau session loi va xu ly refund neu du dieu kien")

    def export_transactions_csv(
        self,
        status_filter: str | None,
        provider: str | None,
        date_from: datetime | None,
        date_to: datetime | None,
    ):
        items = self.repo.list_transactions_for_export(status_filter, provider, date_from, date_to)

        def iter_csv():
            header = ["User", "Amount", "Provider", "Status", "CreatedAt", "Description"]
            yield ",".join(header) + "\n"
            for item in items:
                row = [
                    str(item.user_id),
                    str(item.amount),
                    item.provider or "",
                    item.status or "",
                    item.created_at.strftime("%Y-%m-%d %H:%M:%S") if item.created_at else "",
                    item.description or "",
                ]
                yield ",".join(row) + "\n"

        return iter_csv

    def list_transactions(
        self,
        page: int,
        page_size: int,
        user_id: UUID | None,
        status_filter: str | None,
        provider: str | None,
        date_from: datetime | None,
        date_to: datetime | None,
    ) -> schemas.TopupHistoryPage:
        items, total = self.repo.list_transactions(
            page=page,
            page_size=page_size,
            user_id=user_id,
            status=status_filter,
            provider=provider,
            date_from=date_from,
            date_to=date_to,
        )
        return schemas.TopupHistoryPage(items=items, total=total, page=page, page_size=page_size)

    def get_transaction_detail(self, transaction_id: str) -> schemas.TopupTransactionOut:
        transaction = self.repo.get_transaction_by_id(transaction_id)
        if not transaction:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay giao dich")
        return transaction

    def get_settings(self) -> schemas.AdminSettingsOut:
        settings = self.repo.get_admin_settings()
        if not settings:
            settings = self.repo.create_default_admin_settings()
            self.repo.commit()
            self.repo.refresh(settings)
        return settings

    def update_settings(self, payload: schemas.AdminSettingsUpdate) -> schemas.AdminSettingsOut:
        settings = self.repo.get_admin_settings()
        if not settings:
            settings = self.repo.create_default_admin_settings()

        updated = self.repo.update_admin_settings(settings, payload.dict())
        self.repo.commit()
        self.repo.refresh(updated)
        return updated

    def revenue_statistics(
        self,
        date_from: datetime | None,
        date_to: datetime | None,
    ) -> dict:
        return self.repo.revenue_statistics(date_from, date_to)
