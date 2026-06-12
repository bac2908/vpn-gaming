# API Contract By Screen

## Rule
- Moi screen ben duoi co contract locked truoc khi lam BE.
- Format gom: endpoint, params/body, response shape, error codes.

## Auth screens

### Login
- UI: /login
- Endpoints:
  - GET /auth/config
  - POST /auth/login
- GET /auth/config 200 response:
  - google_oauth_enabled: boolean
  - email_verification_required: boolean
  - password_reset_enabled: boolean
  - registration_auto_active: boolean
- Body:
  - email: string
  - password: string
- 200 response:
  - access_token: string
  - token_type: "bearer"
  - user: { id, email, display_name, role, balance }
- Errors:
  - 401 invalid credentials
  - 403 email not verified

### Register
- UI: /register
- Endpoints:
  - GET /auth/config
  - POST /auth/register
- Body:
  - email
  - password
  - display_name
- 201 response:
  - access_token, token_type, user
- Behavior:
  - SMTP configured: account is pending until email verification.
  - SMTP missing: account is active immediately for free/demo deploy.
- Errors:
  - 409 email existed
  - 400 validation

### Forgot password
- UI: /forgot
- Endpoint: POST /auth/forgot
- Body: { email }
- 200 response: { message }

### Reset password
- UI: /reset
- Endpoint: POST /auth/reset-password
- Body: { token, new_password }
- 200 response: { message }
- Errors:
  - 400 token invalid/expired

### Logout
- Endpoint: POST /auth/logout (Bearer)
- 200 response: { message }

## User app screens

### Dashboard
- UI: /app
- Endpoint used:
  - GET /payments/balance
  - GET /machines?page=&page_size=

### Machines list
- UI: /app/machines
- Endpoint: GET /machines
- Query:
  - page, page_size
  - region, gpu
  - status
  - min_ping, max_ping
  - sort: best|ping
- Response:
  - items: MachineOut[]
  - total, page, page_size

### Machine detail
- Endpoint: GET /machines/{machine_id}
- Response:
  - machine
  - active_session
  - last_session

### Start session
- Endpoint: POST /machines/{machine_id}/start
- Response: SessionOut
- Errors:
  - 409 machine busy
  - 404 machine not found

### Resume session
- Endpoint: POST /machines/{machine_id}/resume
- Response: SessionOut
- Errors:
  - 404 no snapshot

### Session history (user)
- UI: /app/history (sessions tab)
- Endpoint: GET /machines/sessions/history
- Query:
  - page, page_size
  - status (active|stopped|...)
  - machine_id
  - date_from, date_to (datetime)
  - sort: recent|oldest
- Response:
  - items: SessionHistoryItemOut[]
  - total, page, page_size

### Topup create
- UI: topup modal
- Endpoint: POST /payments/momo
- Body: { amount, description }
- Response: { order_id, request_id, pay_url, amount }

### Topup history
- UI: /app/history (topup tab)
- Endpoint: GET /payments/topup-history
- Query: page, page_size, status
- Response:
  - items: TopupTransactionOut[]
  - total, page, page_size
- Status enum (locked):
  - pending
  - succeeded
  - failed

## Admin screens

### Admin dashboard overview
- UI: /admin (Overview)
- Endpoint:
  - GET /admin/dashboard
  - GET /admin/revenue/statistics
  - GET /admin/machines/statistics

### Admin users
- UI: /admin (Users)
- Endpoint:
  - GET /admin/users?page=&page_size=&email=&role=&status=
  - PATCH /admin/users/{user_id}
  - POST /admin/users/{user_id}/topup
- Topup body:
  - amount: int (>0)
  - description: string | null

### Admin machines
- UI: /admin (Machines)
- Endpoint:
  - GET /admin/machines
  - POST /admin/machines
  - PATCH /admin/machines/{machine_id}
  - DELETE /admin/machines/{machine_id}

### Admin sessions
- UI: /admin (Sessions)
- Endpoint:
  - GET /admin/sessions
  - POST /admin/sessions/{session_id}/stop
- Query support:
  - page, page_size
  - status
  - user_id, user_email
  - machine_id, machine_code

### Admin billing
- UI: /admin (Billing)
- Endpoint:
  - GET /admin/transactions
  - GET /admin/transactions/{transaction_id}
  - GET /admin/transactions/export
  - GET /admin/revenue/statistics
- Query support:
  - page, page_size
  - user_id
  - user_email
  - search/q (email, description, trans_id)
  - status
  - provider (momo|bank|admin|admin_debit|admin_adjustment)
  - date_from, date_to (datetime)

### Admin settings
- UI: /admin (Settings)
- Endpoints:
  - GET /admin/settings
  - PUT /admin/settings
- Response body:
  - password_min_length: int
  - password_require_upper: bool
  - password_require_lower: bool
  - password_require_digit: bool
  - lockout_max_attempts: int
  - lockout_minutes: int
  - min_topup_amount: int
  - session_timeout_hours: int
  - snapshot_retention_count: int

### Support tickets
- UI: /app/support, /admin (Support)
- Endpoints:
  - POST /support/tickets
  - GET /support/tickets/me
  - GET /admin/support/tickets
  - PATCH /admin/support/tickets/{ticket_id}
- Admin query support:
  - page, page_size
  - status
  - type
  - user_id
  - user_email
  - search/q (email, title, detail, admin_note)
- Status:
  - open
  - in_progress
  - resolved
  - closed

## Contract mismatches detected
1. FE history status uses completed, backend uses succeeded. (resolved)
2. FE history pagination reads pages field, backend returns total/page/page_size. (resolved)
3. FE admin billing filter sends user_email, backend supports user_id. (resolved; backend now supports both)
4. Optional enhancement: support user_email filter directly in BE for admin UX convenience. (resolved)

## Contract lock decision
- Use backend schema as source of truth.
- FE must map to:
  - status: pending|succeeded|failed
  - total/page/page_size pagination formula.
  - billing filter by user_id and/or user_email.
