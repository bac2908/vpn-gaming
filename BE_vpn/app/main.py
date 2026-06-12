from pathlib import Path
import asyncio
import sys
from time import perf_counter

# Check Python compatibility early and provide a clear message if unsupported.
# This project depends on Pydantic 1.x and FastAPI built against it; those
# packages are not compatible with very recent Python versions (eg. 3.13+).
if sys.version_info >= (3, 13):
    raise RuntimeError(
        f"Unsupported Python version: {sys.version_info.major}.{sys.version_info.minor}.\n"
        "This project requires Python 3.10, 3.11, or 3.12 (Pydantic v1 incompatibilities with newer Pythons).\n"
        "Please create a virtualenv using Python 3.11 (eg. `py -3.11 -m venv .venv`)."
    )

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app import models
from app.config import get_settings
from app.core.logging import configure_logging, get_logger
from app.database import engine, init_database, SessionLocal
from app.api.auth import router as auth_router
from app.api.machines import router as machines_router
from app.api.payments import router as payments_router
from app.api.admin import router as admin_router
from app.api.subscriptions import router as subscriptions_router
from app.api.support import router as support_router
from app import security
from app.services.machine_service import MachineService

settings = get_settings()
configure_logging(level=settings.log_level, use_json=settings.log_json)
logger = get_logger(__name__)

# Initialize database: create pgcrypto extension and all tables
init_database()


def seed_default_data():
    """Seed default data if database is empty."""
    if not settings.seed_default_data:
        logger.info("Default seed data disabled (SEED_DEFAULT_DATA=false).")
        return

    db = SessionLocal()
    try:
        # Seed default service plans if not exist
        existing_plans = db.query(models.ServicePlan).first()
        if not existing_plans:
            default_plans = [
                models.ServicePlan(
                    code="basic",
                    name="Gói Cơ Bản",
                    description="Phù hợp cho người dùng cá nhân",
                    price_cents=49000,
                    currency="VND",
                    duration_days=30,
                    data_limit_gb=50,
                    active=True,
                ),
                models.ServicePlan(
                    code="pro",
                    name="Gói Pro",
                    description="Dành cho game thủ chuyên nghiệp",
                    price_cents=99000,
                    currency="VND",
                    duration_days=30,
                    data_limit_gb=100,
                    active=True,
                ),
                models.ServicePlan(
                    code="premium",
                    name="Gói Premium",
                    description="Không giới hạn dung lượng",
                    price_cents=199000,
                    currency="VND",
                    duration_days=30,
                    data_limit_gb=None,
                    active=True,
                ),
            ]
            db.add_all(default_plans)
            db.commit()
            logger.info("Seeded default service plans")

        # Seed default admin user if not exist
        admin_email = settings.seed_admin_email
        existing_admin = db.query(models.User).filter(models.User.email == admin_email).first()
        if not existing_admin:
            if settings.seed_admin_password == "change-this-admin-password":
                logger.warning("Using default SEED_ADMIN_PASSWORD. Set a strong value in .env.")

            admin_user = models.User(
                email=admin_email,
                display_name="Administrator",
                role="admin",
                status="active",
            )
            admin_credential = models.Credential(
                password_hash=security.hash_password(settings.seed_admin_password),
                user=admin_user,
            )
            db.add_all([admin_user, admin_credential])
            db.commit()
            logger.info("Seeded admin user: %s", admin_email)

        # Seed sample machines if not exist
        existing_machines = db.query(models.Machine).first()
        if not existing_machines:
            default_machines = [
                models.Machine(
                    code="VN-HCM-3060",
                    region="Vietnam",
                    location="Ho Chi Minh City",
                    ping_ms=6,
                    gpu="NVIDIA RTX 3060",
                    status="idle",
                ),
                models.Machine(
                    code="VN-HCM-01",
                    region="Vietnam",
                    location="Ho Chi Minh City",
                    ping_ms=5,
                    gpu="NVIDIA RTX 4090",
                    status="idle",
                ),
                models.Machine(
                    code="VN-HN-01",
                    region="Vietnam",
                    location="Hanoi",
                    ping_ms=10,
                    gpu="NVIDIA RTX 4080",
                    status="idle",
                ),
                models.Machine(
                    code="SG-01",
                    region="Singapore",
                    location="Singapore",
                    ping_ms=25,
                    gpu="NVIDIA RTX 4090",
                    status="idle",
                ),
                models.Machine(
                    code="JP-TK-01",
                    region="Japan",
                    location="Tokyo",
                    ping_ms=50,
                    gpu="NVIDIA RTX 4080",
                    status="idle",
                ),
            ]
            db.add_all(default_machines)
            db.commit()
            logger.info("Seeded default machines")

    except Exception as e:
        db.rollback()
        logger.exception("Error seeding data: %s", e)
    finally:
        db.close()


# Seed default data
seed_default_data()

app = FastAPI(title="VPN Gaming Auth API")


async def billing_loop() -> None:
    while True:
        await asyncio.sleep(60)
        db = SessionLocal()
        try:
            changed = MachineService(db).bill_all_active_sessions()
            if changed:
                logger.info("Billed active sessions: %d", changed)
        except Exception as exc:
            db.rollback()
            logger.exception("Billing loop failed: %s", exc)
        finally:
            db.close()


@app.on_event("startup")
async def start_billing_loop() -> None:
    app.state.billing_task = asyncio.create_task(billing_loop())


@app.on_event("shutdown")
async def stop_billing_loop() -> None:
    task = getattr(app.state, "billing_task", None)
    if task:
        task.cancel()

# Load settings for CORS configuration
cors_settings = settings

# CORS - supports both dev and production via CORS_ORIGINS env var
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


@app.middleware("http")
async def log_http_requests(request: Request, call_next):
    if request.url.path == "/health":
        return await call_next(request)

    start = perf_counter()
    client_ip = request.client.host if request.client else "-"

    try:
        response = await call_next(request)
    except Exception:
        duration_ms = round((perf_counter() - start) * 1000, 2)
        logger.exception(
            "Unhandled HTTP error",
            extra={
                "method": request.method,
                "path": request.url.path,
                "status_code": 500,
                "duration_ms": duration_ms,
                "client_ip": client_ip,
            },
        )
        raise

    duration_ms = round((perf_counter() - start) * 1000, 2)
    logger.info(
        "HTTP request completed",
        extra={
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": duration_ms,
            "client_ip": client_ip,
        },
    )
    return response

app.include_router(auth_router)
app.include_router(machines_router)
app.include_router(payments_router)
app.include_router(subscriptions_router)
app.include_router(support_router)
app.include_router(admin_router)

@app.get("/health")
def health():
    return {"status": "ok"}


# Serve built frontend (Vite build outputs to app/static)
STATIC_DIR = Path(__file__).parent / "static"
INDEX_NO_CACHE_HEADERS = {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
}

if STATIC_DIR.exists():
    # Serve built assets explicitly, then fall back to index.html for SPA routes like /app
    assets_dir = STATIC_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/", include_in_schema=False)
    def serve_root():
        index_file = STATIC_DIR / "index.html"
        if index_file.exists():
            return FileResponse(index_file, headers=INDEX_NO_CACHE_HEADERS)
        return {"detail": "Not Found"}

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa_catch_all(full_path: str):
        requested = STATIC_DIR / full_path
        if requested.exists() and requested.is_file():
            return FileResponse(requested)
        index_file = STATIC_DIR / "index.html"
        if index_file.exists():
            return FileResponse(index_file, headers=INDEX_NO_CACHE_HEADERS)
        return {"detail": "Not Found"}
