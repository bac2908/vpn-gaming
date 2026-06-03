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


def _signed_momo_payload(service: PaymentService, result_code: str = "0", extra_data: str = "") -> dict:
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
        "&resultCode=0"
        "&transId=987654321"
    )
    payload["signature"] = service._sign_momo(raw_signature)
    return payload


def test_momo_callback_processes_success_and_redirects_to_frontend(payment_service: PaymentService) -> None:
    payment = SimpleNamespace(
        id=uuid4(),
        user_id=uuid4(),
        amount=50000,
        status="pending",
        trans_id=None,
    )
    topup = SimpleNamespace(id=uuid4())
    user = SimpleNamespace(email="player@example.com", balance=10000)

    payment_service.repo.get_payment_by_order_id.return_value = payment
    payment_service.repo.get_topup_by_payment_id.return_value = topup
    payment_service.repo.get_user_by_id.return_value = user
    payment_service.repo.apply_topup_success.return_value = (10000, 60000)

    redirect_url = payment_service.momo_callback(_signed_momo_payload(payment_service))

    assert redirect_url.startswith("http://localhost:5173/app?payment=success")
    payment_service.repo.mark_payment_result.assert_called_once()
    payment_service.repo.apply_topup_success.assert_called_once()
    payment_service.repo.commit.assert_called_once()


def test_momo_callback_preserves_local_frontend_origin(payment_service: PaymentService) -> None:
    payment = SimpleNamespace(
        id=uuid4(),
        user_id=uuid4(),
        amount=50000,
        status="pending",
        trans_id=None,
    )
    topup = SimpleNamespace(id=uuid4())
    user = SimpleNamespace(email="player@example.com", balance=10000)

    payment_service.repo.get_payment_by_order_id.return_value = payment
    payment_service.repo.get_topup_by_payment_id.return_value = topup
    payment_service.repo.get_user_by_id.return_value = user
    payment_service.repo.apply_topup_success.return_value = (10000, 60000)

    extra_data = payment_service._encode_extra_data("http://127.0.0.1:5173/app")
    redirect_url = payment_service.momo_callback(_signed_momo_payload(payment_service, extra_data=extra_data))

    assert redirect_url.startswith("http://127.0.0.1:5173/app?payment=success")
