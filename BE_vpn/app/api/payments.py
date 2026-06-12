from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app import models, schemas
from app.api.deps import get_current_user
from app.database import get_db
from app.services.payment_service import PaymentService


router = APIRouter(prefix="/payments", tags=["payments"])


def get_payment_service(db: Session = Depends(get_db)) -> PaymentService:
    return PaymentService(db)


@router.post("/momo", response_model=schemas.PaymentInitResponse)
def create_momo_payment(
    payload: schemas.PaymentCreateRequest,
    current_user: models.User = Depends(get_current_user),
    payment_service: PaymentService = Depends(get_payment_service),
):
    return payment_service.create_momo_payment(payload, current_user)


@router.get("/momo/status", response_model=schemas.PaymentStatusResponse)
def get_momo_payment_status(
    order_id: str = Query(..., min_length=1),
    current_user: models.User = Depends(get_current_user),
    payment_service: PaymentService = Depends(get_payment_service),
):
    return payment_service.get_momo_payment_status(order_id, current_user)


@router.post("/momo/ipn")
async def momo_ipn(request: Request, payment_service: PaymentService = Depends(get_payment_service)):
    payload = await request.json()
    return payment_service.momo_ipn(payload)


@router.get("/balance", response_model=schemas.UserBalanceOut)
def get_user_balance(
    current_user: models.User = Depends(get_current_user),
    payment_service: PaymentService = Depends(get_payment_service),
):
    return payment_service.get_user_balance(current_user)


@router.get("/topup-history", response_model=schemas.TopupHistoryPage)
def get_topup_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    status_filter: str | None = Query(None, alias="status"),
    current_user: models.User = Depends(get_current_user),
    payment_service: PaymentService = Depends(get_payment_service),
):
    return payment_service.get_topup_history(
        current_user=current_user,
        page=page,
        page_size=page_size,
        status_filter=status_filter,
    )


@router.get("/topup-summary", response_model=schemas.TopupSummaryOut)
def get_topup_summary(
    current_user: models.User = Depends(get_current_user),
    payment_service: PaymentService = Depends(get_payment_service),
):
    return payment_service.get_topup_summary(current_user)
