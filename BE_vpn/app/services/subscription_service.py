import secrets
from datetime import datetime, timedelta
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app import models, schemas
from app.pricing import SAMPLE_HIGH_END_RATE_PER_MINUTE, discounted_rate, get_plan_policy


class SubscriptionService:
    def __init__(self, db: Session):
        self.db = db

    def list_plans(self) -> list[models.ServicePlan]:
        plans = (
            self.db.query(models.ServicePlan)
            .filter(models.ServicePlan.active.is_(True))
            .order_by(models.ServicePlan.price_cents.asc(), models.ServicePlan.duration_days.asc())
            .all()
        )
        for plan in plans:
            self._attach_plan_policy(plan)
        return plans

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
        if subscription and subscription.plan:
            self._attach_plan_policy(subscription.plan)
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
        if subscription.plan:
            self._attach_plan_policy(subscription.plan)
        return subscription

    def _attach_plan_policy(self, plan: models.ServicePlan) -> None:
        policy = get_plan_policy(plan.code)
        plan.play_rate_per_minute = policy.play_rate_per_minute
        plan.hourly_estimate = policy.hourly_estimate
        plan.discount_percent = policy.discount_percent
        plan.standard_sample_rate_per_minute = SAMPLE_HIGH_END_RATE_PER_MINUTE
        plan.member_sample_rate_per_minute = discounted_rate(SAMPLE_HIGH_END_RATE_PER_MINUTE, policy)
        plan.allowed_gpu_tier = policy.allowed_gpu_tier
        plan.allowed_regions = policy.allowed_regions
        plan.snapshot_policy = policy.snapshot_policy
        plan.snapshot_active_limit = policy.snapshot_active_limit
        plan.queue_policy = policy.queue_policy
        plan.queue_priority = policy.queue_priority
        plan.max_session_seconds = policy.max_session_seconds
        plan.grace_period_seconds = policy.grace_period_seconds
        plan.idle_warning_seconds = policy.idle_warning_seconds
        plan.idle_stop_seconds = policy.idle_stop_seconds
        plan.cooldown_seconds = policy.cooldown_seconds
        plan.max_concurrent_sessions = policy.max_concurrent_sessions
        plan.daily_cap_vnd = policy.daily_cap_vnd
