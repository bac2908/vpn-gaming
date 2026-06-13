from functools import lru_cache
from pathlib import Path
from typing import List, Optional

from pydantic import BaseSettings
from sqlalchemy.engine import URL

class Settings(BaseSettings):
    # Database configuration
    database_url: Optional[str] = None
    db_driver: str = "psycopg2"
    db_host: str = "localhost"
    db_port: int = 5432
    db_user: str = "vpn_user"
    db_password: Optional[str] = None
    db_name: str = "vpn_app"

    jwt_secret: str
    jwt_alg: str = "HS256"
    jwt_expire_min: int = 30
    app_base_url: str = "http://localhost:8000"

    # OpenVPN profile generation
    openvpn_remote_host: str = "vpn-gateway.local"
    openvpn_remote_port: int = 1194
    openvpn_protocol: str = "udp"
    openvpn_ca_cert: Optional[str] = None
    openvpn_tls_crypt_key: Optional[str] = None

    # Logging
    log_level: str = "INFO"
    log_json: bool = False

    # Startup seeding controls
    seed_default_data: bool = True
    seed_admin_email: str = "admin@vpngaming.com"
    seed_admin_password: str = "change-this-admin-password"

    # CORS Configuration
    cors_origins: str = "http://localhost,http://localhost:80,http://localhost:8080,http://localhost:5173,http://127.0.0.1:5173"

    smtp_host: Optional[str] = None
    smtp_port: int = 587
    smtp_user: Optional[str] = None
    smtp_pass: Optional[str] = None
    smtp_from: Optional[str] = None
    smtp_use_tls: bool = True
    smtp_fallback_to_console: bool = False
    verification_expire_min: int = 30

    google_client_id: Optional[str] = None
    google_client_secret: Optional[str] = None
    google_redirect_uri: Optional[str] = None

    # MoMo payment gateway
    momo_partner_code: Optional[str] = None
    momo_access_key: Optional[str] = None
    momo_secret_key: Optional[str] = None
    momo_endpoint: str = "https://test-payment.momo.vn/v2/gateway/api/create"
    momo_redirect_url: Optional[str] = None
    momo_ipn_url: Optional[str] = None
    momo_request_type: str = "captureWallet"
    momo_demo_auto_confirm: bool = False

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS_ORIGINS string to list."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def sqlalchemy_database_url(self) -> str:
        """Return a SQLAlchemy URL from DATABASE_URL or DB_* fields."""
        if self.database_url:
            return self.database_url

        if not self.db_password:
            raise ValueError(
                "Database configuration missing. Set DATABASE_URL or DB_PASSWORD "
                "(with DB_USER/DB_HOST/DB_PORT/DB_NAME)."
            )

        return URL.create(
            drivername=f"postgresql+{self.db_driver}",
            username=self.db_user,
            password=self.db_password,
            host=self.db_host,
            port=self.db_port,
            database=self.db_name,
        ).render_as_string(hide_password=False)

    class Config:
        env_file = str(Path(__file__).resolve().parent.parent / ".env")
        env_file_encoding = "utf-8"

@lru_cache()
def get_settings() -> Settings:
    # Let Pydantic BaseSettings load values from environment and .env file
    return Settings()
