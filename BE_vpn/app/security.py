from datetime import datetime, timedelta
from jose import jwt, JWTError, ExpiredSignatureError
from passlib.hash import bcrypt
from app.config import get_settings

settings = get_settings()


def hash_password(password: str) -> str:
    if len(password) > 72:
        raise ValueError("Mật khẩu tối đa 72 ký tự")
    return bcrypt.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    if len(password) > 72:
        return False
    return bcrypt.verify(password, password_hash)


def create_access_token(sub: str, expires_minutes: int | None = None) -> str:
    expire = datetime.utcnow() + timedelta(minutes=expires_minutes or settings.jwt_expire_min)
    payload = {"sub": sub, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_alg)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_alg])
    except ExpiredSignatureError as exc:
        raise ValueError("Phiên đăng nhập đã hết hạn") from exc
    except JWTError as exc:
        raise ValueError("Token không hợp lệ") from exc
