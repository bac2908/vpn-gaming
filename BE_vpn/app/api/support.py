from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.api.deps import get_current_user
from app.database import get_db
from app.services.support_service import SupportService


router = APIRouter(prefix="/support", tags=["support"])


def get_support_service(db: Session = Depends(get_db)) -> SupportService:
    return SupportService(db)


@router.post("/tickets", response_model=schemas.SupportTicketOut)
def create_support_ticket(
    payload: schemas.SupportTicketCreateRequest,
    current_user: models.User = Depends(get_current_user),
    support_service: SupportService = Depends(get_support_service),
):
    return support_service.create_ticket(current_user, payload)


@router.get("/tickets/me", response_model=schemas.SupportTicketsPage)
def list_my_support_tickets(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    status_filter: str | None = Query(None, alias="status"),
    current_user: models.User = Depends(get_current_user),
    support_service: SupportService = Depends(get_support_service),
):
    return support_service.list_my_tickets(current_user, page, page_size, status_filter)
