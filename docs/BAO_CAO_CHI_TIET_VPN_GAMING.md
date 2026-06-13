# BÁO CÁO CHI TIẾT DỰ ÁN VPN GAMING

Ngày lập báo cáo: 13/06/2026  
Dự án: VPN Gaming - nền tảng cloud gaming qua VPN riêng  
Mã nguồn: `d:\vpn-gaming`  
URL triển khai: https://vpn-gaming.onrender.com

## 1. Tóm tắt dự án

VPN Gaming là một hệ thống web hỗ trợ người dùng thuê và sử dụng máy chơi game cloud. Người dùng đăng ký tài khoản, chọn máy cloud theo khu vực/GPU/ping, khởi tạo phiên chơi, tải file VPN `.ovpn`, kết nối bằng OpenVPN Connect, sau đó dùng Moonlight để stream game từ máy cloud về thiết bị cá nhân.

Dự án gồm ba phần chính:

1. Frontend React/Vite: giao diện người dùng, dashboard, wizard khởi tạo phiên, thanh toán, lịch sử, hỗ trợ và admin portal.
2. Backend FastAPI: API xác thực, quản lý máy, phiên chơi, billing, ví, thanh toán MoMo, subscription, support ticket và admin.
3. Database PostgreSQL: lưu người dùng, máy cloud, phiên VPN, gói dịch vụ, giao dịch, billing event, support ticket và cấu hình admin.

Hệ thống đã được build và deploy trên Render theo mô hình một web service Docker và một PostgreSQL database free.

## 2. Lý do chọn đề tài

Nhu cầu chơi game cấu hình cao ngày càng lớn, nhưng không phải người dùng nào cũng có máy tính đủ mạnh. Cloud gaming giải quyết vấn đề này bằng cách chạy game trên máy chủ mạnh và truyền hình ảnh về thiết bị người dùng. Tuy nhiên, để sử dụng ổn định cần có các phần quan trọng:

- Máy cloud/GPU đủ mạnh.
- Đường truyền riêng hoặc mạng nội bộ ảo để truy cập máy cloud an toàn.
- Công cụ streaming độ trễ thấp như Moonlight.
- Hệ thống quản lý phiên, tính tiền, lịch sử và hỗ trợ người dùng.
- Cổng quản trị để admin theo dõi người dùng, máy, phiên, giao dịch và lỗi.

Vì vậy dự án VPN Gaming được xây dựng như một nền tảng hoàn chỉnh, vừa có trải nghiệm người dùng, vừa có backend, database và admin portal để quản lý vận hành.

## 3. Mục tiêu dự án

Mục tiêu tổng quát:

Xây dựng một nền tảng web cho phép người dùng đăng nhập, chọn máy cloud, tạo phiên chơi, kết nối VPN riêng, stream bằng Moonlight và quản lý chi phí sử dụng theo thời gian.

Mục tiêu chi tiết:

- Người dùng có thể đăng ký, đăng nhập bằng email/mật khẩu hoặc Google OAuth.
- Người dùng có ví tài khoản, nạp tiền bằng MoMo và xem lịch sử nạp.
- Người dùng xem danh sách máy cloud theo GPU, khu vực, ping, trạng thái và giá/phút.
- Người dùng khởi tạo phiên chơi qua wizard từng bước.
- Người dùng tải file `.ovpn` của phiên, import vào OpenVPN Connect và xác nhận VPN online.
- Người dùng sử dụng Moonlight để thêm máy bằng IP local, nhập PIN trong Sunshine Web và bắt đầu stream.
- Hệ thống tự động ghi nhận phiên, trạng thái VPN, trạng thái Moonlight/Sunshine, chi phí, thời gian chơi.
- Admin quản lý toàn bộ người dùng, máy, phiên, giao dịch, doanh thu, support ticket và cài đặt hệ thống.
- Dữ liệu phát sinh từ web người dùng tự động đồng bộ sang admin portal.
- Hệ thống có thể deploy lên Render free để chạy online.

## 4. Phạm vi chức năng

Phạm vi đã triển khai:

- Landing page giới thiệu dịch vụ.
- Auth: đăng ký, đăng nhập, đăng xuất, quên mật khẩu, đặt lại mật khẩu, đổi mật khẩu, cập nhật hồ sơ.
- Google OAuth tùy chọn.
- Dashboard người dùng.
- Danh sách máy cloud.
- Wizard khởi tạo phiên chơi.
- Hướng dẫn OpenVPN Connect và Moonlight.
- Quản lý gói dịch vụ/subscription.
- Nạp tiền MoMo và ví người dùng.
- Lịch sử phiên chơi, giao dịch và thống kê.
- Support ticket người dùng.
- Admin portal đầy đủ.
- Backend API và database.
- Build frontend vào backend static để deploy một service.
- Deploy Render Docker + PostgreSQL.

Phạm vi cần cấu hình ngoài khi chạy thật:

- Google OAuth cần `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.
- MoMo cần `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY`.
- SMTP thật nếu muốn gửi email xác minh/quên mật khẩu qua email thay vì fallback console.
- Hạ tầng cloud VM/OpenVPN/Sunshine thật nếu vận hành production quy mô lớn.

## 5. Công nghệ sử dụng

Frontend:

| Thành phần | Công nghệ |
| --- | --- |
| Framework | React 19 |
| Build tool | Vite 7 |
| Routing | React Router 7 |
| Biểu đồ | Recharts |
| Icon | lucide-react |
| Styling | CSS tùy chỉnh |

Backend:

| Thành phần | Công nghệ |
| --- | --- |
| Framework API | FastAPI |
| ASGI server | Uvicorn |
| ORM | SQLAlchemy |
| Database | PostgreSQL |
| Auth | JWT, passlib/bcrypt |
| OAuth/Payment HTTP client | httpx |
| Config | Pydantic Settings, dotenv |
| Test | pytest |

Triển khai:

| Thành phần | Công nghệ |
| --- | --- |
| Container | Docker |
| Hosting | Render Web Service Free |
| Database cloud | Render PostgreSQL Free |
| Build FE | Vite build output vào `BE_vpn/app/static` |

## 6. Kiến trúc tổng thể

Kiến trúc dự án được chia thành frontend, backend và database.

Luồng tổng quát:

```text
User Browser
    |
    | React/Vite SPA
    v
FastAPI Backend
    |
    | Service layer
    v
Repository layer
    |
    | SQLAlchemy
    v
PostgreSQL Database
```

Luồng deploy Render:

```text
GitHub repository
    |
    | Render Blueprint / Docker
    v
Dockerfile.render
    |
    | Build frontend + backend image
    v
Render Web Service
    |
    | DATABASE_URL
    v
Render PostgreSQL
```

Frontend khi build production được đặt trong:

```text
BE_vpn/app/static
```

Backend FastAPI serve luôn static SPA, vì vậy chỉ cần một Render Web Service để chạy cả frontend và backend.

## 7. Cấu trúc thư mục chính

```text
vpn-gaming/
|-- BE_vpn/
|   |-- app/
|   |   |-- api/             # Router API
|   |   |-- services/        # Business logic
|   |   |-- repositories/    # Data access
|   |   |-- static/          # Frontend build output
|   |   |-- main.py          # FastAPI app
|   |   |-- models.py        # SQLAlchemy models
|   |   |-- schemas.py       # Pydantic schemas
|   |   |-- database.py      # DB engine/session/init
|   |   |-- security.py      # JWT/password helpers
|   |   `-- config.py        # Env settings
|   |-- tests/               # Backend tests
|   `-- requirements.txt
|-- FE_vpn/
|   |-- src/
|   |   |-- api/             # API wrappers
|   |   |-- pages/           # Pages
|   |   |-- utils/           # Helpers
|   |   |-- App.jsx
|   |   `-- App.css
|   |-- public/              # Images/assets
|   `-- package.json
|-- docs/
|-- database/
|-- render.yaml
|-- Dockerfile.render
`-- docker-compose.yml
```

## 8. Phân quyền người dùng

Hệ thống có hai nhóm tài khoản chính.

### 8.1. Người dùng thường

Người dùng thường có thể:

- Đăng ký/đăng nhập.
- Xem dashboard.
- Nạp tiền.
- Chọn máy cloud.
- Tạo phiên chơi.
- Tải VPN profile.
- Kết nối VPN.
- Pair Moonlight/Sunshine.
- Xem lịch sử phiên và giao dịch.
- Mua gói dịch vụ.
- Gửi ticket hỗ trợ.
- Cập nhật hồ sơ cá nhân và đổi mật khẩu.

### 8.2. Admin

Admin có thể:

- Xem dashboard tổng quan hệ thống.
- Quản lý người dùng.
- Cộng tiền thủ công cho người dùng.
- Quản lý danh sách máy cloud.
- Theo dõi và can thiệp phiên chơi.
- Xem giao dịch nạp tiền.
- Xuất CSV giao dịch.
- Xem thống kê doanh thu.
- Xử lý support ticket.
- Cập nhật cài đặt bảo mật và vận hành.

## 9. Chức năng frontend chi tiết

### 9.1. Landing page

Landing page là màn hình đầu tiên khi truy cập website. Mục tiêu là giới thiệu dịch vụ VPN Gaming và dẫn người dùng vào luồng đăng nhập/đăng ký.

Nội dung chính:

- Giới thiệu cloud gaming GPU.
- Mô tả lợi ích ping thấp, VPN riêng, stream bằng Moonlight.
- Hiển thị các bước cơ bản: chuẩn bị VPN, Moonlight, kiểm tra hệ thống.
- Có các vùng support nhanh như OpenVPN, Moonlight, điều khoản, chính sách.

### 9.2. Xác thực người dùng

Các màn hình auth gồm:

- `/login`: đăng nhập.
- `/register`: đăng ký.
- `/forgot`: quên mật khẩu.
- `/reset`: đặt lại mật khẩu.
- `/admin-portal/login`: đăng nhập admin.

Chức năng:

- Đăng ký bằng email, mật khẩu, tên hiển thị.
- Đăng nhập bằng email/mật khẩu.
- Đăng nhập bằng Google OAuth nếu đã cấu hình.
- Hiển thị thông báo nếu Google OAuth chưa được cấu hình.
- Lưu token vào localStorage.
- Tự động chuyển hướng sau đăng nhập.
- Đăng xuất và xóa phiên local.
- Đổi mật khẩu.
- Với tài khoản Google, có thể đặt mật khẩu mới để đăng nhập bằng email/mật khẩu.

Điểm bảo mật:

- Mật khẩu yêu cầu tối thiểu theo cấu hình admin.
- Có rate-limit/lockout khi đăng nhập sai nhiều lần.
- Token JWT dùng cho các API cần đăng nhập.
- Admin có route riêng và kiểm tra `role=admin`.

### 9.3. Dashboard người dùng

Route: `/app`

Dashboard là trung tâm sau khi người dùng đăng nhập.

Chức năng chính:

- Hiển thị trạng thái máy cloud hiện tại.
- Hiển thị trạng thái VPN.
- Hiển thị trạng thái Moonlight.
- Hiển thị gói dịch vụ và số dư.
- Đề xuất máy có ping tốt.
- Nút tiếp tục phiên hiện tại.
- Nút chọn máy.
- Khối hướng dẫn chuẩn bị trước khi chơi.

Điểm mới đã bổ sung:

- Dashboard hiển thị rõ người dùng cần cài OpenVPN Connect và Moonlight trước khi chơi.
- Có link tải chính thức:
  - OpenVPN Connect: https://openvpn.net/client/
  - Moonlight: https://moonlight-stream.org/
- Có giải thích Sunshine chạy trên máy cloud, người dùng không cần tải Sunshine về máy cá nhân.

### 9.4. Danh sách máy cloud

Route: `/app/machines`

Chức năng:

- Hiển thị danh sách máy cloud.
- Mỗi máy có mã máy, khu vực, vị trí, GPU, ping, trạng thái.
- Lọc/sắp xếp máy theo thông tin phù hợp.
- Xem chi tiết máy.
- Bắt đầu luồng khởi tạo từ máy đã chọn.
- Hiển thị trạng thái phiên active nếu máy đang được dùng.

Thông tin máy gồm:

- Code máy.
- Region/location.
- GPU.
- Ping.
- Status: idle, running, suspended, maintenance, offline.
- Giá theo phút.
- Trial nếu có.

### 9.5. Wizard khởi tạo phiên

Route: `/app/wizard`

Đây là luồng nghiệp vụ quan trọng nhất của hệ thống.

Các bước chính:

1. Chọn máy cloud.
2. Khởi động VM.
3. Tải VPN profile `.ovpn`.
4. Import `.ovpn` vào OpenVPN Connect.
5. Bật OpenVPN và xác nhận VPN online.
6. Nhận IP local.
7. Mở Moonlight, thêm PC bằng IP local.
8. Khi Moonlight hiện PIN, mở Sunshine Web để nhập PIN.
9. Xác nhận đã ghép Sunshine/Moonlight.
10. Bắt đầu chơi game.

Các thành phần giao diện:

- Hero hiển thị máy đang chọn.
- Stepper trạng thái: Cloud rig, Boot VM, VPN route, Moonlight.
- Danh sách máy để đổi máy nhanh.
- Process log mô phỏng/quản lý tiến trình.
- Readiness panel kiểm tra VM, VPN, Sunshine, Moonlight.
- Card "Tiếp theo" hướng dẫn hành động tiếp theo.
- Nút tải VPN.
- Nút xác nhận đã kết nối VPN.
- Nút hướng dẫn pair Moonlight.
- Nút xác nhận đã ghép Sunshine.
- Nút dừng phiên hoặc lưu snapshot.

Điểm hướng dẫn người dùng:

- Trước khi khởi tạo có checklist: đã cài OpenVPN Connect và Moonlight.
- Khi chưa VPN online, hệ thống nhắc tải OpenVPN Connect và import file `.ovpn`.
- Khi VPN online, hệ thống nhắc mở Moonlight, thêm PC bằng IP local và nhập PIN trong Sunshine Web.
- Sunshine được giải thích là host đã chạy trên máy cloud, không phải phần mềm người dùng cần tải.

### 9.6. Subscription/gói dịch vụ

Route: `/app/subscriptions`

Chức năng:

- Hiển thị các gói dịch vụ.
- Hiển thị gói hiện tại.
- So sánh quyền lợi gói.
- Mua gói bằng số dư ví.
- Gói có thể ảnh hưởng tới giảm giá chơi, snapshot, queue priority, giới hạn phiên.

Backend quản lý:

- Service plan.
- Subscription.
- Thời gian bắt đầu/kết thúc.
- Trạng thái active/canceled.

### 9.7. Ví và nạp tiền MoMo

Chức năng nạp tiền nằm trong modal topup và trang kết quả.

Luồng nạp tiền:

1. Người dùng chọn số tiền.
2. Frontend gọi `POST /payments/momo`.
3. Backend tạo payment pending.
4. Backend gọi MoMo để lấy `pay_url`.
5. Người dùng chuyển sang trang thanh toán MoMo.
6. MoMo gọi IPN về backend.
7. Backend xác thực chữ ký MoMo.
8. Nếu thành công, cập nhật payment thành succeeded.
9. Cộng tiền vào ví.
10. Tạo topup transaction.
11. Người dùng xem kết quả tại `/app/topup/result`.

Nguyên tắc an toàn:

- Không cộng tiền khi mới tạo payment pending.
- Chỉ cộng tiền khi IPN MoMo hợp lệ và thành công.
- Giao dịch có trạng thái pending, succeeded, failed.
- Admin có thể xem và lọc giao dịch.

### 9.8. Lịch sử người dùng

Route: `/app/history`

Chức năng:

- Xem lịch sử phiên chơi.
- Xem trạng thái phiên: active, stopped, failed.
- Xem máy đã dùng, thời gian bắt đầu/kết thúc, chi phí, VPN, Sunshine, Moonlight.
- Xem lịch sử nạp tiền.
- Xem thống kê/summary.
- Xuất dữ liệu CSV/JSON ở phía giao diện.

### 9.9. Hỗ trợ và tài liệu

Route: `/app/support` và `/support`

Chức năng:

- Gửi ticket hỗ trợ.
- Xem ticket đã gửi.
- Xem trạng thái ticket.
- Xem phản hồi/ghi chú admin.
- Tài liệu hướng dẫn OpenVPN.
- Tài liệu hướng dẫn Moonlight.
- FAQ lỗi thường gặp.
- Chính sách dịch vụ, hoàn tiền, điều khoản.

Nội dung hướng dẫn OpenVPN:

- Tải OpenVPN Connect.
- Tải file `.ovpn` từ phiên hiện tại.
- Import vào OpenVPN.
- Bật kết nối.
- Quay lại web xác nhận đã kết nối VPN.

Nội dung hướng dẫn Moonlight:

- Cài Moonlight.
- Bật OpenVPN trước.
- Thêm máy bằng IP local.
- Nhập PIN vào Sunshine Web.
- Xử lý lỗi không thấy máy, lag, timeout VPN.

## 10. Chức năng admin chi tiết

Route admin: `/admin-portal`

Admin portal là nơi quản trị toàn hệ thống. Các dữ liệu phát sinh từ web người dùng đều được ghi vào database và tự động hiển thị trong admin.

### 10.1. Admin dashboard overview

Chức năng:

- Xem tổng quan người dùng.
- Xem tổng số máy.
- Xem phiên đang hoạt động.
- Xem doanh thu/giao dịch.
- Xem tình trạng hệ thống.
- Xem thống kê máy.

API chính:

- `GET /admin/dashboard`
- `GET /admin/revenue/statistics`
- `GET /admin/machines/statistics`

### 10.2. Quản lý người dùng

Chức năng:

- Xem danh sách user.
- Tìm kiếm theo email.
- Lọc theo role/status.
- Cập nhật thông tin user.
- Khóa/mở user nếu cần.
- Cộng tiền thủ công cho user.

API chính:

- `GET /admin/users`
- `PATCH /admin/users/{user_id}`
- `POST /admin/users/{user_id}/topup`

Ý nghĩa vận hành:

- Admin có thể xử lý trường hợp người dùng chuyển khoản thủ công.
- Admin có thể điều chỉnh tài khoản khi có sự cố.
- Admin kiểm soát trạng thái người dùng.

### 10.3. Quản lý máy cloud

Chức năng:

- Xem danh sách máy.
- Tạo máy mới.
- Sửa thông tin máy.
- Xóa máy.
- Cập nhật region, location, GPU, ping, status, giá/phút, trial.
- Xem thống kê máy.

API chính:

- `GET /admin/machines`
- `POST /admin/machines`
- `PATCH /admin/machines/{machine_id}`
- `DELETE /admin/machines/{machine_id}`
- `GET /admin/machines/statistics`

Ý nghĩa vận hành:

- Khi admin thêm/sửa máy, người dùng sẽ thấy máy đó ở trang danh sách máy.
- Khi người dùng chọn và khởi tạo máy, trạng thái máy/phiên sẽ tự động phản ánh lại ở admin.

### 10.4. Quản lý phiên chơi

Chức năng:

- Xem danh sách phiên.
- Lọc theo status, user, email, machine, machine code.
- Xem phiên active/stopped/failed.
- Dừng phiên từ admin.
- Đánh dấu phiên fail kèm lý do.
- Theo dõi billing, thời gian, IP local, VPN, Sunshine, Moonlight.

API chính:

- `GET /admin/sessions`
- `POST /admin/sessions/{session_id}/stop`
- `POST /admin/sessions/{session_id}/fail`

Ý nghĩa vận hành:

- Nếu user gặp lỗi không dừng được phiên, admin có thể dừng.
- Nếu máy có lỗi kỹ thuật, admin có thể đánh dấu fail.
- Lịch sử phiên giúp đối soát chi phí và hỗ trợ người dùng.

### 10.5. Quản lý billing/giao dịch

Chức năng:

- Xem danh sách giao dịch.
- Lọc theo user, email, trạng thái, provider, ngày.
- Xem chi tiết giao dịch.
- Xuất CSV.
- Xem thống kê doanh thu.

API chính:

- `GET /admin/transactions`
- `GET /admin/transactions/{transaction_id}`
- `GET /admin/transactions/export`
- `GET /admin/revenue/statistics`

Provider giao dịch:

- `momo`: nạp qua MoMo.
- `admin`: admin cộng tiền.
- `admin_debit`: admin trừ/điều chỉnh.
- `bank`: có thể mở rộng sau.

### 10.6. Quản lý support ticket

Chức năng:

- Xem ticket người dùng gửi.
- Lọc ticket theo status, category, user, email, từ khóa.
- Cập nhật trạng thái ticket.
- Thêm ghi chú admin.
- Đánh dấu resolved/closed.

API chính:

- `GET /admin/support/tickets`
- `PATCH /admin/support/tickets/{ticket_id}`

Luồng tự động:

- User gửi ticket ở `/app/support`.
- Backend lưu vào `support_tickets`.
- Admin thấy ticket mới trong admin portal.
- Admin cập nhật trạng thái/ghi chú.
- User thấy lại trạng thái và ghi chú trong trang support của mình.

### 10.7. Cài đặt hệ thống

Chức năng:

- Cấu hình độ dài mật khẩu.
- Bật/tắt yêu cầu chữ hoa, chữ thường, chữ số.
- Cấu hình số lần đăng nhập sai trước khi khóa.
- Cấu hình thời gian khóa.
- Cấu hình số tiền nạp tối thiểu.
- Cấu hình timeout phiên.
- Cấu hình số snapshot được giữ.

API chính:

- `GET /admin/settings`
- `PUT /admin/settings`

Ý nghĩa:

Admin có thể điều chỉnh chính sách vận hành mà không cần sửa code.

## 11. Dữ liệu tự động từ web sang admin

Một yêu cầu quan trọng của dự án là dữ liệu người dùng thao tác ở web phải được tự động ghi nhận và hiển thị cho admin. Hệ thống đã xử lý theo hướng này.

Các luồng tự động:

| Hành động ở web người dùng | Dữ liệu ghi vào database | Admin xem ở đâu |
| --- | --- | --- |
| Đăng ký tài khoản | `users`, `credentials` hoặc `identities` | Admin Users |
| Đăng nhập Google | `users`, `identities` | Admin Users |
| Nạp tiền MoMo | `payments`, `topup_transactions`, `users.balance` | Admin Billing |
| Chọn/khởi tạo máy | `vpn_sessions`, `machines.status` | Admin Sessions, Admin Machines |
| Tải VPN/xác nhận VPN | `vpn_sessions.ip_address`, trạng thái session | Admin Sessions |
| Pair Sunshine/Moonlight | `machine_logs`, computed `sunshine_paired`, `moonlight_ready` | Admin Sessions |
| Dừng phiên | `vpn_sessions.ended_at`, `charged_amount`, `stop_reason` | Admin Sessions, Billing |
| Billing theo phút | `session_billing_events`, `vpn_sessions.charged_amount` | Admin Sessions, Revenue |
| Gửi hỗ trợ | `support_tickets` | Admin Support |
| Mua gói | `subscriptions`, có thể liên kết payment/balance | Admin/User overview |

Điểm mạnh:

- Admin không cần nhập lại dữ liệu từ người dùng.
- Mọi hoạt động quan trọng đều có bảng lưu trữ.
- Dữ liệu user và admin dùng chung API/backend nên tránh lệch trạng thái.
- Các API admin có filter để tìm kiếm và đối soát.

## 12. Backend API chi tiết

### 12.1. Auth API

```text
GET    /auth/config
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

Nhiệm vụ:

- Xác thực người dùng.
- Cấp JWT.
- Lấy thông tin tài khoản hiện tại.
- Đổi/cập nhật mật khẩu.
- Google OAuth.
- Email verification nếu có SMTP.

### 12.2. Machines/Sessions API

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

Nhiệm vụ:

- Cung cấp danh sách máy.
- Tạo phiên chơi.
- Resume từ snapshot.
- Dừng phiên.
- Tải VPN profile.
- Kiểm tra VPN.
- Ghi nhận Sunshine/Moonlight pairing.
- Lưu heartbeat để biết phiên còn hoạt động.

### 12.3. Payments API

```text
POST   /payments/momo
POST   /payments/momo/ipn
GET    /payments/balance
GET    /payments/topup-history
GET    /payments/topup-summary
```

Nhiệm vụ:

- Tạo giao dịch MoMo.
- Nhận IPN từ MoMo.
- Cập nhật ví.
- Trả lịch sử nạp tiền cho người dùng.

### 12.4. Subscriptions API

```text
GET    /subscriptions/plans
GET    /subscriptions/me
POST   /subscriptions/purchase
```

Nhiệm vụ:

- Lấy danh sách gói.
- Lấy gói hiện tại.
- Mua gói bằng số dư.

### 12.5. Support API

```text
POST   /support/tickets
GET    /support/tickets/me
```

Nhiệm vụ:

- Người dùng gửi hỗ trợ.
- Người dùng xem ticket của mình.

### 12.6. Admin API

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

Nhiệm vụ:

- Quản trị toàn bộ hệ thống.
- Theo dõi dữ liệu phát sinh.
- Can thiệp khi có sự cố.
- Đối soát giao dịch và doanh thu.

## 13. Thiết kế database

Các bảng chính:

| Bảng | Mục đích |
| --- | --- |
| `users` | Lưu tài khoản, email, role, status, balance |
| `credentials` | Lưu password hash |
| `identities` | Lưu tài khoản OAuth như Google |
| `email_verifications` | Token xác minh email |
| `password_resets` | Token đặt lại mật khẩu |
| `machines` | Danh sách máy cloud |
| `vpn_sessions` | Phiên chơi/VPN của người dùng |
| `machine_logs` | Log trạng thái máy/phiên, gồm Sunshine pairing |
| `session_billing_events` | Sự kiện tính phí theo phiên/ngày |
| `service_plans` | Gói dịch vụ |
| `subscriptions` | Gói người dùng đã mua |
| `payments` | Payment pending/succeeded/failed |
| `topup_transactions` | Lịch sử nạp tiền và biến động ví |
| `admin_settings` | Cấu hình bảo mật/vận hành |
| `support_tickets` | Yêu cầu hỗ trợ |
| `revoked_tokens` | Token JWT đã logout/thu hồi |

Quan hệ chính:

- Một user có một credential.
- Một user có nhiều identity OAuth.
- Một user có nhiều subscription.
- Một user có nhiều payment/topup transaction.
- Một user có nhiều VPN session.
- Một machine có nhiều VPN session.
- Một VPN session có nhiều machine log và billing event.
- Một user có nhiều support ticket.

Các index quan trọng:

- `users.email` unique.
- `machines.region/status`.
- `vpn_sessions.user_id`, `vpn_sessions.machine_id`, `vpn_sessions.status`.
- `payments.user_id/status`.
- `topup_transactions.user_id/status/created_at`.
- `support_tickets.user_id/status`, `support_tickets.status/created_at`.

## 14. Luồng nghiệp vụ trọng tâm

### 14.1. Luồng đăng ký và đăng nhập

```text
User nhập email/mật khẩu
    |
Frontend gọi /auth/register hoặc /auth/login
    |
Backend validate dữ liệu
    |
Hash/check mật khẩu
    |
Cấp JWT
    |
Frontend lưu token
    |
Chuyển vào /app
```

Nếu dùng Google:

```text
User bấm Tiếp tục với Google
    |
/auth/google/login
    |
Google OAuth consent
    |
/auth/google/callback
    |
Backend tạo/cập nhật user identity
    |
Cấp JWT và redirect vào app
```

### 14.2. Luồng khởi tạo phiên chơi

```text
User chọn máy
    |
POST /machines/{machine_id}/start
    |
Backend tạo vpn_session
    |
Máy chuyển sang running
    |
User tải .ovpn
    |
Import vào OpenVPN Connect
    |
User xác nhận VPN
    |
Backend cấp/ghi nhận IP local
    |
User mở Moonlight, nhập IP local
    |
Moonlight hiện PIN
    |
User mở Sunshine Web và nhập PIN
    |
POST /machines/sessions/{session_id}/sunshine/pair
    |
Phiên sẵn sàng chơi
```

### 14.3. Luồng tính tiền phiên

```text
Session active
    |
Backend billing loop chạy mỗi 60 giây
    |
Kiểm tra trạng thái phiên, thời gian chơi, trial, balance, gói
    |
Tạo billing event
    |
Cập nhật charged_minutes, charged_amount
    |
Trừ số dư nếu cần
    |
Nếu hết tiền/quá hạn/idle thì dừng phiên
```

### 14.4. Luồng nạp tiền MoMo

```text
User nhập số tiền
    |
POST /payments/momo
    |
Backend tạo payment pending
    |
MoMo trả pay_url
    |
User thanh toán
    |
MoMo gọi /payments/momo/ipn
    |
Backend xác thực chữ ký
    |
Nếu thành công: payment succeeded + cộng balance + tạo topup transaction
    |
User xem kết quả tại /app/topup/result
```

### 14.5. Luồng support

```text
User gửi ticket
    |
POST /support/tickets
    |
Backend lưu support_tickets
    |
Admin thấy ticket ở /admin-portal/support
    |
Admin cập nhật trạng thái/ghi chú
    |
User xem lại trạng thái ticket
```

## 15. Bảo mật

Các cơ chế bảo mật đã có:

- JWT Bearer token cho API cần đăng nhập.
- Password hash bằng passlib/bcrypt.
- Revoked token khi logout.
- Role-based access control: user/admin.
- Admin route riêng và require admin.
- Lockout khi đăng nhập sai nhiều lần.
- Chính sách mật khẩu có thể cấu hình trong admin settings.
- CORS cấu hình theo domain deploy.
- Không hard-code secret trong source; dùng environment variables trên Render.
- Google OAuth client secret lưu bằng biến môi trường.
- MoMo secret key lưu bằng biến môi trường.
- Payment chỉ cộng tiền sau khi IPN hợp lệ.
- File `.ovpn` cấp theo phiên, tránh dùng lại profile cũ.

## 16. Triển khai Render

Dự án deploy bằng `render.yaml`.

Render tạo:

- Web Service `vpn-gaming`.
- PostgreSQL database `vpn-gaming-db`.
- Region: Singapore.
- Plan: Free.
- Health check: `/health`.

Các biến môi trường chính:

```text
DATABASE_URL
JWT_SECRET
APP_BASE_URL=https://vpn-gaming.onrender.com
CORS_ORIGINS=https://vpn-gaming.onrender.com
SEED_DEFAULT_DATA=true
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI=https://vpn-gaming.onrender.com/auth/google/callback
MOMO_ENDPOINT
MOMO_PARTNER_CODE
MOMO_ACCESS_KEY
MOMO_SECRET_KEY
MOMO_REDIRECT_URL=https://vpn-gaming.onrender.com/app/topup/result
MOMO_IPN_URL=https://vpn-gaming.onrender.com/payments/momo/ipn
```

Quy trình deploy:

1. Build frontend bằng Vite.
2. Output frontend nằm ở `BE_vpn/app/static`.
3. Docker build backend.
4. FastAPI serve API và serve SPA fallback.
5. Render kết nối PostgreSQL qua `DATABASE_URL`.
6. Khi push GitHub, Render tự deploy bản mới.

Trạng thái kiểm tra gần nhất:

- Public URL đã serve asset build mới.
- `GET https://vpn-gaming.onrender.com/health` trả `{"status":"ok"}`.

Lưu ý Render Free:

- Service có thể sleep khi không có request.
- Request đầu tiên sau khi sleep có thể chậm.
- PostgreSQL free có giới hạn dung lượng và thời gian duy trì theo chính sách Render.

## 17. Kiểm thử

Các kiểm thử đã chạy ngày 13/06/2026:

### 17.1. Frontend lint

Lệnh:

```powershell
cd FE_vpn
npm run lint
```

Kết quả:

```text
eslint . -> OK
```

### 17.2. Frontend build

Lệnh:

```powershell
cd FE_vpn
npm run build
```

Kết quả:

```text
vite build -> OK
Output:
BE_vpn/app/static/index.html
BE_vpn/app/static/assets/index-*.css
BE_vpn/app/static/assets/index-*.js
```

Ghi chú: Vite có cảnh báo chunk JS lớn hơn 500 kB. Đây là cảnh báo tối ưu hiệu năng, không phải lỗi build.

### 17.3. Backend tests

Lệnh:

```powershell
cd BE_vpn
.\.venv\Scripts\python.exe -m pytest
```

Kết quả:

```text
48 passed in 3.70s
```

Các nhóm test:

- `test_api.py`
- `test_auth.py`
- `test_machine_billing.py`
- `test_payments.py`
- `test_support.py`
- `test_user_service.py`

### 17.4. Health check production

Lệnh kiểm tra:

```text
GET https://vpn-gaming.onrender.com/health
```

Kết quả:

```json
{"status":"ok"}
```

## 18. Điểm mạnh của hệ thống

- Có đầy đủ frontend, backend, database và admin portal.
- Luồng người dùng rõ: đăng nhập, chọn máy, tạo phiên, VPN, Moonlight, chơi game.
- Có onboarding cho người mới: giải thích OpenVPN Connect, Moonlight và Sunshine.
- Admin quản lý được user, machine, session, billing, support, settings.
- Dữ liệu từ web tự động đồng bộ sang admin qua backend/database.
- Có billing theo phút, trial, ví, nạp tiền, gói dịch vụ.
- Có MoMo IPN để đảm bảo chỉ cộng tiền khi thanh toán thành công.
- Có test backend và lint/build frontend.
- Deploy được lên Render free.
- Cấu trúc code theo layer rõ ràng: API -> Service -> Repository -> Database.

## 19. Hạn chế hiện tại

- Render free có thể sleep, lần truy cập đầu tiên có thể chậm.
- MoMo cần cấu hình merchant/test keys đầy đủ để thanh toán chạy thực tế.
- Google OAuth cần cấu hình Google Cloud OAuth client.
- SMTP chưa bắt buộc; nếu không cấu hình thì email verification/password reset có thể fallback theo cấu hình.
- Hạ tầng VM/OpenVPN/Sunshine production cần tích hợp provider thật nếu muốn vận hành quy mô lớn.
- Frontend bundle còn lớn, về sau có thể code-splitting để tối ưu tải trang.
- Cần thêm monitoring/log dashboard chuyên sâu nếu vận hành nhiều người dùng thật.

## 20. Hướng phát triển

Các hướng nâng cấp đề xuất:

1. Tích hợp cloud provider thật để tự động tạo/tắt VM.
2. Tự động sinh và revoke OpenVPN profile theo phiên.
3. Tự động kiểm tra Sunshine service trên máy cloud.
4. Tích hợp queue khi hết máy.
5. Thêm notification realtime bằng WebSocket.
6. Thêm dashboard monitoring CPU/GPU/RAM/network.
7. Tối ưu frontend bundle bằng lazy loading.
8. Thêm email SMTP production.
9. Thêm thanh toán production MoMo hoặc VNPay.
10. Thêm hệ thống coupon/khuyến mãi.
11. Thêm báo cáo doanh thu theo ngày/tháng/năm.
12. Thêm audit log cho hành động admin.
13. Thêm phân quyền admin chi tiết hơn: support admin, billing admin, super admin.
14. Thêm app mobile hoặc PWA.

## 21. Kịch bản demo báo cáo

Khi trình bày, có thể demo theo thứ tự sau:

1. Mở trang chủ:
   - Giới thiệu VPN Gaming.
   - Nói mục tiêu: cloud gaming qua VPN riêng và Moonlight.

2. Đăng nhập/đăng ký:
   - Demo login.
   - Nói hệ thống hỗ trợ email/mật khẩu và Google OAuth.

3. Dashboard user:
   - Chỉ trạng thái máy cloud, VPN, Moonlight, số dư.
   - Chỉ phần hướng dẫn cài OpenVPN Connect và Moonlight.

4. Danh sách máy:
   - Chọn máy theo ping/GPU/khu vực.
   - Giải thích trạng thái máy.

5. Wizard:
   - Bấm khởi tạo phiên.
   - Tải `.ovpn`.
   - Giải thích import vào OpenVPN Connect.
   - Xác nhận VPN.
   - Giải thích dùng Moonlight nhập IP local.
   - Giải thích Sunshine chỉ dùng để nhập PIN trên máy cloud.

6. Thanh toán:
   - Mở modal nạp tiền.
   - Giải thích MoMo pending -> IPN -> cộng ví.

7. Lịch sử:
   - Xem phiên chơi.
   - Xem giao dịch.

8. Support:
   - Gửi ticket.
   - Chuyển qua admin để thấy ticket tự xuất hiện.

9. Admin portal:
   - Overview.
   - Users.
   - Machines.
   - Sessions.
   - Billing.
   - Support.
   - Settings.

10. Kết luận:
   - Hệ thống đã có FE, BE, DB, deploy online.
   - Dữ liệu user tự đồng bộ sang admin.
   - Có test và health check.

## 22. Kết luận

Dự án VPN Gaming đã xây dựng được một nền tảng cloud gaming tương đối hoàn chỉnh, bao gồm giao diện người dùng, backend API, cơ sở dữ liệu, thanh toán, quản trị và triển khai online. Điểm nổi bật của hệ thống là luồng khởi tạo phiên chơi rõ ràng: chọn máy cloud, tải OpenVPN profile, kết nối VPN, dùng Moonlight để stream và ghi nhận trạng thái vào hệ thống.

Admin portal giúp quản trị viên theo dõi toàn bộ dữ liệu phát sinh từ người dùng như tài khoản, máy, phiên, giao dịch, doanh thu và support ticket. Điều này giúp hệ thống không chỉ là một giao diện demo mà đã có cấu trúc vận hành thực tế.

Hệ thống đã được kiểm thử với backend test `48 passed`, frontend lint/build thành công và deploy trên Render với health check hoạt động. Trong tương lai, dự án có thể tiếp tục phát triển bằng cách tích hợp hạ tầng cloud VM thật, tối ưu performance, bổ sung realtime monitoring và triển khai thanh toán production.
