from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

from app.services.machine_service import MachineService


def _service() -> MachineService:
    service = MachineService(db=None)
    service.repo = MagicMock()
    service.repo.db = MagicMock()
    return service


def test_free_quota_bills_without_charging_balance() -> None:
    service = _service()
    user = SimpleNamespace(id=uuid4(), balance=0)
    session = SimpleNamespace(
        id=uuid4(),
        user_id=user.id,
        user=user,
        machine_id=uuid4(),
        status="active",
        ended_at=None,
        billing_tier="free",
        play_rate_per_minute=50,
        billing_started_at=datetime.utcnow() - timedelta(minutes=15),
        charged_minutes=0,
        charged_amount=0,
        free_minutes_used=0,
        trial_eligible=True,
        last_billed_at=None,
    )
    service.repo.get_daily_billing_totals.return_value = (0, 0)

    changed = service._bill_session_until_now(session, user, datetime.utcnow())

    assert changed is True
    assert session.free_minutes_used == 15
    assert session.charged_minutes == 0
    assert session.charged_amount == 0
    assert user.balance == 0
    service.repo.add_billing_event.assert_called_once()


def _history_session(**overrides) -> SimpleNamespace:
    now = datetime.utcnow()
    data = {
        "id": uuid4(),
        "user_id": uuid4(),
        "machine_id": None,
        "status": "stopped",
        "started_at": now - timedelta(hours=3),
        "ended_at": now,
        "ip_address": None,
        "vpn_online": False,
        "sunshine_paired": False,
        "moonlight_ready": False,
        "bytes_up": 0,
        "bytes_down": 0,
        "billing_tier": "free",
        "play_rate_per_minute": 0,
        "billing_started_at": None,
        "charged_minutes": 0,
        "charged_amount": 0,
        "free_minutes_used": 0,
        "trial_eligible": False,
        "lifecycle_state": "stopped",
        "billing_state": "stopped",
        "connection_state": "disconnected",
        "stop_reason": None,
        "snapshot_retained": False,
        "refunded_amount": 0,
        "refund_status": "none",
    }
    data.update(overrides)
    return SimpleNamespace(**data)


def _history_result_for(session: SimpleNamespace):
    service = _service()
    user = SimpleNamespace(id=session.user_id, balance=0)
    service.repo.list_user_sessions.return_value = ([session], 1)
    service.repo.get_machines_by_ids.return_value = {}
    service.repo.get_latest_ended_session_ids_for_user.return_value = {}
    service.repo.get_active_session_for_user.return_value = None

    return service.get_user_session_history(
        current_user=user,
        page=1,
        page_size=10,
        status_filter=None,
        machine_id=None,
        date_from=None,
        date_to=None,
        sort="recent",
    )


def test_history_duration_ignores_pre_stream_vm_lifetime() -> None:
    now = datetime.utcnow()
    session = _history_session(
        started_at=now - timedelta(days=120),
        ended_at=now,
        billing_started_at=None,
        charged_minutes=0,
        free_minutes_used=0,
    )

    result = _history_result_for(session)

    assert result.items[0].duration_seconds == 0


def test_history_duration_uses_billing_start_when_stream_started() -> None:
    now = datetime.utcnow()
    session = _history_session(
        started_at=now - timedelta(hours=5),
        billing_started_at=now - timedelta(minutes=12),
        ended_at=now,
    )

    result = _history_result_for(session)

    assert result.items[0].duration_seconds == 12 * 60


def test_history_summary_separates_streamed_and_pre_stream_sessions() -> None:
    service = _service()
    user_id = uuid4()
    user = SimpleNamespace(id=user_id, balance=0)
    now = datetime.utcnow()
    streamed = _history_session(
        user_id=user_id,
        started_at=now - timedelta(hours=2),
        billing_started_at=now - timedelta(minutes=10),
        ended_at=now,
        charged_minutes=3,
        free_minutes_used=7,
        charged_amount=300,
        refunded_amount=50,
    )
    pre_stream = _history_session(
        user_id=user_id,
        started_at=now - timedelta(days=120),
        ended_at=now,
        billing_started_at=None,
        charged_minutes=0,
        free_minutes_used=0,
        charged_amount=0,
    )
    service.repo.list_user_sessions_for_summary.return_value = [streamed, pre_stream]
    service.repo.get_machines_by_ids.return_value = {}
    service.repo.get_latest_ended_session_ids_for_user.return_value = {}
    service.repo.get_active_session_for_user.return_value = None

    summary = service.get_user_session_history_summary(user)

    assert summary.total_sessions == 2
    assert summary.streamed_sessions == 1
    assert summary.pre_stream_sessions == 1
    assert summary.total_play_seconds == 10 * 60
    assert summary.average_play_seconds == 10 * 60
    assert summary.total_charged_minutes == 3
    assert summary.total_free_minutes == 7
    assert summary.net_charged_amount == 250


def test_payg_billing_stops_session_without_negative_balance() -> None:
    service = _service()
    user = SimpleNamespace(id=uuid4(), balance=50)
    machine_id = uuid4()
    session = SimpleNamespace(
        id=uuid4(),
        user_id=user.id,
        user=user,
        machine_id=machine_id,
        status="active",
        ended_at=None,
        billing_tier="free",
        play_rate_per_minute=50,
        billing_started_at=datetime.utcnow() - timedelta(minutes=2),
        charged_minutes=0,
        charged_amount=0,
        free_minutes_used=0,
        trial_eligible=True,
        last_billed_at=None,
    )
    machine = SimpleNamespace(id=machine_id, status="busy")
    service.repo.get_daily_billing_totals.return_value = (0, 15)
    service.repo.get_machine_by_id.return_value = machine

    changed = service._bill_session_until_now(session, user, datetime.utcnow())

    assert changed is True
    assert user.balance == 0
    assert session.charged_minutes == 1
    assert session.charged_amount == 50
    assert session.status == "stopped"
    assert session.ended_at is not None
    service.repo.set_machine_status.assert_called_once_with(machine, "idle")


def test_billing_clamps_shifted_billing_start_to_session_start() -> None:
    service = _service()
    user = SimpleNamespace(id=uuid4(), balance=1000)
    now = datetime.utcnow()
    started_at = now - timedelta(minutes=5)
    session = SimpleNamespace(
        id=uuid4(),
        user_id=user.id,
        user=user,
        machine_id=uuid4(),
        status="active",
        ended_at=None,
        started_at=started_at,
        billing_tier="basic",
        play_rate_per_minute=10,
        billing_started_at=started_at - timedelta(hours=7),
        charged_minutes=0,
        charged_amount=0,
        free_minutes_used=0,
        trial_eligible=False,
        last_billed_at=None,
        disconnected_at=None,
        grace_period_seconds=300,
        max_session_seconds=14400,
        idle_stop_seconds=900,
        idle_warning_seconds=600,
        last_stream_activity_at=started_at,
    )
    service.repo.get_daily_billing_totals.return_value = (0, 0)

    changed = service._bill_session_until_now(session, user, now)

    assert changed is True
    assert session.charged_minutes == 5
    assert session.charged_amount == 50
    assert service._utc_naive(session.billing_started_at) == started_at
    assert user.balance == 950


def test_start_machine_allows_free_user_without_subscription() -> None:
    service = _service()
    user = SimpleNamespace(id=uuid4(), balance=0)
    machine = SimpleNamespace(
        id=uuid4(),
        status="idle",
        gpu="NVIDIA RTX 3060",
        region="Vietnam",
        location="Hanoi",
        base_rate_per_minute=50,
        trial_eligible=True,
    )
    session = SimpleNamespace(
        id=uuid4(),
        user_id=user.id,
        user=user,
        machine_id=machine.id,
        subscription_id=None,
        status="active",
        ended_at=None,
        billing_tier="free",
        play_rate_per_minute=50,
        billing_started_at=datetime.utcnow(),
        charged_minutes=0,
        charged_amount=0,
        free_minutes_used=0,
        trial_eligible=True,
    )
    service.repo.get_machine_by_id.return_value = machine
    service.repo.get_active_session_for_user.return_value = None
    service.repo.get_active_subscription_for_user.return_value = None
    service.repo.get_daily_billing_totals.return_value = (0, 0)
    service.repo.create_active_session.return_value = session

    result = service.start_machine_session(machine.id, user)

    assert result is session
    service.repo.create_active_session.assert_called_once()
    kwargs = service.repo.create_active_session.call_args.kwargs
    assert kwargs["subscription_id"] is None
    assert kwargs["billing_tier"] == "free"
    assert kwargs["billing_started_at"] is None
    assert kwargs["billing_state"] == "waiting_stream"
    assert kwargs["connection_state"] == "waiting_vpn"
    assert kwargs["play_rate_per_minute"] == 50
    assert kwargs["trial_eligible"] is True


def test_payg_allows_high_gpu_without_membership_when_balance_is_enough() -> None:
    service = _service()
    user = SimpleNamespace(id=uuid4(), balance=250)
    machine = SimpleNamespace(
        id=uuid4(),
        status="idle",
        gpu="NVIDIA RTX 4090",
        region="Singapore",
        location="Singapore",
        base_rate_per_minute=250,
        trial_eligible=False,
    )
    session = SimpleNamespace(
        id=uuid4(),
        user_id=user.id,
        user=user,
        machine_id=machine.id,
        subscription_id=None,
        status="active",
        ended_at=None,
        billing_tier="free",
        play_rate_per_minute=250,
        billing_started_at=datetime.utcnow(),
        charged_minutes=0,
        charged_amount=0,
        free_minutes_used=0,
        trial_eligible=False,
    )
    service.repo.get_machine_by_id.return_value = machine
    service.repo.get_active_session_for_user.return_value = None
    service.repo.get_active_subscription_for_user.return_value = None
    service.repo.get_daily_billing_totals.return_value = (0, 15)
    service.repo.create_active_session.return_value = session

    result = service.start_machine_session(machine.id, user)

    assert result is session
    kwargs = service.repo.create_active_session.call_args.kwargs
    assert kwargs["billing_tier"] == "free"
    assert kwargs["billing_started_at"] is None
    assert kwargs["billing_state"] == "waiting_stream"
    assert kwargs["play_rate_per_minute"] == 250
    assert kwargs["trial_eligible"] is False


def test_membership_discounts_machine_payg_rate_without_unlocking_gpu() -> None:
    service = _service()
    user = SimpleNamespace(id=uuid4(), balance=160)
    plan = SimpleNamespace(code="premium")
    subscription = SimpleNamespace(id=uuid4(), plan=plan)
    machine = SimpleNamespace(
        id=uuid4(),
        status="idle",
        gpu="NVIDIA RTX 4090",
        region="United States",
        location="New York",
        base_rate_per_minute=250,
        trial_eligible=False,
    )
    session = SimpleNamespace(
        id=uuid4(),
        user_id=user.id,
        user=user,
        machine_id=machine.id,
        subscription_id=subscription.id,
        status="active",
        ended_at=None,
        billing_tier="premium",
        play_rate_per_minute=160,
        billing_started_at=datetime.utcnow(),
        charged_minutes=0,
        charged_amount=0,
        free_minutes_used=0,
        trial_eligible=False,
    )
    service.repo.get_machine_by_id.return_value = machine
    service.repo.get_active_session_for_user.return_value = None
    service.repo.get_active_subscription_for_user.return_value = subscription
    service.repo.get_daily_billing_totals.return_value = (0, 15)
    service.repo.create_active_session.return_value = session

    result = service.start_machine_session(machine.id, user)

    assert result is session
    kwargs = service.repo.create_active_session.call_args.kwargs
    assert kwargs["subscription_id"] == subscription.id
    assert kwargs["billing_tier"] == "premium"
    assert kwargs["billing_started_at"] is None
    assert kwargs["billing_state"] == "waiting_stream"
    assert kwargs["play_rate_per_minute"] == 160


def test_sunshine_pairing_starts_stream_billing() -> None:
    service = _service()
    user = SimpleNamespace(id=uuid4(), balance=1000)
    machine_id = uuid4()
    session = SimpleNamespace(
        id=uuid4(),
        user_id=user.id,
        user=user,
        machine_id=machine_id,
        status="active",
        ended_at=None,
        ip_address="10.8.0.24",
        billing_tier="free",
        play_rate_per_minute=50,
        billing_started_at=None,
        charged_minutes=0,
        charged_amount=0,
        free_minutes_used=0,
        trial_eligible=False,
        last_billed_at=None,
    )
    machine = SimpleNamespace(id=machine_id, code="VN-01", status="running")
    service.repo.get_session_by_id.return_value = session
    service.repo.get_machine_by_id.return_value = machine
    service.repo.get_daily_billing_totals.return_value = (0, 0)
    service.repo.has_session_log.return_value = False

    result = service.mark_sunshine_paired(session.id, user)

    assert result is session
    assert session.billing_started_at is not None
    assert session.last_billed_at == session.billing_started_at
    assert session.lifecycle_state == "playing"
    assert session.connection_state == "streaming"
    assert session.billing_state == "charging"
    messages = [call.kwargs["message"] for call in service.repo.add_session_log.call_args_list]
    assert "sunshine_paired" in messages
    assert "moonlight_ready" in messages
    assert "billing_started" in messages


def test_heartbeat_does_not_start_billing_before_stream() -> None:
    service = _service()
    user = SimpleNamespace(id=uuid4(), balance=1000)
    session = SimpleNamespace(
        id=uuid4(),
        user_id=user.id,
        user=user,
        machine_id=uuid4(),
        status="active",
        ended_at=None,
        ip_address=None,
        billing_tier="free",
        play_rate_per_minute=50,
        billing_started_at=None,
        charged_minutes=0,
        charged_amount=0,
        free_minutes_used=0,
        trial_eligible=False,
        last_billed_at=None,
    )
    payload = SimpleNamespace(connection_state="connected", stream_active=False, bytes_up=None, bytes_down=None)
    service.repo.get_session_by_id.return_value = session
    service.repo.get_daily_billing_totals.return_value = (0, 0)

    service.record_session_heartbeat(session.id, user, payload)

    assert session.billing_started_at is None
    assert session.lifecycle_state == "vm_running"
    assert session.connection_state == "waiting_vpn"
    assert session.billing_state == "waiting_stream"


def test_grace_period_auto_stops_after_disconnect_window() -> None:
    service = _service()
    now = datetime.utcnow()
    user = SimpleNamespace(id=uuid4(), balance=1000)
    machine_id = uuid4()
    disconnected_at = now - timedelta(minutes=6)
    session = SimpleNamespace(
        id=uuid4(),
        user_id=user.id,
        user=user,
        machine_id=machine_id,
        status="active",
        ended_at=None,
        started_at=now - timedelta(minutes=10),
        billing_tier="basic",
        play_rate_per_minute=35,
        billing_started_at=now - timedelta(minutes=10),
        charged_minutes=0,
        charged_amount=0,
        free_minutes_used=0,
        last_billed_at=None,
        disconnected_at=disconnected_at,
        grace_period_seconds=300,
        max_session_seconds=0,
        idle_stop_seconds=900,
        idle_warning_seconds=600,
        last_stream_activity_at=now - timedelta(minutes=10),
        cooldown_seconds=0,
        snapshot_active_limit=0,
        refunded_amount=0,
    )
    machine = SimpleNamespace(id=machine_id, status="running", cooldown_until=None)
    service.repo.get_daily_billing_totals.return_value = (0, 0)
    service.repo.get_machine_by_id.return_value = machine

    changed = service._bill_session_until_now(session, user, now)

    assert changed is True
    assert session.status == "stopped"
    assert session.stop_reason == "connection_grace_expired"
    assert service._utc_naive(session.ended_at) == disconnected_at + timedelta(seconds=300)
    service.repo.set_machine_status.assert_called_once_with(machine, "idle")


def test_max_session_duration_auto_stops() -> None:
    service = _service()
    now = datetime.utcnow()
    user = SimpleNamespace(id=uuid4(), balance=1000)
    machine_id = uuid4()
    started_at = now - timedelta(minutes=5)
    session = SimpleNamespace(
        id=uuid4(),
        user_id=user.id,
        user=user,
        machine_id=machine_id,
        status="active",
        ended_at=None,
        started_at=started_at,
        billing_tier="basic",
        play_rate_per_minute=35,
        billing_started_at=started_at,
        charged_minutes=0,
        charged_amount=0,
        free_minutes_used=0,
        last_billed_at=None,
        disconnected_at=None,
        grace_period_seconds=300,
        max_session_seconds=120,
        idle_stop_seconds=900,
        idle_warning_seconds=600,
        last_stream_activity_at=now,
        cooldown_seconds=0,
        snapshot_active_limit=0,
        refunded_amount=0,
    )
    machine = SimpleNamespace(id=machine_id, status="running", cooldown_until=None)
    service.repo.get_daily_billing_totals.return_value = (0, 0)
    service.repo.get_machine_by_id.return_value = machine

    service._bill_session_until_now(session, user, now)

    assert session.status == "stopped"
    assert session.stop_reason == "session_max_duration_reached"
    assert service._utc_naive(session.ended_at) == started_at + timedelta(seconds=120)


def test_stop_session_puts_machine_into_cooldown() -> None:
    service = _service()
    user = SimpleNamespace(id=uuid4(), balance=1000)
    machine_id = uuid4()
    now = datetime.utcnow()
    session = SimpleNamespace(
        id=uuid4(),
        user_id=user.id,
        user=user,
        machine_id=machine_id,
        status="active",
        ended_at=None,
        started_at=now,
        billing_tier="basic",
        play_rate_per_minute=35,
        billing_started_at=now,
        charged_minutes=0,
        charged_amount=0,
        free_minutes_used=0,
        last_billed_at=None,
        disconnected_at=None,
        grace_period_seconds=300,
        max_session_seconds=14400,
        idle_stop_seconds=900,
        idle_warning_seconds=600,
        last_stream_activity_at=now,
        cooldown_seconds=60,
        snapshot_active_limit=1,
        refunded_amount=0,
    )
    machine = SimpleNamespace(id=machine_id, status="running", cooldown_until=None)
    service.repo.get_session_by_id.return_value = session
    service.repo.get_machine_by_id.return_value = machine
    service.repo.get_daily_billing_totals.return_value = (0, 0)
    service.repo.list_retained_snapshots_for_user.return_value = []

    service.stop_user_session(session.id, user)

    assert session.status == "stopped"
    assert session.stop_reason == "user_stopped"
    assert session.snapshot_retained is False
    assert session.snapshot_archived_at is not None
    assert machine.cooldown_until is not None
    service.repo.set_machine_status.assert_called_once_with(machine, "suspended")


def test_stop_session_retains_snapshot_when_requested() -> None:
    service = _service()
    user = SimpleNamespace(id=uuid4(), balance=1000)
    machine_id = uuid4()
    now = datetime.utcnow()
    session = SimpleNamespace(
        id=uuid4(),
        user_id=user.id,
        user=user,
        machine_id=machine_id,
        status="active",
        ended_at=None,
        started_at=now,
        billing_tier="basic",
        play_rate_per_minute=35,
        billing_started_at=now,
        charged_minutes=0,
        charged_amount=0,
        free_minutes_used=0,
        last_billed_at=None,
        disconnected_at=None,
        grace_period_seconds=300,
        max_session_seconds=14400,
        idle_stop_seconds=900,
        idle_warning_seconds=600,
        last_stream_activity_at=now,
        cooldown_seconds=60,
        snapshot_active_limit=1,
        refunded_amount=0,
    )
    machine = SimpleNamespace(id=machine_id, status="running", cooldown_until=None)
    service.repo.get_session_by_id.return_value = session
    service.repo.get_machine_by_id.return_value = machine
    service.repo.get_daily_billing_totals.return_value = (0, 0)
    service.repo.list_retained_snapshots_for_user.return_value = []

    service.stop_user_session(session.id, user, retain_snapshot=True)

    assert session.status == "stopped"
    assert session.stop_reason == "user_stopped"
    assert session.snapshot_retained is True
    assert session.snapshot_archived_at is None
    assert machine.cooldown_until is not None
    service.repo.set_machine_status.assert_called_once_with(machine, "suspended")


def test_stop_pre_stream_session_releases_machine_immediately() -> None:
    service = _service()
    user = SimpleNamespace(id=uuid4(), balance=1000)
    machine_id = uuid4()
    now = datetime.utcnow()
    session = SimpleNamespace(
        id=uuid4(),
        user_id=user.id,
        user=user,
        machine_id=machine_id,
        status="active",
        ended_at=None,
        started_at=now,
        billing_tier="basic",
        play_rate_per_minute=35,
        billing_started_at=None,
        charged_minutes=0,
        charged_amount=0,
        free_minutes_used=0,
        trial_eligible=False,
        last_billed_at=None,
        disconnected_at=None,
        connection_state="waiting_vpn",
        lifecycle_state="vm_running",
        billing_state="waiting_stream",
        grace_period_seconds=300,
        max_session_seconds=14400,
        idle_stop_seconds=900,
        idle_warning_seconds=600,
        last_stream_activity_at=None,
        cooldown_seconds=60,
        snapshot_active_limit=0,
        refunded_amount=0,
    )
    machine = SimpleNamespace(id=machine_id, status="running", cooldown_until=None)
    service.repo.get_session_by_id.return_value = session
    service.repo.get_machine_by_id.return_value = machine
    service.repo.get_daily_billing_totals.return_value = (0, 0)

    service.stop_user_session(session.id, user)

    assert session.status == "stopped"
    assert session.stop_reason == "user_stopped"
    assert session.billing_started_at is None
    assert session.charged_amount == 0
    assert machine.cooldown_until is None
    service.repo.set_machine_status.assert_called_once_with(machine, "idle")


def test_failed_short_session_refunds_charged_amount() -> None:
    service = _service()
    user = SimpleNamespace(id=uuid4(), balance=0)
    machine_id = uuid4()
    now = datetime.utcnow()
    started_at = now - timedelta(seconds=90)
    session = SimpleNamespace(
        id=uuid4(),
        user_id=user.id,
        user=user,
        machine_id=machine_id,
        status="active",
        ended_at=None,
        started_at=started_at,
        billing_tier="basic",
        play_rate_per_minute=35,
        billing_started_at=started_at,
        charged_minutes=2,
        charged_amount=70,
        free_minutes_used=0,
        last_billed_at=None,
        disconnected_at=None,
        grace_period_seconds=300,
        max_session_seconds=14400,
        idle_stop_seconds=900,
        idle_warning_seconds=600,
        last_stream_activity_at=now,
        cooldown_seconds=0,
        snapshot_active_limit=1,
        refunded_amount=0,
    )
    machine = SimpleNamespace(id=machine_id, status="running", cooldown_until=None)
    service.repo.get_session_by_id.return_value = session
    service.repo.get_machine_by_id.return_value = machine
    service.repo.get_daily_billing_totals.return_value = (0, 0)

    service.fail_session_as_admin(session.id, "vm_failed")

    assert session.status == "failed"
    assert session.lifecycle_state == "refunded"
    assert session.refund_status == "refunded"
    assert session.refunded_amount == 70
    assert user.balance == 70
    assert service.repo.add_billing_event.call_args.kwargs["event_type"] == "refund"


def test_finish_session_clamps_timezone_shifted_end_time() -> None:
    service = _service()
    user = SimpleNamespace(id=uuid4(), balance=1000)
    machine_id = uuid4()
    started_at = datetime.utcnow().replace(tzinfo=None) + timedelta(hours=7)
    ended_at = started_at - timedelta(hours=6)
    session = SimpleNamespace(
        id=uuid4(),
        user_id=user.id,
        user=user,
        machine_id=machine_id,
        status="active",
        ended_at=None,
        started_at=started_at.replace(tzinfo=None),
        billing_started_at=None,
        disconnected_at=None,
        cooldown_seconds=0,
        snapshot_active_limit=0,
        refunded_amount=0,
    )
    machine = SimpleNamespace(id=machine_id, status="running", cooldown_until=None)
    service.repo.get_machine_by_id.return_value = machine

    service._finish_session(session, ended_at, "user_stopped", current_user=user)

    assert session.status == "stopped"
    assert service._utc_naive(session.ended_at) == service._utc_naive(session.started_at) + timedelta(seconds=1)
