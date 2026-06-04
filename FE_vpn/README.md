# FE_vpn - Frontend React/Vite

Frontend của VPN Gaming là SPA React/Vite cho người dùng và admin portal. UI phục vụ cloud gaming flow: chọn máy, khởi tạo phiên, tải VPN profile, xác nhận VPN/Sunshine/Moonlight, theo dõi lịch sử, nạp tiền và quản trị hệ thống.

## Stack

| Thành phần | Công nghệ |
| --- | --- |
| Framework | React 19 |
| Build tool | Vite qua `rolldown-vite` 7.2.5 |
| Routing | React Router DOM 7 |
| Icons | lucide-react |
| Charts | Recharts |
| HTTP | `fetch` wrapper trong `src/api/client.js` |
| Dev server | Vite port 5173 |
| Production container | Nginx |

## Cấu trúc

```text
FE_vpn/
|-- public/                 # Logo, GPU banners, VPN images
|-- src/
|   |-- api/
|   |   |-- client.js        # request(), ApiError, API_BASE_URL
|   |   |-- auth.js
|   |   |-- machines.js
|   |   |-- payments.js
|   |   |-- subscriptions.js
|   |   |-- admin.js
|   |   `-- oauth.js
|   |-- pages/
|   |   |-- Landing.jsx
|   |   |-- Dashboard.jsx
|   |   |-- Machines.jsx
|   |   |-- Wizard.jsx
|   |   |-- Subscriptions.jsx
|   |   |-- History.jsx
|   |   |-- Support.jsx
|   |   |-- Admin.jsx
|   |   |-- landing.css
|   |   |-- admin.css
|   |   `-- auth/
|   |       |-- Login.jsx
|   |       |-- Register.jsx
|   |       |-- ForgotPassword.jsx
|   |       |-- ResetPassword.jsx
|   |       |-- AdminLogin.jsx
|   |       `-- AuthSessionNotice.jsx
|   |-- utils/
|   |   `-- redirect.js
|   |-- App.jsx
|   |-- App.css
|   |-- index.css
|   `-- main.js
|-- Dockerfile
|-- nginx.conf
|-- vite.config.js
|-- package.json
|-- .env.example
`-- README.md
```

## Route trong app

### Public/auth

| Route | Component |
| --- | --- |
| `/` | `Landing` |
| `/login` | `Login` |
| `/register` | `Register` |
| `/forgot` | `ForgotPassword` |
| `/reset` | `ResetPassword` |
| `/admin/login` | redirect sang `/admin-portal/login` |
| `/admin-portal/login` | `AdminLogin` |

### User shell

Các route này yêu cầu user role `user`.

| Route | Component |
| --- | --- |
| `/app` | `Dashboard` |
| `/app/machines` | `Machines` |
| `/app/wizard` | `Wizard` |
| `/app/subscriptions` | `Subscriptions` |
| `/app/history` | `History` |
| `/app/support` | `Support` |

### Admin portal

Các route này yêu cầu user role `admin`.

| Route | Component |
| --- | --- |
| `/admin-portal/overview` | `Admin` |
| `/admin-portal/users` | `Admin` |
| `/admin-portal/machines` | `Admin` |
| `/admin-portal/sessions` | `Admin` |
| `/admin-portal/billing` | `Admin` |
| `/admin-portal/settings` | `Admin` |

## Chạy local

```powershell
cd FE_vpn
npm install
copy .env.example .env.development
npm run dev
```

Mở:

```text
http://localhost:5173
```

## Cấu hình API

`src/api/client.js` dùng:

```js
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
```

Nếu `VITE_API_BASE_URL` rỗng, request sẽ gọi cùng origin. Trong dev, `vite.config.js` proxy các path API về backend local `http://localhost:8000`:

```text
/auth
/machines
/payments
/subscriptions
/admin
/health
```

Khuyến nghị khi chạy backend bằng `uvicorn` ở port 8000:

```env
VITE_API_BASE_URL=
```

Nếu chạy backend container từ root `docker-compose.yml`, backend publish ra host port 8080:

```env
VITE_API_BASE_URL=http://localhost:8080
```

Production với Nginx cùng domain thường để trống:

```env
VITE_API_BASE_URL=
```

## Biến môi trường

```env
VITE_API_BASE_URL=
VITE_APP_NAME=VPN Gaming Platform
VITE_API_TIMEOUT=30000
VITE_DEBUG=false
VITE_MOCK_API=false
```

Lưu ý: `VITE_API_TIMEOUT` hiện là cấu hình dự phòng; API client hiện dùng `fetch` và chưa tự áp timeout.

## Scripts

| Command | Mô tả |
| --- | --- |
| `npm run dev` | Chạy Vite dev server |
| `npm start` | Alias của `npm run dev` |
| `npm run build` | Build production |
| `npm run preview` | Preview build |
| `npm run lint` | ESLint |

## Build output

Trong local, `vite.config.js` đặt:

```js
outDir: path.resolve(__dirname, '../BE_vpn/app/static')
```

Vì vậy:

```powershell
npm run build
```

sẽ cập nhật:

```text
BE_vpn/app/static/index.html
BE_vpn/app/static/assets/*
```

Backend FastAPI có thể serve SPA sau build.

Trong Docker build, `DOCKER_BUILD=true`, output là `FE_vpn/dist` để Nginx copy vào `/usr/share/nginx/html`.

## Docker/Nginx

Build riêng frontend:

```powershell
cd FE_vpn
docker build -t vpn-gaming-frontend .
```

`nginx.conf` hiện proxy:

```text
/auth
/machines
/payments
/admin
/docs
/openapi.json
/api/health
```

Frontend code có gọi `/subscriptions`. Nếu dùng frontend container riêng, cần thêm `location /subscriptions` proxy về backend hoặc dùng backend static serving thay cho frontend Nginx container.

## Các màn hình chính

- `Landing`: giới thiệu sản phẩm và CTA.
- `Dashboard`: Play Center, ví, phiên hiện tại, máy đề xuất.
- `Machines`: danh sách máy cloud, filter vùng/GPU/ping/status, start/resume.
- `Wizard`: flow khởi tạo, tải `.ovpn`, check VPN, pair Sunshine/Moonlight, stop/snapshot.
- `Subscriptions`: gói membership, pricing, purchase.
- `History`: tổng quan phiên 7 ngày, timeline, export, lịch sử nạp tiền đã cộng ví.
- `Support`: FAQ, hướng dẫn OpenVPN/Moonlight, trạng thái hệ thống.
- `Admin`: users, machines, sessions, billing, settings.

## Payment UI rule

Tab `Nạp tiền` trong `History` chỉ hiển thị các giao dịch đã thanh toán và đã cộng vào ví (`succeeded`). Các lần mở cổng MoMo nhưng chưa thanh toán không được coi là lịch sử nạp ví của user.

## Auth/session storage

Frontend lưu:

```text
localStorage.auth_token
localStorage.auth_email
localStorage.auth_user
localStorage.active_session
sessionStorage.post_login_redirect
```

Nếu API trả 401, `src/api/client.js` bắn event `vpngaming:auth-expired` để `App.jsx` clear auth và redirect login.

## Kiểm tra

```powershell
npm run lint
npm run build
```

Nếu màn hình vẫn dùng bundle cũ khi backend serve static, hard refresh trình duyệt bằng `Ctrl + F5`.
