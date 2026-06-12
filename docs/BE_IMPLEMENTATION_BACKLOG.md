# BE Implementation Backlog (after UI + contract lock)

## Scope
Backlog nay chi bat dau sau khi UX/UI va API contract da lock.

## Completed in this iteration
- Admin settings persistence/API:
  - Added model AdminSettings.
  - Added schemas AdminSettingsOut/AdminSettingsUpdate.
  - Added routes GET /admin/settings and PUT /admin/settings.
  - Wired repository + service methods for settings read/update.
- FE contract alignment:
  - Fixed topup status mapping to pending|succeeded|failed.
  - Fixed topup pagination mapping from total/page/page_size.
  - Fixed admin billing filter mapping to user_id.
- Admin UX completion:
  - Added manual admin topup action from Users tab.
  - Settings tab now editable and connected to settings API.

## P0 - Must do
### 1) Contract consistency hardening
- Keep topup status enum stable: pending/succeeded/failed.
- Ensure pagination response always has total/page/page_size.
- Verify /admin/transactions query docs and runtime aligned.

### 2) Security baseline
- Strengthen role-based checks in admin endpoints.
- Audit token revoke checks and expiry handling.
- Added basic rate-limit hooks, password policy enforcement, failed-login counter, and temporary lockout for auth sensitive routes.

## P1 - Should do

### 4) Support ticket backend (for Support screen) - done
- Added endpoints:
  - POST /support/tickets
  - GET /support/tickets/me
  - GET /admin/support/tickets
  - PATCH /admin/support/tickets/{id}
- Added frontend support form persistence and admin ticket management tab.

### 5) Session history endpoint for user History tab
- Current UI session tab is placeholder.
- Add endpoint:
  - GET /sessions/me?page=&page_size=&status=

### 6) Better admin transaction filtering
- Done:
  - support user_email and search filters in /admin/transactions and /admin/transactions/export
  - support admin_adjustment/admin_debit provider filters for manual balance adjustments
  - exclude admin manual adjustments from revenue statistics so dashboard revenue reflects payment revenue

## P2 - Nice to have

### 7) Observability
- Structured logs for admin actions (update user, stop session, delete machine, topup).
- Add audit log write hooks from service layer.

### 8) Idempotency for payment callbacks
- Enforce unique processing key per MoMo callback payload.

## Test matrix
- Unit tests: services/repositories.
- API tests: auth, machines, payments, admin, settings.
- Contract tests: request/response fields match docs/API_CONTRACT_BY_SCREEN.md.

## Rollout order
1. Admin settings APIs + tests.
2. Session history API + tests.
3. Support ticket API + tests.
4. Security and observability polish.

## Done criteria
- Swagger/OpenAPI reflects locked contracts.
- FE no longer uses temporary/mock workaround for contract fields.
- CI test suite passes for new APIs and regression checks.
