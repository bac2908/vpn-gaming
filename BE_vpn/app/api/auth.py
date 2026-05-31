from fastapi import APIRouter, Depends, Query, status
from fastapi.security import HTTPAuthorizationCredentials

from app import models, schemas
from app.api.deps import auth_scheme, get_auth_service, get_current_user
from app.services.auth_service import AuthService


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=schemas.AuthResponse)
def login(payload: schemas.LoginRequest, auth_service: AuthService = Depends(get_auth_service)):
    return auth_service.login(payload)


@router.get("/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(get_current_user), auth_service: AuthService = Depends(get_auth_service)):
    return auth_service.to_user_out(current_user)


@router.post("/logout", response_model=schemas.MessageResponse)
def logout(
    credentials: HTTPAuthorizationCredentials = Depends(auth_scheme),
    auth_service: AuthService = Depends(get_auth_service),
):
    return auth_service.logout(credentials.credentials)


@router.post("/register", response_model=schemas.AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: schemas.RegisterRequest, auth_service: AuthService = Depends(get_auth_service)):
    return auth_service.register(payload)


@router.post("/forgot", response_model=dict)
def forgot_password(payload: schemas.ForgotPasswordRequest, auth_service: AuthService = Depends(get_auth_service)):
    return auth_service.forgot_password(payload)


@router.post("/reset-password", response_model=dict)
def reset_password(payload: schemas.ResetPasswordRequest, auth_service: AuthService = Depends(get_auth_service)):
    return auth_service.reset_password(payload)


@router.post("/change-password", response_model=dict)
def change_password(payload: schemas.ChangePasswordRequest, auth_service: AuthService = Depends(get_auth_service)):
    return auth_service.change_password(payload)


@router.post("/set-password", response_model=schemas.UserOut)
def set_password(
    payload: schemas.SetPasswordRequest,
    current_user: models.User = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service),
):
    return auth_service.set_password(current_user, payload)


@router.patch("/profile", response_model=schemas.UserOut)
def update_profile(
    payload: schemas.UserProfileUpdateRequest,
    current_user: models.User = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service),
):
    return auth_service.update_profile(current_user, payload)


@router.get("/verify-email")
def verify_email(
    token: str = Query(..., description="Token xac thuc email"),
    auth_service: AuthService = Depends(get_auth_service),
):
    return auth_service.verify_email(token)


@router.get("/google/login")
def google_login(auth_service: AuthService = Depends(get_auth_service)):
    return auth_service.google_login()


@router.get("/google/callback")
def google_callback(
    code: str | None = Query(None),
    auth_service: AuthService = Depends(get_auth_service),
):
    return auth_service.google_callback(code)
