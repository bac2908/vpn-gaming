from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.api.deps import get_current_user
from app.database import get_db
from app.services.subscription_service import SubscriptionService


router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


def get_subscription_service(db: Session = Depends(get_db)) -> SubscriptionService:
    return SubscriptionService(db)


@router.get("/plans", response_model=list[schemas.ServicePlanOut])
def list_subscription_plans(
    subscription_service: SubscriptionService = Depends(get_subscription_service),
):
    return subscription_service.list_plans()


@router.get("/me", response_model=schemas.SubscriptionOut | None)
def get_my_subscription(
    current_user: models.User = Depends(get_current_user),
    subscription_service: SubscriptionService = Depends(get_subscription_service),
):
    return subscription_service.get_active_subscription(current_user)


@router.post("/purchase", response_model=schemas.SubscriptionOut)
def purchase_subscription_plan(
    payload: schemas.SubscriptionPurchaseRequest,
    current_user: models.User = Depends(get_current_user),
    subscription_service: SubscriptionService = Depends(get_subscription_service),
):
    return subscription_service.purchase_plan(payload, current_user)
