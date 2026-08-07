from datetime import datetime, timedelta, timezone
from app.services.time_intelligence import (
    get_timezone,
    utc_now,
    to_utc,
    from_utc,
    format_local,
    validate_iana_timezone,
    parse_natural_language_time,
    calculate_care_windows,
    get_active_care_windows,
    get_expired_care_windows,
    generate_daily_intelligence,
    update_appointment_lifecycle,
    update_event_lifecycle,
    infer_temporal_relationship,
    detect_time_patterns,
    natural_language_time_ago,
    natural_language_time_until,
)
from app.services.location_intelligence import (
    validate_timezone,
    get_timezone_for_state,
    parse_location_text,
    detect_care_transition,
    infer_transition_type,
    is_care_transition_significant,
    get_location_context,
    get_nearby_providers,
    enrich_location_with_geographic_intelligence,
    format_location_for_display,
)


def test_get_timezone_iana_identifiers():
    assert get_timezone("America/New_York") is not None
    assert get_timezone("America/Chicago") is not None
    assert get_timezone("America/Denver") is not None
    assert get_timezone("America/Los_Angeles") is not None
    assert get_timezone("America/Anchorage") is not None
    assert get_timezone("Pacific/Honolulu") is not None


def test_get_timezone_abbreviations():
    assert get_timezone("ET") is not None
    assert get_timezone("CT") is not None
    assert get_timezone("PT") is not None
    assert get_timezone("AKT") is not None


def test_utc_now_is_timezone_aware():
    now = utc_now()
    assert now.tzinfo is timezone.utc


def test_to_utc_converts_naive_datetime():
    naive = datetime(2026, 1, 1, 12, 0, 0)
    utc_dt = to_utc(naive, "America/New_York")
    assert utc_dt.tzinfo is timezone.utc
    assert utc_dt.hour == 17


def test_from_utc_converts_to_local():
    utc_dt = datetime(2026, 1, 1, 17, 0, 0, tzinfo=timezone.utc)
    local = from_utc(utc_dt, "America/New_York")
    assert local.hour == 12


def test_format_local_returns_string():
    utc_dt = datetime(2026, 1, 1, 17, 0, 0, tzinfo=timezone.utc)
    result = format_local(utc_dt, "America/New_York")
    assert isinstance(result, str)
    assert "2026" in result


def test_validate_iana_timezone():
    assert validate_iana_timezone("America/New_York") == "America/New_York"
    assert validate_iana_timezone("Invalid/Zone") is None
    assert validate_iana_timezone(None) is None


def test_parse_natural_language_today():
    ref = datetime(2026, 8, 7, 12, 0, 0, tzinfo=timezone.utc)
    result = parse_natural_language_time("today", ref)
    assert result["parsed_datetime"] is not None
    assert "Today" in result["interpretation"]
    assert result["confidence"] >= 0.9


def test_parse_natural_language_yesterday():
    ref = datetime(2026, 8, 7, 12, 0, 0, tzinfo=timezone.utc)
    result = parse_natural_language_time("yesterday", ref)
    assert result["parsed_datetime"] is not None
    assert "Yesterday" in result["interpretation"]


def test_parse_natural_language_tomorrow():
    ref = datetime(2026, 8, 7, 12, 0, 0, tzinfo=timezone.utc)
    result = parse_natural_language_time("tomorrow", ref)
    assert result["parsed_datetime"] is not None
    assert "Tomorrow" in result["interpretation"]


def test_parse_natural_language_tonight():
    ref = datetime(2026, 8, 7, 12, 0, 0, tzinfo=timezone.utc)
    result = parse_natural_language_time("tonight", ref)
    assert result["parsed_datetime"] is not None
    assert "Tonight" in result["interpretation"]


def test_parse_natural_language_next_monday():
    ref = datetime(2026, 8, 7, 12, 0, 0, tzinfo=timezone.utc)
    result = parse_natural_language_time("next monday", ref)
    assert result["parsed_datetime"] is not None
    assert "Next Monday" in result["interpretation"]


def test_parse_natural_language_next_friday():
    ref = datetime(2026, 8, 7, 12, 0, 0, tzinfo=timezone.utc)
    result = parse_natural_language_time("next friday", ref)
    assert result["parsed_datetime"] is not None
    assert "Next Friday" in result["interpretation"]


def test_parse_natural_language_last_friday():
    ref = datetime(2026, 8, 7, 12, 0, 0, tzinfo=timezone.utc)
    result = parse_natural_language_time("last friday", ref)
    assert result["parsed_datetime"] is not None
    assert "Last Friday" in result["interpretation"]


def test_parse_natural_language_in_two_weeks():
    ref = datetime(2026, 8, 7, 12, 0, 0, tzinfo=timezone.utc)
    result = parse_natural_language_time("in two weeks", ref)
    assert result["parsed_datetime"] is not None
    assert "two weeks" in result["interpretation"]


def test_parse_natural_language_three_months_ago():
    ref = datetime(2026, 8, 7, 12, 0, 0, tzinfo=timezone.utc)
    result = parse_natural_language_time("three months ago", ref)
    assert result["parsed_datetime"] is not None
    parsed = datetime.fromisoformat(result["parsed_datetime"])
    assert parsed.month == 5


def test_parse_natural_language_unrecognized():
    ref = datetime(2026, 8, 7, 12, 0, 0, tzinfo=timezone.utc)
    result = parse_natural_language_time("xyzzy", ref)
    assert result["confidence"] == 0.0
    assert result["parsed_datetime"] is None


def test_calculate_care_windows_hospital_discharge():
    dt = datetime(2026, 8, 7, 12, 0, 0, tzinfo=timezone.utc)
    windows = calculate_care_windows("hospital_discharge", dt)
    assert len(windows) == 2
    window_types = {w["window_type"] for w in windows}
    assert "30_day_post_discharge" in window_types
    assert "7_day_follow_up" in window_types


def test_calculate_care_windows_medication_change():
    dt = datetime(2026, 8, 7, 12, 0, 0, tzinfo=timezone.utc)
    windows = calculate_care_windows("medication_change", dt)
    assert len(windows) == 1
    assert windows[0]["window_type"] == "48_hour_medication_monitoring"


def test_calculate_care_windows_fall():
    dt = datetime(2026, 8, 7, 12, 0, 0, tzinfo=timezone.utc)
    windows = calculate_care_windows("fall", dt)
    assert len(windows) == 1
    assert windows[0]["window_type"] == "24_hour_observation"


def test_get_active_care_windows():
    now = datetime(2026, 8, 7, 12, 0, 0, tzinfo=timezone.utc)
    windows = [
        {"ends_at": (now + timedelta(hours=1)).isoformat(), "status": "active"},
        {"ends_at": (now - timedelta(hours=1)).isoformat(), "status": "active"},
    ]
    active = get_active_care_windows(windows, now)
    assert len(active) == 1


def test_get_expired_care_windows():
    now = datetime(2026, 8, 7, 12, 0, 0, tzinfo=timezone.utc)
    windows = [
        {"ends_at": (now + timedelta(hours=1)).isoformat(), "status": "active"},
        {"ends_at": (now - timedelta(hours=1)).isoformat(), "status": "active"},
    ]
    expired = get_expired_care_windows(windows, now)
    assert len(expired) == 1


def test_generate_daily_intelligence():
    ref = datetime(2026, 8, 7, 12, 0, 0, tzinfo=timezone.utc)
    events = []
    appointments = [
        {
            "id": "apt1",
            "title": "Dr. Smith",
            "scheduled_at": (ref + timedelta(days=1)).isoformat(),
            "location": "Clinic",
            "status": "scheduled",
        }
    ]
    windows = []
    result = generate_daily_intelligence("person1", events, appointments, windows, ref)
    assert result["person_id"] == "person1"
    assert "daily_summary" in result


def test_update_appointment_lifecycle_scheduled():
    ref = datetime(2026, 8, 7, 12, 0, 0, tzinfo=timezone.utc)
    appt = {
        "scheduled_at": (ref + timedelta(days=2)).isoformat(),
        "status": "scheduled",
    }
    new_status = update_appointment_lifecycle(appt, ref)
    assert new_status == "upcoming"


def test_update_appointment_lifecycle_today():
    ref = datetime(2026, 8, 7, 12, 0, 0, tzinfo=timezone.utc)
    appt = {
        "scheduled_at": ref.replace(hour=14, minute=0).isoformat(),
        "status": "scheduled",
    }
    new_status = update_appointment_lifecycle(appt, ref)
    assert new_status == "today"


def test_update_appointment_lifecycle_overdue():
    ref = datetime(2026, 8, 7, 12, 0, 0, tzinfo=timezone.utc)
    appt = {
        "scheduled_at": (ref - timedelta(days=1)).isoformat(),
        "status": "scheduled",
    }
    new_status = update_appointment_lifecycle(appt, ref)
    assert new_status == "overdue"


def test_update_event_lifecycle_recent():
    ref = datetime(2026, 8, 7, 12, 0, 0, tzinfo=timezone.utc)
    evt = {
        "occurred_at": (ref - timedelta(days=1)).isoformat(),
        "status": "recorded",
    }
    new_status = update_event_lifecycle(evt, ref)
    assert new_status == "recorded"


def test_update_event_lifecycle_historical():
    ref = datetime(2026, 8, 7, 12, 0, 0, tzinfo=timezone.utc)
    evt = {
        "occurred_at": (ref - timedelta(weeks=2)).isoformat(),
        "status": "recorded",
    }
    new_status = update_event_lifecycle(evt, ref)
    assert new_status == "historical"


def test_infer_temporal_relationship():
    time_a = datetime(2026, 8, 7, 10, 0, 0, tzinfo=timezone.utc)
    time_b = datetime(2026, 8, 7, 11, 0, 0, tzinfo=timezone.utc)
    rel = infer_temporal_relationship(
        {"id": "a", "occurred_at": time_a.isoformat()},
        {"id": "b", "occurred_at": time_b.isoformat()},
    )
    assert rel is not None
    assert rel["relationship"] == "followed_shortly_after"


def test_detect_time_patterns():
    ref = datetime(2026, 8, 7, 12, 0, 0, tzinfo=timezone.utc)
    events = []
    for i in range(5):
        events.append({
            "id": f"e{i}",
            "event_type": "observation",
            "occurred_at": (ref - timedelta(hours=20 * i)).replace(hour=21, minute=0).isoformat(),
        })
    patterns = detect_time_patterns(events, window_days=30)
    assert len(patterns) >= 1
    time_patterns = [p for p in patterns if p["pattern_type"] == "time_of_day"]
    assert len(time_patterns) >= 1


def test_natural_language_time_ago():
    ref = datetime(2026, 8, 7, 12, 0, 0, tzinfo=timezone.utc)
    target = ref - timedelta(hours=2)
    assert natural_language_time_ago(ref, target) == "2 hours ago"


def test_natural_language_time_until():
    ref = datetime(2026, 8, 7, 12, 0, 0, tzinfo=timezone.utc)
    target = ref + timedelta(days=1)
    assert natural_language_time_until(ref, target) == "tomorrow"


def test_location_intelligence_validate_timezone():
    assert validate_timezone("America/New_York") == "America/New_York"
    assert validate_timezone("Invalid/Zone") is None


def test_location_intelligence_get_timezone_for_state():
    assert get_timezone_for_state("CA") == "America/Los_Angeles"
    assert get_timezone_for_state("NY") == "America/New_York"
    assert get_timezone_for_state("TX") == "America/Chicago"
    assert get_timezone_for_state("HI") == "Pacific/Honolulu"
    assert get_timezone_for_state(None) is None


def test_location_intelligence_parse_location_text():
    result = parse_location_text("Patient went to the emergency department")
    assert result["parsed_location_type"] == "emergency_department"
    assert result["confidence"] >= 0.8


def test_location_intelligence_detect_care_transition():
    transition = detect_care_transition("Home", "Hospital", "hospital_admission")
    assert transition["is_significant"] is True
    assert transition["transition_type"] == "hospital_admission"


def test_location_intelligence_infer_transition_type():
    assert infer_transition_type("Home", "Emergency Department") == "emergency_visit"
    assert infer_transition_type("Home", "Primary Care Clinic") == "routine_follow_up"
    assert infer_transition_type("Hospital", "Home") == "hospital_discharge"
    assert infer_transition_type("Hospital", "Rehabilitation") == "transition_to_rehab"


def test_location_intelligence_is_care_transition_significant():
    assert is_care_transition_significant("Home", "Hospital") is True
    assert is_care_transition_significant("Home", "Home") is False
    assert is_care_transition_significant(None, "Hospital") is False


def test_location_intelligence_get_location_context():
    ctx = get_location_context("emergency_department")
    assert ctx["urgency_multiplier"] == 3.0
    assert len(ctx["coordination_notes"]) > 0

    ctx_home = get_location_context("home")
    assert ctx_home["urgency_multiplier"] == 1.0


def test_location_intelligence_get_nearby_providers():
    providers = get_nearby_providers("pharmacy", 25)
    assert len(providers) > 0
    assert providers[0]["type"] == "pharmacy"


def test_location_intelligence_enrich_location():
    loc = {"name": "Test Hospital", "location_type": "hospital", "city": "LA", "state": "CA"}
    enriched = enrich_location_with_geographic_intelligence(loc)
    assert "context" in enriched
    assert "nearby_providers" in enriched
    assert enriched["context"]["urgency_multiplier"] == 2.0


def test_location_intelligence_format_location_for_display():
    loc = {"name": "Test Clinic", "city": "Los Angeles", "state": "CA", "timezone": "America/Los_Angeles"}
    display = format_location_for_display(loc)
    assert "Test Clinic" in display
    assert "Los Angeles" in display
