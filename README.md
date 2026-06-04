# VPN Gaming

VPN Gaming là nền tảng web quản lý cloud gaming qua VPN riêng. Dự án gồm frontend React/Vite, backend FastAPI, PostgreSQL, flow khởi tạo máy chơi game, tải profile OpenVPN, xác nhận Sunshine/Moonlight, thanh toán MoMo, ví người dùng và cổng quản trị.

## Trạng thái kỹ thuật hiện tại

- Frontend: React 19, Vite 7, React Router 7, Recharts, lucide-react.
- Backend: FastAPI, SQLAlchemy, PostgreSQL, JWT, SMTP, Google OAuth tùy chọn, MoMo IPN.
- Database: PostgreSQL 15+, schema SQL trong `database/`, migrations SQL trong `database/migrations/versions/`.
- Docker: `docker-compose.yml` chạy PostgreSQL, backend FastAPI và frontend Nginx.
- Local build frontend: chạy `npm run build` trong `FE_vpn/` sẽ xuất thẳng vào `BE_vpn/app/static` để backend có thể serve SPA tại `http://localhost:8000`.

## Chức năng chính

- Đăng ký, đăng nhập, đăng xuất, đổi mật khẩu, đặt mật khẩu cho tài khoản OAuth, quên mật khẩu.
- Google OAuth đăng nhập tùy chọn.
- Dashboard người dùng với ví, trạng thái phiên và máy đề xuất.
- Danh sách máy cloud theo vùng, GPU, ping, trạng thái, giá/phút, trial.
- Wizard khởi tạo phiên: chọn máy, boot VM, tải `.ovpn`, kiểm tra VPN, xác nhận Sunshine/Moonlight.
- Billing PAYG theo phút, trial ngày, gói membership giảm giá, snapshot/resume.
- Lịch sử phiên chơi, thống kê 7 ngày, timeline hoạt động, export CSV/JSON.
- Ví người dùng và lịch sử nạp tiền: chỉ hiển thị các khoản đã thanh toán và đã cộng vào ví.
- MoMo payment: tạo payment pending, chỉ cộng ví khi IPN thành công.
- Admin portal: quản lý user, máy, phiên, giao dịch, doanh thu, settings.

## Cấu trúc thư mục

```text
vpn-gaming/
|-- BE_vpn/                  # Backend FastAPI
|   |-- app/
|   |   |-- api/             # Routers: auth, machines, payments, subscriptions, admin
|   |   |-- repositories/    # Data access
|   |   |-- services/        # Business logic
|   |   |-- static/          # Frontend build output for backend static serving
|   |   |-- main.py          # FastAPI app, CORS, billing loop, static SPA fallback
|   |   |-- models.py        # SQLAlchemy models
|   |   |-- schemas.py       # Pydantic schemas
|   |   |-- config.py        # Env settings
|   |   |-- database.py      # Engine/session/init
|   |   `-- security.py      # JWT/password/token helpers
|   |-- migrations/          # Legacy SQL migration snippets
|   |-- tests/               # Pytest tests
|   |-- Dockerfile
|   |-- requirements.txt
|   `-- README.md
|-- FE_vpn/                  # Frontend React/Vite
|   |-- public/              # Images/logo assets
|   |-- src/
|   |   |-- api/             # fetch API wrappers
|   |   |-- pages/           # Landing, Dashboard, Machines, Wizard, History, Admin...
|   |   |-- utils/
|   |   |-- App.jsx
|   |   |-- App.css
|   |   `-- main.js
|   |-- Dockerfile
|   |-- nginx.conf
|   |-- vite.config.js
|   |-- package.json
|   `-- README.md
|-- database/                # PostgreSQL schema, seed, migrations, backup scripts
|-- deploy/                  # Deployment scripts
|-- docs/                    # Planning/API/backlog docs
|-- tmp_ui_code/             # Prototype UI components, not production source
|-- docker-compose.yml
|-- DEPLOY_GUIDE.md
`-- README.md
```

## Yêu cầu môi trường

- Python 3.10, 3.11 hoặc 3.12. Python 3.13+ bị chặn trong `BE_vpn/app/main.py` vì FastAPI/Pydantic v1 của dự án chưa tương thích.
- Node.js 18+ hoặc 20+.
- PostgreSQL 15+.
- Docker và Docker Compose nếu chạy container.

## Chạy local từ source

### 1. Database

Cách nhanh nhất là chạy riêng service database bằng Docker Compose gốc:

```powershell
docker compose up -d database
```

Database mặc định:

```text
host: localhost
port: 5432
user: vpn_user
password: change-this-db-password
database: vpn_app
```

### 2. Backend

```powershell
cd BE_vpn
py -3.11 -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend chạy tại:

```text
http://localhost:8000
http://localhost:8000/docs
```

Lần khởi động đầu tiên backend sẽ gọi `init_database()` và seed dữ liệu mặc định nếu `SEED_DEFAULT_DATA=true`.

### 3. Frontend

Nếu backend chạy trực tiếp tại port `8000`, nên để frontend dùng proxy Vite:

```powershell
cd FE_vpn
npm install
copy .env.example .env.development
```

Trong `FE_vpn/.env.development`, đặt:

```env
VITE_API_BASE_URL=
```

Sau đó chạy:

```powershell
npm run dev
```

Frontend dev chạy tại:

```text
http://localhost:5173
```

Nếu backend đang chạy qua Docker với port host `8080`, có thể đặt:

```env
VITE_API_BASE_URL=http://localhost:8080
```

## Build frontend vào backend static

Ở chế độ local, `FE_vpn/vite.config.js` xuất build sang `BE_vpn/app/static`:

```powershell
cd FE_vpn
npm run build
```

Sau build, backend có thể serve toàn bộ SPA tại:

```text
http://localhost:8000
http://localhost:8000/app
http://localhost:8000/admin-portal
```

## Chạy bằng Docker Compose

```powershell
copy .env.example .env
docker compose up -d --build
```

Các service chính:

| Service | Container | Host port | Ghi chú |
| --- | --- | --- | --- |
| `database` | `vpn_database` | `5432` | PostgreSQL 15 |
| `backend` | `vpn_backend` | `8080 -> 8000` | FastAPI |
| `frontend` | `vpn_frontend` | `80` | Nginx + React build |

Lưu ý: `FE_vpn/nginx.conf` hiện proxy `/auth`, `/machines`, `/payments`, `/admin`, `/docs`, `/openapi.json`, `/api/health`. Frontend code có gọi `/subscriptions`; nếu dùng frontend Nginx container riêng, cần bổ sung proxy `/subscriptions` hoặc dùng backend static serving.

## Route frontend

| Route | Mô tả |
| --- | --- |
| `/` | Landing page |
| `/login`, `/register`, `/forgot`, `/reset` | Auth pages |
| `/app` | Dashboard người dùng |
| `/app/machines` | Danh sách máy |
| `/app/wizard` | Khởi tạo/tiếp tục phiên |
| `/app/subscriptions` | Gói membership |
| `/app/history` | Lịch sử phiên và nạp tiền |
| `/app/support` | Hỗ trợ, hướng dẫn |
| `/admin-portal/login` | Đăng nhập admin |
| `/admin-portal/overview` | Admin portal |
| `/admin-portal/users` | Quản lý người dùng |
| `/admin-portal/machines` | Quản lý máy |
| `/admin-portal/sessions` | Quản lý phiên |
| `/admin-portal/billing` | Giao dịch/doanh thu |
| `/admin-portal/settings` | Cài đặt admin |

## API backend chính

### Auth

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

### Machines and sessions

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

### Subscriptions

```text
GET    /subscriptions/plans
GET    /subscriptions/me
POST   /subscriptions/purchase
```

### Payments

```text
POST   /payments/momo
POST   /payments/momo/ipn
GET    /payments/balance
GET    /payments/topup-history
GET    /payments/topup-summary
```

Payment rule hiện tại:

- `POST /payments/momo` chỉ tạo payment pending và trả `pay_url`.
- `POST /payments/momo/ipn` xác thực chữ ký MoMo.
- Chỉ khi `resultCode == 0` thì backend mới cộng số dư và tạo `topup_transactions` trạng thái `succeeded`.
- Lịch sử nạp tiền của user mặc định chỉ trả các giao dịch `succeeded`.
- Admin vẫn có thể xem/đối soát giao dịch qua `/admin/transactions`.

### Admin

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
GET    /admin/settings
PUT    /admin/settings
```

## Tài khoản seed mặc định

Nếu `SEED_DEFAULT_DATA=true`, backend tự tạo admin nếu chưa có:

```text
email: admin@vpngaming.com
password: giá trị SEED_ADMIN_PASSWORD trong .env
```

Không dùng `change-this-admin-password` trong production.

## Lệnh kiểm tra

Backend:

```powershell
cd BE_vpn
.\.venv\Scripts\python.exe -m compileall app
.\.venv\Scripts\python.exe -m pytest tests/test_payments.py
.\.venv\Scripts\python.exe -m pytest tests/test_machine_billing.py
```

Frontend:

```powershell
cd FE_vpn
npm run lint
npm run build
```

## Tài liệu liên quan

- `BE_vpn/README.md`: chi tiết backend.
- `FE_vpn/README.md`: chi tiết frontend.
- `database/README.md`: schema, seed, migrations, backup.
- `DEPLOY_GUIDE.md`: hướng dẫn triển khai VPS/Docker.
- `docs/API_CONTRACT_BY_SCREEN.md`: mapping API theo màn hình.
- `docs/BE_IMPLEMENTATION_BACKLOG.md`: backlog backend.

## Ghi chú vận hành

- Các file trong `BE_vpn/app/static/assets/` là output build frontend, hash tên file sẽ đổi sau mỗi lần build.
- Billing loop backend chạy mỗi 60 giây để tính phí các phiên active.
- MoMo IPN cần URL public truy cập được từ MoMo; localhost chỉ dùng được khi có tunnel hoặc môi trường test phù hợp.
- Database production cần backup volume PostgreSQL thường xuyên.
