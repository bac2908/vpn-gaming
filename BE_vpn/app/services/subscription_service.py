import secrets
from datetime import datetime, timedelta
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app import models, schemas


class SubscriptionService:
    def __init__(self, db: Session):
        self.db = db

    def list_plans(self) -> list[models.ServicePlan]:
        return (
            self.db.query(models.ServicePlan)
            .filter(models.ServicePlan.active.is_(True))
            .order_by(models.ServicePlan.price_cents.asc(), models.ServicePlan.duration_days.asc())
            .all()
        )

    def get_active_subscription(self, current_user: models.User) -> models.Subscription | None:
        now = datetime.utcnow()
        subscription = (
            self.db.query(models.Subscription)
            .filter(
                models.Subscription.user_id == current_user.id,
                models.Subscription.status == "active",
                or_(models.Subscription.end_at.is_(None), models.Subscription.end_at > now),
            )
            .order_by(models.Subscription.created_at.desc())
            .first()
        )
        return subscription

    def purchase_plan(self, payload: schemas.SubscriptionPurchaseRequest, current_user: models.User) -> models.Subscription:
        plan = (
            self.db.query(models.ServicePlan)
            .filter(models.ServicePlan.id == payload.plan_id, models.ServicePlan.active.is_(True))
            .first()
        )
        if not plan:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay goi dich vu")

        price = int(plan.price_cents or 0)
        current_balance = int(current_user.balance or 0)
        if current_balance < price:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="So du khong du de mua goi. Vui long nap them tien.",
            )

        now = datetime.utcnow()
        active_subscription = self.get_active_subscription(current_user)
        if active_subscription and active_subscription.plan_id == plan.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ban dang so huu goi nay")

        if active_subscription:
            active_subscription.status = "canceled"
            active_subscription.canceled_at = now
            active_subscription.end_at = now
            self.db.add(active_subscription)

        subscription = models.Subscription(
            user_id=current_user.id,
            plan_id=plan.id,
            status="active",
            start_at=now,
            end_at=now + timedelta(days=plan.duration_days or 30),
        )
        self.db.add(subscription)
        self.db.flush()

        current_user.balance = current_balance - price
        self.db.add(current_user)

        payment = models.Payment(
            user_id=current_user.id,
            subscription_id=subscription.id,
            order_id=f"SUB-{secrets.token_hex(10)}",
            request_id=f"SUB-{secrets.token_hex(10)}",
            amount=price,
            currency=plan.currency or "VND",
            provider="balance",
            status="succeeded",
            message=f"Mua goi {plan.name}",
        )
        self.db.add(payment)
        self.db.commit()
        self.db.refresh(subscription)
        return subscription
