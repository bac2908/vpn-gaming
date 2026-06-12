from datetime import datetime
from uuid import UUID

from fastapi import HTTPException, status

from app import models, schemas
from app.repositories.support_repository import SupportRepository


class SupportService:
    def __init__(self, db):
        self.repo = SupportRepository(db)

    def _ticket_out(
        self,
        ticket: models.SupportTicket,
        users_map: dict[UUID, models.User] | None = None,
    ) -> schemas.SupportTicketOut:
        user = users_map.get(ticket.user_id) if users_map else getattr(ticket, "user", None)
        return schemas.SupportTicketOut(
            id=ticket.id,
            user_id=ticket.user_id,
            user_email=user.email if user else None,
            title=ticket.title,
            type=ticket.category,
            detail=ticket.detail,
            status=ticket.status,
            admin_note=ticket.admin_note,
            created_at=ticket.created_at,
            updated_at=ticket.updated_at,
            resolved_at=ticket.resolved_at,
        )

    def create_ticket(
        self,
        current_user: models.User,
        payload: schemas.SupportTicketCreateRequest,
    ) -> schemas.SupportTicketOut:
        ticket = self.repo.create_ticket(
            user_id=current_user.id,
            title=payload.title.strip(),
            category=payload.type,
            detail=payload.detail.strip(),
        )
        self.repo.commit()
        self.repo.refresh(ticket)
        return self._ticket_out(ticket, {current_user.id: current_user})

    def list_my_tickets(
        self,
        current_user: models.User,
        page: int,
        page_size: int,
        status_filter: str | None,
    ) -> schemas.SupportTicketsPage:
        items, total = self.repo.list_user_tickets(current_user.id, page, page_size, status_filter)
        return schemas.SupportTicketsPage(
            items=[self._ticket_out(item, {current_user.id: current_user}) for item in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    def list_admin_tickets(
        self,
        page: int,
        page_size: int,
        status_filter: str | None,
        category: str | None,
        user_id: UUID | None,
        user_email: str | None = None,
        search: str | None = None,
    ) -> schemas.SupportTicketsPage:
        items, total = self.repo.list_tickets(
            page,
            page_size,
            status_filter,
            category,
            user_id,
            user_email,
            search,
        )
        users_map = self.repo.get_users_by_ids([item.user_id for item in items])
        return schemas.SupportTicketsPage(
            items=[self._ticket_out(item, users_map) for item in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    def update_ticket(
        self,
        ticket_id: UUID,
        payload: schemas.SupportTicketUpdateRequest,
    ) -> schemas.SupportTicketOut:
        ticket = self.repo.get_ticket_by_id(ticket_id)
        if not ticket:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay ticket")

        if payload.status is not None:
            ticket.status = payload.status
            if payload.status in ("resolved", "closed") and ticket.resolved_at is None:
                ticket.resolved_at = datetime.utcnow()
            if payload.status in ("open", "in_progress"):
                ticket.resolved_at = None

        if payload.admin_note is not None:
            ticket.admin_note = payload.admin_note.strip() or None

        self.repo.commit()
        self.repo.refresh(ticket)
        users_map = self.repo.get_users_by_ids([ticket.user_id])
        return self._ticket_out(ticket, users_map)
