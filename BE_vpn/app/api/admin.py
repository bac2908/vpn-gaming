from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app import models, schemas
from app.api.deps import require_admin
from app.database import get_db
from app.services.admin_service import AdminService


router = APIRouter(prefix="/admin", tags=["admin"])


def get_admin_service(db: Session = Depends(get_db)) -> AdminService:
    return AdminService(db)


@router.get("/users", response_model=schemas.UsersPage)
def admin_list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    email: str | None = Query(None),
    role: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    _: models.User = Depends(require_admin),
    admin_service: AdminService = Depends(get_admin_service),
):
    return admin_service.list_users(page, page_size, email, role, status_filter)


@router.patch("/users/{user_id}", response_model=schemas.AdminUserOut)
def admin_update_user(
    user_id: UUID,
    payload: schemas.UserUpdateRequest,
    admin_user: models.User = Depends(require_admin),
    admin_service: AdminService = Depends(get_admin_service),
):
    return admin_service.update_user(user_id, payload, admin_user)


@router.post("/users/{user_id}/topup", response_model=schemas.TopupTransactionOut)
def admin_topup_user(
    user_id: UUID,
    payload: schemas.AdminTopupRequest,
    admin_user: models.User = Depends(require_admin),
    admin_service: AdminService = Depends(get_admin_service),
):
    return admin_service.topup_user(user_id, payload, admin_user)


@router.get("/machines", response_model=schemas.MachinesPage)
def admin_list_machines(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    region: str | None = Query(None),
    gpu: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    _: models.User = Depends(require_admin),
    admin_service: AdminService = Depends(get_admin_service),
):
    return admin_service.list_machines(page, page_size, region, gpu, status_filter)


@router.post("/machines", response_model=schemas.MachineOut, status_code=status.HTTP_201_CREATED)
def admin_create_machine(
    payload: schemas.MachineCreateRequest,
    _: models.User = Depends(require_admin),
    admin_service: AdminService = Depends(get_admin_service),
):
    return admin_service.create_machine(payload)


@router.patch("/machines/{machine_id}", response_model=schemas.MachineOut)
def admin_update_machine(
    machine_id: UUID,
    payload: schemas.MachineUpdateRequest,
    _: models.User = Depends(require_admin),
    admin_service: AdminService = Depends(get_admin_service),
):
    return admin_service.update_machine(machine_id, payload)


@router.get("/dashboard", response_model=schemas.AdminDashboardOut)
def admin_dashboard(
    _: models.User = Depends(require_admin),
    admin_service: AdminService = Depends(get_admin_service),
):
    return admin_service.dashboard()


@router.get("/machines/statistics", response_model=schemas.MachineStatisticsOut)
def admin_machine_statistics(
    _: models.User = Depends(require_admin),
    admin_service: AdminService = Depends(get_admin_service),
):
    return admin_service.machine_statistics()


@router.get("/settings", response_model=schemas.AdminSettingsOut)
def admin_get_settings(
    _: models.User = Depends(require_admin),
    admin_service: AdminService = Depends(get_admin_service),
):
    return admin_service.get_settings()


@router.put("/settings", response_model=schemas.AdminSettingsOut)
def admin_update_settings(
    payload: schemas.AdminSettingsUpdate,
    _: models.User = Depends(require_admin),
    admin_service: AdminService = Depends(get_admin_service),
):
    return admin_service.update_settings(payload)


@router.delete("/machines/{machine_id}", response_model=schemas.MessageResponse)
def admin_delete_machine(
    machine_id: UUID,
    _: models.User = Depends(require_admin),
    admin_service: AdminService = Depends(get_admin_service),
):
    return admin_service.delete_machine(machine_id)


@router.get("/sessions", response_model=schemas.SessionsPage)
def admin_list_sessions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    user_id: UUID | None = Query(None),
    machine_id: UUID | None = Query(None),
    _: models.User = Depends(require_admin),
    admin_service: AdminService = Depends(get_admin_service),
):
    return admin_service.list_sessions(page, page_size, status_filter, user_id, machine_id)


@router.post("/sessions/{session_id}/stop", response_model=schemas.MessageResponse)
def admin_stop_session(
    session_id: UUID,
    _: models.User = Depends(require_admin),
    admin_service: AdminService = Depends(get_admin_service),
):
    return admin_service.stop_session(session_id)


@router.post("/sessions/{session_id}/fail", response_model=schemas.MessageResponse)
def admin_fail_session(
    session_id: UUID,
    payload: schemas.AdminSessionFailRequest,
    _: models.User = Depends(require_admin),
    admin_service: AdminService = Depends(get_admin_service),
):
    return admin_service.fail_session(session_id, payload)


@router.get("/transactions/export", response_model=None)
def admin_export_transactions_csv(
    status_filter: str | None = Query(None, alias="status"),
    provider: str | None = Query(None),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    _: models.User = Depends(require_admin),
    admin_service: AdminService = Depends(get_admin_service),
):
    iter_csv = admin_service.export_transactions_csv(status_filter, provider, date_from, date_to)
    return StreamingResponse(
        iter_csv(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=transactions.csv"},
    )


@router.get("/transactions", response_model=schemas.TopupHistoryPage)
def admin_list_topup_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user_id: UUID | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    provider: str | None = Query(None),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    _: models.User = Depends(require_admin),
    admin_service: AdminService = Depends(get_admin_service),
):
    return admin_service.list_transactions(page, page_size, user_id, status_filter, provider, date_from, date_to)


@router.get("/transactions/{transaction_id}", response_model=schemas.TopupTransactionOut)
def admin_get_transaction_detail(
    transaction_id: str,
    _: models.User = Depends(require_admin),
    admin_service: AdminService = Depends(get_admin_service),
):
    return admin_service.get_transaction_detail(transaction_id)


@router.get("/revenue/statistics", response_model=dict)
def admin_revenue_statistics(
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    _: models.User = Depends(require_admin),
    admin_service: AdminService = Depends(get_admin_service),
):
    return admin_service.revenue_statistics(date_from, date_to)
