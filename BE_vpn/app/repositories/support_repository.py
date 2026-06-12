from uuid import UUID

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app import models


class SupportRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_ticket(
        self,
        user_id: UUID,
        title: str,
        category: str,
        detail: str,
    ) -> models.SupportTicket:
        ticket = models.SupportTicket(
            user_id=user_id,
            title=title,
            category=category,
            detail=detail,
            status="open",
        )
        self.db.add(ticket)
        self.db.flush()
        return ticket

    def list_user_tickets(
        self,
        user_id: UUID,
        page: int,
        page_size: int,
        status_filter: str | None = None,
    ) -> tuple[list[models.SupportTicket], int]:
        query = self.db.query(models.SupportTicket).filter(models.SupportTicket.user_id == user_id)
        if status_filter:
            query = query.filter(models.SupportTicket.status == status_filter)

        total = query.count()
        items = (
            query.order_by(models.SupportTicket.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return items, total

    def list_tickets(
        self,
        page: int,
        page_size: int,
        status_filter: str | None = None,
        category: str | None = None,
        user_id: UUID | None = None,
        user_email: str | None = None,
        search: str | None = None,
    ) -> tuple[list[models.SupportTicket], int]:
        query = self.db.query(models.SupportTicket)
        joined_user = False
        if status_filter:
            query = query.filter(models.SupportTicket.status == status_filter)
        if category:
            query = query.filter(models.SupportTicket.category == category)
        if user_id:
            query = query.filter(models.SupportTicket.user_id == user_id)
        if user_email:
            query = query.join(models.User, models.SupportTicket.user_id == models.User.id)
            joined_user = True
            query = query.filter(models.User.email.ilike(f"%{user_email.strip()}%"))

        search_term = (search or "").strip()
        if search_term:
            if not joined_user:
                query = query.outerjoin(models.User, models.SupportTicket.user_id == models.User.id)
            like = f"%{search_term}%"
            query = query.filter(
                or_(
                    models.User.email.ilike(like),
                    models.SupportTicket.title.ilike(like),
                    models.SupportTicket.detail.ilike(like),
                    models.SupportTicket.admin_note.ilike(like),
                )
            )

        total = query.count()
        items = (
            query.order_by(models.SupportTicket.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return items, total

    def get_ticket_by_id(self, ticket_id: UUID) -> models.SupportTicket | None:
        return self.db.query(models.SupportTicket).filter(models.SupportTicket.id == ticket_id).first()

    def get_users_by_ids(self, user_ids: list[UUID]) -> dict[UUID, models.User]:
        if not user_ids:
            return {}
        items = self.db.query(models.User).filter(models.User.id.in_(user_ids)).all()
        return {item.id: item for item in items}

    def commit(self) -> None:
        self.db.commit()

    def refresh(self, instance: object) -> None:
        self.db.refresh(instance)
