import hashlib
import json
import logging
import secrets
from datetime import datetime, timedelta
from urllib.parse import urlencode
from uuid import UUID

import httpx
from fastapi import HTTPException, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import HTMLResponse

from app import models, schemas, security
from app.config import get_settings
from app.email_utils import send_email
from app.repositories.auth_repository import AuthRepository


_RATE_LIMIT_BUCKETS: dict[str, list[datetime]] = {}


class AuthService:
    def __init__(self, db):
        self.repo = AuthRepository(db)
        self.settings = get_settings()
        self.logger = logging.getLogger(__name__)

    @staticmethod
    def to_user_out(user: models.User) -> schemas.UserOut:
        return schemas.UserOut(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            role=user.role,
            balance=user.balance or 0,
            has_password=bool(user.credential),
        )

    def build_auth_response(self, user: models.User) -> schemas.AuthResponse:
        token = security.create_access_token(str(user.id))
        return schemas.AuthResponse(access_token=token, user=self.to_user_out(user))

    def _security_policy(self) -> dict:
        policy = {
            "password_min_length": 8,
            "password_require_upper": True,
            "password_require_lower": True,
            "password_require_digit": True,
            "lockout_max_attempts": 5,
            "lockout_minutes": 10,
        }
        try:
            settings = self.repo.db.query(models.AdminSettings).order_by(models.AdminSettings.created_at.asc()).first()
        except Exception:
            settings = None

        if not settings:
            return policy

        for key, default_value in policy.items():
            value = getattr(settings, key, None)
            if isinstance(default_value, bool) and isinstance(value, bool):
                policy[key] = value
            elif isinstance(default_value, int) and isinstance(value, int):
                policy[key] = value
        return policy

    def _check_rate_limit(self, action: str, identifier: str, max_attempts: int, window_seconds: int) -> None:
        now = datetime.utcnow()
        key = f"{action}:{identifier.strip().lower()}"
        bucket = [
            item for item in _RATE_LIMIT_BUCKETS.get(key, [])
            if (now - item).total_seconds() < window_seconds
        ]
        if len(bucket) >= max_attempts:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Qua nhieu yeu cau. Vui long thu lai sau.",
            )
        bucket.append(now)
        _RATE_LIMIT_BUCKETS[key] = bucket

    def _validate_password_policy(self, password: str) -> None:
        policy = self._security_policy()
        min_length = int(policy["password_min_length"])
        if len(password) < min_length:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Mat khau phai co it nhat {min_length} ky tu",
            )
        if policy["password_require_upper"] and not any(char.isupper() for char in password):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mat khau phai co chu hoa")
        if policy["password_require_lower"] and not any(char.islower() for char in password):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mat khau phai co chu thuong")
        if policy["password_require_digit"] and not any(char.isdigit() for char in password):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mat khau phai co chu so")

    def _locked_response(self, locked_until: datetime) -> None:
        raise HTTPException(
            status_code=423,
            detail=f"Tai khoan bi khoa tam thoi den {locked_until.isoformat()}",
        )

    def _ensure_user_not_locked(self, user: models.User) -> None:
        locked_until = getattr(user, "locked_until", None)
        now = datetime.utcnow()
        if locked_until and locked_until > now:
            self._locked_response(locked_until)
        if locked_until and locked_until <= now:
            user.locked_until = None
            user.failed_login_attempts = 0
            self.repo.db.add(user)
            self.repo.commit()

    def _record_failed_login(self, user: models.User) -> None:
        policy = self._security_policy()
        attempts = int(getattr(user, "failed_login_attempts", 0) or 0) + 1
        user.failed_login_attempts = attempts
        user.last_failed_login_at = datetime.utcnow()
        if attempts >= int(policy["lockout_max_attempts"]):
            user.locked_until = datetime.utcnow() + timedelta(minutes=int(policy["lockout_minutes"]))
        self.repo.db.add(user)
        self.repo.commit()

    def _record_successful_login(self, user: models.User) -> None:
        if getattr(user, "failed_login_attempts", 0) or getattr(user, "locked_until", None):
            user.failed_login_attempts = 0
            user.locked_until = None
            user.last_failed_login_at = None
            self.repo.db.add(user)
            self.repo.commit()

    def build_sso_success_page(self, auth: schemas.AuthResponse) -> HTMLResponse:
        redirect_to = self.settings.app_base_url.rstrip("/") + "/app"
        payload = jsonable_encoder(
            {
                "access_token": auth.access_token,
                "token_type": auth.token_type,
                "user": auth.user,
            }
        )
        html = f"""
<!doctype html>
<html lang=\"en\">\n<body>\n<script>
    (function() {{
        const data = {json.dumps(payload, default=str)};
        try {{
            localStorage.setItem('auth_token', data.access_token);
            if (data.user && data.user.email) localStorage.setItem('auth_email', data.user.email);
            localStorage.setItem('auth_user', JSON.stringify(data.user));
        }} catch (err) {{
            console.error('Khong luu duoc phien dang nhap', err);
        }}
        window.location.replace('{redirect_to}');
    }})();
</script>\n</body>\n</html>
"""
        return HTMLResponse(content=html)

    def get_token_payload(self, token: str) -> dict:
        try:
            return security.decode_access_token(token)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    def get_current_user(self, token: str) -> models.User:
        payload = self.get_token_payload(token)

        token_hash = hashlib.sha256(token.encode()).hexdigest()
        revoked = self.repo.get_revoked_token(token_hash)
        if revoked:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token da bi thu hoi")

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token khong hop le")

        try:
            user_uuid = UUID(user_id)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token khong hop le") from exc

        user = self.repo.get_user_by_id(user_uuid)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay nguoi dung")
        return user

    def login(self, payload: schemas.LoginRequest) -> schemas.AuthResponse:
        self._check_rate_limit("login", payload.email, max_attempts=10, window_seconds=60)
        if len(payload.password) > 72:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mat khau toi da 72 ky tu")

        user = self.repo.get_user_by_email(payload.email)
        if not user or not user.credential:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sai thong tin dang nhap")

        self._ensure_user_not_locked(user)

        if not security.verify_password(payload.password, user.credential.password_hash):
            self._record_failed_login(user)
            if getattr(user, "locked_until", None):
                self._locked_response(user.locked_until)
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sai thong tin dang nhap")

        if user.status != "active":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tai khoan chua xac thuc email")

        self._record_successful_login(user)
        return self.build_auth_response(user)

    def logout(self, token: str) -> dict:
        payload = self.get_token_payload(token)
        exp = payload.get("exp")
        if not exp:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token khong co exp")

        token_hash = hashlib.sha256(token.encode()).hexdigest()
        exists = self.repo.get_revoked_token(token_hash)
        if not exists:
            expires_at = datetime.utcfromtimestamp(exp)
            self.repo.add_revoked_token(token_hash, expires_at)
            self.repo.commit()

        return {"message": "Dang xuat thanh cong"}

    def register(self, payload: schemas.RegisterRequest) -> schemas.AuthResponse:
        self._check_rate_limit("register", payload.email, max_attempts=5, window_seconds=300)
        if len(payload.password) > 72:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mat khau toi da 72 ky tu")
        self._validate_password_policy(payload.password)

        existing = self.repo.get_user_by_email(payload.email)
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email da ton tai")

        user = self.repo.create_user(
            email=payload.email,
            display_name=payload.display_name or payload.email.split("@")[0],
            status="pending",
        )
        self.repo.create_credential(user=user, password_hash=security.hash_password(payload.password))

        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        self.repo.create_email_verification(
            user=user,
            token_hash=token_hash,
            expires_at=datetime.utcnow() + timedelta(minutes=self.settings.verification_expire_min),
        )

        self.repo.commit()
        self.repo.refresh(user)

        verify_link = self.settings.app_base_url.rstrip("/") + "/auth/verify-email?token=" + raw_token
        body = (
            "Xin chao,\n\n"
            "Vui long bam vao lien ket sau de xac thuc email cua ban: \n"
            f"{verify_link}\n\n"
            "Lien ket het han sau 30 phut."
        )
        try:
            send_email(self.settings, to_email=user.email, subject="Xac thuc tai khoan", body=body)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Khong gui duoc email xac thuc",
            ) from exc

        return self.build_auth_response(user)

    def forgot_password(self, payload: schemas.ForgotPasswordRequest) -> dict:
        self._check_rate_limit("forgot", payload.email, max_attempts=5, window_seconds=300)
        user = self.repo.get_user_by_email(payload.email)
        if not user:
            return {"message": "Neu email ton tai, chung toi da gui huong dan dat lai mat khau."}

        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        self.repo.create_password_reset(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.utcnow() + timedelta(minutes=self.settings.verification_expire_min),
        )
        self.repo.commit()

        reset_link = self.settings.app_base_url.rstrip("/") + "/reset?token=" + raw_token
        body = (
            "Xin chao,\n\n"
            "Chung toi nhan duoc yeu cau dat lai mat khau cho tai khoan cua ban.\n"
            "Neu do la ban, hay bam lien ket sau de dat lai mat khau:\n"
            f"{reset_link}\n\n"
            "Lien ket het han sau 30 phut. Neu ban khong yeu cau, hay bo qua email nay."
        )

        try:
            self.logger.info("Reset link gui toi %s: %s", user.email, reset_link)
            send_email(self.settings, to_email=user.email, subject="Dat lai mat khau", body=body)
        except ValueError as exc:
            self.logger.warning("SMTP chua cau hinh - reset link: %s", reset_link)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
        except Exception as exc:
            self.logger.error("Gui email reset loi: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Khong gui duoc email dat lai mat khau",
            ) from exc

        return {"message": "Neu email ton tai, chung toi da gui huong dan dat lai mat khau."}

    def reset_password(self, payload: schemas.ResetPasswordRequest) -> dict:
        try:
            self._check_rate_limit("reset", payload.token[:16] if payload.token else "missing", max_attempts=8, window_seconds=300)
            if not payload.token or not payload.new_password:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Thieu thong tin dat lai mat khau")
            if len(payload.new_password) > 72:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mat khau toi da 72 ky tu")
            self._validate_password_policy(payload.new_password)

            token_hash = hashlib.sha256(payload.token.encode()).hexdigest()
            record = self.repo.get_valid_password_reset(token_hash)
            if not record:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token khong hop le hoac da het han")

            user = self.repo.get_user_by_id(record.user_id)
            if not user:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay nguoi dung")

            new_hash = security.hash_password(payload.new_password)
            if not user.credential:
                self.repo.create_credential(user=user, password_hash=new_hash)
            else:
                user.credential.password_hash = new_hash
                self.repo.db.add(user.credential)

            record.consumed_at = datetime.utcnow()
            self.repo.db.add(record)
            self.repo.commit()
            return {"message": "Dat lai mat khau thanh cong"}
        except HTTPException:
            raise
        except Exception as exc:
            self.repo.rollback()
            self.logger.exception("Reset password loi khong xac dinh")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Khong the dat lai mat khau: {exc}",
            ) from exc

    def change_password(self, payload: schemas.ChangePasswordRequest) -> dict:
        self._check_rate_limit("change-password", payload.email, max_attempts=8, window_seconds=300)
        user = self.repo.get_user_by_email(payload.email)
        if not user or not user.credential:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay nguoi dung")

        if not security.verify_password(payload.old_password, user.credential.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Mat khau cu khong dung")

        if len(payload.new_password) > 72:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mat khau toi da 72 ky tu")
        self._validate_password_policy(payload.new_password)

        user.credential.password_hash = security.hash_password(payload.new_password)
        self.repo.db.add(user.credential)
        self.repo.commit()
        return {"message": "Doi mat khau thanh cong"}

    def set_password(self, user: models.User, payload: schemas.SetPasswordRequest) -> schemas.UserOut:
        if user.credential:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tai khoan da co mat khau")

        if len(payload.new_password) > 72:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mat khau toi da 72 ky tu")
        self._validate_password_policy(payload.new_password)

        new_hash = security.hash_password(payload.new_password)
        self.repo.create_credential(user=user, password_hash=new_hash)
        self.repo.commit()
        return self.to_user_out(user)

    def update_profile(self, user: models.User, payload: schemas.UserProfileUpdateRequest) -> schemas.UserOut:
        if user.credential:
            if not payload.current_password:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Thieu mat khau hien tai")
            if not security.verify_password(payload.current_password, user.credential.password_hash):
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Mat khau hien tai khong dung")

        if payload.display_name is not None:
            display_name = payload.display_name.strip()
            if not display_name:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ten hien thi khong hop le")
            user.display_name = display_name

        self.repo.db.add(user)
        self.repo.commit()
        self.repo.refresh(user)
        return self.to_user_out(user)

    def verify_email(self, token: str) -> dict:
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        record = self.repo.get_valid_email_verification(token_hash)
        if not record:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token khong hop le hoac da het han")

        record.consumed_at = datetime.utcnow()
        record.user.status = "active"
        self.repo.db.add(record)
        self.repo.db.add(record.user)
        self.repo.commit()
        return {"message": "Xac thuc email thanh cong"}

    def google_login(self) -> dict:
        if not self.settings.google_client_id or not self.settings.google_redirect_uri:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Chua cau hinh Google OAuth")

        params = {
            "client_id": self.settings.google_client_id,
            "redirect_uri": self.settings.google_redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "offline",
            "prompt": "consent",
        }
        url = "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)
        return {"auth_url": url}

    def google_callback(self, code: str | None):
        if not code:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Thieu ma xac thuc")
        if not self.settings.google_client_id or not self.settings.google_client_secret or not self.settings.google_redirect_uri:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Chua cau hinh Google OAuth")

        token_resp = httpx.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": self.settings.google_client_id,
                "client_secret": self.settings.google_client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": self.settings.google_redirect_uri,
            },
            timeout=10,
        )
        if token_resp.status_code != 200:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Khong doi duoc token tu Google")

        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google khong tra access_token")

        userinfo_resp = httpx.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
        if userinfo_resp.status_code != 200:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Khong lay duoc thong tin nguoi dung Google")

        info = userinfo_resp.json()
        email = info.get("email")
        sub = info.get("id") or info.get("sub")
        name = info.get("name") or (email.split("@")[0] if email else "")
        if not email or not sub:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Thieu email hoac id tu Google")

        identity = self.repo.get_google_identity(sub)
        if identity:
            user = identity.user
            identity.last_login_at = datetime.utcnow()
            self.repo.db.add(identity)
        else:
            user = self.repo.get_user_by_email(email)
            if not user:
                user = self.repo.create_user(
                    email=email,
                    display_name=name or email.split("@")[0],
                    role="user",
                    status="active",
                )
                self.repo.db.flush()

            self.repo.create_identity(
                user=user,
                subject=sub,
                access_token=access_token,
                refresh_token=token_data.get("refresh_token"),
                expires_at=datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 3600)),
            )

        self.repo.commit()
        self.repo.refresh(user)

        auth = self.build_auth_response(user)
        return self.build_sso_success_page(auth)
