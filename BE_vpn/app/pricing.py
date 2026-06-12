from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from math import ceil
from zoneinfo import ZoneInfo


VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")
TRIAL_DAILY_MINUTES = 15
SAMPLE_HIGH_END_RATE_PER_MINUTE = 250
DEFAULT_PAYG_RATE_PER_MINUTE = 80


@dataclass(frozen=True)
class PricingPolicy:
    code: str
    display_name: str
    monthly_price_vnd: int
    discount_percent: int
    allowed_region_keys: tuple[str, ...]
    snapshot_policy: str
    queue_policy: str
    max_session_seconds: int
    queue_priority: int
    max_concurrent_sessions: int
    snapshot_active_limit: int
    daily_cap_vnd: int = 0
    grace_period_seconds: int = 5 * 60
    idle_warning_seconds: int = 10 * 60
    idle_stop_seconds: int = 15 * 60
    cooldown_seconds: int = 60

    @property
    def play_rate_per_minute(self) -> int:
        return discounted_rate(SAMPLE_HIGH_END_RATE_PER_MINUTE, self)

    @property
    def hourly_estimate(self) -> int:
        return self.play_rate_per_minute * 60

    @property
    def allowed_gpu_tier(self) -> str:
        return "All GPU"

    @property
    def allowed_regions(self) -> list[str]:
        if "global" in self.allowed_region_keys:
            return ["All regions"]
        labels = {
            "vn": "VN",
            "sg": "SG",
            "jp": "JP",
            "kr": "KR",
            "hk": "HK",
            "us": "US",
            "au": "AU",
            "eu": "EU",
        }
        return [labels.get(region, region.upper()) for region in self.allowed_region_keys]


FREE_POLICY = PricingPolicy(
    code="free",
    display_name="Free/PAYG",
    monthly_price_vnd=0,
    discount_percent=0,
    allowed_region_keys=("global",),
    snapshot_policy="none",
    queue_policy="fifo",
    max_session_seconds=2 * 60 * 60,
    queue_priority=0,
    max_concurrent_sessions=1,
    snapshot_active_limit=0,
)

POLICIES: dict[str, PricingPolicy] = {
    "free": FREE_POLICY,
    "basic": PricingPolicy(
        code="basic",
        display_name="Basic",
        monthly_price_vnd=49000,
        discount_percent=15,
        allowed_region_keys=("vn", "sg"),
        snapshot_policy="standard",
        queue_policy="light_priority",
        max_session_seconds=4 * 60 * 60,
        queue_priority=20,
        max_concurrent_sessions=1,
        snapshot_active_limit=1,
    ),
    "pro": PricingPolicy(
        code="pro",
        display_name="Pro",
        monthly_price_vnd=99000,
        discount_percent=25,
        allowed_region_keys=("vn", "sg", "jp", "kr", "hk"),
        snapshot_policy="realtime_resume",
        queue_policy="priority",
        max_session_seconds=8 * 60 * 60,
        queue_priority=50,
        max_concurrent_sessions=2,
        snapshot_active_limit=5,
    ),
    "premium": PricingPolicy(
        code="premium",
        display_name="Premium",
        monthly_price_vnd=199000,
        discount_percent=36,
        allowed_region_keys=("global",),
        snapshot_policy="soft_unlimited_archive_old",
        queue_policy="instant_reserve",
        max_session_seconds=24 * 60 * 60,
        queue_priority=100,
        max_concurrent_sessions=3,
        snapshot_active_limit=20,
    ),
}


def get_policy(code: str | None) -> PricingPolicy:
    return POLICIES.get((code or "free").lower(), FREE_POLICY)


def get_plan_policy(code: str | None) -> PricingPolicy:
    return POLICIES.get((code or "").lower(), FREE_POLICY)


def billing_day(value: datetime | None = None) -> date:
    current = value or datetime.utcnow()
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    return current.astimezone(VN_TZ).date()


def local_day_bounds_utc(day: date) -> tuple[datetime, datetime]:
    start_local = datetime.combine(day, time.min, tzinfo=VN_TZ)
    end_local = start_local.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    return (
        start_local.astimezone(timezone.utc).replace(tzinfo=None),
        end_local.astimezone(timezone.utc).replace(tzinfo=None),
    )


def machine_gpu_tier(gpu: str | None) -> int | None:
    value = str(gpu or "")
    match = re.search(r"(?:RTX|GTX)?\s*(20[068]0|30[6789]0|40[689]0)", value, flags=re.IGNORECASE)
    if match:
        return int(match.group(1))
    for tier in (2060, 2080, 3060, 3070, 3080, 3090, 4080, 4090):
        if str(tier) in value:
            return tier
    return None


def base_rate_for_gpu(gpu: str | None, override: int | None = None) -> int:
    if override and override > 0:
        return int(override)

    tier = machine_gpu_tier(gpu)
    rates = {
        2060: 50,
        2080: 60,
        3060: 50,
        3070: 80,
        3080: 100,
        3090: 120,
        4080: 140,
        4090: 250,
    }
    if tier in rates:
        return rates[tier]
    value = str(gpu or "").lower()
    if "t4" in value:
        return 50
    return DEFAULT_PAYG_RATE_PER_MINUTE


def discounted_rate(base_rate_per_minute: int, policy: PricingPolicy) -> int:
    base_rate = max(0, int(base_rate_per_minute or DEFAULT_PAYG_RATE_PER_MINUTE))
    discount = min(95, max(0, int(policy.discount_percent or 0)))
    if discount <= 0 or base_rate <= 0:
        return base_rate
    return max(1, ceil(base_rate * (100 - discount) / 100))


def machine_region_key(region: str | None, location: str | None = None) -> str:
    value = f"{region or ''} {location or ''}".lower()
    if any(token in value for token in ("vietnam", "viet nam", "vn", "hanoi", "ha noi", "hcmc", "ho chi minh", "saigon")):
        return "vn"
    if any(token in value for token in ("singapore", "sg")):
        return "sg"
    if any(token in value for token in ("japan", "tokyo", "osaka", "jp")):
        return "jp"
    if any(token in value for token in ("korea", "seoul", "kr")):
        return "kr"
    if any(token in value for token in ("hong kong", "hongkong", "hk")):
        return "hk"
    if any(token in value for token in ("united states", "usa", "us", "new york", "los angeles")):
        return "us"
    if any(token in value for token in ("australia", "sydney", "au")):
        return "au"
    return "global"


def policy_allows_machine(
    policy: PricingPolicy,
    gpu: str | None,
    region: str | None,
    location: str | None = None,
) -> tuple[bool, str | None]:
    return True, None
