# BE_vpn - Backend FastAPI

Backend của VPN Gaming là API FastAPI chịu trách nhiệm xác thực, quản lý máy cloud, phiên chơi, billing theo phút, ví/nạp tiền, subscription và admin portal. Backend cũng có thể serve frontend build từ `app/static`.

## Stack

| Thành phần | Công nghệ |
| --- | --- |
| Web framework | FastAPI 0.110.2 |
| ASGI server | Uvicorn 0.29 |
| ORM | SQLAlchemy 2.0 |
| Database | PostgreSQL 15+ |
| Driver | psycopg/psycopg2 |
| Auth | JWT bằng `python-jose`, hash mật khẩu bằng passlib/bcrypt |
| Config | `python-dotenv`, Pydantic Settings style |
| HTTP integration | `httpx` cho MoMo/Google |
| Tests | pytest |

Python hỗ trợ: 3.10, 3.11, 3.12. Python 3.13+ bị chặn sớm trong `app/main.py`.

## Cấu trúc

```text
BE_vpn/
|-- app/
|   |-- api/
|   |   |-- auth.py
|   |   |-- machines.py
|   |   |-- payments.py
|   |   |-- subscriptions.py
|   |   |-- admin.py
|   |   `-- deps.py
|   |-- repositories/
|   |   |-- auth_repository.py
|   |   |-- machine_repository.py
|   |   |-- payment_repository.py
|   |   `-- admin_repository.py
|   |-- services/
|   |   |-- auth_service.py
|   |   |-- machine_service.py
|   |   |-- payment_service.py
|   |   |-- subscription_service.py
|   |   |-- admin_service.py
|   |   `-- infrastructure_adapters.py
|   |-- core/
|   |-- static/              # Vite build output; backend SPA fallback
|   |-- config.py
|   |-- database.py
|   |-- main.py
|   |-- models.py
|   |-- pricing.py
|   |-- schemas.py
|   |-- security.py
|   |-- email_utils.py
|   `-- seed.py
|-- migrations/              # Legacy SQL snippets
|-- tests/
|-- Dockerfile
|-- requirements.txt
|-- .env.example
`-- README.md
```

Luồng phụ thuộc chính:

```text
FastAPI router -> Service -> Repository -> SQLAlchemy Session -> PostgreSQL
```

## Chạy local

### 1. Tạo môi trường Python

```powershell
cd BE_vpn
py -3.11 -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Tạo file env

```powershell
copy .env.example .env
```

Cấu hình tối thiểu cho local với PostgreSQL ở `localhost:5432`:

```env
DB_USER=vpn_user
DB_PASSWORD=change-this-db-password
DB_NAME=vpn_app
DB_HOST=localhost
DB_PORT=5432
DB_DRIVER=psycopg2
DATABASE_URL=

JWT_SECRET=your-super-secret-jwt-key-change-in-production
APP_BASE_URL=http://localhost:8000
CORS_ORIGINS=http://localhost:5173,http://localhost:8000,http://localhost:8080

SEED_DEFAULT_DATA=true
SEED_ADMIN_EMAIL=admin@vpngaming.com
SEED_ADMIN_PASSWORD=change-this-admin-password
```

Nếu chạy backend container từ `docker-compose.yml`, backend expose ra host tại `http://localhost:8080` nhưng bên trong container vẫn là port `8000`.

### 3. Chạy server

```powershell
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

URL:

```text
http://localhost:8000/health
http://localhost:8000/docs
http://localhost:8000/redoc
```

Khi import `app.main`, backend sẽ:

- gọi `init_database()` để tạo extension/tables theo SQLAlchemy models;
- seed service plans, admin và sample machines nếu `SEED_DEFAULT_DATA=true`;
- bật billing loop mỗi 60 giây để tính phí phiên active.

## Database

Backend dùng `app/database.py` để tạo engine/session. Có hai cách cấu hình:

1. Đặt `DATABASE_URL` đầy đủ.
2. Để `DATABASE_URL=` rỗng và dùng `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_HOST`, `DB_PORT`, `DB_DRIVER`.

Ví dụ URL:

```text
postgresql+psycopg2://vpn_user:change-this-db-password@localhost:5432/vpn_app
```

Schema đầy đủ và migrations SQL nằm trong `../database`.

## API endpoints

### Auth `/auth`

```text
POST   /auth/register
POST   /auth/login
GET    /auth/me
POST   /auth/logout
POST   /auth/forgot
POST   /auth/reset-password
POST   /auth/change-password
POST   /auth/set-password
PATCH  /auth/profile
GET    /auth/verify-email
GET    /auth/google/login
GET    /auth/google/callback
```

### Machines and sessions `/machines`

```text
GET    /machines
GET    /machines/{machine_id}
POST   /machines/{machine_id}/start
POST   /machines/{machine_id}/resume
GET    /machines/sessions/active
GET    /machines/sessions/history
GET    /machines/sessions/history/summary
POST   /machines/sessions/{session_id}/stop
POST   /machines/sessions/{session_id}/heartbeat
GET    /machines/sessions/{session_id}/ovpn
POST   /machines/sessions/{session_id}/vpn/check
POST   /machines/sessions/{session_id}/sunshine/pair
```

### Subscriptions `/subscriptions`

```text
GET    /subscriptions/plans
GET    /subscriptions/me
POST   /subscriptions/purchase
```

### Support `/support`

```text
POST   /support/tickets
GET    /support/tickets/me
```

### Payments `/payments`

```text
POST   /payments/momo
POST   /payments/momo/ipn
GET    /payments/balance
GET    /payments/topup-history
GET    /payments/topup-summary
```

### Admin `/admin`

```text
GET    /admin/dashboard
GET    /admin/users
PATCH  /admin/users/{user_id}
POST   /admin/users/{user_id}/topup
GET    /admin/machines
POST   /admin/machines
PATCH  /admin/machines/{machine_id}
DELETE /admin/machines/{machine_id}
GET    /admin/machines/statistics
GET    /admin/sessions
POST   /admin/sessions/{session_id}/stop
POST   /admin/sessions/{session_id}/fail
GET    /admin/transactions
GET    /admin/transactions/{transaction_id}
GET    /admin/transactions/export
GET    /admin/revenue/statistics
GET    /admin/support/tickets
PATCH  /admin/support/tickets/{ticket_id}
GET    /admin/settings
PUT    /admin/settings
```

## Billing và session lifecycle

`MachineService` xử lý:

- tính trial ngày;
- tính giá theo PAYG/membership;
- start/resume/stop session;
- heartbeat, idle warning, disconnected grace, stop khi hết tiền hoặc quá thời gian;
- refund theo cửa sổ refund;
- snapshot/cooldown;
- history và summary cho màn lịch sử.

Billing loop trong `main.py` chạy mỗi 60 giây và gọi `bill_all_active_sessions()`.

## Payment flow

Rule hiện tại của ví:

1. User bấm nạp tiền.
2. `POST /payments/momo` tạo `Payment` trạng thái `pending` và trả `pay_url`.
3. Chưa tạo lịch sử nạp ví và chưa cộng tiền ở bước này.
4. MoMo gọi `POST /payments/momo/ipn`.
5. Backend verify signature.
6. Nếu `resultCode == 0`, backend cộng số dư và tạo `TopupTransaction` trạng thái `succeeded`.
7. Lịch sử nạp tiền của user mặc định chỉ trả các giao dịch `succeeded`.

Các `TopupTransaction pending` cũ nếu còn trong database sẽ không xuất hiện ở lịch sử user mặc định. Admin có thể đối soát qua `/admin/transactions`.

Admin nạp/trừ tiền thủ công dùng:

```text
POST /admin/users/{user_id}/topup
```

Nếu amount âm, provider trả ra là `admin_debit`.

## Email và OAuth

SMTP:

```env
SMTP_FALLBACK_TO_CONSOLE=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
SMTP_USE_TLS=true
VERIFICATION_EXPIRE_MIN=30
```

Google OAuth:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback
```

## MoMo env

```env
MOMO_PARTNER_CODE=MOMO
MOMO_ACCESS_KEY=F8BBA842ECF85
MOMO_SECRET_KEY=
MOMO_ENDPOINT=https://test-payment.momo.vn/v2/gateway/api/create
MOMO_REDIRECT_URL=http://localhost:8000/app
MOMO_IPN_URL=http://localhost:8000/payments/momo/ipn
MOMO_REQUEST_TYPE=payWithMethod
```

`MOMO_IPN_URL` cần public URL nếu muốn MoMo gọi được từ internet.

## Serve frontend từ backend

Nếu `BE_vpn/app/static/index.html` tồn tại, backend mount:

- `/assets/*` cho static assets;
- `/` cho SPA root;
- `/{full_path:path}` fallback về `index.html`.

Build frontend:

```powershell
cd ..\FE_vpn
npm run build
```

Sau đó backend serve app tại `http://localhost:8000`.

## Test và kiểm tra

```powershell
cd BE_vpn
.\.venv\Scripts\python.exe -m compileall app
.\.venv\Scripts\python.exe -m pytest tests/test_payments.py
.\.venv\Scripts\python.exe -m pytest tests/test_machine_billing.py
.\.venv\Scripts\python.exe -m pytest
```

## Docker

Build riêng backend:

```powershell
cd BE_vpn
docker build -t vpn-gaming-backend .
```

Chạy toàn hệ thống từ root:

```powershell
docker compose up -d --build
```

## Seed mặc định

Nếu database trống và `SEED_DEFAULT_DATA=true`, backend tạo:

- service plans: `basic`, `pro`, `premium`;
- admin theo `SEED_ADMIN_EMAIL` và `SEED_ADMIN_PASSWORD`;
- sample machines tại Vietnam, Singapore, Japan.

Không dùng password seed mặc định trong production.
