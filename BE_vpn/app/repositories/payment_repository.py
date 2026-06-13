from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app import models


class PaymentRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_payment(
        self,
        user_id: UUID,
        order_id: str,
        request_id: str,
        amount: int,
        provider: str,
        status: str,
        message: str | None,
        pay_url: str,
        extra_data: str,
    ) -> models.Payment:
        payment = models.Payment(
            user_id=user_id,
            order_id=order_id,
            request_id=request_id,
            amount=amount,
            provider=provider,
            status=status,
            message=message,
            pay_url=pay_url,
            extra_data=extra_data,
        )
        self.db.add(payment)
        self.db.flush()
        return payment

    def get_payment_by_order_id(self, order_id: str) -> models.Payment | None:
        return self.db.query(models.Payment).filter(models.Payment.order_id == order_id).first()

    def get_topup_by_payment_id(self, payment_id: UUID) -> models.TopupTransaction | None:
        return self.db.query(models.TopupTransaction).filter(models.TopupTransaction.payment_id == payment_id).first()

    def get_user_by_id(self, user_id: UUID) -> models.User | None:
        return self.db.query(models.User).filter(models.User.id == user_id).first()

    def mark_payment_result(self, payment: models.Payment, is_success: bool, message: str, trans_id: str | None, extra_data: str) -> None:
        payment.status = "succeeded" if is_success else "failed"
        payment.message = message
        payment.trans_id = trans_id or payment.trans_id
        payment.extra_data = extra_data
        payment.updated_at = datetime.now(timezone.utc)
        self.db.add(payment)

    def mark_topup_failed(self, topup: models.TopupTransaction) -> None:
        topup.status = "failed"
        topup.completed_at = datetime.now(timezone.utc)
        self.db.add(topup)

    def apply_topup_success(self, topup: models.TopupTransaction, user: models.User, amount: int, trans_id: str | None) -> tuple[int, int]:
        old_balance = user.balance or 0
        new_balance = old_balance + amount
        user.balance = new_balance
        self.db.add(user)

        topup.balance_before = old_balance
        topup.balance_after = new_balance
        topup.status = "succeeded"
        topup.trans_id = trans_id
        topup.completed_at = datetime.now(timezone.utc)
        self.db.add(topup)
        return old_balance, new_balance

    def create_succeeded_topup_from_payment(
        self,
        payment: models.Payment,
        user: models.User,
        trans_id: str | None,
        description: str | None = None,
    ) -> tuple[models.TopupTransaction, int, int]:
        old_balance = user.balance or 0
        amount = int(payment.amount or 0)
        new_balance = old_balance + amount
        user.balance = new_balance
        self.db.add(user)

        topup = models.TopupTransaction(
            user_id=user.id,
            payment_id=payment.id,
            amount=amount,
            balance_before=old_balance,
            balance_after=new_balance,
            status="succeeded",
            provider=payment.provider or "momo",
            description=description,
            trans_id=trans_id,
            completed_at=datetime.now(timezone.utc),
        )
        self.db.add(topup)
        return topup, old_balance, new_balance

    def list_user_topup_history(
        self,
        user_id: UUID,
        page: int,
        page_size: int,
        status_filter: str | None,
    ) -> tuple[list[models.TopupTransaction], int]:
        query = self.db.query(models.TopupTransaction).filter(models.TopupTransaction.user_id == user_id)
        if status_filter:
            query = query.filter(models.TopupTransaction.status == status_filter)

        total = query.count()
        items = (
            query.order_by(models.TopupTransaction.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return items, total

    def list_user_topups_for_summary(self, user_id: UUID) -> list[models.TopupTransaction]:
        return (
            self.db.query(models.TopupTransaction)
            .filter(
                models.TopupTransaction.user_id == user_id,
                models.TopupTransaction.status == "succeeded",
            )
            .order_by(models.TopupTransaction.created_at.desc())
            .all()
        )

    def commit(self) -> None:
        self.db.commit()

    def rollback(self) -> None:
        self.db.rollback()
