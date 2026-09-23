from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.care import CareEvent
from app.models.change import Baseline, Change
from app.services.baseline import (
    build_baseline,
    compare_to_baseline,
    get_longitudinal_event_counts,
    _ensure_utc,
)
from app.core.change_enums import ChangeType, ChangeDirection, BaselineConfidence


def detect_event_changes(
    db: Session,
    person_id: str,
    event_type: str,
    subject_id: Optional[str],
    reference_time: Optional[datetime] = None,
    min_persistence_days: int = 14,
) -> List[Change]:
    now = _ensure_utc(reference_time) or datetime.now(timezone.utc)
    baseline = build_baseline(db, person_id, event_type, subject_id, now)
    if not baseline:
        return []
    counts = get_longitudinal_event_counts(db, person_id, event_type, subject_id, now)
    current_count = counts["current_window_count"]
    historical_count = counts["historical_count"]
    comparison = compare_to_baseline(baseline, current_count, 42)
    changes = []
    if baseline.event_count == 0 and current_count > 0:
        change = _create_change(
            db=db,
            person_id=person_id,
            subject_type=event_type,
            subject_id=subject_id or "",
            change_type=ChangeType.ONSET,
            change_direction=ChangeDirection.INCREASING,
            previous_state="absent",
            current_state="present",
            previous_count=0,
            current_count=current_count,
            baseline_id=baseline.id,
            baseline=baseline,
            comparison=comparison,
            events=counts["recent_events"],
            now=now,
        )
        changes.append(change)
    elif baseline.event_count > 0 and current_count > baseline.event_count:
        relative_change = comparison.get("relative_change_percent")
        if relative_change is not None and relative_change >= 50:
            change = _create_change(
                db=db,
                person_id=person_id,
                subject_type=event_type,
                subject_id=subject_id or "",
                change_type=ChangeType.INCREASE,
                change_direction=ChangeDirection.INCREASING,
                previous_state=f"{baseline.event_count} events per baseline window",
                current_state=f"{current_count} events in current window",
                previous_count=baseline.event_count,
                current_count=current_count,
                baseline_id=baseline.id,
                baseline=baseline,
                comparison=comparison,
                events=counts["recent_events"],
                now=now,
            )
            changes.append(change)
    elif baseline.event_count > 0 and current_count == 0:
        if historical_count > 0:
            change = _create_change(
                db=db,
                person_id=person_id,
                subject_type=event_type,
                subject_id=subject_id or "",
                change_type=ChangeType.CESSATION,
                change_direction=ChangeDirection.DECREASING,
                previous_state="present",
                current_state="absent",
                previous_count=historical_count,
                current_count=0,
                baseline_id=baseline.id,
                baseline=baseline,
                comparison=comparison,
                events=[],
                now=now,
            )
            changes.append(change)
    if not changes and current_count >= 2:
        recent_events = counts["recent_events"]
        if len(recent_events) >= 2:
            first_event = min(recent_events, key=lambda e: e.occurred_at)
            last_event = max(recent_events, key=lambda e: e.occurred_at)
            span_days = (last_event.occurred_at - first_event.occurred_at).days
            if span_days <= 42:
                change = _create_change(
                    db=db,
                    person_id=person_id,
                    subject_type=event_type,
                    subject_id=subject_id or "",
                    change_type=ChangeType.RECURRENCE,
                    change_direction=ChangeDirection.INCREASING,
                    previous_state=f"{baseline.event_count} events in baseline window",
                    current_state=f"{current_count} events in current window",
                    previous_count=baseline.event_count,
                    current_count=current_count,
                    baseline_id=baseline.id,
                    baseline=baseline,
                    comparison=comparison,
                    events=recent_events,
                    now=now,
                )
                changes.append(change)
    return changes


def _create_change(
    db: Session,
    person_id: str,
    subject_type: str,
    subject_id: str,
    change_type: ChangeType,
                 change_direction: ChangeDirection,
                 previous_state: str,
                 current_state: str,
                 previous_count: Optional[int],
                 current_count: int,
                 baseline_id: Optional[str],
                 baseline: Optional[Baseline],
                 comparison: Dict[str, Any],
                 events: List[CareEvent],
                 now: datetime,
) -> Change:
    explanation = (
        f"{subject_type} changed from {previous_state} to {current_state} "
        f"compared to the baseline window. "
        f"Current count: {current_count}. "
        f"Baseline count: {comparison.get('baseline_event_count', 'unknown')}."
    )
    if comparison.get("relative_change_percent") is not None:
        explanation += (
            f" Relative change: {comparison['relative_change_percent']:.1f}%."
        )
    evidence_ids = []
    for e in events:
        if e.evidence_ids:
            evidence_ids.extend(e.evidence_ids)
    if baseline_id and baseline_id not in evidence_ids:
        evidence_ids.append(baseline_id)
    magnitude = comparison.get("relative_change_percent")
    if magnitude is not None and magnitude == float('inf'):
        magnitude = 1000.0
    change = Change(
        person_id=person_id,
        subject_type=subject_type,
        subject_id=subject_id,
        change_type=change_type,
        change_direction=change_direction,
        previous_state=previous_state,
        current_state=current_state,
        magnitude=magnitude,
        previous_count=previous_count,
        current_count=current_count,
        baseline_id=baseline_id,
        comparison_window_start=comparison.get("current_window_start"),
        comparison_window_end=comparison.get("current_window_end"),
        confidence=_calculate_change_confidence(comparison, len(events)),
        evidence_ids=evidence_ids,
        explanation=explanation,
        time_provenance=f"detected_at:{now.isoformat()}",
    )
    db.add(change)
    db.flush()

    from app.services.significance import assess_change
    assess_change(db, change, baseline, comparison, events, now)
    db.flush()
    return change


def _calculate_change_confidence(comparison: Dict[str, Any], event_count: int) -> float:
    confidence = 1.0
    baseline_confidence = comparison.get("baseline_confidence", "moderate")
    if baseline_confidence == BaselineConfidence.LOW.value:
        confidence -= 0.3
    elif baseline_confidence == BaselineConfidence.MODERATE.value:
        confidence -= 0.15
    observation_density = comparison.get("observation_density")
    if observation_density is not None and observation_density < 0.05:
        confidence -= 0.2
    if event_count < 2:
        confidence -= 0.2
    return max(0.1, min(1.0, confidence))
