from types import SimpleNamespace
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import schemas
from app.api.admin import get_admin_service, router as admin_router
from app.api.auth import router as auth_router
from app.api.deps import require_admin, get_auth_service


def _build_test_app() -> FastAPI:
    app = FastAPI()
    app.include_router(auth_router)
    app.include_router(admin_router)
    return app


def test_auth_login_endpoint_returns_auth_payload() -> None:
    app = _build_test_app()

    class FakeAuthService:
        def login(self, payload: schemas.LoginRequest) -> schemas.AuthResponse:
            return schemas.AuthResponse(
                access_token="test-token",
                user=schemas.UserOut(
                    id=uuid4(),
                    email=payload.email,
                    display_name="Player",
                    role="user",
                    balance=0,
                ),
            )

    app.dependency_overrides[get_auth_service] = lambda: FakeAuthService()
    client = TestClient(app)

    response = client.post("/auth/login", json={"email": "player@example.com", "password": "secret123"})

    assert response.status_code == 200
    data = response.json()
    assert data["access_token"] == "test-token"
    assert data["user"]["email"] == "player@example.com"



def test_admin_users_endpoint_uses_service_layer() -> None:
    app = _build_test_app()

    class FakeAdminService:
        def __init__(self) -> None:
            self.called = False

        def list_users(self, page, page_size, email, role, status_filter):
            self.called = True
            return schemas.UsersPage(
                items=[
                    schemas.AdminUserOut(
                        id=uuid4(),
                        email="u1@example.com",
                        display_name="U1",
                        role="user",
                        status="active",
                        balance=100,
                    )
                ],
                total=1,
                page=page,
                page_size=page_size,
            )

    fake_service = FakeAdminService()
    app.dependency_overrides[require_admin] = lambda: SimpleNamespace(role="admin", email="admin@example.com")
    app.dependency_overrides[get_admin_service] = lambda: fake_service

    client = TestClient(app)
    response = client.get("/admin/users?page=1&page_size=20")

    assert response.status_code == 200
    assert fake_service.called is True
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["email"] == "u1@example.com"


def test_admin_transactions_endpoint_passes_email_and_search_filters() -> None:
    app = _build_test_app()

    class FakeAdminService:
        def __init__(self) -> None:
            self.params = None

        def list_transactions(
            self,
            page,
            page_size,
            user_id,
            user_email,
            status_filter,
            provider,
            date_from,
            date_to,
            search,
        ):
            self.params = (
                page,
                page_size,
                user_id,
                user_email,
                status_filter,
                provider,
                date_from,
                date_to,
                search,
            )
            return schemas.TopupHistoryPage(
                items=[
                    schemas.TopupTransactionOut(
                        id=uuid4(),
                        user_id=uuid4(),
                        user_email="player@example.com",
                        amount=50000,
                        balance_before=10000,
                        balance_after=60000,
                        status="succeeded",
                        provider="momo",
                    )
                ],
                total=1,
                page=page,
                page_size=page_size,
            )

    fake_service = FakeAdminService()
    app.dependency_overrides[require_admin] = lambda: SimpleNamespace(role="admin", email="admin@example.com")
    app.dependency_overrides[get_admin_service] = lambda: fake_service

    client = TestClient(app)
    response = client.get(
        "/admin/transactions?page=2&page_size=5&user_email=player%40example.com"
        "&status=succeeded&provider=momo&q=Moonlight"
    )

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert fake_service.params == (
        2,
        5,
        None,
        "player@example.com",
        "succeeded",
        "momo",
        None,
        None,
        "Moonlight",
    )


def test_admin_transaction_export_passes_same_filters() -> None:
    app = _build_test_app()

    class FakeAdminService:
        def __init__(self) -> None:
            self.params = None

        def export_transactions_csv(
            self,
            user_id,
            user_email,
            status_filter,
            provider,
            date_from,
            date_to,
            search,
        ):
            self.params = (user_id, user_email, status_filter, provider, date_from, date_to, search)

            def iter_csv():
                yield "TransactionId,UserEmail\n"
                yield "tx-1,player@example.com\n"

            return iter_csv

    fake_service = FakeAdminService()
    app.dependency_overrides[require_admin] = lambda: SimpleNamespace(role="admin", email="admin@example.com")
    app.dependency_overrides[get_admin_service] = lambda: fake_service

    client = TestClient(app)
    response = client.get(
        "/admin/transactions/export?user_email=player%40example.com"
        "&status=succeeded&provider=admin_adjustment&search=manual"
    )

    assert response.status_code == 200
    assert "player@example.com" in response.text
    assert fake_service.params == (
        None,
        "player@example.com",
        "succeeded",
        "admin_adjustment",
        None,
        None,
        "manual",
    )


def test_admin_sessions_endpoint_passes_email_and_machine_code_filters() -> None:
    app = _build_test_app()

    class FakeAdminService:
        def __init__(self) -> None:
            self.params = None

        def list_sessions(
            self,
            page,
            page_size,
            status_filter,
            user_id,
            machine_id,
            user_email=None,
            machine_code=None,
        ):
            self.params = (page, page_size, status_filter, user_id, machine_id, user_email, machine_code)
            return schemas.SessionsPage(items=[], total=0, page=page, page_size=page_size)

    fake_service = FakeAdminService()
    app.dependency_overrides[require_admin] = lambda: SimpleNamespace(role="admin", email="admin@example.com")
    app.dependency_overrides[get_admin_service] = lambda: fake_service

    client = TestClient(app)
    response = client.get(
        "/admin/sessions?page=1&page_size=10&status=active"
        "&user_email=player%40example.com&machine_code=SG-01"
    )

    assert response.status_code == 200
    assert fake_service.params == (
        1,
        10,
        "active",
        None,
        None,
        "player@example.com",
        "SG-01",
    )
