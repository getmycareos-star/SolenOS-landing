from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from app.models.care import CareEvent
from app.models.change import Baseline
from app.core.change_enums import BaselineType, BaselineConfidence
from app.services.temporal_intelligence import utc_now


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def select_baseline_window(
    reference_time: datetime,
    candidate_windows: List[Tuple[datetime, datetime]],
    min_days: int = 30,
    max_gap_days: int = 60,
) -> Optional[Tuple[datetime, datetime]]:
    candidate_windows = sorted(candidate_windows, key=lambda w: w[0])
    best_window = None
    best_score = -1
    for window_start, window_end in candidate_windows:
        duration = (window_end - window_start).days
        gap = (reference_time - window_end).days
        if duration < min_days:
            continue
        if gap > max_gap_days:
            continue
        score = duration - gap * 0.5
        if score > best_score:
            best_score = score
            best_window = (window_start, window_end)
    return best_window


def get_longitudinal_event_counts(
    db: Session,
    person_id: str,
    event_type: str,
    subject_id: Optional[str],
    now: datetime,
) -> dict:
    now = _ensure_utc(now)
    query = db.query(CareEvent).filter(
        CareEvent.person_id == person_id,
        CareEvent.event_type == event_type,
    )
    if subject_id:
        query = query.filter(CareEvent.id == subject_id)
    events = query.order_by(CareEvent.occurred_at.asc()).all()
    timed_events = [e for e in events if e.occurred_at is not None]
    six_weeks_ago = now - timedelta(days=42)
    current_window_count = sum(1 for e in timed_events if _ensure_utc(e.occurred_at) >= six_weeks_ago)
    historical_count = sum(1 for e in timed_events if _ensure_utc(e.occurred_at) < six_weeks_ago)
    recent_events = [e for e in timed_events if _ensure_utc(e.occurred_at) >= six_weeks_ago]
    return {
        "total_events": len(events),
        "current_window_count": current_window_count,
        "historical_count": historical_count,
        "current_window_start": six_weeks_ago,
        "current_window_end": now,
        "recent_events": recent_events,
        "all_events": events,
    }


def build_baseline(
    db: Session,
    person_id: str,
    event_type: str,
    subject_id: Optional[str],
    reference_time: Optional[datetime] = None,
) -> Optional[Baseline]:
    now = _ensure_utc(reference_time) or _ensure_utc(utc_now())
    counts = get_longitudinal_event_counts(db, person_id, event_type, subject_id, now)
    events = counts["all_events"]
    if not events:
        return None
    six_weeks_ago = now - timedelta(days=42)
    timed_events = [e for e in events if e.occurred_at is not None]
    baseline_events = [e for e in timed_events if _ensure_utc(e.occurred_at) < six_weeks_ago]
    if baseline_events:
        window_start = baseline_events[0].occurred_at
        window_end = baseline_events[-1].occurred_at
        event_count = len(baseline_events)
        window_days = max((_ensure_utc(window_end) - _ensure_utc(window_start)).days, 1)
        frequency_per_period = event_count / (window_days / 30.0)
        confidence = BaselineConfidence.HIGH if event_count >= 5 else (BaselineConfidence.MODERATE if event_count >= 2 else BaselineConfidence.LOW)
    else:
        window_start = now - timedelta(days=180)
        window_end = six_weeks_ago
        event_count = 0
        window_days = max((_ensure_utc(window_end) - _ensure_utc(window_start)).days, 1)
        frequency_per_period = 0.0
        confidence = BaselineConfidence.LOW
    observation_density = event_count / max(window_days, 1)
    baseline = Baseline(
        person_id=person_id,
        subject_type=event_type,
        subject_id=subject_id or "",
        baseline_type=BaselineType.PERSONAL_HISTORICAL,
        window_start=window_start,
        window_end=window_end,
        event_count=event_count,
        frequency_per_period=frequency_per_period,
        state_value=None,
        confidence=confidence,
        is_stable=True,
        observation_density=observation_density,
        documentation_bias_flag=False,
        evidence_ids=[e.id for e in baseline_events],
    )
    db.add(baseline)
    db.flush()
    return baseline


def compare_to_baseline(
    baseline: Baseline,
    current_count: int,
    current_window_days: int = 42,
) -> dict:
    if baseline.frequency_per_period is None:
        frequency_delta = None
        relative_change = None
    else:
        current_frequency = current_count / (current_window_days / 30.0) if current_window_days > 0 else 0.0
        frequency_delta = current_frequency - baseline.frequency_per_period
        if baseline.frequency_per_period == 0:
            relative_change = float('inf') if current_count > 0 else 0.0
        else:
            relative_change = ((current_count - baseline.event_count) / baseline.event_count) * 100 if baseline.event_count > 0 else float('inf')
    return {
        "baseline_event_count": baseline.event_count,
        "baseline_window_days": max((_ensure_utc(baseline.window_end) - _ensure_utc(baseline.window_start)).days, 1),
        "baseline_frequency_per_period": baseline.frequency_per_period,
        "current_count": current_count,
        "current_window_days": current_window_days,
        "frequency_delta": frequency_delta,
        "relative_change_percent": relative_change,
        "baseline_confidence": baseline.confidence.value,
        "baseline_is_stable": baseline.is_stable,
        "observation_density": baseline.observation_density,
    }
