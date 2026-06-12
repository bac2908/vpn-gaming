from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app import schemas, security
from app.services import auth_service as auth_service_module
from app.services.auth_service import AuthService


@pytest.fixture
def auth_service(monkeypatch: pytest.MonkeyPatch) -> AuthService:
    fake_settings = SimpleNamespace(
        app_base_url="http://localhost:8080",
        verification_expire_min=30,
        google_client_id=None,
        google_client_secret=None,
        google_redirect_uri=None,
    )
    monkeypatch.setattr(auth_service_module, "get_settings", lambda: fake_settings)
    auth_service_module._RATE_LIMIT_BUCKETS.clear()

    service = AuthService(db=object())
    service.repo = MagicMock()
    return service


def test_login_success_returns_auth_response(auth_service: AuthService, monkeypatch: pytest.MonkeyPatch) -> None:
    user = SimpleNamespace(
        id=uuid4(),
        email="player@example.com",
        display_name="Player",
        role="user",
        balance=20000,
        status="active",
        credential=SimpleNamespace(password_hash="hashed"),
    )
    auth_service.repo.get_user_by_email.return_value = user

    monkeypatch.setattr(security, "verify_password", lambda plain, hashed: True)
    monkeypatch.setattr(security, "create_access_token", lambda sub: "token-abc")

    payload = schemas.LoginRequest(email="player@example.com", password="secret123")
    response = auth_service.login(payload)

    assert response.access_token == "token-abc"
    assert response.user.email == "player@example.com"


def test_login_wrong_password_returns_401(auth_service: AuthService, monkeypatch: pytest.MonkeyPatch) -> None:
    user = SimpleNamespace(
        id=uuid4(),
        email="player@example.com",
        display_name="Player",
        role="user",
        balance=0,
        status="active",
        credential=SimpleNamespace(password_hash="hashed"),
    )
    auth_service.repo.get_user_by_email.return_value = user

    monkeypatch.setattr(security, "verify_password", lambda plain, hashed: False)

    payload = schemas.LoginRequest(email="player@example.com", password="wrong")
    with pytest.raises(HTTPException) as exc:
        auth_service.login(payload)

    assert exc.value.status_code == 401


def test_login_locks_user_after_configured_failures(auth_service: AuthService, monkeypatch: pytest.MonkeyPatch) -> None:
    user = SimpleNamespace(
        id=uuid4(),
        email="player@example.com",
        display_name="Player",
        role="user",
        balance=0,
        status="active",
        credential=SimpleNamespace(password_hash="hashed"),
        failed_login_attempts=0,
        locked_until=None,
        last_failed_login_at=None,
    )
    auth_service.repo.get_user_by_email.return_value = user
    monkeypatch.setattr(security, "verify_password", lambda plain, hashed: False)
    monkeypatch.setattr(
        auth_service,
        "_security_policy",
        lambda: {
            "password_min_length": 8,
            "password_require_upper": False,
            "password_require_lower": False,
            "password_require_digit": False,
            "lockout_max_attempts": 2,
            "lockout_minutes": 10,
        },
    )

    payload = schemas.LoginRequest(email="player@example.com", password="wrong")
    with pytest.raises(HTTPException) as first:
        auth_service.login(payload)
    with pytest.raises(HTTPException) as second:
        auth_service.login(payload)

    assert first.value.status_code == 401
    assert second.value.status_code == 423
    assert user.failed_login_attempts == 2
    assert user.locked_until is not None


def test_get_current_user_rejects_revoked_token(auth_service: AuthService, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(auth_service, "get_token_payload", lambda token: {"sub": str(uuid4())})
    auth_service.repo.get_revoked_token.return_value = object()

    with pytest.raises(HTTPException) as exc:
        auth_service.get_current_user("revoked-token")

    assert exc.value.status_code == 401


def test_logout_revokes_token_once(auth_service: AuthService, monkeypatch: pytest.MonkeyPatch) -> None:
    exp_ts = int((datetime.utcnow() + timedelta(minutes=10)).timestamp())
    monkeypatch.setattr(auth_service, "get_token_payload", lambda token: {"exp": exp_ts})
    auth_service.repo.get_revoked_token.return_value = None

    result = auth_service.logout("some-token")

    assert result["message"] == "Dang xuat thanh cong"
    auth_service.repo.add_revoked_token.assert_called_once()
    auth_service.repo.commit.assert_called_once()
