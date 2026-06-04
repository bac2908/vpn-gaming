# database - PostgreSQL

Thư mục `database/` chứa schema SQL, seed, migration và script vận hành cho PostgreSQL của VPN Gaming. Backend vẫn có cơ chế `init_database()` bằng SQLAlchemy để tạo bảng khi chạy app, nhưng thư mục này là nguồn tham chiếu khi cần khởi tạo database bằng SQL, nâng cấp database cũ, backup hoặc restore.

## Vai trò trong dự án

- `init.sql`: script khởi tạo schema đầy đủ cho database mới.
- `schema/`: tách riêng phần tables, indexes, constraints để dễ đọc và đối chiếu.
- `seeds/seed.sql`: dữ liệu mẫu ban đầu.
- `migrations/versions/`: các migration SQL dùng khi nâng cấp database đã tồn tại.
- `scripts/`: script backup, restore, init cho môi trường shell/Linux.
- `backups/`: nơi lưu backup local.
- `docker-compose.yml`: chạy riêng PostgreSQL trong thư mục `database/`.
- `Dockerfile`: image PostgreSQL 15 kèm script init/seed.

## Kết nối mặc định

```text
host: localhost
port: 5432
user: vpn_user
password: change-this-db-password
database: vpn_app
```

Connection string thường dùng:

```text
postgresql://vpn_user:change-this-db-password@localhost:5432/vpn_app
postgresql+psycopg2://vpn_user:change-this-db-password@localhost:5432/vpn_app
```

## Chạy database bằng Docker

Từ root dự án:

```powershell
docker compose up -d database
```

Hoặc chạy riêng trong thư mục này:

```powershell
cd database
docker compose up -d
```

Image database dựa trên PostgreSQL 15 Alpine. Khi volume Postgres còn trống, Docker entrypoint sẽ chạy:

```text
/docker-entrypoint-initdb.d/01-init.sql
/docker-entrypoint-initdb.d/02-seed.sql
```

Lưu ý: các file init chỉ chạy trong lần tạo volume đầu tiên. Nếu volume đã có dữ liệu, thay đổi trong `init.sql` sẽ không tự áp vào database đang chạy. Khi đó dùng migration SQL hoặc backup rồi reset volume có chủ ý.

## Khởi tạo bằng psql

Khi đã có PostgreSQL local:

```powershell
cd database
psql -h localhost -p 5432 -U vpn_user -d vpn_app -v ON_ERROR_STOP=1 -f init.sql
psql -h localhost -p 5432 -U vpn_user -d vpn_app -v ON_ERROR_STOP=1 -f seeds/seed.sql
```

Nếu user `vpn_user` chưa có quyền tạo extension, hãy tạo sẵn extension bằng superuser:

```sql
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

## Migration cho database cũ

Các migration trong `migrations/versions/` là SQL script chạy thủ công. Khi nâng cấp database cũ, backup trước rồi chạy các file cần thiết theo thứ tự ngày/file name:

```powershell
cd database
psql -h localhost -p 5432 -U vpn_user -d vpn_app -v ON_ERROR_STOP=1 -f migrations/versions/20260518_align_application_schema.sql
psql -h localhost -p 5432 -U vpn_user -d vpn_app -v ON_ERROR_STOP=1 -f migrations/versions/20260528_add_session_billing.sql
psql -h localhost -p 5432 -U vpn_user -d vpn_app -v ON_ERROR_STOP=1 -f migrations/versions/20260528_add_session_state_machine.sql
psql -h localhost -p 5432 -U vpn_user -d vpn_app -v ON_ERROR_STOP=1 -f migrations/versions/20260529_marketplace_payg_memberships.sql
psql -h localhost -p 5432 -U vpn_user -d vpn_app -v ON_ERROR_STOP=1 -f migrations/versions/20260531_user_role_user_admin.sql
psql -h localhost -p 5432 -U vpn_user -d vpn_app -v ON_ERROR_STOP=1 -f migrations/versions/20260531_user_status_active_suspended.sql
psql -h localhost -p 5432 -U vpn_user -d vpn_app -v ON_ERROR_STOP=1 -f migrations/versions/20260531_admin_audit_logs.sql
```

Ý nghĩa chính:

| File | Nội dung |
| --- | --- |
| `20260518_align_application_schema.sql` | Căn schema cũ về các bảng backend đang dùng như users, machines, service plans, subscriptions, payments, sessions, topup transactions, admin settings. |
| `20260528_add_session_billing.sql` | Bổ sung billing theo phút, free/trial minutes, session billing events. |
| `20260528_add_session_state_machine.sql` | Bổ sung trạng thái lifecycle/billing/connection, idle timeout, snapshot, refund, cooldown. |
| `20260529_marketplace_payg_memberships.sql` | Thêm giá theo máy, trial eligibility và seed máy PAYG/membership. |
| `20260531_user_role_user_admin.sql` | Giới hạn role user còn `user` và `admin`. |
| `20260531_user_status_active_suspended.sql` | Giới hạn trạng thái user còn `active` và `suspended`. |
| `20260531_admin_audit_logs.sql` | Tạo bảng audit log cho thao tác admin nhạy cảm. |

## Bảng quan trọng

| Nhóm | Bảng |
| --- | --- |
| Auth | `users`, `credentials`, `identities`, `email_verifications`, `password_resets`, `revoked_tokens` |
| Máy và phiên | `machines`, `vpn_sessions`, `session_billing_events`, `machine_logs` |
| Gói dịch vụ | `service_plans`, `subscriptions` |
| Thanh toán/ví | `payments`, `topup_transactions` |
| Admin | `admin_settings`, `admin_audit_logs` nếu đã chạy migration audit |
| View | `active_users`, `machine_stats`, `revenue_daily` |

Quy ước ví hiện tại:

- `payments` lưu lần mở cổng thanh toán, có thể ở trạng thái `pending`, `succeeded`, `failed`, `cancelled`.
- `topup_transactions` là ledger ví. Với flow MoMo hiện tại, user chỉ thấy giao dịch đã thanh toán thành công và đã cộng ví.
- `revenue_daily` chỉ cộng các `topup_transactions.status = 'succeeded'`.
- Admin nạp/trừ tiền thủ công cũng ghi vào `topup_transactions` với provider `admin` hoặc `admin_debit`.

## Backup và restore

Các script dùng biến môi trường `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_NAME`, `DB_PASSWORD`. Nếu không set, script dùng giá trị mặc định ở trên.

Backup:

```bash
cd database
./scripts/backup.sh
```

File backup được ghi vào `database/backups/` với dạng `backup_YYYYMMDD_HHMMSS.sql` hoặc `.sql.gz` nếu máy có `gzip`.

Restore:

```bash
cd database
./scripts/restore.sh backups/backup_YYYYMMDD_HHMMSS.sql.gz
```

Để bỏ qua câu hỏi xác nhận trong môi trường tự động:

```bash
RESTORE_FORCE=true ./scripts/restore.sh backups/backup_YYYYMMDD_HHMMSS.sql.gz
```

Auto backup Linux:

```bash
cd database
./backups/auto_backup.sh
```

Script auto backup có biến `BACKUP_RETENTION_DAYS`, mặc định giữ 14 ngày.

## Quan hệ với backend

Backend đọc cấu hình database trong `BE_vpn/app/config.py` và tạo engine tại `BE_vpn/app/database.py`. Khi khởi động backend, `init_database()` sẽ:

- tạo extension `pgcrypto` nếu có quyền;
- gọi `Base.metadata.create_all()` theo SQLAlchemy models;
- bổ sung một số cột billing/session còn thiếu cho database cũ;
- tạo index cần thiết cho session billing.

Điểm cần nhớ: `create_all()` chỉ tạo bảng mới, không thay đổi đầy đủ constraint/schema của bảng đã tồn tại. Với database production hoặc database cũ, nên dùng migration SQL trong thư mục này và backup trước khi chạy.

## Ghi chú vận hành

- Không commit backup thật chứa dữ liệu khách hàng.
- Không dùng mật khẩu `change-this-db-password` cho production.
- Nếu chạy Docker Compose root, backend container kết nối database bằng host nội bộ `database`, không phải `localhost`.
- Nếu chạy backend từ source trên máy thật, `DB_HOST=localhost` là phù hợp khi database publish port `5432`.
- File `database.sh` và `database.ps1` được giữ lại cho luồng cũ; luồng hiện tại nên dùng `scripts/` và Docker Compose.
