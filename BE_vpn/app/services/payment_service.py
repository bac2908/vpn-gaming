import hashlib
import hmac
import logging
import secrets
from datetime import datetime, timedelta
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import httpx
from fastapi import HTTPException, status

from app import models, schemas
from app.config import get_settings
from app.pricing import billing_day
from app.repositories.payment_repository import PaymentRepository


class PaymentService:
    def __init__(self, db):
        self.repo = PaymentRepository(db)
        self.settings = get_settings()
        self.logger = logging.getLogger(__name__)

    def _ensure_momo_config(self) -> None:
        required = {
            "MOMO_PARTNER_CODE": self.settings.momo_partner_code,
            "MOMO_ACCESS_KEY": self.settings.momo_access_key,
            "MOMO_SECRET_KEY": self.settings.momo_secret_key,
        }
        missing = [key for key, value in required.items() if not value]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Thieu cau hinh MoMo: " + ", ".join(missing),
            )

    def _sign_momo(self, raw: str) -> str:
        return hmac.new(self.settings.momo_secret_key.encode(), raw.encode(), hashlib.sha256).hexdigest()

    def _append_query_params(self, url: str, params: dict[str, str]) -> str:
        parts = urlsplit(url)
        query = dict(parse_qsl(parts.query, keep_blank_values=True))
        query.update({key: value for key, value in params.items() if value})
        return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))

    def _demo_auto_confirm_enabled(self) -> bool:
        if not self.settings.momo_demo_auto_confirm:
            return False

        targets = [
            self.settings.app_base_url,
            self.settings.momo_redirect_url,
            self.settings.momo_ipn_url,
        ]
        return any(target and ("localhost" in target or "127.0.0.1" in target) for target in targets)

    def _auto_confirm_demo_payment(self, payment: models.Payment) -> None:
        if payment.status != "pending":
            return

        user = self.repo.get_user_by_id(payment.user_id)
        if not user:
            return

        trans_id = payment.trans_id or f"DEMO-{payment.request_id}"
        self.repo.mark_payment_result(
            payment=payment,
            is_success=True,
            message="Demo local: tu dong xac nhan vi localhost khong nhan duoc MoMo IPN.",
            trans_id=trans_id,
            extra_data=payment.extra_data or "",
        )

        topup = self.repo.get_topup_by_payment_id(payment.id)
        if topup:
            self.repo.apply_topup_success(
                topup=topup,
                user=user,
                amount=int(payment.amount or 0),
                trans_id=payment.trans_id,
            )
        else:
            self.repo.create_succeeded_topup_from_payment(
                payment=payment,
                user=user,
                trans_id=payment.trans_id,
                description="Demo local MoMo auto-confirm",
            )
        self.repo.commit()

    def create_momo_payment(self, payload: schemas.PaymentCreateRequest, current_user: models.User) -> schemas.PaymentInitResponse:
        self._ensure_momo_config()

        if payload.amount < 10000:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="So tien toi thieu la 10.000d")

        order_id = secrets.token_hex(10)
        request_id = secrets.token_hex(10)
        amount = payload.amount
        order_info = payload.description or "Nap tien qua MoMo"
        redirect_base_url = self.settings.momo_redirect_url or self.settings.app_base_url.rstrip("/") + "/app/topup/result"
        redirect_url = self._append_query_params(
            redirect_base_url,
            {"orderId": order_id, "requestId": request_id},
        )
        ipn_url = self.settings.momo_ipn_url or self.settings.app_base_url.rstrip("/") + "/payments/momo/ipn"
        extra_data = ""

        raw_signature = (
            f"accessKey={self.settings.momo_access_key}&amount={amount}&extraData={extra_data}"
            f"&ipnUrl={ipn_url}&orderId={order_id}&orderInfo={order_info}"
            f"&partnerCode={self.settings.momo_partner_code}&redirectUrl={redirect_url}"
            f"&requestId={request_id}&requestType={self.settings.momo_request_type}"
        )
        signature = self._sign_momo(raw_signature)

        body = {
            "partnerCode": self.settings.momo_partner_code,
            "partnerName": "VPN Gaming",
            "storeId": "VPN_STORE",
            "requestId": request_id,
            "amount": amount,
            "orderId": order_id,
            "orderInfo": order_info,
            "redirectUrl": redirect_url,
            "ipnUrl": ipn_url,
            "lang": "vi",
            "extraData": extra_data,
            "requestType": self.settings.momo_request_type,
            "signature": signature,
            "accessKey": self.settings.momo_access_key,
        }

        try:
            response = httpx.post(self.settings.momo_endpoint, json=body, timeout=10)
        except httpx.RequestError as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"MoMo khong phan hoi: {exc}") from exc

        data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
        if response.status_code != 200:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Khong goi duoc MoMo")

        if data.get("resultCode") != 0 or not data.get("payUrl"):
            message = data.get("message") or "MoMo tu choi giao dich"
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=message)

        payment = self.repo.create_payment(
            user_id=current_user.id,
            order_id=order_id,
            request_id=request_id,
            amount=amount,
            provider="momo",
            status="pending",
            message=data.get("message"),
            pay_url=data.get("payUrl"),
            extra_data=extra_data,
        )
        self.repo.commit()

        return schemas.PaymentInitResponse(
            order_id=order_id,
            request_id=request_id,
            pay_url=data.get("payUrl"),
            amount=amount,
        )

    def get_momo_payment_status(self, order_id: str, current_user: models.User) -> schemas.PaymentStatusResponse:
        payment = self.repo.get_payment_by_order_id(order_id)
        if not payment or str(payment.user_id) != str(current_user.id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay giao dich")

        if payment.status == "pending" and self._demo_auto_confirm_enabled():
            self.logger.info("Auto-confirming local demo MoMo payment: %s", order_id)
            self._auto_confirm_demo_payment(payment)
            payment = self.repo.get_payment_by_order_id(order_id)

        topup = self.repo.get_topup_by_payment_id(payment.id)
        return schemas.PaymentStatusResponse(
            order_id=payment.order_id,
            request_id=payment.request_id,
            amount=int(payment.amount or 0),
            status=(topup.status if topup else payment.status) or "pending",
            provider=payment.provider or "momo",
            message=payment.message,
            trans_id=payment.trans_id,
            balance_before=int(topup.balance_before) if topup else None,
            balance_after=int(topup.balance_after) if topup else None,
            created_at=payment.created_at,
            completed_at=topup.completed_at if topup else None,
        )

    def momo_ipn(self, payload: dict) -> dict:
        self._ensure_momo_config()
        self.logger.info("MoMo IPN received: %s", payload)

        required_keys = ["orderId", "requestId", "amount", "signature", "resultCode", "message", "partnerCode"]
        for key in required_keys:
            if key not in payload:
                return {"resultCode": 10, "message": f"Missing {key}"}

        extra_data = payload.get("extraData") or ""
        raw_signature = (
            f"accessKey={self.settings.momo_access_key}&amount={payload.get('amount')}"
            f"&extraData={extra_data}&message={payload.get('message')}"
            f"&orderId={payload.get('orderId')}"
            f"&orderInfo={payload.get('orderInfo', '')}"
            f"&orderType={payload.get('orderType', '')}"
            f"&partnerCode={payload.get('partnerCode')}"
            f"&payType={payload.get('payType', '')}"
            f"&requestId={payload.get('requestId')}"
            f"&responseTime={payload.get('responseTime')}"
            f"&resultCode={payload.get('resultCode')}"
            f"&transId={payload.get('transId', '')}"
        )

        if self._sign_momo(raw_signature) != payload.get("signature"):
            self.logger.warning("MoMo IPN invalid signature for order %s", payload.get("orderId"))
            return {"resultCode": 10, "message": "Invalid signature"}

        payment = self.repo.get_payment_by_order_id(payload.get("orderId"))
        if not payment:
            self.logger.warning("MoMo IPN order not found: %s", payload.get("orderId"))
            return {"resultCode": 0, "message": "Order not found"}

        if payment.status in ("succeeded", "failed"):
            self.logger.info("MoMo IPN order already processed: %s", payload.get("orderId"))
            return {"resultCode": 0, "message": "Already processed"}

        is_success = payload.get("resultCode") == 0
        trans_id = str(payload.get("transId")) if payload.get("transId") is not None else None

        self.repo.mark_payment_result(
            payment=payment,
            is_success=is_success,
            message=payload.get("message"),
            trans_id=trans_id,
            extra_data=extra_data,
        )

        topup = self.repo.get_topup_by_payment_id(payment.id)
        if is_success:
            user = self.repo.get_user_by_id(payment.user_id)
            if user:
                if topup:
                    old_balance, new_balance = self.repo.apply_topup_success(
                        topup=topup,
                        user=user,
                        amount=payment.amount,
                        trans_id=payment.trans_id,
                    )
                else:
                    _, old_balance, new_balance = self.repo.create_succeeded_topup_from_payment(
                        payment=payment,
                        user=user,
                        trans_id=payment.trans_id,
                    )
                self.logger.info(
                    "Topup success: user=%s, amount=%d, new_balance=%d",
                    user.email,
                    payment.amount,
                    new_balance,
                )
        elif topup and not is_success:
            self.repo.mark_topup_failed(topup)
            self.logger.info("Topup failed: payment_id=%s", payment.id)

        self.repo.commit()
        return {"resultCode": 0, "message": "OK"}

    def get_user_balance(self, current_user: models.User) -> schemas.UserBalanceOut:
        balance = current_user.balance or 0
        formatted = f"{balance:,.0f}đ".replace(",", ".")
        return schemas.UserBalanceOut(balance=balance, formatted_balance=formatted)

    def get_topup_history(
        self,
        current_user: models.User,
        page: int,
        page_size: int,
        status_filter: str | None,
    ) -> schemas.TopupHistoryPage:
        effective_status = status_filter or "succeeded"
        items, total = self.repo.list_user_topup_history(
            user_id=current_user.id,
            page=page,
            page_size=page_size,
            status_filter=effective_status,
        )
        return schemas.TopupHistoryPage(items=items, total=total, page=page, page_size=page_size)

    def get_topup_summary(self, current_user: models.User) -> schemas.TopupSummaryOut:
        items = self.repo.list_user_topups_for_summary(current_user.id)
        today = billing_day()
        week_days = {today - timedelta(days=6 - idx) for idx in range(7)}

        total_succeeded_amount = 0
        pending_amount = 0
        week_succeeded_amount = 0
        succeeded_transactions = 0
        pending_transactions = 0
        failed_transactions = 0
        latest_topup_at = None

        for item in items:
            if item.status != "succeeded":
                continue
            amount = int(item.amount or 0)
            succeeded_transactions += 1
            total_succeeded_amount += amount
            topup_time = item.completed_at or item.created_at
            if latest_topup_at is None or (topup_time and topup_time > latest_topup_at):
                latest_topup_at = topup_time
            if billing_day(topup_time) in week_days:
                week_succeeded_amount += amount

        return schemas.TopupSummaryOut(
            total_transactions=succeeded_transactions,
            succeeded_transactions=succeeded_transactions,
            pending_transactions=pending_transactions,
            failed_transactions=failed_transactions,
            total_succeeded_amount=total_succeeded_amount,
            pending_amount=pending_amount,
            week_succeeded_amount=week_succeeded_amount,
            latest_topup_at=latest_topup_at,
        )
