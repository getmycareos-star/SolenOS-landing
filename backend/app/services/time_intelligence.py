from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Optional
from dateutil import parser as dateutil_parser
from dateutil.tz import gettz


TIMEZONE_ABBREVIATIONS = {
    "ET": "America/New_York",
    "CT": "America/Chicago",
    "MT": "America/Denver",
    "PT": "America/Los_Angeles",
    "AKT": "America/Anchorage",
    "HT": "Pacific/Honolulu",
    "EDT": "America/New_York",
    "CDT": "America/Chicago",
    "MDT": "America/Denver",
    "PDT": "America/Los_Angeles",
}

US_TIMEZONES = [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Anchorage",
    "Pacific/Honolulu",
]

TIMESTAMP_PROVENANCE = {
    "caregiver_entered": "Entered by caregiver",
    "extracted_document": "Extracted from document",
    "extracted_discharge": "Extracted from hospital discharge summary",
    "imported_calendar": "Imported from calendar",
    "imported_provider": "Imported from healthcare provider",
    "ai_estimated": "Estimated by AI",
    "system_generated": "System-generated",
}

CARE_WINDOW_DEFINITIONS = {
    "hospital_discharge": [
        {"window_type": "30_day_post_discharge", "days": 30},
        {"window_type": "7_day_follow_up", "days": 7},
    ],
    "discharge": [
        {"window_type": "30_day_post_discharge", "days": 30},
        {"window_type": "7_day_follow_up", "days": 7},
    ],
    "medication_change": [
        {"window_type": "48_hour_medication_monitoring", "hours": 48},
    ],
    "medication_adjustment": [
        {"window_type": "48_hour_medication_monitoring", "hours": 48},
    ],
    "appointment": [
        {"window_type": "follow_up_window", "days": 14},
    ],
    "clinic_visit": [
        {"window_type": "follow_up_window", "days": 14},
    ],
    "fall": [
        {"window_type": "24_hour_observation", "hours": 24},
    ],
    "injury": [
        {"window_type": "24_hour_observation", "hours": 24},
    ],
    "hospital_admission": [
        {"window_type": "acute_care_period", "days": 30},
    ],
    "observation": [],
}

APPOINTMENT_LIFECYCLE = [
    "scheduled",
    "upcoming",
    "today",
    "completed",
    "awaiting_results",
    "resolved",
    "historical",
]

EVENT_LIFECYCLE = [
    "recorded",
    "pending_review",
    "confirmed",
    "resolved",
    "historical",
]


def get_timezone(tz_input: Optional[str]) -> Optional[timezone]:
    if not tz_input:
        return None
    tz_input = tz_input.strip()
    if tz_input.upper() in TIMEZONE_ABBREVIATIONS:
        tz_input = TIMEZONE_ABBREVIATIONS[tz_input.upper()]
    tz = gettz(tz_input)
    if tz is None:
        return None
    return tz


def now_in_timezone(tz_input: Optional[str]) -> datetime:
    tz = get_timezone(tz_input) or timezone.utc
    return datetime.now(tz)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def to_utc(dt: datetime, source_tz: Optional[str] = None) -> datetime:
    if dt.tzinfo is None:
        tz = get_timezone(source_tz) or timezone.utc
        dt = dt.replace(tzinfo=tz)
    return dt.astimezone(timezone.utc)


def from_utc(dt: datetime, target_tz: Optional[str]) -> datetime:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    tz = get_timezone(target_tz)
    if tz is None:
        return dt
    return dt.astimezone(tz)


def format_local(dt: datetime, target_tz: Optional[str]) -> str:
    local_dt = from_utc(dt, target_tz)
    return local_dt.strftime("%B %d, %Y at %I:%M %p %Z")


def format_date_local(dt: datetime, target_tz: Optional[str]) -> str:
    local_dt = from_utc(dt, target_tz)
    return local_dt.strftime("%B %d, %Y")


def format_time_local(dt: datetime, target_tz: Optional[str]) -> str:
    local_dt = from_utc(dt, target_tz)
    return local_dt.strftime("%I:%M %p %Z")


def validate_iana_timezone(tz: Optional[str]) -> Optional[str]:
    if not tz:
        return None
    if tz in US_TIMEZONES:
        return tz
    return None


def parse_natural_language_time(
    text: str,
    reference_time: Optional[datetime] = None,
    source_tz: Optional[str] = None,
) -> dict:
    if reference_time is None:
        reference_time = utc_now()

    text_lower = text.lower().strip()
    confidence = 0.9
    interpretation = ""
    parsed_dt = None
    is_ambiguous = False
    tz = get_timezone(source_tz)

    today = reference_time.date()
    current_year = reference_time.year
    weekday_names = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

    if text_lower in ["today", "this day"]:
        parsed_dt = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)
        interpretation = f"Today ({today.isoformat()})"
    elif text_lower == "yesterday":
        yesterday = today - timedelta(days=1)
        parsed_dt = datetime(yesterday.year, yesterday.month, yesterday.day, tzinfo=timezone.utc)
        interpretation = f"Yesterday ({yesterday.isoformat()})"
    elif text_lower == "tomorrow":
        tomorrow = today + timedelta(days=1)
        parsed_dt = datetime(tomorrow.year, tomorrow.month, tomorrow.day, tzinfo=timezone.utc)
        interpretation = f"Tomorrow ({tomorrow.isoformat()})"
    elif text_lower in ["tonight", "this evening"]:
        parsed_dt = datetime(today.year, today.month, today.day, 20, 0, tzinfo=timezone.utc)
        interpretation = f"Tonight at 8:00 PM ({today.isoformat()})"
    elif text_lower == "this morning":
        parsed_dt = datetime(today.year, today.month, today.day, 9, 0, tzinfo=timezone.utc)
        interpretation = f"This morning at 9:00 AM ({today.isoformat()})"
    elif text_lower == "this afternoon":
        parsed_dt = datetime(today.year, today.month, today.day, 14, 0, tzinfo=timezone.utc)
        interpretation = f"This afternoon at 2:00 PM ({today.isoformat()})"
    elif "earlier today" in text_lower:
        parsed_dt = datetime(today.year, today.month, today.day, 10, 0, tzinfo=timezone.utc)
        interpretation = f"Earlier today (around 10:00 AM, {today.isoformat()})"
    elif "later this week" in text_lower:
        days_ahead = 4 - today.weekday()
        if days_ahead <= 0:
            days_ahead += 7
        target = today + timedelta(days=days_ahead)
        parsed_dt = datetime(target.year, target.month, target.day, tzinfo=timezone.utc)
        interpretation = f"Later this week ({target.isoformat()})"
    else:
        next_monday = re.search(r"next\s+monday", text_lower)
        next_tuesday = re.search(r"next\s+tuesday", text_lower)
        next_wednesday = re.search(r"next\s+wednesday", text_lower)
        next_thursday = re.search(r"next\s+thursday", text_lower)
        next_friday = re.search(r"next\s+friday", text_lower)
        next_saturday = re.search(r"next\s+saturday", text_lower)
        next_sunday = re.search(r"next\s+sunday", text_lower)
        last_monday = re.search(r"last\s+monday", text_lower)
        last_tuesday = re.search(r"last\s+tuesday", text_lower)
        last_wednesday = re.search(r"last\s+wednesday", text_lower)
        last_thursday = re.search(r"last\s+thursday", text_lower)
        last_friday = re.search(r"last\s+friday", text_lower)
        last_saturday = re.search(r"last\s+saturday", text_lower)
        last_sunday = re.search(r"last\s+sunday", text_lower)
        next_week = re.search(r"next\s+week", text_lower)
        in_two_weeks = re.search(r"in\s+two\s+weeks", text_lower)
        three_months_ago = re.search(r"three\s+months\s+ago", text_lower)
        two_days_ago = re.search(r"two\s+days\s+ago", text_lower)
        three_days_ago = re.search(r"three\s+days\s+ago", text_lower)
        one_week_ago = re.search(r"one\s+week\s+ago", text_lower)
        next_month = re.search(r"next\s+month", text_lower)

        next_day_match = None
        for i, name in enumerate(weekday_names):
            pattern = re.compile(rf"next\s+{name}")
            if pattern.search(text_lower):
                next_day_match = i
                break

        last_day_match = None
        for i, name in enumerate(weekday_names):
            pattern = re.compile(rf"last\s+{name}")
            if pattern.search(text_lower):
                last_day_match = i
                break

        if next_day_match is not None:
            days_ahead = next_day_match - today.weekday()
            if days_ahead <= 0:
                days_ahead += 7
            target = today + timedelta(days=days_ahead)
            parsed_dt = datetime(target.year, target.month, target.day, tzinfo=timezone.utc)
            interpretation = f"Next {weekday_names[next_day_match].capitalize()} ({target.isoformat()})"
        elif last_day_match is not None:
            days_back = (today.weekday() - last_day_match) % 7
            if days_back == 0:
                days_back = 7
            target = today - timedelta(days=days_back)
            parsed_dt = datetime(target.year, target.month, target.day, tzinfo=timezone.utc)
            interpretation = f"Last {weekday_names[last_day_match].capitalize()} ({target.isoformat()})"
        elif next_monday:
            days_ahead = 0 - today.weekday()
            if days_ahead <= 0:
                days_ahead += 7
            target = today + timedelta(days=days_ahead)
            parsed_dt = datetime(target.year, target.month, target.day, tzinfo=timezone.utc)
            interpretation = f"Next Monday ({target.isoformat()})"
        elif next_tuesday:
            days_ahead = 1 - today.weekday()
            if days_ahead <= 0:
                days_ahead += 7
            target = today + timedelta(days=days_ahead)
            parsed_dt = datetime(target.year, target.month, target.day, tzinfo=timezone.utc)
            interpretation = f"Next Tuesday ({target.isoformat()})"
        elif next_wednesday:
            days_ahead = 2 - today.weekday()
            if days_ahead <= 0:
                days_ahead += 7
            target = today + timedelta(days=days_ahead)
            parsed_dt = datetime(target.year, target.month, target.day, tzinfo=timezone.utc)
            interpretation = f"Next Wednesday ({target.isoformat()})"
        elif next_thursday:
            days_ahead = 3 - today.weekday()
            if days_ahead <= 0:
                days_ahead += 7
            target = today + timedelta(days=days_ahead)
            parsed_dt = datetime(target.year, target.month, target.day, tzinfo=timezone.utc)
            interpretation = f"Next Thursday ({target.isoformat()})"
        elif next_friday:
            days_ahead = 4 - today.weekday()
            if days_ahead <= 0:
                days_ahead += 7
            target = today + timedelta(days=days_ahead)
            parsed_dt = datetime(target.year, target.month, target.day, tzinfo=timezone.utc)
            interpretation = f"Next Friday ({target.isoformat()})"
        elif next_saturday:
            days_ahead = 5 - today.weekday()
            if days_ahead <= 0:
                days_ahead += 7
            target = today + timedelta(days=days_ahead)
            parsed_dt = datetime(target.year, target.month, target.day, tzinfo=timezone.utc)
            interpretation = f"Next Saturday ({target.isoformat()})"
        elif next_sunday:
            days_ahead = 6 - today.weekday()
            if days_ahead <= 0:
                days_ahead += 7
            target = today + timedelta(days=days_ahead)
            parsed_dt = datetime(target.year, target.month, target.day, tzinfo=timezone.utc)
            interpretation = f"Next Sunday ({target.isoformat()})"
        elif last_monday:
            days_back = (today.weekday() - 0) % 7
            if days_back == 0:
                days_back = 7
            target = today - timedelta(days=days_back)
            parsed_dt = datetime(target.year, target.month, target.day, tzinfo=timezone.utc)
            interpretation = f"Last Monday ({target.isoformat()})"
        elif last_tuesday:
            days_back = (today.weekday() - 1) % 7
            if days_back == 0:
                days_back = 7
            target = today - timedelta(days=days_back)
            parsed_dt = datetime(target.year, target.month, target.day, tzinfo=timezone.utc)
            interpretation = f"Last Tuesday ({target.isoformat()})"
        elif last_wednesday:
            days_back = (today.weekday() - 2) % 7
            if days_back == 0:
                days_back = 7
            target = today - timedelta(days=days_back)
            parsed_dt = datetime(target.year, target.month, target.day, tzinfo=timezone.utc)
            interpretation = f"Last Wednesday ({target.isoformat()})"
        elif last_thursday:
            days_back = (today.weekday() - 3) % 7
            if days_back == 0:
                days_back = 7
            target = today - timedelta(days=days_back)
            parsed_dt = datetime(target.year, target.month, target.day, tzinfo=timezone.utc)
            interpretation = f"Last Thursday ({target.isoformat()})"
        elif last_friday:
            days_back = (today.weekday() - 4) % 7
            if days_back == 0:
                days_back = 7
            target = today - timedelta(days=days_back)
            parsed_dt = datetime(target.year, target.month, target.day, tzinfo=timezone.utc)
            interpretation = f"Last Friday ({target.isoformat()})"
        elif last_saturday:
            days_back = (today.weekday() - 5) % 7
            if days_back == 0:
                days_back = 7
            target = today - timedelta(days=days_back)
            parsed_dt = datetime(target.year, target.month, target.day, tzinfo=timezone.utc)
            interpretation = f"Last Saturday ({target.isoformat()})"
        elif last_sunday:
            days_back = (today.weekday() - 6) % 7
            if days_back == 0:
                days_back = 7
            target = today - timedelta(days=days_back)
            parsed_dt = datetime(target.year, target.month, target.day, tzinfo=timezone.utc)
            interpretation = f"Last Sunday ({target.isoformat()})"
        elif next_week:
            target = today + timedelta(weeks=1)
            parsed_dt = datetime(target.year, target.month, target.day, tzinfo=timezone.utc)
            interpretation = f"Next week ({target.isoformat()})"
        elif next_month:
            month = today.month + 1
            year = today.year
            if month > 12:
                month = 1
                year += 1
            day = min(today.day, [31, 28 + (1 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 0), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1])
            parsed_dt = datetime(year, month, day, tzinfo=timezone.utc)
            interpretation = f"Next month ({year}-{month:02d}-{day:02d})"
        elif in_two_weeks:
            target = today + timedelta(weeks=2)
            parsed_dt = datetime(target.year, target.month, target.day, tzinfo=timezone.utc)
            interpretation = f"In two weeks ({target.isoformat()})"
        elif three_months_ago:
            month = today.month - 3
            year = today.year
            if month <= 0:
                month += 12
                year -= 1
            day = min(
                today.day,
                [
                    31,
                    28 + (1 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 0),
                    31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
                ][month - 1],
            )
            parsed_dt = datetime(year, month, day, tzinfo=timezone.utc)
            interpretation = f"Three months ago ({year}-{month:02d}-{day:02d})"
        elif two_days_ago:
            target = today - timedelta(days=2)
            parsed_dt = datetime(target.year, target.month, target.day, tzinfo=timezone.utc)
            interpretation = f"Two days ago ({target.isoformat()})"
        elif three_days_ago:
            target = today - timedelta(days=3)
            parsed_dt = datetime(target.year, target.month, target.day, tzinfo=timezone.utc)
            interpretation = f"Three days ago ({target.isoformat()})"
        elif one_week_ago:
            target = today - timedelta(weeks=1)
            parsed_dt = datetime(target.year, target.month, target.day, tzinfo=timezone.utc)
            interpretation = f"One week ago ({target.isoformat()})"
        else:
            try:
                parsed_dt = dateutil_parser.parse(text, fuzzy=True)
                if parsed_dt.year == current_year:
                    pass
                elif parsed_dt.year < current_year - 5 or parsed_dt.year > current_year + 5:
                    is_ambiguous = True
                    interpretation = f"Date may be ambiguous: {parsed_dt.isoformat()}"
                else:
                    interpretation = f"Parsed date: {parsed_dt.isoformat()}"
                confidence = 0.7
            except Exception:
                interpretation = "Could not parse date"
                confidence = 0.0
                parsed_dt = None

    return {
        "original_text": text,
        "parsed_datetime": parsed_dt.isoformat() if parsed_dt else None,
        "timezone": tz.tzname(datetime.now(tz)) if tz else None,
        "timezone_id": source_tz,
        "confidence": confidence,
        "interpretation": interpretation,
        "is_ambiguous": is_ambiguous,
        "provenance": "ai_estimated" if confidence < 1.0 else "caregiver_entered",
    }


def calculate_care_windows(event_type: str, event_date: datetime) -> list[dict]:
    windows = []
    start = event_date
    event_key = event_type.lower().replace(" ", "_")

    for key, window_list in CARE_WINDOW_DEFINITIONS.items():
        if key in event_key or event_key in key:
            for w in window_list:
                delta = timedelta(days=w.get("days", 0), hours=w.get("hours", 0))
                windows.append(
                    {
                        "window_type": w["window_type"],
                        "started_at": start.isoformat(),
                        "ends_at": (start + delta).isoformat(),
                        "status": "active",
                        "provenance": "system_generated",
                    }
                )
            break

    return windows


def get_active_care_windows(
    windows: list[dict], reference_time: Optional[datetime] = None
) -> list[dict]:
    if reference_time is None:
        reference_time = utc_now()
    active = []
    for w in windows:
        ends_at = datetime.fromisoformat(w["ends_at"])
        if ends_at.tzinfo is None:
            ends_at = ends_at.replace(tzinfo=timezone.utc)
        if ends_at > reference_time:
            active.append(w)
    return active


def get_expired_care_windows(
    windows: list[dict], reference_time: Optional[datetime] = None
) -> list[dict]:
    if reference_time is None:
        reference_time = utc_now()
    expired = []
    for w in windows:
        ends_at = datetime.fromisoformat(w["ends_at"])
        if ends_at.tzinfo is None:
            ends_at = ends_at.replace(tzinfo=timezone.utc)
        if ends_at <= reference_time and w.get("status") == "active":
            expired.append(w)
    return expired


def generate_daily_intelligence(
    person_id: str,
    events: list,
    appointments: list,
    windows: list[dict],
    reference_time: Optional[datetime] = None,
) -> dict:
    if reference_time is None:
        reference_time = utc_now()
    today = reference_time.date()
    overdue = []
    upcoming = []
    active_windows = get_active_care_windows(windows, reference_time)
    expired_windows = get_expired_care_windows(windows, reference_time)

    for apt in appointments:
        apt_time = apt.get("scheduled_at")
        if isinstance(apt_time, str):
            apt_time = datetime.fromisoformat(apt_time)
        if apt_time and apt_time.tzinfo is None:
            apt_time = apt_time.replace(tzinfo=timezone.utc)
        if apt_time and apt_time < reference_time and apt.get("status") in ("scheduled", "upcoming"):
            overdue.append(
                {
                    "type": "appointment",
                    "title": apt.get("title"),
                    "scheduled_at": apt_time.isoformat(),
                    "location": apt.get("location"),
                    "status": apt.get("status"),
                }
            )
        elif apt_time and apt_time.date() == today and apt.get("status") == "scheduled":
            upcoming.append(
                {
                    "type": "appointment",
                    "title": apt.get("title"),
                    "scheduled_at": apt_time.isoformat(),
                    "location": apt.get("location"),
                    "status": apt.get("status"),
                }
            )

    for evt in events:
        evt_time = evt.get("occurred_at")
        if isinstance(evt_time, str):
            evt_time = datetime.fromisoformat(evt_time)
        if evt_time and evt_time.tzinfo is None:
            evt_time = evt_time.replace(tzinfo=timezone.utc)
        if evt_time and evt_time.date() == today:
            upcoming.append(
                {
                    "type": "event",
                    "title": evt.get("title"),
                    "occurred_at": evt_time.isoformat(),
                    "status": evt.get("status"),
                    "event_type": evt.get("event_type"),
                }
            )

    summary_parts = []
    if overdue:
        summary_parts.append(f"{len(overdue)} overdue appointment(s)")
    if upcoming:
        summary_parts.append(f"{len(upcoming)} item(s) today")
    if active_windows:
        summary_parts.append(f"{len(active_windows)} active care window(s)")
    if expired_windows:
        summary_parts.append(f"{len(expired_windows)} care window(s) completed")
    summary = ". ".join(summary_parts) if summary_parts else "No special items today."

    return {
        "person_id": person_id,
        "intelligence_date": datetime(
            today.year, today.month, today.day, tzinfo=timezone.utc
        ).isoformat(),
        "overdue_items": overdue,
        "upcoming_items": upcoming,
        "active_windows": active_windows,
        "expired_windows": expired_windows,
        "daily_summary": summary,
    }


def update_appointment_lifecycle(appointment: dict, reference_time: Optional[datetime] = None) -> str:
    if reference_time is None:
        reference_time = utc_now()

    scheduled_at = appointment.get("scheduled_at")
    if isinstance(scheduled_at, str):
        scheduled_at = datetime.fromisoformat(scheduled_at)
    if scheduled_at and scheduled_at.tzinfo is None:
        scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)

    current_status = appointment.get("status", "scheduled")

    if current_status in ("completed", "resolved", "historical"):
        return current_status

    if scheduled_at is None:
        return current_status

    today_start = reference_time.replace(hour=0, minute=0, second=0, microsecond=0)

    if scheduled_at < today_start:
        if current_status == "scheduled":
            return "overdue"
        return current_status
    elif scheduled_at.date() == reference_time.date():
        if current_status in ("scheduled", "upcoming"):
            return "today"
        return current_status
    elif scheduled_at > reference_time:
        if current_status == "scheduled":
            return "upcoming"
        return current_status

    return current_status


def update_event_lifecycle(event: dict, reference_time: Optional[datetime] = None) -> str:
    if reference_time is None:
        reference_time = utc_now()

    occurred_at = event.get("occurred_at")
    if isinstance(occurred_at, str):
        occurred_at = datetime.fromisoformat(occurred_at)
    if occurred_at and occurred_at.tzinfo is None:
        occurred_at = occurred_at.replace(tzinfo=timezone.utc)

    current_status = event.get("status", "recorded")

    if current_status in ("resolved", "historical"):
        return current_status

    if occurred_at is None:
        return current_status

    one_week_ago = reference_time - timedelta(weeks=1)
    if occurred_at < one_week_ago:
        return "historical"

    return current_status


def infer_temporal_relationship(event_a: dict, event_b: dict) -> Optional[dict]:
    time_a = event_a.get("occurred_at") or event_a.get("scheduled_at")
    time_b = event_b.get("occurred_at") or event_b.get("scheduled_at")

    if isinstance(time_a, str):
        time_a = datetime.fromisoformat(time_a)
    if isinstance(time_b, str):
        time_b = datetime.fromisoformat(time_b)

    if time_a is None or time_b is None:
        return None

    if time_a.tzinfo is None:
        time_a = time_a.replace(tzinfo=timezone.utc)
    if time_b.tzinfo is None:
        time_b = time_b.replace(tzinfo=timezone.utc)

    diff = (time_b - time_a).total_seconds()

    if abs(diff) < 3600:
        relationship = "simultaneous"
    elif diff > 0:
        if diff < 86400:
            relationship = "followed_shortly_after"
        elif diff < 604800:
            relationship = "followed_within_week"
        else:
            relationship = "followed_later"
    else:
        if abs(diff) < 86400:
            relationship = "preceded_shortly_before"
        elif abs(diff) < 604800:
            relationship = "preceded_within_week"
        else:
            relationship = "preceded_earlier"

    return {
        "event_a_id": event_a.get("id"),
        "event_b_id": event_b.get("id"),
        "relationship": relationship,
        "time_difference_seconds": diff,
        "time_a": time_a.isoformat(),
        "time_b": time_b.isoformat(),
    }


def detect_time_patterns(events: list, window_days: int = 30) -> list[dict]:
    if not events:
        return []

    reference = utc_now()
    cutoff = reference - timedelta(days=window_days)

    recent_events = []
    for e in events:
        evt_time = e.get("occurred_at")
        if isinstance(evt_time, str):
            evt_time = datetime.fromisoformat(evt_time)
        if evt_time and evt_time.tzinfo is None:
            evt_time = evt_time.replace(tzinfo=timezone.utc)
        if evt_time and evt_time >= cutoff:
            recent_events.append(e)

    patterns = []

    time_of_day_counts: dict[str, int] = {}
    day_of_week_counts: dict[str, int] = {}
    event_type_counts: dict[str, int] = {}

    for e in recent_events:
        evt_time = e.get("occurred_at")
        if isinstance(evt_time, str):
            evt_time = datetime.fromisoformat(evt_time)
        if evt_time and evt_time.tzinfo is None:
            evt_time = evt_time.replace(tzinfo=timezone.utc)

        if evt_time:
            hour = evt_time.hour
            if 6 <= hour < 12:
                period = "morning"
            elif 12 <= hour < 17:
                period = "afternoon"
            elif 17 <= hour < 21:
                period = "evening"
            else:
                period = "night"
            time_of_day_counts[period] = time_of_day_counts.get(period, 0) + 1

            day_name = evt_time.strftime("%A")
            day_of_week_counts[day_name] = day_of_week_counts.get(day_name, 0) + 1

        evt_type = e.get("event_type", "unknown")
        event_type_counts[evt_type] = event_type_counts.get(evt_type, 0) + 1

    for period, count in sorted(time_of_day_counts.items(), key=lambda x: x[1], reverse=True):
        if count >= 3:
            patterns.append({
                "pattern_type": "time_of_day",
                "label": f"Events frequently occur in the {period}",
                "period": period,
                "count": count,
                "confidence": min(count / 10.0, 1.0),
                "window_days": window_days,
            })

    for day, count in sorted(day_of_week_counts.items(), key=lambda x: x[1], reverse=True):
        if count >= 3:
            patterns.append({
                "pattern_type": "day_of_week",
                "label": f"Events frequently occur on {day}s",
                "day": day,
                "count": count,
                "confidence": min(count / 10.0, 1.0),
                "window_days": window_days,
            })

    for evt_type, count in sorted(event_type_counts.items(), key=lambda x: x[1], reverse=True):
        if count >= 3:
            patterns.append({
                "pattern_type": "event_frequency",
                "label": f"Recurring {evt_type} events",
                "event_type": evt_type,
                "count": count,
                "confidence": min(count / 10.0, 1.0),
                "window_days": window_days,
            })

    return patterns


def natural_language_time_ago(reference: datetime, target: datetime) -> str:
    diff = (reference - target).total_seconds()

    if diff < 0:
        return "in the future"

    if diff < 60:
        return "just now"
    elif diff < 3600:
        minutes = int(diff / 60)
        return f"{minutes} minute{'s' if minutes != 1 else ''} ago"
    elif diff < 86400:
        hours = int(diff / 3600)
        return f"{hours} hour{'s' if hours != 1 else ''} ago"
    elif diff < 604800:
        days = int(diff / 86400)
        if days == 1:
            return "yesterday"
        return f"{days} days ago"
    elif diff < 2592000:
        weeks = int(diff / 604800)
        return f"{weeks} week{'s' if weeks != 1 else ''} ago"
    elif diff < 31536000:
        months = int(diff / 2592000)
        return f"{months} month{'s' if months != 1 else ''} ago"
    else:
        years = int(diff / 31536000)
        return f"{years} year{'s' if years != 1 else ''} ago"


def natural_language_time_until(reference: datetime, target: datetime) -> str:
    diff = (target - reference).total_seconds()

    if diff < 0:
        return "already passed"

    if diff < 60:
        return "in less than a minute"
    elif diff < 3600:
        minutes = int(diff / 60)
        return f"in {minutes} minute{'s' if minutes != 1 else ''}"
    elif diff < 86400:
        hours = int(diff / 3600)
        return f"in {hours} hour{'s' if hours != 1 else ''}"
    elif diff < 604800:
        days = int(diff / 86400)
        if days == 1:
            return "tomorrow"
        return f"in {days} days"
    elif diff < 2592000:
        weeks = int(diff / 604800)
        return f"in {weeks} week{'s' if weeks != 1 else ''}"
    elif diff < 31536000:
        months = int(diff / 2592000)
        return f"in {months} month{'s' if months != 1 else ''}"
    else:
        years = int(diff / 31536000)
        return f"in {years} year{'s' if years != 1 else ''}"
