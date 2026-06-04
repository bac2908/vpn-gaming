from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.services import payment_service as payment_service_module
from app.services.payment_service import PaymentService


@pytest.fixture
def payment_service(monkeypatch: pytest.MonkeyPatch) -> PaymentService:
    fake_settings = SimpleNamespace(
        momo_partner_code="MOMO",
        momo_access_key="access-key",
        momo_secret_key="secret-key",
        momo_endpoint="https://example.test/momo",
        momo_redirect_url=None,
        momo_ipn_url=None,
        momo_request_type="payWithMethod",
        app_base_url="http://localhost:8000",
        frontend_base_url="http://localhost:5173",
    )
    monkeypatch.setattr(payment_service_module, "get_settings", lambda: fake_settings)

    service = PaymentService(db=object())
    service.repo = MagicMock()
    return service


def _signed_momo_payload(service: PaymentService, result_code: int = 0, extra_data: str = "") -> dict:
    payload = {
        "partnerCode": "MOMO",
        "orderId": "order-123",
        "requestId": "request-123",
        "amount": "50000",
        "orderInfo": "Nap tien qua MoMo",
        "orderType": "momo_wallet",
        "transId": "987654321",
        "resultCode": result_code,
        "message": "Successful.",
        "payType": "qr",
        "responseTime": "1710000000000",
        "extraData": extra_data,
    }
    raw_signature = (
        "accessKey=access-key&amount=50000"
        f"&extraData={extra_data}&message=Successful."
        "&orderId=order-123"
        "&orderInfo=Nap tien qua MoMo"
        "&orderType=momo_wallet"
        "&partnerCode=MOMO"
        "&payType=qr"
        "&requestId=request-123"
        "&responseTime=1710000000000"
        f"&resultCode={result_code}"
        "&transId=987654321"
    )
    payload["signature"] = service._sign_momo(raw_signature)
    return payload


def test_momo_ipn_creates_topup_only_after_success(payment_service: PaymentService) -> None:
    payment = SimpleNamespace(
        id=uuid4(),
        user_id=uuid4(),
        amount=50000,
        status="pending",
        trans_id=None,
        provider="momo",
    )
    user = SimpleNamespace(email="player@example.com", balance=10000)
    topup = SimpleNamespace(id=uuid4())

    payment_service.repo.get_payment_by_order_id.return_value = payment
    payment_service.repo.get_topup_by_payment_id.return_value = None
    payment_service.repo.get_user_by_id.return_value = user
    payment_service.repo.create_succeeded_topup_from_payment.return_value = (topup, 10000, 60000)

    def mark_result(payment, is_success, message, trans_id, extra_data):
        payment.status = "succeeded" if is_success else "failed"
        payment.trans_id = trans_id

    payment_service.repo.mark_payment_result.side_effect = mark_result

    result = payment_service.momo_ipn(_signed_momo_payload(payment_service))

    assert result == {"resultCode": 0, "message": "OK"}
    payment_service.repo.mark_payment_result.assert_called_once()
    payment_service.repo.apply_topup_success.assert_not_called()
    payment_service.repo.create_succeeded_topup_from_payment.assert_called_once_with(
        payment=payment,
        user=user,
        trans_id="987654321",
    )
    payment_service.repo.commit.assert_called_once()


def test_momo_ipn_updates_existing_pending_topup_for_old_orders(payment_service: PaymentService) -> None:
    payment = SimpleNamespace(
        id=uuid4(),
        user_id=uuid4(),
        amount=50000,
        status="pending",
        trans_id=None,
        provider="momo",
    )
    topup = SimpleNamespace(id=uuid4())
    user = SimpleNamespace(email="player@example.com", balance=10000)

    payment_service.repo.get_payment_by_order_id.return_value = payment
    payment_service.repo.get_topup_by_payment_id.return_value = topup
    payment_service.repo.get_user_by_id.return_value = user
    payment_service.repo.apply_topup_success.return_value = (10000, 60000)

    def mark_result(payment, is_success, message, trans_id, extra_data):
        payment.status = "succeeded" if is_success else "failed"
        payment.trans_id = trans_id

    payment_service.repo.mark_payment_result.side_effect = mark_result

    result = payment_service.momo_ipn(_signed_momo_payload(payment_service))

    assert result == {"resultCode": 0, "message": "OK"}
    payment_service.repo.apply_topup_success.assert_called_once_with(
        topup=topup,
        user=user,
        amount=50000,
        trans_id="987654321",
    )
    payment_service.repo.create_succeeded_topup_from_payment.assert_not_called()
    payment_service.repo.commit.assert_called_once()
