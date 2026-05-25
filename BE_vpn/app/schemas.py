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
    status: str
    started_at: datetime | None = None
    ended_at: datetime | None = None
    ip_address: str | None = None
    vpn_online: bool = False
    sunshine_paired: bool = False
    moonlight_ready: bool = False

    class Config:
        orm_mode = True


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


class MachineCreateRequest(BaseModel):
    code: str
    region: str | None = None
    ping_ms: int | None = None
    gpu: str | None = None
    status: str | None = "idle"
    location: str | None = None


class MachineUpdateRequest(BaseModel):
    region: str | None = None
    ping_ms: int | None = None
    gpu: str | None = None
    status: str | None = None
    location: str | None = None


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
    snapshot_retention_count: int = Field(..., ge=1, le=10)
