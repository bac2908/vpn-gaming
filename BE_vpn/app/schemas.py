from datetime import datetime
from pydantic import BaseModel, EmailStr, Field
from uuid import UUID


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str | None = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class ChangePasswordRequest(BaseModel):
    email: EmailStr
    old_password: str
    new_password: str


class UserProfileUpdateRequest(BaseModel):
    display_name: str | None = None
    current_password: str


class UserOut(BaseModel):
    id: UUID
    email: EmailStr
    display_name: str | None = None
    role: str
    balance: int = 0  # Số dư tài khoản (VND)

    class Config:
        orm_mode = True


class AdminUserOut(BaseModel):
    id: UUID
    email: EmailStr
    display_name: str | None = None
    role: str
    status: str
    balance: int = 0  # Số dư tài khoản (VND)
    created_at: datetime | None = None

    class Config:
        orm_mode = True


class UsersPage(BaseModel):
    items: list[AdminUserOut]
    total: int
    page: int
    page_size: int


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class MessageResponse(BaseModel):
    message: str


class MachineOut(BaseModel):
    id: UUID
    code: str
    region: str | None = None
    ping_ms: int | None = None
    gpu: str | None = None
    status: str
    last_heartbeat: datetime | None = None
    location: str | None = None
    cooldown_until: datetime | None = None
    base_rate_per_minute: int = 0
    standard_rate_per_minute: int | None = None
    member_rate_per_minute: int | None = None
    billing_tier: str | None = None
    membership_tier: str | None = None
    play_rate_per_minute: int | None = None
    hourly_estimate: int | None = None
    standard_hourly_estimate: int | None = None
    discount_percent: int = 0
    savings_per_minute: int = 0
    trial_eligible: bool = False
    trial_daily_minutes: int = 0
    trial_minutes_remaining: int = 0
    allowed_gpu_tier: str | None = None
    allowed_regions: list[str] = Field(default_factory=list)
    snapshot_policy: str | None = None
    snapshot_active_limit: int | None = None
    queue_policy: str | None = None
    queue_priority: int | None = None
    max_session_seconds: int | None = None
    grace_period_seconds: int | None = None
    idle_warning_seconds: int | None = None
    idle_stop_seconds: int | None = None
    cooldown_seconds: int | None = None
    max_concurrent_sessions: int | None = None
    daily_cap_vnd: int | None = None
    access_allowed: bool = True
    can_start: bool = True
    can_resume: bool = False
    access_reason: str | None = None
    estimated_minutes: int | None = None

    class Config:
        orm_mode = True


class MachinesPage(BaseModel):
    items: list[MachineOut]
    total: int
    page: int
    page_size: int


class UserUpdateRequest(BaseModel):
    display_name: str | None = None
    role: str | None = None
    status: str | None = None


class AdminTopupRequest(BaseModel):
    amount: int = Field(..., gt=0, description="Số tiền nạp (VND)")
    description: str | None = None


class SessionOut(BaseModel):
    id: UUID
    user_id: UUID | None = None
    machine_id: UUID | None = None
    subscription_id: UUID | None = None
    status: str
    started_at: datetime | None = None
    ended_at: datetime | None = None
    ip_address: str | None = None
    vpn_online: bool = False
    sunshine_paired: bool = False
    moonlight_ready: bool = False
    billing_tier: str | None = None
    play_rate_per_minute: int = 0
    billing_started_at: datetime | None = None
    last_billed_at: datetime | None = None
    charged_minutes: int = 0
    charged_amount: int = 0
    free_minutes_used: int = 0
    trial_eligible: bool = False
    trial_daily_minutes: int = 0
    trial_minutes_remaining: int = 0
    free_minutes_remaining: int = 0
    daily_cap_remaining: int = 0
    lifecycle_state: str = "running"
    billing_state: str = "free"
    connection_state: str = "connected"
    last_client_heartbeat_at: datetime | None = None
    last_stream_activity_at: datetime | None = None
    disconnected_at: datetime | None = None
    idle_warning_at: datetime | None = None
    stop_reason: str | None = None
    max_session_seconds: int = 0
    grace_period_seconds: int = 300
    idle_warning_seconds: int = 600
    idle_stop_seconds: int = 900
    cooldown_seconds: int = 60
    queue_priority: int = 0
    max_concurrent_sessions: int = 1
    snapshot_active_limit: int = 0
    snapshot_retained: bool = False
    snapshot_archived_at: datetime | None = None
    refunded_amount: int = 0
    refund_reason: str | None = None
    refund_status: str = "none"

    class Config:
        orm_mode = True


class SessionHistoryItemOut(BaseModel):
    id: UUID
    status: str
    started_at: datetime | None = None
    ended_at: datetime | None = None
    duration_seconds: int | None = None
    ip_address: str | None = None
    vpn_online: bool = False
    sunshine_paired: bool = False
    moonlight_ready: bool = False
    bytes_up: int = 0
    bytes_down: int = 0
    machine_id: UUID | None = None
    machine: MachineOut | None = None
    can_resume: bool = False
    billing_tier: str | None = None
    play_rate_per_minute: int = 0
    charged_minutes: int = 0
    charged_amount: int = 0
    free_minutes_used: int = 0
    trial_eligible: bool = False
    lifecycle_state: str = "stopped"
    billing_state: str = "stopped"
    connection_state: str = "unknown"
    stop_reason: str | None = None
    snapshot_retained: bool = False
    refunded_amount: int = 0
    refund_status: str = "none"

    class Config:
        orm_mode = True


class SessionHistoryPage(BaseModel):
    items: list[SessionHistoryItemOut]
    total: int
    page: int
    page_size: int


class MachineDetailOut(BaseModel):
    machine: MachineOut
    active_session: SessionOut | None = None
    last_session: SessionOut | None = None


class PaymentCreateRequest(BaseModel):
    amount: int = Field(..., gt=0)
    description: str | None = None


class PaymentInitResponse(BaseModel):
    order_id: str
    request_id: str
    pay_url: str
    amount: int


class ServicePlanOut(BaseModel):
    id: UUID
    code: str
    name: str
    description: str | None = None
    price_cents: int
    currency: str = "VND"
    duration_days: int
    data_limit_gb: int | None = None
    active: bool = True
    play_rate_per_minute: int = 0
    hourly_estimate: int = 0
    discount_percent: int = 0
    standard_sample_rate_per_minute: int = 250
    member_sample_rate_per_minute: int = 250
    allowed_gpu_tier: str | None = None
    allowed_regions: list[str] = Field(default_factory=list)
    snapshot_policy: str | None = None
    snapshot_active_limit: int = 0
    queue_policy: str | None = None
    queue_priority: int = 0
    max_session_seconds: int = 0
    grace_period_seconds: int = 300
    idle_warning_seconds: int = 600
    idle_stop_seconds: int = 900
    cooldown_seconds: int = 60
    max_concurrent_sessions: int = 1
    daily_cap_vnd: int = 20000

    class Config:
        orm_mode = True


class SubscriptionOut(BaseModel):
    id: UUID
    user_id: UUID
    plan_id: UUID
    status: str
    start_at: datetime | None = None
    end_at: datetime | None = None
    auto_renew: bool = False
    canceled_at: datetime | None = None
    plan: ServicePlanOut | None = None

    class Config:
        orm_mode = True


class SubscriptionPurchaseRequest(BaseModel):
    plan_id: UUID


class MachineCreateRequest(BaseModel):
    code: str
    region: str | None = None
    ping_ms: int | None = None
    gpu: str | None = None
    status: str | None = "idle"
    location: str | None = None
    base_rate_per_minute: int | None = Field(None, ge=0)
    trial_eligible: bool = False


class MachineUpdateRequest(BaseModel):
    region: str | None = None
    ping_ms: int | None = None
    gpu: str | None = None
    status: str | None = None
    location: str | None = None
    base_rate_per_minute: int | None = Field(None, ge=0)
    trial_eligible: bool | None = None


class SessionHeartbeatRequest(BaseModel):
    connection_state: str | None = Field(None, regex="^(connected|disconnected|idle)$")
    stream_active: bool = True
    bytes_up: int | None = Field(None, ge=0)
    bytes_down: int | None = Field(None, ge=0)


class AdminSessionFailRequest(BaseModel):
    reason: str | None = Field("vm_failed", max_length=120)


# ===== Topup Schemas =====

class TopupCreateRequest(BaseModel):
    """Request tạo giao dịch nạp tiền"""
    amount: int = Field(..., ge=10000, description="Số tiền nạp (tối thiểu 10.000đ)")
    description: str | None = Field(None, max_length=200, description="Ghi chú")


class TopupTransactionOut(BaseModel):
    """Response thông tin giao dịch nạp tiền"""
    id: UUID
    user_id: UUID
    amount: int
    balance_before: int
    balance_after: int
    status: str
    provider: str
    description: str | None = None
    trans_id: str | None = None
    created_at: datetime | None = None
    completed_at: datetime | None = None

    class Config:
        orm_mode = True


class TopupHistoryPage(BaseModel):
    """Danh sách lịch sử nạp tiền có phân trang"""
    items: list[TopupTransactionOut]
    total: int
    page: int
    page_size: int


class UserBalanceOut(BaseModel):
    """Response số dư tài khoản"""
    balance: int
    formatted_balance: str  # Định dạng: "1.000.000đ"


# ===== Admin Dashboard Schemas =====

class AdminDashboardOut(BaseModel):
    """Response Dashboard Admin"""
    total_users: int
    active_users: int
    pending_users: int
    total_machines: int
    idle_machines: int
    busy_machines: int
    maintenance_machines: int
    total_sessions: int
    active_sessions: int
    total_revenue: int
    today_revenue: int
    month_revenue: int
    recent_transactions: list[TopupTransactionOut]


class MachineStatisticsOut(BaseModel):
    """Response thống kê máy"""
    total: int
    idle: int
    busy: int
    maintenance: int
    avg_ping: float
    by_region: list[dict]
    by_gpu: list[dict]


class AdminSessionOut(BaseModel):
    """Session với thông tin user và machine"""
    id: UUID
    user_id: UUID | None = None
    user_email: str | None = None
    machine_id: UUID | None = None
    machine_code: str | None = None
    status: str
    started_at: datetime | None = None
    ended_at: datetime | None = None
    ip_address: str | None = None
    bytes_up: int = 0
    bytes_down: int = 0
    billing_tier: str | None = None
    play_rate_per_minute: int = 0
    charged_minutes: int = 0
    charged_amount: int = 0
    free_minutes_used: int = 0
    lifecycle_state: str = "running"
    billing_state: str = "free"
    connection_state: str = "connected"
    stop_reason: str | None = None
    refunded_amount: int = 0
    refund_status: str = "none"

    class Config:
        orm_mode = True


class SessionsPage(BaseModel):
    """Danh sách sessions có phân trang"""
    items: list[AdminSessionOut]
    total: int
    page: int
    page_size: int


class AdminSettingsOut(BaseModel):
    password_min_length: int
    password_require_upper: bool
    password_require_lower: bool
    password_require_digit: bool
    lockout_max_attempts: int
    lockout_minutes: int
    min_topup_amount: int
    session_timeout_hours: int
    snapshot_retention_count: int

    class Config:
        orm_mode = True


class AdminSettingsUpdate(BaseModel):
    password_min_length: int = Field(..., ge=8, le=128)
    password_require_upper: bool
    password_require_lower: bool
    password_require_digit: bool
    lockout_max_attempts: int = Field(..., ge=1, le=20)
    lockout_minutes: int = Field(..., ge=1, le=1440)
    min_topup_amount: int = Field(..., ge=10000)
    session_timeout_hours: int = Field(..., ge=1, le=168)
    snapshot_retention_count: int = Field(..., ge=1, le=20)
