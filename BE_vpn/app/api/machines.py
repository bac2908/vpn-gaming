from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app import models, schemas
from app.api.deps import get_current_user, get_optional_current_user
from app.database import get_db
from app.services.machine_service import MachineService


router = APIRouter(prefix="/machines", tags=["machines"])


def get_machine_service(db: Session = Depends(get_db)) -> MachineService:
    return MachineService(db)


@router.get("", response_model=schemas.MachinesPage)
def list_machines(
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=100),
    region: str | None = Query(None),
    gpu: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    min_ping: int | None = Query(None, ge=0),
    max_ping: int | None = Query(None, ge=0),
    sort: str = Query("best", pattern="^(best|ping)$"),
    current_user: models.User | None = Depends(get_optional_current_user),
    machine_service: MachineService = Depends(get_machine_service),
):
    return machine_service.list_machines(
        page=page,
        page_size=page_size,
        region=region,
        gpu=gpu,
        status_filter=status_filter,
        min_ping=min_ping,
        max_ping=max_ping,
        sort=sort,
        current_user=current_user,
    )


@router.get("/sessions/active", response_model=schemas.SessionOut | None)
def get_active_user_session(
    current_user: models.User = Depends(get_current_user),
    machine_service: MachineService = Depends(get_machine_service),
):
    return machine_service.get_active_user_session(current_user)


@router.get("/sessions/history", response_model=schemas.SessionHistoryPage)
def get_user_session_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    status_filter: str | None = Query(None, alias="status"),
    machine_id: UUID | None = Query(None),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    sort: str = Query("recent", pattern="^(recent|oldest)$"),
    current_user: models.User = Depends(get_current_user),
    machine_service: MachineService = Depends(get_machine_service),
):
    return machine_service.get_user_session_history(
        current_user=current_user,
        page=page,
        page_size=page_size,
        status_filter=status_filter,
        machine_id=machine_id,
        date_from=date_from,
        date_to=date_to,
        sort=sort,
    )


@router.get("/sessions/history/summary", response_model=schemas.SessionHistorySummaryOut)
def get_user_session_history_summary(
    current_user: models.User = Depends(get_current_user),
    machine_service: MachineService = Depends(get_machine_service),
):
    return machine_service.get_user_session_history_summary(current_user)


@router.post("/sessions/{session_id}/stop", response_model=schemas.SessionOut)
def stop_user_session(
    session_id: UUID,
    retain_snapshot: bool = Query(False),
    current_user: models.User = Depends(get_current_user),
    machine_service: MachineService = Depends(get_machine_service),
):
    return machine_service.stop_user_session(session_id, current_user, retain_snapshot=retain_snapshot)


@router.post("/sessions/{session_id}/heartbeat", response_model=schemas.SessionOut)
def heartbeat_session(
    session_id: UUID,
    payload: schemas.SessionHeartbeatRequest,
    current_user: models.User = Depends(get_current_user),
    machine_service: MachineService = Depends(get_machine_service),
):
    return machine_service.record_session_heartbeat(session_id, current_user, payload)


@router.get("/sessions/{session_id}/ovpn")
def download_session_ovpn(
    session_id: UUID,
    current_user: models.User = Depends(get_current_user),
    machine_service: MachineService = Depends(get_machine_service),
):
    filename, content = machine_service.build_session_ovpn(session_id, current_user)
    return Response(
        content=content,
        media_type="application/x-openvpn-profile",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.post("/sessions/{session_id}/vpn/check", response_model=schemas.SessionOut)
def check_session_vpn(
    session_id: UUID,
    current_user: models.User = Depends(get_current_user),
    machine_service: MachineService = Depends(get_machine_service),
):
    return machine_service.verify_vpn_connection(session_id, current_user)


@router.post("/sessions/{session_id}/sunshine/pair", response_model=schemas.SessionOut)
def pair_session_sunshine(
    session_id: UUID,
    current_user: models.User = Depends(get_current_user),
    machine_service: MachineService = Depends(get_machine_service),
):
    return machine_service.mark_sunshine_paired(session_id, current_user)


@router.get("/{machine_id}", response_model=schemas.MachineDetailOut)
def get_machine_detail(
    machine_id: UUID,
    current_user: models.User = Depends(get_current_user),
    machine_service: MachineService = Depends(get_machine_service),
):
    return machine_service.get_machine_detail(machine_id, current_user)


@router.post("/{machine_id}/start", response_model=schemas.SessionOut)
def start_machine_session(
    machine_id: UUID,
    current_user: models.User = Depends(get_current_user),
    machine_service: MachineService = Depends(get_machine_service),
):
    return machine_service.start_machine_session(machine_id, current_user)


@router.post("/{machine_id}/resume", response_model=schemas.SessionOut)
def resume_machine_session(
    machine_id: UUID,
    current_user: models.User = Depends(get_current_user),
    machine_service: MachineService = Depends(get_machine_service),
):
    return machine_service.resume_machine_session(machine_id, current_user)
