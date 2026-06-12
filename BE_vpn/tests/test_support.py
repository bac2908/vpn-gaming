from types import SimpleNamespace
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import schemas
from app.api.admin import get_support_service as get_admin_support_service
from app.api.admin import router as admin_router
from app.api.deps import get_current_user, require_admin
from app.api.support import get_support_service as get_user_support_service
from app.api.support import router as support_router


def _ticket(status: str = "open") -> schemas.SupportTicketOut:
    return schemas.SupportTicketOut(
        id=uuid4(),
        user_id=uuid4(),
        user_email="player@example.com",
        title="VPN connection issue",
        type="technical",
        detail="OpenVPN connected but Moonlight cannot find the VM.",
        status=status,
        admin_note=None,
    )


def test_user_can_create_support_ticket() -> None:
    app = FastAPI()
    app.include_router(support_router)
    current_user = SimpleNamespace(id=uuid4(), email="player@example.com")

    class FakeSupportService:
        def __init__(self) -> None:
            self.created = None

        def create_ticket(self, user, payload):
            self.created = (user, payload)
            return _ticket()

    fake_service = FakeSupportService()
    app.dependency_overrides[get_current_user] = lambda: current_user
    app.dependency_overrides[get_user_support_service] = lambda: fake_service

    client = TestClient(app)
    response = client.post(
        "/support/tickets",
        json={
            "title": "VPN connection issue",
            "type": "technical",
            "detail": "OpenVPN connected but Moonlight cannot find the VM.",
        },
    )

    assert response.status_code == 200
    assert fake_service.created[0] is current_user
    assert fake_service.created[1].type == "technical"
    assert response.json()["status"] == "open"


def test_admin_can_list_and_update_support_tickets() -> None:
    app = FastAPI()
    app.include_router(admin_router)

    class FakeSupportService:
        def __init__(self) -> None:
            self.list_params = None
            self.update_params = None

        def list_admin_tickets(self, page, page_size, status_filter, category, user_id, user_email=None, search=None):
            self.list_params = (page, page_size, status_filter, category, user_id, user_email, search)
            return schemas.SupportTicketsPage(items=[_ticket()], total=1, page=page, page_size=page_size)

        def update_ticket(self, ticket_id, payload):
            self.update_params = (ticket_id, payload)
            return _ticket(status=payload.status or "open")

    fake_service = FakeSupportService()
    app.dependency_overrides[require_admin] = lambda: SimpleNamespace(role="admin", email="admin@example.com")
    app.dependency_overrides[get_admin_support_service] = lambda: fake_service

    client = TestClient(app)
    list_response = client.get(
        "/admin/support/tickets?page=1&page_size=20&status=open&type=technical"
        "&user_email=player%40example.com&q=Moonlight"
    )
    ticket_id = uuid4()
    update_response = client.patch(
        f"/admin/support/tickets/{ticket_id}",
        json={"status": "resolved", "admin_note": "Checked and resolved."},
    )

    assert list_response.status_code == 200
    assert list_response.json()["total"] == 1
    assert fake_service.list_params == (1, 20, "open", "technical", None, "player@example.com", "Moonlight")
    assert update_response.status_code == 200
    assert update_response.json()["status"] == "resolved"
    assert fake_service.update_params[0] == ticket_id
    assert fake_service.update_params[1].admin_note == "Checked and resolved."
