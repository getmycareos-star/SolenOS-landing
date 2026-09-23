from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.care import CareEvent
from app.models.change import Change, Pattern, Situation
from app.models.uncertainty import (
    Contradiction as ContradictionModel,
    InformationGap as InformationGapModel,
    OpenQuestion as OpenQuestionModel,
)
from app.models.significance import SignificanceAssessment
from app.services.change_detection import detect_event_changes
from app.services.pattern_detection import detect_patterns
from app.core.change_enums import (
    SituationType,
    SituationState,
    PatternType,
    ChangeDirection,
    SignificanceVerdict,
    EvidenceStatus,
)
from app.core.uncertainty_enums import GapLifecycleStatus


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def detect_situations(
    db: Session,
    person_id: str,
    reference_time: Optional[datetime] = None,
) -> List[Situation]:
    now = _ensure_utc(reference_time) or _utc_now()
    event_types = _get_recent_event_types(db, person_id, now)
    all_changes: List[Change] = []
    all_patterns: List[Pattern] = []
    for event_type in event_types:
        changes = detect_event_changes(db, person_id, event_type, None, now)
        all_changes.extend(changes)
        patterns = detect_patterns(db, person_id, event_type, None, now)
        all_patterns.extend(patterns)
    if not all_changes and not all_patterns:
        return []

    situations = []
    meaningful_changes = [c for c in all_changes if _is_meaningful(c)]
    if meaningful_changes:
        change_situation = _form_change_situation(
            db=db,
            person_id=person_id,
            changes=meaningful_changes,
            patterns=all_patterns,
            now=now,
        )
        if change_situation:
            situations.append(change_situation)
    if len(all_patterns) >= 2:
        pattern_situation = _form_pattern_situation(
            db=db,
            person_id=person_id,
            patterns=all_patterns,
            changes=all_changes,
            now=now,
        )
        if pattern_situation:
            situations.append(pattern_situation)
    for pattern in all_patterns:
        if pattern.pattern_type == PatternType.FREQUENCY_INCREASE:
            situation = _form_frequency_situation(
                db=db,
                person_id=person_id,
                pattern=pattern,
                changes=[c for c in all_changes if c.subject_type == pattern.subject_type],
                now=now,
            )
            if situation:
                situations.append(situation)
    return situations


def _is_meaningful(change: Change) -> bool:
    return change.significance_verdict == SignificanceVerdict.MEANINGFUL_CANDIDATE


def _get_recent_event_types(db: Session, person_id: str, now: datetime) -> List[str]:
    thirty_days_ago = now - timedelta(days=30)
    events = db.query(CareEvent).filter(
        CareEvent.person_id == person_id,
        CareEvent.occurred_at >= thirty_days_ago,
    ).all()
    event_types = list(set(e.event_type for e in events))
    return event_types


def _form_change_situation(
    db: Session,
    person_id: str,
    changes: List[Change],
    patterns: List[Pattern],
    now: datetime,
) -> Optional[Situation]:
    if not changes:
        return None
    signal_ids = []
    signal_types = []
    for c in changes:
        signal_ids.extend(c.evidence_ids or [])
        signal_types.append(c.subject_type)
    signal_ids = list(set(signal_ids))
    signal_types = list(set(signal_types))
    temporal_start = min(c.created_at for c in changes)
    temporal_end = max(c.created_at for c in changes)
    increasing = [c for c in changes if c.change_direction == ChangeDirection.INCREASING]
    decreasing = [c for c in changes if c.change_direction == ChangeDirection.DECREASING]
    situation_type = _derive_situation_type(db, changes, increasing, decreasing)
    relevant_patterns = [p for p in patterns if p.subject_type in signal_types]
    primary = _primary_significance(db, changes[0])
    attention = any((_primary_significance(db, c) or _bool_none(c.attention_candidate)) for c in changes)
    follow_up = any((_primary_significance(db, c) or _bool_none(c.follow_up_candidate)) for c in changes)

    context = _build_situation_context(db, person_id, changes, primary)
    alternative_interpretations = _derive_alternatives(db, person_id, changes, patterns)
    situation = Situation(
        person_id=person_id,
        situation_type=situation_type,
        state=SituationState.ACTIVE,
        title=_generate_situation_title(changes),
        description=_generate_situation_description(changes, relevant_patterns),
        signal_ids=signal_ids,
        signal_types=signal_types,
        temporal_start=temporal_start,
        temporal_end=temporal_end,
        pattern_ids=[p.id for p in relevant_patterns],
        change_ids=[c.id for c in changes],
        significance_assessment_id=primary.id if primary else None,
        confidence=_situation_confidence(changes, relevant_patterns),
        alternative_interpretations=alternative_interpretations,
        context=context,
        attention_candidate=attention,
        follow_up_candidate=follow_up,
        explanation=_build_situation_explanation(changes, relevant_patterns, attention, follow_up),
    )
    db.add(situation)
    db.flush()
    return situation


def _derive_situation_type(db: Session, changes: List[Change], increasing: List[Change], decreasing: List[Change]) -> SituationType:
    evidence_texts = _collect_evidence_texts(db, changes)
    functional_indicators = [
        "fall", "fell", "fallen", "couldn't get up", "could not get up",
        "unable to stand", "unable to walk", "needed help", "required assistance",
        "confused", "disoriented", "unsteady", "lost balance",
    ]
    has_functional = any(
        any(indicator in text.lower() for indicator in functional_indicators)
        for text in evidence_texts
    )
    if has_functional and len(increasing) > len(decreasing):
        return SituationType.FUNCTIONAL_INSTABILITY
    if len(increasing) > len(decreasing):
        return SituationType.FLUCTUATING_STATE
    if len(decreasing) > len(increasing):
        return SituationType.STABLE_STATE
    return SituationType.UNKNOWN


def _collect_evidence_texts(db: Session, changes: List[Change]) -> List[str]:
    from app.models.care import Evidence
    evidence_ids = []
    for c in changes:
        evidence_ids.extend(c.evidence_ids or [])
    evidence_ids = list(set(evidence_ids))
    if not evidence_ids:
        return []
    rows = db.query(Evidence).filter(Evidence.id.in_(evidence_ids)).all()
    return [r.source_text for r in rows if r.source_text]


def _derive_pattern_situation_type(db: Session, patterns: List[Pattern]) -> SituationType:
    evidence_texts = _collect_evidence_texts_from_patterns(db, patterns)
    functional_indicators = [
        "fall", "fell", "fallen", "couldn't get up", "could not get up",
        "unable to stand", "unable to walk", "needed help", "required assistance",
        "confused", "disoriented", "unsteady", "lost balance",
    ]
    has_functional = any(
        any(indicator in text.lower() for indicator in functional_indicators)
        for text in evidence_texts
    )
    if has_functional:
        return SituationType.FUNCTIONAL_INSTABILITY
    return SituationType.FLUCTUATING_STATE


def _derive_frequency_situation_type(db: Session, pattern: Pattern) -> SituationType:
    evidence_texts = _collect_evidence_texts_from_patterns(db, [pattern])
    functional_indicators = [
        "fall", "fell", "fallen", "couldn't get up", "could not get up",
        "unable to stand", "unable to walk", "needed help", "required assistance",
        "confused", "disoriented", "unsteady", "lost balance",
    ]
    has_functional = any(
        any(indicator in text.lower() for indicator in functional_indicators)
        for text in evidence_texts
    )
    if has_functional:
        return SituationType.FUNCTIONAL_INSTABILITY
    return SituationType.FLUCTUATING_STATE


def _collect_evidence_texts_from_patterns(db: Session, patterns: List[Pattern]) -> List[str]:
    from app.models.care import Evidence
    evidence_ids = []
    for p in patterns:
        evidence_ids.extend(p.event_ids or [])
    evidence_ids = list(set(evidence_ids))
    if not evidence_ids:
        return []
    rows = db.query(Evidence).filter(Evidence.id.in_(evidence_ids)).all()
    return [r.source_text for r in rows if r.source_text]


def _bool_none(v: Any) -> bool:
    return bool(v or False)


def _primary_significance(db: Session, change: Change) -> Optional[SignificanceAssessment]:
    if not change.significance_assessment_id:
        return None
    return (
        db.query(SignificanceAssessment)
        .filter(SignificanceAssessment.id == change.significance_assessment_id)
        .first()
    )


def _situation_confidence(changes: List[Change], patterns: List[Pattern]) -> float:
    sigs = [c.confidence for c in changes]
    pats = [p.confidence for p in patterns]
    vals = sigs + pats
    if not vals:
        return 0.0
    return round(min(vals), 3)


def _build_situation_context(db: Session, person_id: str, changes: List[Change],
                             primary: Optional[SignificanceAssessment]) -> Dict[str, Any]:
    context: Dict[str, Any] = {
        "type": "situation_understanding",
        "significance_verdict": primary.verdict.value if primary else SignificanceVerdict.INSUFFICIENT_EVIDENCE.value,
        "significance_confidence": primary.significance_confidence if primary else 0.0,
        "evidence_confidence": primary.evidence_confidence if primary else 0.0,
        "evidence_status": primary.evidence_status.value if primary else EvidenceStatus.UNKNOWN.value,
        "dimensions": primary.dimensions if primary else [],
        "reporters": primary.reporters if primary else [],
        "possible_context": primary.possible_context if primary else [],
        "per_change_significance": {},
        "epistemic": {},
    }
    for c in changes:
        sig = _primary_significance(db, c)
        if sig:
            context["per_change_significance"][c.id] = {
                "verdict": sig.verdict.value,
                "significance_confidence": sig.significance_confidence,
                "evidence_status": sig.evidence_status.value,
                "attention_candidate": sig.attention_candidate,
                "follow_up_candidate": sig.follow_up_candidate,
                "baseline_id": sig.baseline_id,
            }
            if c.subject_type not in context["epistemic"]:
                context["epistemic"][c.subject_type] = _epistemic_context(db, person_id, c.subject_type, c.subject_id)
    return context


def _epistemic_context(db: Session, person_id: str, subject_type: str, subject_id: str) -> Dict[str, Any]:
    q = db.query(ContradictionModel).filter(
        ContradictionModel.person_id == person_id,
        ContradictionModel.subject_type == subject_type,
    )
    if subject_id:
        q = q.filter(ContradictionModel.subject_id == subject_id)
    contradictions = q.all()

    gaps = (
        db.query(InformationGapModel)
        .filter(
            InformationGapModel.person_id == person_id,
            InformationGapModel.subject_type == subject_type,
            InformationGapModel.lifecycle_status == GapLifecycleStatus.OPEN,
        )
        .all()
    )
    if subject_id:
        gaps = [g for g in gaps if g.subject_id == subject_id or g.subject_id == ""]

    questions = db.query(OpenQuestionModel).filter(
        OpenQuestionModel.person_id == person_id,
        OpenQuestionModel.subject_type == subject_type,
        OpenQuestionModel.status == "open",
    ).all()

    if contradictions:
        epistemic_state = "conflicting"
    elif not gaps and not questions:
        epistemic_state = "known_or_reported"
    elif gaps or questions:
        epistemic_state = "partially_known"
    else:
        epistemic_state = "unknown"

    return {
        "epistemic_state": epistemic_state,
        "contradictions": [{"id": c.id, "field": c.field, "description": c.description,
                            "evidence_ids": c.evidence_ids or [], "resolution_status": c.resolution_status} for c in contradictions],
        "open_gaps": [{"id": g.id, "field": g.field, "gap_reason": g.gap_reason.value if g.gap_reason else None} for g in gaps],
        "open_questions": [{"id": q.id, "question": q.question, "priority": q.priority.value if q.priority else None} for q in questions],
    }


def _derive_alternatives(db: Session, person_id: str, changes: List[Change],
                         patterns: List[Pattern]) -> List[Dict[str, Any]]:
    interpretations: List[Dict[str, Any]] = []
    for c in changes:
        ep = _epistemic_context(db, person_id, c.subject_type, c.subject_id)
        alt = {
            "interpretation": (
                f"Documentation or reporting change rather than actual change for {c.subject_type} "
                f"({c.change_type.value}, n={c.current_count})"
            ),
            "confidence": 0.3,
            "supporting_evidence": "No documentation-density delta computed for this window; treat as unconfirmed hypothesis.",
        }
        if ep["contradictions"]:
            alt["interpretation"] += " Conflicting observations exist for this subject."
        interpretations.append(alt)
    for p in patterns:
        interpretations.append({
            "interpretation": f"Pattern {p.pattern_type.value} for {p.subject_type} may reflect recording cadence, not pathophysiology.",
            "confidence": 0.35,
            "supporting_evidence": f"Pattern strength {p.pattern_strength.value}; {p.evidence_count} evidence items.",
        })
    return interpretations


def _form_pattern_situation(
    db: Session,
    person_id: str,
    patterns: List[Pattern],
    changes: List[Change],
    now: datetime,
) -> Optional[Situation]:
    if len(patterns) < 2:
        return None
    active_patterns = [p for p in patterns if p.confidence >= 0.4]
    if len(active_patterns) < 2:
        return None
    signal_ids = []
    signal_types = []
    for p in active_patterns:
        signal_ids.extend(p.event_ids or [])
        signal_types.append(p.subject_type)
    signal_ids = list(set(signal_ids))
    signal_types = list(set(signal_types))
    temporal_start = min(p.temporal_start for p in active_patterns)
    temporal_end = max(p.temporal_end for p in active_patterns)

    change_sigs = {c.id: _primary_significance(db, c) for c in changes}
    change_sigs = {k: v for k, v in change_sigs.items() if v is not None}
    att = any(s.attention_candidate for s in change_sigs.values())
    foll = any(s.follow_up_candidate for s in change_sigs.values())

    context = _build_converged_context(db, person_id, active_patterns, change_sigs)
    situation = Situation(
        person_id=person_id,
        situation_type=_derive_pattern_situation_type(db, active_patterns),
        state=SituationState.ACTIVE,
        title="Converging patterns detected",
        description="Multiple patterns detected across related signals.",
        signal_ids=signal_ids,
        signal_types=signal_types,
        temporal_start=temporal_start,
        temporal_end=temporal_end,
        pattern_ids=[p.id for p in active_patterns],
        change_ids=[c.id for c in changes],
        significance_assessment_id=(
            next((v.id for v in change_sigs.values()), None)
        ),
        confidence=min(p.confidence for p in active_patterns) * 0.9,
        alternative_interpretations=[
            {
                "interpretation": "Convergence may indicate a systemic change, or may reflect inconsistent reporting across signals.",
                "confidence": 0.4,
                "supporting_evidence": f"{len(active_patterns)} active patterns.",
            }
        ],
        context=context,
        attention_candidate=att,
        follow_up_candidate=foll,
        explanation=(
            "Multiple patterns detected across related signals. Temporal association "
            "of events does not establish causation; verify with additional evidence."
        ),
    )
    db.add(situation)
    db.flush()
    return situation


def _build_converged_context(db: Session, person_id: str, patterns: List[Pattern],
                             change_sigs: Dict[str, SignificanceAssessment]) -> Dict[str, Any]:
    ctx: Dict[str, Any] = {
        "type": "converged_situation_understanding",
        "significance_verdict": SignificanceVerdict.MEANINGFUL_CANDIDATE.value,
        "significance_confidence": min(s.significance_confidence for s in change_sigs.values()) if change_sigs else 0.0,
        "evidence_confidence": min(s.evidence_confidence for s in change_sigs.values()) if change_sigs else 0.0,
        "evidence_status": max(
            (s.evidence_status for s in change_sigs.values()),
            key=lambda e: 0 if e == EvidenceStatus.CONFIRMED else
               1 if e == EvidenceStatus.REPORTED else
               2 if e == EvidenceStatus.INFERRED else
               3 if e == EvidenceStatus.UNKNOWN else 4,
        ).value if change_sigs else EvidenceStatus.UNKNOWN.value,
        "per_change_significance": {},
        "epistemic": {},
        "warnings": ["convergence is correlative, not causal"],
        "possible_context": ["shared temporal trigger is plausible but unverified"],
    }
    for cid, sig in change_sigs.items():
        ctx["per_change_significance"][cid] = {
            "verdict": sig.verdict.value,
            "significance_confidence": sig.significance_confidence,
            "evidence_status": sig.evidence_status.value,
        }
    for p in patterns:
        ctx["epistemic"].setdefault(p.subject_type, _epistemic_context(db, person_id, p.subject_type, p.subject_id))
    return ctx


def _form_frequency_situation(
    db: Session,
    person_id: str,
    pattern: Pattern,
    changes: List[Change],
    now: datetime,
) -> Optional[Situation]:
    change_sigs = {c.id: _primary_significance(db, c) for c in changes}
    change_sigs = {k: v for k, v in change_sigs.items() if v is not None}
    att = any(s.attention_candidate for s in change_sigs.values()) if change_sigs else pattern.confidence >= 0.6
    foll = any(s.follow_up_candidate for s in change_sigs.values()) if change_sigs else pattern.pattern_strength.value == "established"

    context = {
        "type": "frequency_situation_understanding",
        "significance_verdict": SignificanceVerdict.MEANINGFUL_CANDIDATE.value if att else SignificanceVerdict.NOT_MEANINGFUL.value,
        "significance_confidence": min(s.significance_confidence for s in change_sigs.values()) if change_sigs else round(pattern.confidence * 0.9, 3),
        "evidence_confidence": min(s.evidence_confidence for s in change_sigs.values()) if change_sigs else round(pattern.confidence * 0.8, 3),
        "evidence_status": EvidenceStatus.REPORTED.value,
        "per_change_significance": {
            cid: {"verdict": s.verdict.value, "significance_confidence": s.significance_confidence}
            for cid, s in change_sigs.items()
        },
        "epistemic": _epistemic_context(db, person_id, pattern.subject_type, pattern.subject_id) if changes else {},
        "possible_context": ["frequency increase may reflect reporting cadence, not true event frequency"],
        "warnings": [],
    }
    situation = Situation(
        person_id=person_id,
        situation_type=_derive_frequency_situation_type(db, pattern),
        state=SituationState.ACTIVE,
        title=f"Increasing {pattern.subject_type} frequency",
        description=(
            f"Frequency of {pattern.subject_type} events has increased. "
            f"Pattern strength: {pattern.pattern_strength.value}. "
            f"Rate: {pattern.rate_per_period:.2f} per period."
            if pattern.rate_per_period
            else f"Frequency of {pattern.subject_type} events has increased."
        ),
        signal_ids=list(set(pattern.event_ids or [])),
        signal_types=[pattern.subject_type],
        temporal_start=pattern.temporal_start,
        temporal_end=pattern.temporal_end,
        pattern_ids=[pattern.id],
        change_ids=[c.id for c in changes],
        significance_assessment_id=(next(iter(change_sigs.values()), None).id if change_sigs else None),
        confidence=pattern.confidence * 0.9,
        alternative_interpretations=[
            {
                "interpretation": f"Increase may be documentation-driven for {pattern.subject_type}",
                "confidence": 0.3,
                "supporting_evidence": "No documentation-density comparison; sparse baseline.",
            }
        ],
        context=context,
        attention_candidate=att,
        follow_up_candidate=foll,
        explanation=(
            "Increasing event frequency is a longitudinal observation, not a prognosis. "
            "Rule out reporting-driven frequency change before acting."
        ),
    )
    db.add(situation)
    db.flush()
    return situation


def _generate_situation_title(changes: List[Change]) -> str:
    if not changes:
        return "Situation detected"
    significant = changes[0]
    return f"{significant.change_type.value}: {significant.subject_type}"


def _generate_situation_description(changes: List[Change], patterns: List[Pattern]) -> str:
    parts = []
    for c in changes:
        parts.append(c.explanation or f"{c.change_type.value}: {c.subject_type}")
    for p in patterns:
        parts.append(f"Pattern: {p.pattern_type.value} ({p.pattern_strength.value})")
    return " | ".join(parts)


def _build_situation_explanation(changes: List[Change], patterns: List[Pattern],
                                 attention: bool, follow_up: bool) -> str:
    parts = []
    parts.append(
        "Situation constructed from evidence-grounded change(s); temporal association is not causation."
    )
    if attention:
        parts.append("Attention candidate: warrants monitoring.")
    if follow_up:
        parts.append("Follow-up candidate: worth clarifying with a professional.")
    parts.append("This interpretation is reversible when underlying evidence changes.")
    return " ".join(parts)


def update_situations(
    db: Session,
    person_id: str,
    new_event: CareEvent,
    reference_time: Optional[datetime] = None,
) -> List[Situation]:
    now = _ensure_utc(reference_time) or _utc_now()
    active_situations = db.query(Situation).filter(
        Situation.person_id == person_id,
        Situation.is_active,
        Situation.state == SituationState.ACTIVE,
    ).all()
    if not active_situations:
        return []
    updated = []
    for situation in active_situations:
        if new_event.id in (situation.signal_ids or []):
            continue
        if new_event.event_type in (situation.signal_types or []):
            situation.signal_ids = (situation.signal_ids or []) + [new_event.id]
            situation.signal_types = list(set((situation.signal_types or []) + [new_event.event_type]))
            situation.temporal_end = now
            situation.explanation = (
                (situation.explanation or "")
                + f" Updated {now.isoformat()} with new evidence {new_event.id}."
            )
            updated.append(situation)
    if updated:
        db.commit()
    return updated
