from datetime import date, datetime, timedelta, timezone
from typing import List, Set
from zoneinfo import ZoneInfo
from app.core.config import settings

COMPANY_TZ = ZoneInfo(settings.TZ)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def now_company() -> datetime:
    return datetime.now(COMPANY_TZ)


def to_company_tz(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(COMPANY_TZ)


def get_working_days_between(
    start_date: date,
    end_date: date,
    weekend_days: str = "5,6",
    holiday_dates: Set[date] = None
) -> int:
    """
    Counts working days between start_date and end_date (inclusive),
    strictly skipping configured weekend days (default Sat-Sun) and public holidays.
    """
    if start_date > end_date:
        return 0

    weekends = {int(x.strip()) for x in weekend_days.split(",") if x.strip()}
    holidays = holiday_dates or set()

    current = start_date
    working_days = 0
    while current <= end_date:
        # Python weekday: Monday is 0, Sunday is 6
        if current.weekday() not in weekends and current not in holidays:
            working_days += 1
        current += timedelta(days=1)

    return working_days
