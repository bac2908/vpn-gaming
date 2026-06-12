from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import SQLAlchemyError

from app import models, schemas
from app.config import get_settings
from app.pricing import (
    TRIAL_DAILY_MINUTES,
    base_rate_for_gpu,
    billing_day,
    discounted_rate,
    get_policy,
    get_plan_policy,
)
from app.repositories.machine_repository import MachineRepository
from app.services.infrastructure_adapters import (
    SimulatedStreamingProvider,
    SimulatedVmProvider,
    SimulatedVpnProvider,
)


RUNNING_MACHINE_STATUSES = {"running", "busy"}
REFUND_WINDOW_SECONDS = 2 * 60


class MachineService:
    def __init__(self, db):
        self.repo = MachineRepository(db)
        self.vm_provider = SimulatedVmProvider()
        self.vpn_provider = SimulatedVpnProvider()
        self.streaming_provider = SimulatedStreamingProvider()

    def list_machines(
        self,
        page: int,
        page_size: int,
        region: str | None,
        gpu: str | None,
        status_filter: str | None,
        min_ping: int | None,
        max_ping: int | None,
        sort: str,
        current_user: models.User | None = None,
    ) -> schemas.MachinesPage:
        if min_ping is not None and max_ping is not None and min_ping > max_ping:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="min_ping khong duoc lon hon max_ping",
            )

        try:
            if self.repo.release_expired_machine_cooldowns(self._utc_now()):
                self.repo.commit()
            items, total = self.repo.list_machines(
                page=page,
                page_size=page_size,
                region=region,
                gpu=gpu,
                status=status_filter,
                min_ping=min_ping,
                max_ping=max_ping,
                sort=sort,
            )
            self._attach_machine_pricing(items, current_user)
            self._attach_machine_resume_state(items, current_user)
            return schemas.MachinesPage(items=items, total=total, page=page, page_size=page_size)
        except SQLAlchemyError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Khong doc duoc danh sach may (kiem tra quyen DB)",
            ) from exc

    def get_machine_detail(self, machine_id: UUID, current_user: models.User) -> schemas.MachineDetailOut:
        machine = self.repo.get_machine_by_id(machine_id)
        if not machine:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay may")

        active_session = self.repo.get_active_session_for_machine(machine_id)
        last_session = self.repo.get_last_ended_session_for_user_machine(machine_id, current_user.id)
        self._attach_machine_pricing([machine], current_user)
        if active_session:
            if self._bill_session_until_now(active_session):
                self.repo.commit()
                self.repo.refresh(active_session)
            self._attach_session_billing_view(active_session)
        if last_session:
            self._attach_session_billing_view(last_session)
        machine.can_resume = bool(last_session and machine.status == "idle")

        return schemas.MachineDetailOut(
            machine=machine,
            active_session=active_session,
            last_session=last_session,
        )

    def get_active_user_session(self, current_user: models.User) -> schemas.SessionOut | None:
        session = self.repo.get_active_session_for_user(current_user.id)
        if not session:
            return None
        changed = self._bill_session_until_now(session, current_user)
        if changed:
            self.repo.commit()
            self.repo.refresh(session)
        self._attach_session_billing_view(session, current_user)
        return session

    def _active_policy_for_user(self, current_user: models.User | None) -> tuple[models.Subscription | None, object]:
        if not current_user:
            return None, get_policy("free")
        subscription = self.repo.get_active_subscription_for_user(current_user.id)
        if not subscription or not subscription.plan:
            return None, get_policy("free")
        return subscription, get_plan_policy(subscription.plan.code)

    def _machine_base_rate(self, machine: models.Machine) -> int:
        return base_rate_for_gpu(
            getattr(machine, "gpu", None),
            int(getattr(machine, "base_rate_per_minute", 0) or 0),
        )

    def _attach_machine_resume_state(self, machines: list[models.Machine], current_user: models.User | None) -> None:
        for machine in machines:
            machine.can_resume = False
        if not current_user or not machines:
            return
        machine_ids = [machine.id for machine in machines if getattr(machine, "id", None)]
        latest_ended_map = self.repo.get_latest_ended_session_ids_for_user(current_user.id, machine_ids)
        for machine in machines:
            machine.can_resume = bool(machine.status == "idle" and latest_ended_map.get(machine.id))

    def _attach_machine_pricing(self, machines: list[models.Machine], current_user: models.User | None) -> None:
        _, policy = self._active_policy_for_user(current_user)
        today = billing_day()
        daily_free_used = 0
        balance = int(getattr(current_user, "balance", 0) or 0)
        if current_user:
            _, daily_free_used = self.repo.get_daily_billing_totals(current_user.id, today)

        trial_remaining = max(0, TRIAL_DAILY_MINUTES - daily_free_used)

        for machine in machines:
            base_rate = self._machine_base_rate(machine)
            effective_rate = discounted_rate(base_rate, policy)
            machine_trial_remaining = trial_remaining if getattr(machine, "trial_eligible", False) else 0
            balance_minutes = balance // effective_rate if effective_rate > 0 else 0
            can_pay_next_minute = machine_trial_remaining > 0 or balance >= effective_rate
            machine.billing_tier = policy.code
            machine.membership_tier = policy.code
            machine.base_rate_per_minute = base_rate
            machine.standard_rate_per_minute = base_rate
            machine.member_rate_per_minute = effective_rate
            machine.play_rate_per_minute = effective_rate
            machine.hourly_estimate = effective_rate * 60
            machine.standard_hourly_estimate = base_rate * 60
            machine.discount_percent = policy.discount_percent
            machine.savings_per_minute = max(0, base_rate - effective_rate)
            machine.trial_daily_minutes = TRIAL_DAILY_MINUTES
            machine.trial_minutes_remaining = machine_trial_remaining
            machine.allowed_gpu_tier = policy.allowed_gpu_tier
            machine.allowed_regions = policy.allowed_regions
            machine.snapshot_policy = policy.snapshot_policy
            machine.snapshot_active_limit = policy.snapshot_active_limit
            machine.queue_policy = policy.queue_policy
            machine.queue_priority = policy.queue_priority
            machine.max_session_seconds = policy.max_session_seconds
            machine.grace_period_seconds = policy.grace_period_seconds
            machine.idle_warning_seconds = policy.idle_warning_seconds
            machine.idle_stop_seconds = policy.idle_stop_seconds
            machine.cooldown_seconds = policy.cooldown_seconds
            machine.max_concurrent_sessions = policy.max_concurrent_sessions
            machine.daily_cap_vnd = policy.daily_cap_vnd
            machine.access_allowed = True
            machine.can_start = can_pay_next_minute and machine.status == "idle"
            machine.access_reason = None
            if machine.status == "suspended" and machine.cooldown_until:
                remaining = self._seconds_until(machine.cooldown_until)
                machine.access_reason = f"May dang cooldown {remaining}s truoc khi khoi dong lai."
            elif machine.status in {"maintenance", "offline"}:
                machine.access_reason = "May dang bao tri hoac offline."
            elif machine.status in RUNNING_MACHINE_STATUSES:
                machine.access_reason = "May dang co phien chay."
            elif not can_pay_next_minute:
                machine.access_reason = "So du khong du de choi phut tiep theo."
            machine.estimated_minutes = machine_trial_remaining + balance_minutes

    def _attach_session_billing_view(
        self,
        session: models.VpnSession,
        current_user: models.User | None = None,
    ) -> None:
        today = billing_day()
        user_id = session.user_id or getattr(current_user, "id", None)
        daily_spent = 0
        daily_free_used = 0
        if user_id:
            daily_spent, daily_free_used = self.repo.get_daily_billing_totals(user_id, today)
        trial_remaining = max(0, TRIAL_DAILY_MINUTES - daily_free_used)
        if not getattr(session, "trial_eligible", False):
            trial_remaining = 0
        session.trial_daily_minutes = TRIAL_DAILY_MINUTES
        session.trial_minutes_remaining = trial_remaining
        session.free_minutes_remaining = trial_remaining
        policy = get_policy(session.billing_tier)
        session.daily_cap_remaining = max(0, policy.daily_cap_vnd - daily_spent) if policy.daily_cap_vnd > 0 else 0

    def _ensure_session_can_start(self, machine: models.Machine, current_user: models.User) -> tuple[models.Subscription | None, object]:
        subscription, policy = self._active_policy_for_user(current_user)
        _, daily_free_used = self.repo.get_daily_billing_totals(current_user.id, billing_day())
        trial_remaining = max(0, TRIAL_DAILY_MINUTES - daily_free_used)
        if getattr(machine, "trial_eligible", False) and trial_remaining > 0:
            return subscription, policy

        effective_rate = discounted_rate(self._machine_base_rate(machine), policy)
        if int(current_user.balance or 0) < effective_rate:
            raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="So du khong du de choi phut tiep theo. Vui long nap them tien.")
        return subscription, policy

    def _active_session_count_for_user(self, current_user: models.User) -> int:
        count = self.repo.count_active_sessions_for_user(current_user.id)
        if isinstance(count, int):
            return count
        return 1 if self.repo.get_active_session_for_user(current_user.id) else 0

    def _release_machine_if_cooldown_expired(self, machine: models.Machine, now: datetime) -> None:
        cooldown_until = self._utc_naive(getattr(machine, "cooldown_until", None))
        if machine.status == "suspended" and cooldown_until and cooldown_until <= now:
            machine.status = "idle"
            machine.cooldown_until = None
            self.repo.db.add(machine)

    def _ensure_machine_available(self, machine: models.Machine, now: datetime) -> None:
        self._release_machine_if_cooldown_expired(machine, now)
        if machine.status == "idle":
            return
        if machine.status == "suspended" and machine.cooldown_until:
            remaining = self._seconds_until(machine.cooldown_until)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"May dang cooldown {remaining}s truoc khi khoi dong lai.",
            )
        if machine.status in {"maintenance", "offline"}:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="May dang bao tri hoac offline.")
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="May dang ban")

    def _create_session_for_policy(
        self,
        machine: models.Machine,
        current_user: models.User,
        subscription: models.Subscription | None,
        policy,
        now: datetime,
    ) -> models.VpnSession:
        effective_rate = discounted_rate(self._machine_base_rate(machine), policy)
        trial_eligible = bool(getattr(machine, "trial_eligible", False))
        session = self.repo.create_active_session(
            user_id=current_user.id,
            machine_id=machine.id,
            subscription_id=subscription.id if subscription else None,
            billing_tier=policy.code,
            play_rate_per_minute=effective_rate,
            billing_started_at=None,
            lifecycle_state="provisioning",
            billing_state="waiting_stream",
            connection_state="waiting_vpn",
            max_session_seconds=policy.max_session_seconds,
            grace_period_seconds=policy.grace_period_seconds,
            idle_warning_seconds=policy.idle_warning_seconds,
            idle_stop_seconds=policy.idle_stop_seconds,
            cooldown_seconds=policy.cooldown_seconds,
            queue_priority=policy.queue_priority,
            max_concurrent_sessions=policy.max_concurrent_sessions,
            snapshot_active_limit=policy.snapshot_active_limit,
            trial_eligible=trial_eligible,
        )
        machine.cooldown_until = None
        self.repo.set_machine_status(machine, "running")
        return session

    def _log_once(self, session: models.VpnSession, message: str, level: str = "info") -> bool:
        if not getattr(session, "id", None) or not getattr(session, "machine_id", None):
            return False
        if self.repo.has_session_log(session.id, message):
            return False
        self.repo.add_session_log(
            machine_id=session.machine_id,
            session_id=session.id,
            message=message,
            level=level,
        )
        return True

    def _provision_session_for_launch(self, machine: models.Machine, session: models.VpnSession) -> None:
        vm_result = self.vm_provider.start_machine(machine, session)
        session.lifecycle_state = "vm_running"
        session.connection_state = "waiting_vpn"
        session.billing_state = "waiting_stream"
        session.last_client_heartbeat_at = None
        session.last_stream_activity_at = None
        self._log_once(session, f"vm_provider:{vm_result.provider}")
        self._log_once(session, "vm_running")
        self._log_once(session, "vpn_profile_pending")
        self.repo.db.add(session)

    def _start_stream_billing(
        self,
        session: models.VpnSession,
        current_user: models.User,
        now: datetime,
    ) -> None:
        now = self._utc_aware(now) or self._utc_now()
        billing_started = not getattr(session, "billing_started_at", None)
        if billing_started:
            session.billing_started_at = now
            session.last_billed_at = now
        session.last_client_heartbeat_at = now
        session.last_stream_activity_at = now
        session.disconnected_at = None
        session.idle_warning_at = None
        session.connection_state = "streaming"
        session.lifecycle_state = "playing"
        session.billing_state = "trial" if getattr(session, "trial_eligible", False) else "charging"
        if billing_started:
            self._log_once(session, "billing_started")
        self.repo.db.add(session)

    def _utc_now(self) -> datetime:
        return datetime.now(timezone.utc)

    def _utc_naive(self, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value
        return value.astimezone(timezone.utc).replace(tzinfo=None)

    def _utc_aware(self, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    def _billing_start_naive(self, session: models.VpnSession) -> datetime | None:
        started_at = self._utc_naive(getattr(session, "started_at", None))
        billing_started_at = self._utc_naive(getattr(session, "billing_started_at", None))
        if billing_started_at and started_at and billing_started_at < started_at:
            return started_at
        return billing_started_at or started_at

    def _session_play_duration_seconds(self, session: models.VpnSession, now: datetime) -> int:
        billing_started_at = self._utc_naive(getattr(session, "billing_started_at", None))
        if billing_started_at:
            started_at = self._utc_naive(getattr(session, "started_at", None))
            start_time = max(started_at, billing_started_at) if started_at else billing_started_at
            end_time = self._utc_naive(getattr(session, "ended_at", None)) or now
            return max(0, int((end_time - start_time).total_seconds()))

        counted_minutes = int(getattr(session, "charged_minutes", 0) or 0) + int(getattr(session, "free_minutes_used", 0) or 0)
        if counted_minutes > 0:
            return counted_minutes * 60

        return 0

    def _session_activity_day_key(self, session: models.VpnSession) -> str | None:
        activity_at = (
            self._utc_aware(getattr(session, "billing_started_at", None))
            or self._utc_aware(getattr(session, "started_at", None))
        )
        if not activity_at:
            return None
        return billing_day(activity_at).isoformat()

    def _normalize_shifted_billing_start(self, session: models.VpnSession) -> bool:
        started_at = self._utc_naive(getattr(session, "started_at", None))
        billing_started_at = self._utc_naive(getattr(session, "billing_started_at", None))
        if not started_at or not billing_started_at or billing_started_at >= started_at:
            return False
        if int(getattr(session, "charged_minutes", 0) or 0) or int(getattr(session, "free_minutes_used", 0) or 0):
            return False

        normalized_start = self._utc_aware(getattr(session, "started_at", None)) or self._utc_now()
        session.billing_started_at = normalized_start
        last_billed_at = self._utc_naive(getattr(session, "last_billed_at", None))
        if last_billed_at is None or last_billed_at < started_at:
            session.last_billed_at = normalized_start
        self.repo.db.add(session)
        return True

    def _seconds_until(self, value: datetime | None) -> int:
        target = self._utc_naive(value)
        if target is None:
            return 0
        now = self._utc_naive(self._utc_now()) or datetime.utcnow()
        return max(0, int((target - now).total_seconds()))

    def _session_stop_candidate(self, session: models.VpnSession, now: datetime) -> tuple[datetime | None, str | None]:
        candidates: list[tuple[datetime, str]] = []
        started_at = self._billing_start_naive(session)
        max_session_seconds = int(getattr(session, "max_session_seconds", 0) or 0)
        if started_at and max_session_seconds > 0:
            max_stop_at = started_at + timedelta(seconds=max_session_seconds)
            if max_stop_at <= now:
                candidates.append((max_stop_at, "session_max_duration_reached"))

        disconnected_at = self._utc_naive(getattr(session, "disconnected_at", None))
        grace_period_seconds = int(getattr(session, "grace_period_seconds", 0) or 0)
        if disconnected_at and grace_period_seconds > 0:
            grace_stop_at = disconnected_at + timedelta(seconds=grace_period_seconds)
            if grace_stop_at <= now:
                candidates.append((grace_stop_at, "connection_grace_expired"))

        last_activity_at = self._utc_naive(getattr(session, "last_stream_activity_at", None))
        idle_stop_seconds = int(getattr(session, "idle_stop_seconds", 0) or 0)
        if last_activity_at and idle_stop_seconds > 0 and not disconnected_at:
            idle_stop_at = last_activity_at + timedelta(seconds=idle_stop_seconds)
            if idle_stop_at <= now:
                candidates.append((idle_stop_at, "idle_timeout_reached"))

        if not candidates:
            return None, None
        return min(candidates, key=lambda item: item[0])

    def _refresh_lifecycle_state(self, session: models.VpnSession, now: datetime) -> bool:
        if session.status != "active" or session.ended_at is not None:
            return False

        next_state = "running"
        next_connection_state = "connected"
        if getattr(session, "billing_started_at", None):
            next_state = "playing"
            next_connection_state = "streaming"
        disconnected_at = self._utc_naive(getattr(session, "disconnected_at", None))
        if disconnected_at:
            next_state = "grace_disconnected"
            next_connection_state = "disconnected"
        else:
            last_activity_at = self._utc_naive(getattr(session, "last_stream_activity_at", None))
            idle_warning_seconds = int(getattr(session, "idle_warning_seconds", 0) or 0)
            if last_activity_at and idle_warning_seconds > 0 and last_activity_at + timedelta(seconds=idle_warning_seconds) <= now:
                next_state = "idle_warning"
                next_connection_state = "idle"
                if not getattr(session, "idle_warning_at", None):
                    session.idle_warning_at = now
            else:
                session.idle_warning_at = None

        changed = False
        if getattr(session, "lifecycle_state", None) != next_state:
            session.lifecycle_state = next_state
            changed = True
        if getattr(session, "connection_state", None) != next_connection_state:
            session.connection_state = next_connection_state
            changed = True
        if next_state == "grace_disconnected" and getattr(session, "billing_state", None) != "grace":
            session.billing_state = "grace"
            changed = True
        if changed:
            self.repo.db.add(session)
        return changed

    def _billing_cutoff_for_counted_minutes(self, session: models.VpnSession, counted_minutes: int) -> datetime:
        started_at = self._billing_start_naive(session) or self._utc_naive(self._utc_now()) or datetime.utcnow()
        return started_at + timedelta(minutes=max(0, counted_minutes))

    def _bill_session_until_now(
        self,
        session: models.VpnSession,
        current_user: models.User | None = None,
        now: datetime | None = None,
    ) -> bool:
        if session.status != "active" or session.ended_at is not None:
            return False
        if not session.billing_tier or not session.billing_started_at:
            return False

        now = self._utc_naive(now or self._utc_now()) or datetime.utcnow()
        policy_stop_at, policy_stop_reason = self._session_stop_candidate(session, now)
        bill_until = policy_stop_at or now
        changed = self._normalize_shifted_billing_start(session)
        changed = self._refresh_lifecycle_state(session, bill_until) or changed

        billing_started_at = self._billing_start_naive(session) or bill_until
        elapsed_seconds = max(0, int((bill_until - billing_started_at).total_seconds()))
        target_total_minutes = elapsed_seconds // 60
        already_counted = int(session.charged_minutes or 0) + int(session.free_minutes_used or 0)
        minutes_to_bill = max(0, target_total_minutes - already_counted)
        if minutes_to_bill <= 0:
            if policy_stop_reason:
                self._finish_session(session, bill_until, policy_stop_reason, current_user=current_user)
                changed = True
            self._attach_session_billing_view(session, current_user)
            return changed

        user = current_user if current_user and current_user.id == session.user_id else session.user
        if not user:
            if policy_stop_reason:
                self._finish_session(session, bill_until, policy_stop_reason, current_user=current_user)
                changed = True
            return changed

        policy = get_policy(session.billing_tier)
        today = billing_day(bill_until)
        daily_spent, daily_free_used = self.repo.get_daily_billing_totals(user.id, today)
        free_to_apply = 0
        if getattr(session, "trial_eligible", False):
            free_to_apply = min(minutes_to_bill, max(0, TRIAL_DAILY_MINUTES - daily_free_used))

        if free_to_apply > 0:
            session.free_minutes_used = int(session.free_minutes_used or 0) + free_to_apply
            session.billing_state = "trial"
            self.repo.add_billing_event(
                user_id=user.id,
                session_id=session.id,
                machine_id=session.machine_id,
                billing_day=today,
                tier=policy.code,
                charged_minutes=0,
                free_minutes=free_to_apply,
                amount=0,
            )
            changed = True

        paid_needed = minutes_to_bill - free_to_apply
        paid_to_apply = 0
        stop_reason = None
        if paid_needed > 0:
            rate = max(1, int(session.play_rate_per_minute or policy.play_rate_per_minute))
            cap_remaining = max(0, policy.daily_cap_vnd - daily_spent) if policy.daily_cap_vnd > 0 else paid_needed * rate
            affordable_by_cap = cap_remaining // rate
            affordable_by_balance = int(user.balance or 0) // rate
            paid_to_apply = min(paid_needed, affordable_by_cap, affordable_by_balance)

            if paid_to_apply > 0:
                amount = paid_to_apply * rate
                user.balance = int(user.balance or 0) - amount
                session.charged_minutes = int(session.charged_minutes or 0) + paid_to_apply
                session.charged_amount = int(session.charged_amount or 0) + amount
                session.billing_state = "charging"
                self.repo.add_billing_event(
                    user_id=user.id,
                    session_id=session.id,
                    machine_id=session.machine_id,
                    billing_day=today,
                    tier=policy.code,
                    charged_minutes=paid_to_apply,
                    free_minutes=0,
                    amount=amount,
                )
                self.repo.db.add(user)
                changed = True

            if paid_to_apply < paid_needed:
                if affordable_by_cap <= paid_to_apply:
                    stop_reason = "billing_daily_cap_reached"
                else:
                    stop_reason = "billing_balance_depleted"

        if stop_reason:
            counted_minutes = already_counted + free_to_apply + paid_to_apply
            stop_at = min(bill_until, self._billing_cutoff_for_counted_minutes(session, counted_minutes))
            self._finish_session(session, stop_at, stop_reason, current_user=user)
            changed = True
        elif policy_stop_reason:
            self._finish_session(session, bill_until, policy_stop_reason, current_user=user)
            changed = True

        session.last_billed_at = bill_until
        self.repo.db.add(session)
        self._attach_session_billing_view(session, user)
        return changed

    def _finish_session(
        self,
        session: models.VpnSession,
        ended_at: datetime,
        reason: str,
        terminal_status: str = "stopped",
        current_user: models.User | None = None,
        retain_snapshot: bool = False,
    ) -> None:
        if session.status != "active" or session.ended_at is not None:
            return

        ended_at = self._utc_aware(ended_at) or datetime.now(timezone.utc)
        started_floor = (
            self._utc_aware(getattr(session, "started_at", None))
            or self._utc_aware(getattr(session, "billing_started_at", None))
        )
        if started_floor and ended_at <= started_floor:
            ended_at = started_floor + timedelta(seconds=1)

        session.status = terminal_status
        session.ended_at = ended_at
        session.stop_reason = reason
        session.lifecycle_state = "failed" if terminal_status == "failed" else "stopped"
        session.billing_state = "stopped"
        session.connection_state = "disconnected" if getattr(session, "disconnected_at", None) else getattr(session, "connection_state", "connected")
        self._apply_snapshot_policy(session, ended_at, terminal_status, retain_snapshot=retain_snapshot)
        if terminal_status == "failed":
            self._refund_failed_short_session(session, ended_at, reason, current_user)
        self.repo.db.add(session)
        self._release_machine_after_session(session, ended_at)
        if session.machine_id:
            self.repo.add_session_log(
                machine_id=session.machine_id,
                session_id=session.id,
                message=reason,
                level="warning",
            )

    def _apply_snapshot_policy(
        self,
        session: models.VpnSession,
        ended_at: datetime,
        terminal_status: str,
        retain_snapshot: bool = False,
    ) -> None:
        limit = int(getattr(session, "snapshot_active_limit", 0) or 0)
        user_id = getattr(session, "user_id", None)
        if terminal_status == "stopped" and retain_snapshot and limit > 0:
            session.snapshot_retained = True
            session.snapshot_archived_at = None
        else:
            session.snapshot_retained = False
            session.snapshot_archived_at = ended_at

        if not user_id or limit <= 0:
            return
        snapshots = self.repo.list_retained_snapshots_for_user(user_id)
        if not isinstance(snapshots, list):
            return
        for old_snapshot in snapshots[limit:]:
            old_snapshot.snapshot_retained = False
            old_snapshot.snapshot_archived_at = ended_at
            self.repo.db.add(old_snapshot)

    def _release_machine_after_session(self, session: models.VpnSession, ended_at: datetime) -> None:
        if not session.machine_id:
            return
        machine = self.repo.get_machine_by_id(session.machine_id)
        if not machine or machine.status not in RUNNING_MACHINE_STATUSES:
            return
        cooldown_seconds = int(getattr(session, "cooldown_seconds", 0) or 0)
        if not getattr(session, "billing_started_at", None):
            cooldown_seconds = 0
        if cooldown_seconds > 0:
            machine.cooldown_until = ended_at + timedelta(seconds=cooldown_seconds)
            self.repo.set_machine_status(machine, "suspended")
        else:
            machine.cooldown_until = None
            self.repo.set_machine_status(machine, "idle")

    def _refund_failed_short_session(
        self,
        session: models.VpnSession,
        ended_at: datetime,
        reason: str,
        current_user: models.User | None = None,
    ) -> None:
        started_at = self._billing_start_naive(session)
        if not started_at:
            return
        ended_at_naive = self._utc_naive(ended_at) or self._utc_naive(self._utc_now()) or datetime.utcnow()
        duration_seconds = max(0, int((ended_at_naive - started_at).total_seconds()))
        refundable = int(getattr(session, "charged_amount", 0) or 0) - int(getattr(session, "refunded_amount", 0) or 0)
        if duration_seconds >= REFUND_WINDOW_SECONDS or refundable <= 0:
            return

        user = current_user if current_user and current_user.id == session.user_id else session.user
        if not user:
            return

        user.balance = int(user.balance or 0) + refundable
        session.refunded_amount = int(getattr(session, "refunded_amount", 0) or 0) + refundable
        session.refund_reason = reason
        session.refund_status = "refunded"
        session.billing_state = "refunded"
        session.lifecycle_state = "refunded"
        self.repo.add_billing_event(
            user_id=user.id,
            session_id=session.id,
            machine_id=session.machine_id,
            billing_day=billing_day(ended_at),
            tier=session.billing_tier or "free",
            charged_minutes=0,
            free_minutes=0,
            amount=refundable,
            event_type="refund",
        )
        self.repo.db.add(user)

    def bill_all_active_sessions(self) -> int:
        changed_count = 0
        if self.repo.release_expired_machine_cooldowns(self._utc_now()):
            changed_count += 1
        for session in self.repo.list_active_billable_sessions():
            if self._bill_session_until_now(session):
                changed_count += 1
        if changed_count:
            self.repo.commit()
        return changed_count

    def get_user_session_history(
        self,
        current_user: models.User,
        page: int,
        page_size: int,
        status_filter: str | None,
        machine_id: UUID | None,
        date_from: datetime | None,
        date_to: datetime | None,
        sort: str,
    ) -> schemas.SessionHistoryPage:
        if date_from and date_to and date_from > date_to:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="date_from khong duoc lon hon date_to")

        items, total = self.repo.list_user_sessions(
            user_id=current_user.id,
            page=page,
            page_size=page_size,
            status_filter=status_filter,
            machine_id=machine_id,
            date_from=date_from,
            date_to=date_to,
            sort=sort,
        )

        machine_ids = [item.machine_id for item in items if item.machine_id]
        machines_map = self.repo.get_machines_by_ids(machine_ids)
        latest_ended_map = self.repo.get_latest_ended_session_ids_for_user(current_user.id, machine_ids)
        has_active_session = self.repo.get_active_session_for_user(current_user.id) is not None
        now = self._utc_naive(self._utc_now()) or datetime.utcnow()

        result_items: list[schemas.SessionHistoryItemOut] = []
        for item in items:
            machine = machines_map.get(item.machine_id) if item.machine_id else None
            duration_seconds = self._session_play_duration_seconds(item, now)

            can_resume = (
                not has_active_session
                and item.ended_at is not None
                and item.machine_id is not None
                and latest_ended_map.get(item.machine_id) == item.id
                and machine is not None
                and machine.status == "idle"
            )

            result_items.append(
                schemas.SessionHistoryItemOut(
                    id=item.id,
                    status=item.status,
                    started_at=item.started_at,
                    ended_at=item.ended_at,
                    billing_started_at=item.billing_started_at,
                    duration_seconds=duration_seconds,
                    ip_address=item.ip_address,
                    vpn_online=item.vpn_online,
                    sunshine_paired=item.sunshine_paired,
                    moonlight_ready=item.moonlight_ready,
                    bytes_up=item.bytes_up or 0,
                    bytes_down=item.bytes_down or 0,
                    machine_id=item.machine_id,
                    machine=machine,
                    can_resume=can_resume,
                    billing_tier=item.billing_tier,
                    play_rate_per_minute=item.play_rate_per_minute or 0,
                    charged_minutes=item.charged_minutes or 0,
                    charged_amount=item.charged_amount or 0,
                    free_minutes_used=item.free_minutes_used or 0,
                    trial_eligible=bool(getattr(item, "trial_eligible", False)),
                    lifecycle_state=item.lifecycle_state or "stopped",
                    billing_state=item.billing_state or "stopped",
                    connection_state=item.connection_state or "unknown",
                    stop_reason=item.stop_reason,
                    snapshot_retained=bool(item.snapshot_retained),
                    refunded_amount=item.refunded_amount or 0,
                    refund_status=item.refund_status or "none",
                )
            )

        return schemas.SessionHistoryPage(items=result_items, total=total, page=page, page_size=page_size)

    def get_user_session_history_summary(self, current_user: models.User) -> schemas.SessionHistorySummaryOut:
        sessions = self.repo.list_user_sessions_for_summary(current_user.id)
        machine_ids = [item.machine_id for item in sessions if item.machine_id]
        machines_map = self.repo.get_machines_by_ids(machine_ids)
        latest_ended_map = self.repo.get_latest_ended_session_ids_for_user(current_user.id, machine_ids)
        has_active_session = self.repo.get_active_session_for_user(current_user.id) is not None
        now = self._utc_naive(self._utc_now()) or datetime.utcnow()

        today = billing_day(self._utc_now())
        recent_days = [today - timedelta(days=6 - idx) for idx in range(7)]
        bucket_map = {
            day.isoformat(): {
                "date": day.isoformat(),
                "play_seconds": 0,
                "session_count": 0,
                "charged_amount": 0,
            }
            for day in recent_days
        }
        machine_totals: dict[str, dict] = {}

        total_play_seconds = 0
        total_charged_minutes = 0
        total_free_minutes = 0
        total_charged_amount = 0
        total_refunded_amount = 0
        active_sessions = 0
        stopped_sessions = 0
        failed_sessions = 0
        streamed_sessions = 0
        pre_stream_sessions = 0
        resumable_sessions = 0

        for session in sessions:
            duration_seconds = self._session_play_duration_seconds(session, now)
            charged_amount = int(getattr(session, "charged_amount", 0) or 0)
            refunded_amount = int(getattr(session, "refunded_amount", 0) or 0)
            total_play_seconds += duration_seconds
            total_charged_minutes += int(getattr(session, "charged_minutes", 0) or 0)
            total_free_minutes += int(getattr(session, "free_minutes_used", 0) or 0)
            total_charged_amount += charged_amount
            total_refunded_amount += refunded_amount

            if session.status == "active" and session.ended_at is None:
                active_sessions += 1
            elif session.status in {"stopped", "ended"}:
                stopped_sessions += 1
            elif session.status == "failed":
                failed_sessions += 1

            if duration_seconds > 0:
                streamed_sessions += 1
                day_key = self._session_activity_day_key(session)
                if day_key in bucket_map:
                    bucket_map[day_key]["play_seconds"] += duration_seconds
                    bucket_map[day_key]["session_count"] += 1
                    bucket_map[day_key]["charged_amount"] += max(0, charged_amount - refunded_amount)

                machine = machines_map.get(session.machine_id) if session.machine_id else None
                machine_key = str(session.machine_id or "unknown")
                current = machine_totals.setdefault(
                    machine_key,
                    {
                        "machine_id": session.machine_id,
                        "code": getattr(machine, "code", None) or "Chưa gắn máy",
                        "gpu": getattr(machine, "gpu", None),
                        "location": getattr(machine, "location", None),
                        "region": getattr(machine, "region", None),
                        "play_seconds": 0,
                        "session_count": 0,
                        "charged_amount": 0,
                    },
                )
                current["play_seconds"] += duration_seconds
                current["session_count"] += 1
                current["charged_amount"] += max(0, charged_amount - refunded_amount)
            else:
                pre_stream_sessions += 1

            machine = machines_map.get(session.machine_id) if session.machine_id else None
            can_resume = (
                not has_active_session
                and session.ended_at is not None
                and session.machine_id is not None
                and latest_ended_map.get(session.machine_id) == session.id
                and machine is not None
                and machine.status == "idle"
            )
            if can_resume:
                resumable_sessions += 1

        net_charged_amount = max(0, total_charged_amount - total_refunded_amount)
        average_play_seconds = round(total_play_seconds / streamed_sessions) if streamed_sessions else 0
        daily_buckets = [schemas.SessionDailyBucketOut(**bucket_map[day.isoformat()]) for day in recent_days]
        top_machines = [
            schemas.SessionMachineSummaryOut(**item)
            for item in sorted(
                machine_totals.values(),
                key=lambda value: (value["play_seconds"], value["session_count"]),
                reverse=True,
            )[:5]
        ]

        status_counts = [
            schemas.SessionStatusSummaryOut(key="streamed", label="Đã stream", count=streamed_sessions),
            schemas.SessionStatusSummaryOut(key="pre_stream", label="Chưa stream", count=pre_stream_sessions),
            schemas.SessionStatusSummaryOut(key="active", label="Đang chạy", count=active_sessions),
            schemas.SessionStatusSummaryOut(key="resume", label="Có snapshot", count=resumable_sessions),
            schemas.SessionStatusSummaryOut(key="failed", label="Lỗi", count=failed_sessions),
        ]

        return schemas.SessionHistorySummaryOut(
            total_sessions=len(sessions),
            active_sessions=active_sessions,
            stopped_sessions=stopped_sessions,
            failed_sessions=failed_sessions,
            resumable_sessions=resumable_sessions,
            streamed_sessions=streamed_sessions,
            pre_stream_sessions=pre_stream_sessions,
            total_play_seconds=total_play_seconds,
            average_play_seconds=average_play_seconds,
            total_charged_minutes=total_charged_minutes,
            total_free_minutes=total_free_minutes,
            total_charged_amount=total_charged_amount,
            total_refunded_amount=total_refunded_amount,
            net_charged_amount=net_charged_amount,
            week_play_seconds=sum(bucket.play_seconds for bucket in daily_buckets),
            week_charged_amount=sum(bucket.charged_amount for bucket in daily_buckets),
            week_session_count=sum(bucket.session_count for bucket in daily_buckets),
            daily_buckets=daily_buckets,
            top_machines=top_machines,
            status_counts=status_counts,
        )

    def start_machine_session(self, machine_id: UUID, current_user: models.User) -> schemas.SessionOut:
        machine = self.repo.get_machine_by_id(machine_id)
        if not machine:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay may")

        now = self._utc_naive(self._utc_now()) or datetime.utcnow()
        self._ensure_machine_available(machine, now)
        subscription, policy = self._ensure_session_can_start(machine, current_user)
        if self._active_session_count_for_user(current_user) >= policy.max_concurrent_sessions:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Membership {policy.display_name} chi cho phep {policy.max_concurrent_sessions} phien dong thoi.",
            )

        session = self._create_session_for_policy(machine, current_user, subscription, policy, now)
        self._provision_session_for_launch(machine, session)
        self.repo.commit()
        self.repo.refresh(session)
        self._attach_session_billing_view(session, current_user)
        return session

    def stop_user_session(
        self,
        session_id: UUID,
        current_user: models.User,
        retain_snapshot: bool = False,
    ) -> schemas.SessionOut:
        session = self.repo.get_session_by_id(session_id)
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay session")
        if session.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Khong co quyen dung session nay")
        if session.status != "active" or session.ended_at is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session khong dang active")

        self._bill_session_until_now(session, current_user)
        if session.status == "active" and session.ended_at is None:
            self._finish_session(
                session,
                self._utc_now(),
                "user_stopped",
                current_user=current_user,
                retain_snapshot=retain_snapshot,
            )

        self.repo.commit()
        self.repo.refresh(session)
        self._attach_session_billing_view(session, current_user)
        return session

    def build_session_ovpn(self, session_id: UUID, current_user: models.User) -> tuple[str, str]:
        session = self.repo.get_session_by_id(session_id)
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay session")
        if session.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Khong co quyen tai VPN file")
        if session.status != "active" or session.ended_at is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session khong dang active")
        if not session.machine_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session chua gan may")

        if self._bill_session_until_now(session, current_user):
            self.repo.commit()
            self.repo.refresh(session)
        if session.status != "active" or session.ended_at is not None:
            raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="Phien da dung do het so du.")

        machine = self.repo.get_machine_by_id(session.machine_id)
        if not machine:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay may")

        profile_result = self.vpn_provider.create_profile(machine, session)
        self._log_once(session, f"vpn_provider:{profile_result.provider}")
        self._log_once(session, "vpn_profile_generated")
        self.repo.db.add(session)
        self.repo.commit()
        self.repo.refresh(session)

        filename = self._ovpn_filename(machine, session)
        content = self._render_ovpn_profile(machine, session, current_user)
        return filename, content

    def verify_vpn_connection(self, session_id: UUID, current_user: models.User) -> schemas.SessionOut:
        session = self.repo.get_session_by_id(session_id)
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay session")
        if session.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Khong co quyen kiem tra VPN")
        if session.status != "active" or session.ended_at is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session khong dang active")

        self._bill_session_until_now(session, current_user)
        if session.status != "active" or session.ended_at is not None:
            raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="Phien da dung do het so du.")
        if not session.machine_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session chua gan may")
        machine = self.repo.get_machine_by_id(session.machine_id)
        if not machine:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay may")

        vpn_result = self.vpn_provider.check_connection(machine, session)
        if not session.ip_address:
            session.ip_address = vpn_result.ip_address or self._session_local_ip(session)
        now = self._utc_now()
        session.last_client_heartbeat_at = now
        session.disconnected_at = None
        if getattr(session, "billing_started_at", None):
            session.connection_state = "streaming"
            session.lifecycle_state = "playing"
        else:
            session.connection_state = "vpn_connected"
            session.lifecycle_state = "vpn_connected"
            session.billing_state = "waiting_stream"
        self._log_once(session, f"vpn_route_provider:{vpn_result.provider}")
        self._log_once(session, "vpn_connected")

        self.repo.db.add(session)
        self.repo.commit()
        self.repo.refresh(session)
        self._attach_session_billing_view(session, current_user)
        return session

    def mark_sunshine_paired(self, session_id: UUID, current_user: models.User) -> schemas.SessionOut:
        session = self.repo.get_session_by_id(session_id)
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay session")
        if session.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Khong co quyen cap nhat Sunshine")
        if session.status != "active" or session.ended_at is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session khong dang active")
        if not session.machine_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session chua gan may")
        if not session.ip_address:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Can ket noi VPN truoc khi ghep Sunshine")
        machine = self.repo.get_machine_by_id(session.machine_id)
        if not machine:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay may")

        self._bill_session_until_now(session, current_user)
        if session.status != "active" or session.ended_at is not None:
            raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="Phien da dung do het so du.")
        now = self._utc_now()
        stream_result = self.streaming_provider.mark_ready(machine, session)
        self._start_stream_billing(session, current_user, now)
        self._log_once(session, f"stream_provider:{stream_result.provider}")
        self._log_once(session, "sunshine_paired")
        self._log_once(session, "moonlight_ready")

        self.repo.commit()
        self.repo.refresh(session)
        self._attach_session_billing_view(session, current_user)
        return session

    def record_session_heartbeat(
        self,
        session_id: UUID,
        current_user: models.User,
        payload: schemas.SessionHeartbeatRequest,
    ) -> schemas.SessionOut:
        session = self.repo.get_session_by_id(session_id)
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay session")
        if session.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Khong co quyen cap nhat session nay")
        if session.status != "active" or session.ended_at is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session khong dang active")

        self._bill_session_until_now(session, current_user)
        if session.status != "active" or session.ended_at is not None:
            self.repo.commit()
            self.repo.refresh(session)
            self._attach_session_billing_view(session, current_user)
            return session

        now = self._utc_now()
        connection_state = payload.connection_state or "connected"
        session.last_client_heartbeat_at = now
        if payload.bytes_up is not None:
            session.bytes_up = payload.bytes_up
        if payload.bytes_down is not None:
            session.bytes_down = payload.bytes_down

        if connection_state == "disconnected":
            session.connection_state = "disconnected"
            session.lifecycle_state = "grace_disconnected"
            session.billing_state = "grace"
            if not session.disconnected_at:
                session.disconnected_at = now
        else:
            session.disconnected_at = None
            if payload.stream_active:
                if session.ip_address:
                    if not getattr(session, "billing_started_at", None):
                        self._start_stream_billing(session, current_user, now)
                        self._log_once(session, "sunshine_paired")
                        self._log_once(session, "moonlight_ready")
                    else:
                        session.last_stream_activity_at = now
                        session.idle_warning_at = None
                        session.connection_state = "streaming"
                        session.lifecycle_state = "playing"
                else:
                    session.connection_state = "waiting_vpn"
                    session.lifecycle_state = "vm_running"
                    session.billing_state = "waiting_stream"
            elif getattr(session, "billing_started_at", None):
                session.connection_state = "idle" if connection_state == "idle" else "streaming"
            elif session.ip_address:
                session.connection_state = "vpn_connected"
                session.lifecycle_state = "vpn_connected"
                session.billing_state = "waiting_stream"
            else:
                session.connection_state = "waiting_vpn"
                session.lifecycle_state = "vm_running"
                session.billing_state = "waiting_stream"

        if getattr(session, "billing_started_at", None):
            self._refresh_lifecycle_state(session, now)
        self.repo.db.add(session)
        self.repo.commit()
        self.repo.refresh(session)
        self._attach_session_billing_view(session, current_user)
        return session

    def stop_session_as_admin(self, session_id: UUID) -> None:
        session = self.repo.get_session_by_id(session_id)
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay session")
        if session.status != "active" or session.ended_at is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session khong dang active")
        self._bill_session_until_now(session)
        if session.status == "active" and session.ended_at is None:
            self._finish_session(session, self._utc_now(), "admin_stopped")
        self.repo.commit()

    def fail_session_as_admin(self, session_id: UUID, reason: str = "vm_failed") -> None:
        session = self.repo.get_session_by_id(session_id)
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay session")
        if session.status != "active" or session.ended_at is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session khong dang active")
        self._bill_session_until_now(session)
        if session.status == "active" and session.ended_at is None:
            self._finish_session(session, self._utc_now(), reason or "vm_failed", terminal_status="failed")
        self.repo.commit()

    def _ovpn_filename(self, machine: models.Machine, session: models.VpnSession) -> str:
        machine_code = "".join(
            ch.lower() for ch in machine.code if ch.isascii() and (ch.isalnum() or ch in ("-", "_"))
        )
        if not machine_code:
            machine_code = "machine"
        return f"vpngaming-{machine_code}-{str(session.id)[:8]}.ovpn"

    def _render_ovpn_profile(
        self,
        machine: models.Machine,
        session: models.VpnSession,
        current_user: models.User,
    ) -> str:
        settings = get_settings()
        proto = settings.openvpn_protocol.lower()
        if proto not in {"udp", "tcp", "tcp-client"}:
            proto = "udp"

        ca_block = (
            f"\n<ca>\n{settings.openvpn_ca_cert.strip()}\n</ca>\n"
            if settings.openvpn_ca_cert
            else "\n# OPENVPN_CA_CERT is not configured. Add the real VPN CA in backend env before production.\n"
        )
        tls_crypt_block = (
            f"\n<tls-crypt>\n{settings.openvpn_tls_crypt_key.strip()}\n</tls-crypt>\n"
            if settings.openvpn_tls_crypt_key
            else ""
        )

        lines = [
            "# VPN Gaming OpenVPN profile",
            f"# Session: {session.id}",
            f"# User: {current_user.id}",
            f"# Machine: {machine.code}",
            f"# Region: {machine.region or 'unknown'}",
            "client",
            "dev tun",
            f"proto {proto}",
            f"remote {settings.openvpn_remote_host} {settings.openvpn_remote_port}",
            "resolv-retry infinite",
            "nobind",
            "persist-key",
            "persist-tun",
            "remote-cert-tls server",
            "cipher AES-256-GCM",
            "auth SHA256",
            "auth-nocache",
            "verb 3",
            "mute-replay-warnings",
            "pull-filter ignore redirect-gateway",
            "auth-user-pass",
            f"setenv UV_SESSION_ID {session.id}",
            f"setenv UV_MACHINE_ID {machine.id}",
            f"setenv UV_MACHINE_CODE {machine.code}",
            "",
            "# Production note: provision per-session credentials/certificates from OpenVPN/PKI service.",
        ]
        return "\n".join(lines) + ca_block + tls_crypt_block

    def _session_local_ip(self, session: models.VpnSession) -> str:
        # Software adapter: replace this with a real OpenVPN/pfSense lease lookup later.
        host_octet = (session.id.int % 230) + 20
        return f"10.8.0.{host_octet}"

    def resume_machine_session(self, machine_id: UUID, current_user: models.User) -> schemas.SessionOut:
        machine = self.repo.get_machine_by_id(machine_id)
        if not machine:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Khong tim thay may")

        now = self._utc_naive(self._utc_now()) or datetime.utcnow()
        self._ensure_machine_available(machine, now)
        subscription, policy = self._ensure_session_can_start(machine, current_user)
        if self._active_session_count_for_user(current_user) >= policy.max_concurrent_sessions:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Membership {policy.display_name} chi cho phep {policy.max_concurrent_sessions} phien dong thoi.",
            )

        last_session = self.repo.get_last_ended_session_for_user_machine(machine_id, current_user.id)
        if not last_session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chua co snapshot de tiep tuc")

        session = self._create_session_for_policy(machine, current_user, subscription, policy, now)
        self._provision_session_for_launch(machine, session)
        self._log_once(session, "snapshot_resumed")
        self.repo.commit()
        self.repo.refresh(session)
        self._attach_session_billing_view(session, current_user)
        return session
