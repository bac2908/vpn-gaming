from sqlalchemy import Column, String, DateTime, ForeignKey, func, Text, Integer, LargeBinary, Boolean, BigInteger, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from app.database import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        Index("ix_users_email", "email", unique=True),
        Index("ix_users_status", "status"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False)
    display_name = Column(String)
    role = Column(String, nullable=False, default="user")
    status = Column(String, nullable=False, default="active")
    balance = Column(BigInteger, nullable=False, default=0)  # Số dư tài khoản (VND)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    credential = relationship("Credential", back_populates="user", uselist=False)
    identities = relationship("Identity", back_populates="user", cascade="all, delete-orphan")
    email_verifications = relationship("EmailVerification", back_populates="user", cascade="all, delete-orphan")
    subscriptions = relationship("Subscription", back_populates="user", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="user")
    vpn_sessions = relationship("VpnSession", back_populates="user")
    topup_transactions = relationship("TopupTransaction", back_populates="user")


class Credential(Base):
    __tablename__ = "credentials"
    __table_args__ = (
        Index("ix_credentials_user_id", "user_id"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    password_hash = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="credential")


class Machine(Base):
    __tablename__ = "machines"
    __table_args__ = (
        Index("ix_machines_region_status", "region", "status"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String, unique=True, nullable=False)
    region = Column(String)
    ping_ms = Column(Integer)
    gpu = Column(String)
    status = Column(String, nullable=False, default="idle")
    last_heartbeat = Column(DateTime(timezone=True))
    location = Column(String)

    vpn_sessions = relationship("VpnSession", back_populates="machine")
    machine_logs = relationship("MachineLog", back_populates="machine", cascade="all, delete-orphan")


class Identity(Base):
    __tablename__ = "identities"
    __table_args__ = (
        Index("ix_identities_user_id", "user_id"),
        Index("ix_identities_provider_subject", "provider", "subject", unique=True),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    provider = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    access_token_enc = Column(LargeBinary)
    refresh_token_enc = Column(LargeBinary)
    expires_at = Column(DateTime(timezone=True))
    last_login_at = Column(DateTime(timezone=True))

    user = relationship("User", back_populates="identities")


class EmailVerification(Base):
    __tablename__ = "email_verifications"
    __table_args__ = (
        Index("ix_email_verifications_user_id", "user_id"),
        Index("ix_email_verifications_token_hash", "token_hash", unique=True),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String, nullable=False, unique=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    consumed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="email_verifications")


class PasswordReset(Base):
    __tablename__ = "password_resets"
    __table_args__ = (
        Index("ix_password_resets_user_id", "user_id"),
        Index("ix_password_resets_token_hash", "token_hash", unique=True),
        Index("ix_password_resets_expires_at", "expires_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String, nullable=False, unique=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    consumed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = (
        Index("ix_payments_user_status", "user_id", "status"),
        Index("ix_payments_provider", "provider"),
        Index("ix_payments_created_at", "created_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    subscription_id = Column(UUID(as_uuid=True), ForeignKey("subscriptions.id", ondelete="SET NULL"))
    order_id = Column(String, unique=True, nullable=False)
    request_id = Column(String, unique=True, nullable=False)
    amount = Column(Integer, nullable=False)
    currency = Column(String, nullable=False, default="VND")
    provider = Column(String, nullable=False, default="momo")
    status = Column(String, nullable=False, default="pending")
    message = Column(String)
    pay_url = Column(String)
    trans_id = Column(String)
    extra_data = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="payments")
    subscription = relationship("Subscription", back_populates="payments")


class ServicePlan(Base):
    __tablename__ = "service_plans"
    __table_args__ = (
        Index("ix_service_plans_code", "code", unique=True),
        Index("ix_service_plans_active", "active"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    price_cents = Column(Integer, nullable=False, default=0)
    currency = Column(String, nullable=False, default="VND")
    duration_days = Column(Integer, nullable=False, default=30)
    data_limit_gb = Column(Integer)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    subscriptions = relationship("Subscription", back_populates="plan", cascade="all, delete-orphan")


class Subscription(Base):
    __tablename__ = "subscriptions"
    __table_args__ = (
        Index("ix_subscriptions_user_status", "user_id", "status"),
        Index("ix_subscriptions_plan", "plan_id"),
        Index("ix_subscriptions_end_at", "end_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("service_plans.id", ondelete="RESTRICT"), nullable=False)
    status = Column(String, nullable=False, default="active")
    start_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    end_at = Column(DateTime(timezone=True))
    auto_renew = Column(Boolean, nullable=False, default=False)
    canceled_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="subscriptions")
    plan = relationship("ServicePlan", back_populates="subscriptions")
    payments = relationship("Payment", back_populates="subscription")
    vpn_sessions = relationship("VpnSession", back_populates="subscription")


class VpnSession(Base):
    __tablename__ = "vpn_sessions"
    __table_args__ = (
        Index("ix_vpn_sessions_user", "user_id"),
        Index("ix_vpn_sessions_machine", "machine_id"),
        Index("ix_vpn_sessions_status", "status"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    subscription_id = Column(UUID(as_uuid=True), ForeignKey("subscriptions.id", ondelete="SET NULL"))
    machine_id = Column(UUID(as_uuid=True), ForeignKey("machines.id", ondelete="SET NULL"))
    status = Column(String, nullable=False, default="active")
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    ended_at = Column(DateTime(timezone=True))
    ip_address = Column(String)
    bytes_up = Column(BigInteger, nullable=False, default=0)
    bytes_down = Column(BigInteger, nullable=False, default=0)

    user = relationship("User", back_populates="vpn_sessions")
    subscription = relationship("Subscription", back_populates="vpn_sessions")
    machine = relationship("Machine", back_populates="vpn_sessions")
    machine_logs = relationship("MachineLog", back_populates="session")

    @property
    def vpn_online(self) -> bool:
        return bool(self.ip_address)

    @property
    def sunshine_paired(self) -> bool:
        return any(log.message == "sunshine_paired" for log in self.machine_logs)

    @property
    def moonlight_ready(self) -> bool:
        return self.vpn_online and self.sunshine_paired


class MachineLog(Base):
    __tablename__ = "machine_logs"
    __table_args__ = (
        Index("ix_machine_logs_machine", "machine_id"),
        Index("ix_machine_logs_session", "session_id"),
        Index("ix_machine_logs_level", "level"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    machine_id = Column(UUID(as_uuid=True), ForeignKey("machines.id", ondelete="CASCADE"), nullable=False)
    session_id = Column(UUID(as_uuid=True), ForeignKey("vpn_sessions.id", ondelete="SET NULL"))
    level = Column(String, nullable=False, default="info")
    message = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    machine = relationship("Machine", back_populates="machine_logs")
    session = relationship("VpnSession", back_populates="machine_logs")


class RevokedToken(Base):
    __tablename__ = "revoked_tokens"
    __table_args__ = (
        Index("ix_revoked_tokens_token_hash", "token_hash", unique=True),
        Index("ix_revoked_tokens_expires_at", "expires_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    token_hash = Column(String, nullable=False, unique=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TopupTransaction(Base):
    """Lịch sử giao dịch nạp tiền"""
    __tablename__ = "topup_transactions"
    __table_args__ = (
        Index("ix_topup_transactions_user_id", "user_id"),
        Index("ix_topup_transactions_status", "status"),
        Index("ix_topup_transactions_created_at", "created_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    payment_id = Column(UUID(as_uuid=True), ForeignKey("payments.id", ondelete="SET NULL"))
    amount = Column(BigInteger, nullable=False)  # Số tiền nạp (VND)
    balance_before = Column(BigInteger, nullable=False, default=0)  # Số dư trước khi nạp
    balance_after = Column(BigInteger, nullable=False, default=0)  # Số dư sau khi nạp
    status = Column(String, nullable=False, default="pending")  # pending, succeeded, failed
    provider = Column(String, nullable=False, default="momo")  # momo, bank, etc.
    description = Column(String)  # Ghi chú
    trans_id = Column(String)  # Mã giao dịch từ cổng thanh toán
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))  # Thời điểm hoàn thành

    user = relationship("User", back_populates="topup_transactions")
    payment = relationship("Payment")


class AdminSettings(Base):
    __tablename__ = "admin_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    password_min_length = Column(Integer, nullable=False, default=8)
    password_require_upper = Column(Boolean, nullable=False, default=True)
    password_require_lower = Column(Boolean, nullable=False, default=True)
    password_require_digit = Column(Boolean, nullable=False, default=True)
    lockout_max_attempts = Column(Integer, nullable=False, default=5)
    lockout_minutes = Column(Integer, nullable=False, default=10)
    min_topup_amount = Column(BigInteger, nullable=False, default=10000)
    session_timeout_hours = Column(Integer, nullable=False, default=24)
    snapshot_retention_count = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
