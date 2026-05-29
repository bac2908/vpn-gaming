from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.services.auth_service import AuthService


auth_scheme = HTTPBearer()
optional_auth_scheme = HTTPBearer(auto_error=False)


def get_auth_service(db: Session = Depends(get_db)) -> AuthService:
    return AuthService(db)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(auth_scheme),
    auth_service: AuthService = Depends(get_auth_service),
) -> models.User:
    return auth_service.get_current_user(credentials.credentials)


def get_optional_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_auth_scheme),
    auth_service: AuthService = Depends(get_auth_service),
) -> models.User | None:
    if not credentials:
        return None
    try:
        return auth_service.get_current_user(credentials.credentials)
    except HTTPException:
        return None


def require_admin(current_user: models.User = Depends(get_current_user)) -> models.User:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Khong co quyen truy cap")
    return current_user
