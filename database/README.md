# Database (PostgreSQL + pgAdmin4)

Thu muc `database/` duoc to chuc de van hanh CSDL PostgreSQL ro rang theo cac lop: schema, seed, migration, script, backup.

## Cau truc thu muc

```text
database/
|-- backups/
|   `-- auto_backup.sh
|-- migrations/
|   |-- versions/
|   |-- env.py
|   `-- script.py.mako
|-- schema/
|   |-- tables.sql
|   |-- indexes.sql
|   `-- constraints.sql
|-- seeds/
|   `-- seed.sql
|-- scripts/
|   |-- backup.sh
|   |-- restore.sh
|   `-- init.sh
|-- init.sql
|-- Dockerfile
|-- docker-compose.yml
`-- README.md
```

## PostgreSQL va pgAdmin4

- Database engine: PostgreSQL
- GUI quan ly: pgAdmin4
- Luu y: du lieu he thong luu tren PostgreSQL (khong luu local JSON)

Thong tin ket noi mac dinh:

- Host: localhost
- Port: 5432
- User: vpn_user
- Password: change-this-db-password
- Database: vpn_app

Connection string:

```text
postgresql://vpn_user:change-this-db-password@localhost:5432/vpn_app
```

## Khoi tao trong pgAdmin4

1. Mo pgAdmin4 va ket noi server PostgreSQL.
2. Tao database `vpn_app` neu chua co.
3. Chuot phai vao `vpn_app` -> Query Tool.
4. Mo file `database/init.sql` va Execute.
5. Mo file `database/seeds/seed.sql` va Execute neu can du lieu mau.
6. Refresh `Schemas -> public -> Tables` de kiem tra.

## Khoi tao bang command line

```bash
psql -U vpn_user -d vpn_app -f init.sql
psql -U vpn_user -d vpn_app -f seeds/seed.sql
```

## Nang cap database dang co

Neu database da duoc tao tu schema cu, chay migration canh chinh schema truoc khi seed/chay backend:

```bash
psql -U vpn_user -d vpn_app -f migrations/versions/20260518_align_application_schema.sql
```

Migration nay bo sung cac bang backend dang dung nhu `service_plans`, `subscriptions`, `payments`,
`vpn_sessions`, `topup_transactions`, `admin_settings`, them `users.balance`, index va constraint can thiet.

## Khoi tao DB bang Docker (chi database)

Tu thu muc `database/`:

```bash
docker compose up -d
```

Dockerfile se copy `init.sql`, `schema/`, `seeds/seed.sql` vao image de khoi tao o lan chay dau tien.

## Scripts van hanh

### Init schema + seed

```bash
./scripts/init.sh
```

### Backup

```bash
./scripts/backup.sh
```

### Restore

```bash
./scripts/restore.sh backups/backup_YYYYMMDD_HHMMSS.sql.gz
```

### Auto backup (Linux)

```bash
./backups/auto_backup.sh
```

Script auto backup co xoa file qua han theo `BACKUP_RETENTION_DAYS` (mac dinh: 14 ngay).

## Migrations scaffold

- `migrations/env.py`
- `migrations/script.py.mako`
- `migrations/versions/`
- `migrations/versions/20260518_align_application_schema.sql`

Bo khung nay san sang de tich hop Alembic.

## Tuong thich nguoc

- `database.sh` va `database.ps1` duoc giu lai de tuong thich voi luong cu.
- Luong khuyen nghi moi: dung scripts trong `scripts/`.
