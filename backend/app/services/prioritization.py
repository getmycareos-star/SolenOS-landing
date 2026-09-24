from __future__ import annotations

import math
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.core.change_enums import (
    BaselineConfidence,
    ChangeType,
    SignificanceVerdict,
)
from app.core.prioritization_enums import (
    ActionabilityFactor,
    ContradictionType,
    PriorityDimension,
    PriorityLevel,
    PriorityReasonCategory,
    TrajectoryType,
    UncertaintyFactor,
    VulnerabilityFactor,
)
from app.core.uncertainty_enums import GapLifecycleStatus
from app.models.action import Action as ActionModel
from app.models.care import CareEvent, Caregiver, Evidence
from app.models.caregiver_intelligence import CaregiverObservation
from app.models.change import Baseline, Change, Situation
from app.models.prioritization import (
    Prioritization,
    PrioritizationDimension,
    PrioritizationRanking,
)
from app.models.significance import SignificanceAssessment
from app.models.uncertainty import (
    Contradiction,
    InformationGap,
    OpenQuestion,
    UncertaintyAssessment,
)


_PRIORITY_ORDER = {
    PriorityLevel.CRITICAL: 0,
    PriorityLevel.HIGH: 1,
    PriorityLevel.MODERATE: 2,
    PriorityLevel.LOW: 3,
    PriorityLevel.INSUFFICIENT_EVIDENCE: 4,
    PriorityLevel.NO_ACTIVE_PRIORITY: 5,
}

_FUNCTIONAL_KEYWORDS = (
    "fall",
    "fell",
    "fallen",
    "injury",
    "unable to stand",
    "unable to walk",
    "cannot walk",
    "couldn't walk",
    "couldn't get up",
    "could not get up",
    "needed help",
    "required assistance",
    "lost balance",
    "unsteady",
    "weak",
    "confused",
    "disoriented",
    "slurred",
    "drooping",
    "mobility",
    "walking",
)

_SAFETY_KEYWORDS = (
    "emergency",
    "unresponsive",
    "not breathing",
    "chest pain",
    "seizure",
    "severe bleeding",
    "overdose",
    "poison",
    "medication error",
    "fell and hit",
    "danger",
    "unsafe",
)

_CONCERN_KEYWORDS = (
    "concern",
    "concerned",
    "worried",
    "what should i do",
    "please call",
    "urgent",
    "not sure",
    "unclear",
    "help",
    "please advise",
)

_MEDICATION_KEYWORDS = ("medication", "medicine", "prescription", "dose", "pill")
_APPOINTMENT_KEYWORDS = ("appointment", "follow-up", "follow up", "visit", "result")
_DECISION_KEYWORDS = ("decision", "choice", "consent", "care plan", "plan")
_MEASUREMENT_KEYWORDS = ("measurement", "blood pressure", "weight", "temperature", "vital")
_SYMPTOM_KEYWORDS = ("symptom", "pain", "cough", "dizzy", "tired", "nausea", "short of breath")


def _value(value: Any) -> Any:
    return value.value if hasattr(value, "value") else value


def _float(value: Any, default: float = 0.0) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return default
    if math.isinf(result) or math.isnan(result):
        return default
    return result


def _clamp(value: float) -> float:
    return round(min(max(value, 0.0), 1.0), 3)


def _unique(values: Iterable[Any]) -> List[str]:
    seen = set()
    result = []
    for value in values:
        if value is None:
            continue
        item = str(_value(value))
        if item and item not in seen:
            seen.add(item)
            result.append(item)
    return result


def _utc(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _parse_time(value: Optional[Any]) -> Optional[datetime]:
    if isinstance(value, datetime):
        return _utc(value)
    if not value:
        return None
    text = str(value).strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        return _utc(datetime.fromisoformat(text))
    except ValueError:
        return None


def _text(*values: Any) -> str:
    return " ".join(str(value) for value in values if value not in (None, "")).lower()


def _has(text: str, terms: Sequence[str]) -> bool:
    return any(term in text for term in terms)


def _dimension(
    dimension: PriorityDimension,
    score: float,
    label: str,
    evidence_ids: Sequence[str],
    explanation: str,
) -> Dict[str, Any]:
    return {
        "dimension": dimension.value,
        "score": _clamp(score),
        "label": label,
        "evidence_ids": _unique(evidence_ids),
        "explanation": explanation,
    }


def _baseline_score(value: Any) -> float:
    try:
        confidence = BaselineConfidence(value)
    except (TypeError, ValueError):
        confidence = BaselineConfidence.MODERATE
    return {
        BaselineConfidence.HIGH: 1.0,
        BaselineConfidence.MODERATE: 0.7,
        BaselineConfidence.LOW: 0.4,
        BaselineConfidence.INSUFFICIENT: 0.2,
    }.get(confidence, 0.2)


def _reports_conflict(events: Sequence[CareEvent]) -> bool:
    reporters = [event.created_by_caregiver_id for event in events if event.created_by_caregiver_id]
    if len(events) < 2 or len(set(reporters)) < 2:
        return False
    positive = ("normal", "fine", "well", "okay", "ok", "clear", "without symptom", " no ")
    texts = [_text(event.title, event.description) for event in events]
    return any(_has(text, positive) for text in texts) and any(
        not _has(text, positive) for text in texts
    )


def _active_changes(
    db: Session,
    person_id: str,
    subject_type: Optional[str] = None,
    subject_id: Optional[str] = None,
    changes: Optional[Sequence[Change]] = None,
) -> List[Change]:
    if changes is not None:
        selected = [
            change
            for change in changes
            if change.person_id == person_id and change.is_active is not False
        ]
    else:
        query = db.query(Change).filter(
            Change.person_id == person_id,
            Change.is_active.is_(True),
        )
        if subject_type:
            query = query.filter(Change.subject_type == subject_type)
        if subject_id is not None:
            query = query.filter(Change.subject_id == subject_id)
        selected = query.order_by(Change.created_at.desc()).all()
    return [
        change
        for change in selected
        if (not subject_type or change.subject_type == subject_type)
        and (subject_id is None or change.subject_id == subject_id)
    ]


def _events_for_changes(
    db: Session,
    person_id: str,
    changes: Sequence[Change],
    reference_time: Optional[datetime],
) -> List[CareEvent]:
    evidence_ids = {
        evidence_id
        for change in changes
        for evidence_id in (change.evidence_ids or [])
    }
    subject_types = {change.subject_type for change in changes}
    events = db.query(CareEvent).filter(CareEvent.person_id == person_id).all()
    selected = []
    for event in events:
        event_evidence = set(event.evidence_ids or [])
        if event.event_type in subject_types or (evidence_ids and event_evidence & evidence_ids):
            selected.append(event)
    if reference_time:
        start = reference_time - timedelta(days=120)
        end = reference_time + timedelta(days=1)
        selected = [
            event
            for event in selected
            if not event.occurred_at or start <= _utc(event.occurred_at) <= end
        ]
    return selected


def _evidence_for_changes(
    db: Session,
    changes: Sequence[Change],
) -> List[Evidence]:
    evidence_ids = _unique(
        evidence_id
        for change in changes
        for evidence_id in (change.evidence_ids or [])
    )
    if not evidence_ids:
        return []
    return db.query(Evidence).filter(Evidence.id.in_(evidence_ids)).all()


def _baselines_for_changes(
    db: Session,
    changes: Sequence[Change],
) -> List[Baseline]:
    ids = _unique(change.baseline_id for change in changes if change.baseline_id)
    query = db.query(Baseline).filter(Baseline.is_active.is_(True))
    if ids:
        rows = query.filter(Baseline.id.in_(ids)).all()
    else:
        rows = []
    seen = {row.id for row in rows}
    for change in changes:
        if change.baseline_id in seen:
            continue
        row = (
            query.filter(
                Baseline.person_id == change.person_id,
                Baseline.subject_type == change.subject_type,
                Baseline.subject_id == change.subject_id,
            )
            .order_by(Baseline.window_end.desc())
            .first()
        )
        if row:
            rows.append(row)
            seen.add(row.id)
    return rows


def _assessments_for_changes(
    db: Session,
    changes: Sequence[Change],
) -> List[SignificanceAssessment]:
    ids = _unique(
        change.significance_assessment_id
        for change in changes
        if change.significance_assessment_id
    )
    query = db.query(SignificanceAssessment).filter(
        SignificanceAssessment.is_active.is_(True)
    )
    rows = query.filter(SignificanceAssessment.id.in_(ids)).all() if ids else []
    seen = {row.id for row in rows}
    for change in changes:
        if change.significance_assessment_id in seen:
            continue
        row = (
            query.filter(
                SignificanceAssessment.target_type == "change",
                SignificanceAssessment.target_id == change.id,
            )
            .order_by(SignificanceAssessment.created_at.desc())
            .first()
        )
        if row:
            rows.append(row)
            seen.add(row.id)
    return rows


def _matching_rows(
    query: Any,
    person_id: str,
    changes: Sequence[Change],
    reference_time: Optional[datetime],
) -> List[Any]:
    evidence_ids = {
        evidence_id
        for change in changes
        for evidence_id in (change.evidence_ids or [])
    }
    entity = query.column_descriptions[0]["entity"]
    query = query.filter(entity.person_id == person_id)
    if entity is Contradiction:
        query = query.filter(Contradiction.resolution_status == "unresolved")
    elif entity is InformationGap:
        query = query.filter(InformationGap.lifecycle_status == GapLifecycleStatus.OPEN)
    elif entity is OpenQuestion:
        query = query.filter(OpenQuestion.status == "open")
    elif entity is UncertaintyAssessment:
        query = query.filter(UncertaintyAssessment.is_active.is_(True))
    elif entity is ActionModel:
        query = query.filter(
            ActionModel.status.notin_(
                ["completed", "cancelled", "expired", "superseded"]
            )
        )

    if reference_time:
        timestamp_columns = {
            Contradiction: Contradiction.created_at,
            InformationGap: InformationGap.created_at,
            OpenQuestion: OpenQuestion.asked_at,
            UncertaintyAssessment: UncertaintyAssessment.assessed_at,
            CaregiverObservation: CaregiverObservation.created_at,
            ActionModel: ActionModel.created_at,
        }
        timestamp = timestamp_columns.get(entity)
        if timestamp is not None:
            start = reference_time - timedelta(days=120)
            end = reference_time + timedelta(days=1)
            query = query.filter(
                or_(
                    timestamp.is_(None),
                    and_(timestamp >= start, timestamp <= end),
                )
            )

    rows = query.all()
    selected = []
    subject_types = {change.subject_type for change in changes}
    subject_ids = {change.subject_id for change in changes}
    for row in rows:
        row_evidence = set(getattr(row, "evidence_ids", None) or [])
        if hasattr(row, "evidence_ref") and row.evidence_ref:
            row_evidence.add(row.evidence_ref)
        if hasattr(row, "source_evidence_id") and row.source_evidence_id:
            row_evidence.add(row.source_evidence_id)
        subject_match = getattr(row, "subject_type", None) in subject_types and getattr(
            row,
            "subject_id",
            None,
        ) in subject_ids
        if (evidence_ids and row_evidence & evidence_ids) or subject_match:
            selected.append(row)
    return selected


def _reporters(
    db: Session,
    events: Sequence[CareEvent],
    evidence: Sequence[Evidence],
) -> List[str]:
    ids = _unique(
        [
            event.created_by_caregiver_id
            for event in events
            if event.created_by_caregiver_id
        ]
        + [item.uploaded_by_caregiver_id for item in evidence if item.uploaded_by_caregiver_id]
    )
    if not ids:
        return []
    names = dict(db.query(Caregiver.id, Caregiver.name).filter(Caregiver.id.in_(ids)).all())
    return [names.get(item, item) for item in ids]


def _significance_dimensions(assessments: Sequence[SignificanceAssessment]) -> Dict[str, List[Dict[str, Any]]]:
    result: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for assessment in assessments:
        for item in assessment.dimensions or []:
            if isinstance(item, dict):
                result[str(item.get("name", item.get("dimension", "")))].append(item)
    return result


def _evidence_confidence(
    changes: Sequence[Change],
    assessments: Sequence[SignificanceAssessment],
    evidence: Sequence[Evidence],
    baselines: Sequence[Baseline],
) -> float:
    change_confidence = [_float(change.confidence, 0.0) for change in changes]
    assessment_confidence = [
        _float(assessment.evidence_confidence, 0.0) for assessment in assessments
    ]
    evidence_confidence = [_float(item.confidence, 0.0) for item in evidence]
    baseline_confidence = [_baseline_score(item.confidence) for item in baselines]
    values = change_confidence + assessment_confidence + evidence_confidence + baseline_confidence
    if not values:
        return 0.2
    return _clamp(sum(values) / len(values))


def _dimension_values(
    changes: Sequence[Change],
    events: Sequence[CareEvent],
    evidence: Sequence[Evidence],
    baselines: Sequence[Baseline],
    assessments: Sequence[SignificanceAssessment],
    contradictions: Sequence[Contradiction],
    gaps: Sequence[InformationGap],
    questions: Sequence[OpenQuestion],
    uncertainties: Sequence[UncertaintyAssessment],
    observations: Sequence[CaregiverObservation],
    actions: Sequence[ActionModel],
) -> Tuple[List[Dict[str, Any]], Dict[str, float], List[str], List[str], List[str], List[str], List[str]]:
    all_evidence_ids = _unique(
        [item.id for item in evidence]
        + [evidence_id for change in changes for evidence_id in (change.evidence_ids or [])]
        + [evidence_id for event in events for evidence_id in (event.evidence_ids or [])]
    )
    blob = _text(
        *[item.source_text for item in evidence],
        *[f"{event.title} {event.description}" for event in events],
        *[
            f"{change.previous_state} {change.current_state} {change.explanation}"
            for change in changes
        ],
        *[item.observation_content for item in observations],
        *[item.question for item in questions],
        *[item.description for item in gaps],
    )
    sig_dimensions = _significance_dimensions(assessments)
    functional = _has(blob, _FUNCTIONAL_KEYWORDS)
    safety = _has(blob, _SAFETY_KEYWORDS)
    attention = any(change.attention_candidate for change in changes) or any(
        assessment.attention_candidate for assessment in assessments
    )
    safety_score = 0.15
    if functional:
        safety_score = max(safety_score, 0.78)
    if safety:
        safety_score = max(safety_score, 0.92)
    if attention and functional:
        safety_score = max(safety_score, 0.9)
    if attention and not functional and not safety:
        safety_score = max(safety_score, 0.45)

    magnitude_values = []
    for change in changes:
        magnitude = _float(change.magnitude, 0.0)
        if change.change_type == ChangeType.ONSET and (change.current_count or 0) > 0:
            magnitude_values.append(1.0)
        elif magnitude:
            magnitude_values.append(min(abs(magnitude) / 100.0 if abs(magnitude) > 1 else abs(magnitude), 1.0))
    for values in sig_dimensions.get("magnitude", []) + sig_dimensions.get("deviation_from_baseline", []):
        magnitude_values.append(_float(values.get("score"), 0.0))
    magnitude_score = max(magnitude_values, default=0.15 if changes else 0.0)

    change_types = {_value(change.change_type) for change in changes}
    directions = {_value(change.change_direction) for change in changes}
    worsening = bool(change_types & {"onset", "increase", "recurrence", "persistence"})
    improving = bool(change_types & {"decrease", "cessation", "recovery", "stabilization"}) or bool(
        directions & {"decreasing", "improving", "recovering", "stabilizing"}
    )
    repeated = len(changes) >= 2 or any((change.current_count or 0) >= 2 for change in changes)
    trajectory_score = 0.25
    if worsening and repeated:
        trajectory_score = 0.9
    elif worsening:
        trajectory_score = 0.72
    elif repeated:
        trajectory_score = 0.68
    elif improving:
        trajectory_score = 0.25
    elif changes:
        trajectory_score = 0.35

    persistence_days = max([_float(change.persistence_days, 0.0) for change in changes] or [0.0])
    event_dates = [_utc(event.occurred_at) for event in events if event.occurred_at]
    if len(event_dates) >= 2:
        persistence_days = max(
            persistence_days,
            int((max(event_dates) - min(event_dates)).total_seconds() // 86400),
        )
    persistence_score = min(persistence_days / 30.0, 1.0)
    if any(change.is_persistent for change in changes if change.is_persistent is not None):
        persistence_score = max(persistence_score, 0.8)

    recurrence_count = max(
        [int(change.current_count or 0) for change in changes] + [len(changes)] + [0]
    )
    recurrence_score = min(recurrence_count / 3.0, 1.0)
    if "recurrence" in change_types:
        recurrence_score = 1.0

    evidence_confidence = _evidence_confidence(changes, assessments, evidence, baselines)
    low_baseline = any(_baseline_score(item.confidence) < 0.7 for item in baselines)
    uncertainty_score = 1.0 - evidence_confidence
    if low_baseline:
        uncertainty_score = max(uncertainty_score, 0.65)
    if gaps:
        uncertainty_score = max(uncertainty_score, 0.75)
    if uncertainties:
        uncertainty_score = max(uncertainty_score, 0.7)
    if not evidence:
        uncertainty_score = max(uncertainty_score, 0.9)

    contradiction_score = 0.0
    if contradictions or _reports_conflict(events):
        contradiction_score = min(0.8 + 0.1 * max(0, len(contradictions) - 1), 1.0)

    vulnerability_factors = []
    if _has(blob, ("condition", "diagnosis", "history of")):
        vulnerability_factors.append(VulnerabilityFactor.KNOWN_CONDITIONS.value)
    if _has(blob, _MEDICATION_KEYWORDS):
        vulnerability_factors.append(VulnerabilityFactor.CURRENT_MEDICATIONS.value)
    if functional:
        vulnerability_factors.append(VulnerabilityFactor.FUNCTIONAL_STATUS.value)
    if _has(blob, ("memory", "cognitive", "confusion", "disoriented")):
        vulnerability_factors.append(VulnerabilityFactor.COGNITIVE_BASELINE.value)
    if changes:
        vulnerability_factors.append(VulnerabilityFactor.RECENT_CHANGES.value)
    if len(events) >= 2:
        vulnerability_factors.append(VulnerabilityFactor.PRIOR_RELEVANT_EVENTS.value)
    if _has(blob, ("caregiver", "help", "assistance", "dependent")):
        vulnerability_factors.append(VulnerabilityFactor.CARE_DEPENDENCIES.value)
    if _has(blob, ("hospital", "discharge", "transition", "moved")):
        vulnerability_factors.append(VulnerabilityFactor.RECENT_TRANSITIONS.value)
    if gaps or questions or contradictions:
        vulnerability_factors.append(VulnerabilityFactor.UNRESOLVED_ISSUES.value)
    vulnerability_score = min(0.25 + 0.09 * len(vulnerability_factors), 0.95) if vulnerability_factors else 0.15

    concern = _has(blob, _CONCERN_KEYWORDS) or bool(questions) or bool(observations)
    caregiver_score = 0.9 if _has(blob, ("concerned", "worried", "what should i do", "please advise")) else 0.0
    if questions:
        caregiver_score = max(caregiver_score, 0.8)
    if observations:
        caregiver_score = max(caregiver_score, 0.55)
    if concern and caregiver_score == 0.0:
        caregiver_score = 0.45

    actionability_factors = []
    if _has(blob, _MEDICATION_KEYWORDS) and _has(blob, ("unclear", "missed", "changed", "dose")):
        actionability_factors.append(ActionabilityFactor.MEDICATION_ADMINISTRATION_UNCLEAR.value)
    if _has(blob, _APPOINTMENT_KEYWORDS):
        actionability_factors.append(ActionabilityFactor.APPOINTMENT_APPROACHING.value)
    if _has(blob, _SYMPTOM_KEYWORDS) and worsening:
        actionability_factors.append(ActionabilityFactor.NEW_SYMPTOM_NEEDS_DISCUSSION.value)
    if contradictions:
        actionability_factors.append(ActionabilityFactor.CONFLICTING_CAREGIVER_REPORTS.value)
    if _has(blob, _MEASUREMENT_KEYWORDS) and (gaps or _has(blob, ("missing", "unknown"))):
        actionability_factors.append(ActionabilityFactor.IMPORTANT_MEASUREMENT_MISSING.value)
    if questions or gaps:
        actionability_factors.append(ActionabilityFactor.FOLLOW_UP_QUESTION_UNRESOLVED.value)
    if _has(blob, _DECISION_KEYWORDS):
        actionability_factors.append(ActionabilityFactor.CARE_DECISION_PENDING.value)
    active_actions = [
        action
        for action in actions
        if action.status not in {"completed", "cancelled", "expired", "superseded"}
    ]
    if active_actions:
        if any(action.requires_confirmation for action in active_actions):
            actionability_factors.append(ActionabilityFactor.FOLLOW_UP_QUESTION_UNRESOLVED.value)
        if any(action.is_medication_action for action in active_actions):
            actionability_factors.append(ActionabilityFactor.MEDICATION_ADMINISTRATION_UNCLEAR.value)
    actionability_score = min(0.35 + 0.12 * len(actionability_factors), 0.95) if actionability_factors else 0.1
    if any(change.follow_up_candidate for change in changes):
        actionability_score = max(actionability_score, 0.55)
    if any(action.requires_confirmation or action.risk_tier == "high" for action in active_actions):
        actionability_score = max(actionability_score, 0.65)

    dimensions = [
        _dimension(
            PriorityDimension.SAFETY_SIGNIFICANCE,
            safety_score,
            "functional or safety impact documented" if functional or safety else "no direct safety impact documented",
            all_evidence_ids if functional or safety else [],
            "Safety significance is based on documented functional impact or explicit safety language, not a diagnosis.",
        ),
        _dimension(
            PriorityDimension.MAGNITUDE,
            magnitude_score,
            "change is large or new relative to the available baseline" if magnitude_score >= 0.6 else "change magnitude is limited or unquantified",
            all_evidence_ids,
            "Magnitude is normalized from recorded change data and significance evidence.",
        ),
        _dimension(
            PriorityDimension.TRAJECTORY,
            trajectory_score,
            "worsening or repeated pattern" if trajectory_score >= 0.6 else "isolated or improving pattern",
            all_evidence_ids,
            "Trajectory is derived from change direction, type, and repeated observations.",
        ),
        _dimension(
            PriorityDimension.PERSISTENCE,
            persistence_score,
            f"{int(persistence_days)} days observed" if persistence_days else "persistence not established",
            [event.id for event in events] or all_evidence_ids,
            "Persistence uses recorded observation span and explicit change persistence.",
        ),
        _dimension(
            PriorityDimension.RECURRENCE,
            recurrence_score,
            f"{recurrence_count} occurrence(s) in the available window",
            [event.id for event in events] or all_evidence_ids,
            "Recurrence uses distinct recorded occurrences without counting the same evidence twice.",
        ),
        _dimension(
            PriorityDimension.UNCERTAINTY,
            uncertainty_score,
            "important uncertainty remains" if uncertainty_score >= 0.5 else "evidence is comparatively complete",
            all_evidence_ids,
            "Uncertainty reflects evidence quality, baseline quality, missing information, and attribution.",
        ),
        _dimension(
            PriorityDimension.CONTRADICTION,
            contradiction_score,
            "conflicting observations or records are present" if contradiction_score else "no contradiction detected",
            [item.id for item in contradictions] or all_evidence_ids,
            "Contradictions are preserved as uncertainty rather than silently resolved.",
        ),
        _dimension(
            PriorityDimension.VULNERABILITY_CONTEXT,
            vulnerability_score,
            "relevant care-context factors are present" if vulnerability_factors else "limited vulnerability context recorded",
            all_evidence_ids,
            "Vulnerability context is limited to recorded care-state factors.",
        ),
        _dimension(
            PriorityDimension.CAREGIVER_CONCERN,
            caregiver_score,
            "caregiver concern or an unresolved question is recorded" if caregiver_score >= 0.5 else "no explicit caregiver concern recorded",
            [item.evidence_ref for item in observations if item.evidence_ref] or all_evidence_ids,
            "Caregiver concern is based on explicit language, questions, or observations.",
        ),
        _dimension(
            PriorityDimension.ACTIONABILITY,
            actionability_score,
            "an unresolved care question or decision point is recorded" if actionability_factors else "no unresolved decision point recorded",
            all_evidence_ids,
            "Actionability identifies an unresolved question; it does not prescribe an action.",
        ),
    ]
    scores = {item["dimension"]: float(item["score"]) for item in dimensions}
    return (
        dimensions,
        scores,
        _unique(vulnerability_factors),
        _unique(actionability_factors),
        all_evidence_ids,
        _unique(vulnerability_factors),
        _unique(actionability_factors),
    )


class PrioritizationEngine:
    def __init__(self, db: Session) -> None:
        self.db = db

    def detect(
        self,
        person_id: str,
        subject_type: Optional[str] = None,
        subject_id: Optional[str] = None,
        reference_time: Optional[Any] = None,
        changes: Optional[Sequence[Change]] = None,
        situations: Optional[Sequence[Situation]] = None,
    ) -> List[Prioritization]:
        reference_dt = _parse_time(reference_time) or datetime.now(timezone.utc)
        active_changes = _active_changes(
            self.db,
            person_id,
            subject_type,
            subject_id,
            changes,
        )
        if not active_changes:
            return []

        groups: Dict[Tuple[str, str], List[Change]] = defaultdict(list)
        for change in active_changes:
            groups[(change.subject_type, change.subject_id or "")].append(change)

        ordered_groups = sorted(
            groups.items(),
            key=lambda item: max(
                (_utc(change.created_at) or datetime.min.replace(tzinfo=timezone.utc) for change in item[1]),
                default=datetime.min.replace(tzinfo=timezone.utc),
            ),
            reverse=True,
        )
        prioritizations = []
        for (group_type, group_id), group_changes in ordered_groups:
            prioritizations.append(
                self._build_prioritization(
                    person_id,
                    group_type,
                    group_id,
                    group_changes,
                    reference_dt,
                    situations,
                )
            )
        return prioritizations

    def detect_prioritizations(self, *args: Any, **kwargs: Any) -> List[Prioritization]:
        return self.detect(*args, **kwargs)

    def prioritize_changes(self, *args: Any, **kwargs: Any) -> List[Prioritization]:
        return self.detect(*args, **kwargs)

    def rank(
        self,
        person_id: str,
        prioritizations: Optional[Sequence[Prioritization]] = None,
        reference_time: Optional[Any] = None,
    ) -> List[PrioritizationRanking]:
        del reference_time
        if prioritizations is None:
            items = (
                self.db.query(Prioritization)
                .filter(Prioritization.person_id == person_id, Prioritization.is_active.is_(True))
                .all()
            )
        else:
            items = [item for item in prioritizations if item.person_id == person_id]
        if not items:
            return []

        ordered = sorted(items, key=self._rank_key)
        rankings = []
        for rank, item in enumerate(ordered, 1):
            existing = (
                self.db.query(PrioritizationRanking)
                .filter(
                    PrioritizationRanking.person_id == person_id,
                    PrioritizationRanking.prioritization_id == item.id,
                )
                .order_by(PrioritizationRanking.created_at.desc())
                .first()
            )
            reason = self._ranking_reason(item, rank)
            if existing:
                existing.rank = rank
                existing.reason = reason
                ranking = existing
            else:
                ranking = PrioritizationRanking(
                    person_id=person_id,
                    prioritization_id=item.id,
                    rank=rank,
                    reason=reason,
                )
                self.db.add(ranking)
            rankings.append(ranking)
        self.db.flush()
        return rankings

    def rank_prioritizations(self, *args: Any, **kwargs: Any) -> List[PrioritizationRanking]:
        return self.rank(*args, **kwargs)

    def list_prioritizations(
        self,
        person_id: str,
        subject_type: Optional[str] = None,
        subject_id: Optional[str] = None,
    ) -> List[Prioritization]:
        query = self.db.query(Prioritization).filter(
            Prioritization.person_id == person_id,
            Prioritization.is_active.is_(True),
        )
        if subject_type:
            query = query.filter(Prioritization.subject_type == subject_type)
        if subject_id is not None:
            query = query.filter(Prioritization.subject_id == subject_id)
        return query.order_by(Prioritization.created_at.desc()).all()

    def get_prioritization(
        self,
        person_id: str,
        prioritization_id: str,
    ) -> Optional[Prioritization]:
        return (
            self.db.query(Prioritization)
            .filter(
                Prioritization.person_id == person_id,
                Prioritization.id == prioritization_id,
                Prioritization.is_active.is_(True),
            )
            .first()
        )

    def _context(
        self,
        changes: Sequence[Change],
        situations: Optional[Sequence[Situation]],
        reference_time: Optional[datetime],
    ) -> Dict[str, List[Any]]:
        events = _events_for_changes(
            self.db,
            changes[0].person_id,
            changes,
            reference_time,
        )
        evidence = _evidence_for_changes(self.db, changes)
        baselines = _baselines_for_changes(self.db, changes)
        assessments = _assessments_for_changes(self.db, changes)
        evidence_ids = _unique(
            [item.id for item in evidence]
            + [evidence_id for change in changes for evidence_id in (change.evidence_ids or [])]
        )
        contradiction_query = self.db.query(Contradiction)
        gap_query = self.db.query(InformationGap)
        question_query = self.db.query(OpenQuestion)
        uncertainty_query = self.db.query(UncertaintyAssessment)
        observation_query = self.db.query(CaregiverObservation)
        action_query = self.db.query(ActionModel)
        return {
            "changes": list(changes),
            "events": events,
            "evidence": evidence,
            "baselines": baselines,
            "assessments": assessments,
            "contradictions": _matching_rows(
                contradiction_query,
                changes[0].person_id,
                changes,
                reference_time,
            ),
            "gaps": _matching_rows(
                gap_query,
                changes[0].person_id,
                changes,
                reference_time,
            ),
            "questions": _matching_rows(
                question_query,
                changes[0].person_id,
                changes,
                reference_time,
            ),
            "uncertainties": _matching_rows(
                uncertainty_query,
                changes[0].person_id,
                changes,
                reference_time,
            ),
            "observations": _matching_rows(
                observation_query,
                changes[0].person_id,
                changes,
                reference_time,
            ),
            "actions": _matching_rows(
                action_query,
                changes[0].person_id,
                changes,
                reference_time,
            ),
            "situations": list(situations or []),
            "evidence_ids": evidence_ids,
        }

    def _build_prioritization(
        self,
        person_id: str,
        subject_type: str,
        subject_id: str,
        changes: Sequence[Change],
        reference_time: datetime,
        situations: Optional[Sequence[Situation]],
    ) -> Prioritization:
        context = self._context(changes, situations, reference_time)
        dimensions, scores, vulnerability_values, actionability_values, evidence_ids, _, _ = (
            _dimension_values(
                changes,
                context["events"],
                context["evidence"],
                context["baselines"],
                context["assessments"],
                context["contradictions"],
                context["gaps"],
                context["questions"],
                context["uncertainties"],
                context["observations"],
                context["actions"],
            )
        )
        confidence = self._overall_confidence(
            changes,
            context["assessments"],
            context["evidence"],
            context["baselines"],
            context["contradictions"],
            context["gaps"],
        )
        priority = self._priority_level(scores, confidence, context)
        trajectory = self._trajectory(scores, changes)
        reasons = self._reason_categories(priority, scores, context)
        primary_reason = reasons[0] if reasons else None
        persistence_days = self._persistence_days(changes, context["events"])
        recurrence_count = max(
            [int(change.current_count or 0) for change in changes] + [len(changes)] + [0]
        )
        concern_evidence_ids = self._concern_evidence_ids(
            context["evidence"],
            context["observations"],
            context["questions"],
        )
        possible_context = self._possible_context(
            context,
            scores,
        )
        attribution = _reporters(self.db, context["events"], context["evidence"])
        explanation = self._explanation(
            subject_type,
            subject_id,
            changes,
            scores,
            confidence,
            priority,
            context,
            possible_context,
        )
        baseline_reference = ", ".join(
            baseline.id for baseline in context["baselines"]
        ) or "not established"
        baseline_quality = self._baseline_quality(context["baselines"])
        temporal_scope = self._temporal_scope(changes, context["events"], reference_time)

        existing = (
            self.db.query(Prioritization)
            .filter(
                Prioritization.person_id == person_id,
                Prioritization.subject_type == subject_type,
                Prioritization.subject_id == subject_id,
                Prioritization.is_active.is_(True),
            )
            .order_by(Prioritization.created_at.desc())
            .first()
        )
        if existing and set(existing.change_ids or []) == {change.id for change in changes}:
            return existing

        prioritization = Prioritization(
            person_id=person_id,
            subject_type=subject_type,
            subject_id=subject_id,
            priority_level=priority,
            overall_confidence=confidence,
            change_ids=[change.id for change in changes],
            evidence_ids=evidence_ids,
            baseline_reference=baseline_reference,
            trajectory=trajectory,
            persistence_days=persistence_days,
            is_persistent=any(change.is_persistent for change in changes if change.is_persistent is not None),
            is_recurrent="recurrence" in {_value(change.change_type) for change in changes} or recurrence_count > 1,
            recurrence_count=recurrence_count,
            dimensions=dimensions,
            uncertainty_factors=self._uncertainty_factors(context, scores),
            contradiction_types=[
                ContradictionType.EVIDENCE_CONFLICT.value
                for _ in context["contradictions"]
            ],
            vulnerability_factors=vulnerability_values,
            actionability_factors=actionability_values,
            caregiver_concern_expressed=bool(concern_evidence_ids),
            caregiver_concern_evidence_ids=concern_evidence_ids,
            primary_reason_category=primary_reason,
            reason_categories=reasons,
            possible_context=possible_context,
            explanation=explanation,
            attribution=attribution,
            temporal_scope=temporal_scope,
            comparison_baseline_quality=baseline_quality,
            is_active=True,
        )
        self.db.add(prioritization)
        self.db.flush()
        for item in dimensions:
            self.db.add(
                PrioritizationDimension(
                    prioritization_id=prioritization.id,
                    dimension=PriorityDimension(item["dimension"]),
                    score=item["score"],
                    label=item["label"],
                    evidence_ids=item["evidence_ids"],
                    explanation=item["explanation"],
                )
            )
        if existing:
            existing.is_active = False
            existing.superseded_by_prioritization_id = prioritization.id
        self.db.flush()
        return prioritization

    def _overall_confidence(
        self,
        changes: Sequence[Change],
        assessments: Sequence[SignificanceAssessment],
        evidence: Sequence[Evidence],
        baselines: Sequence[Baseline],
        contradictions: Sequence[Contradiction],
        gaps: Sequence[InformationGap],
    ) -> float:
        change_confidence = [_float(change.confidence, 0.0) for change in changes]
        assessment_confidence = [
            _float(assessment.significance_confidence, 0.0) for assessment in assessments
        ]
        evidence_confidence = [_float(item.confidence, 0.0) for item in evidence]
        baseline_confidence = [_baseline_score(item.confidence) for item in baselines]
        values = change_confidence + assessment_confidence + evidence_confidence + baseline_confidence
        confidence = sum(values) / len(values) if values else 0.2
        if contradictions:
            confidence *= 0.6
        if gaps:
            confidence *= 0.9
        if not evidence:
            confidence *= 0.55
        return _clamp(confidence)

    def _priority_level(
        self,
        scores: Dict[str, float],
        confidence: float,
        context: Dict[str, List[Any]],
    ) -> PriorityLevel:
        safety = scores[PriorityDimension.SAFETY_SIGNIFICANCE.value]
        trajectory = scores[PriorityDimension.TRAJECTORY.value]
        recurrence = scores[PriorityDimension.RECURRENCE.value]
        actionability = scores[PriorityDimension.ACTIONABILITY.value]
        caregiver = scores[PriorityDimension.CAREGIVER_CONCERN.value]
        contradiction = scores[PriorityDimension.CONTRADICTION.value]
        aligned = sum(
            scores[name] >= 0.6
            for name in (
                PriorityDimension.SAFETY_SIGNIFICANCE.value,
                PriorityDimension.TRAJECTORY.value,
                PriorityDimension.PERSISTENCE.value,
                PriorityDimension.RECURRENCE.value,
                PriorityDimension.ACTIONABILITY.value,
            )
        )
        meaningful = any(
            _value(change.significance_verdict) == SignificanceVerdict.MEANINGFUL_CANDIDATE.value
            or change.attention_candidate
            for change in context["changes"]
        ) if "changes" in context else False
        has_evidence = bool(context["evidence"])
        if contradiction >= 0.7 and safety < 0.85:
            return PriorityLevel.INSUFFICIENT_EVIDENCE
        if safety >= 0.85 and (trajectory >= 0.7 or recurrence >= 0.7) and confidence >= 0.55 and has_evidence:
            return PriorityLevel.CRITICAL
        if (meaningful or safety >= 0.65) and has_evidence and (
            aligned >= 2 or actionability >= 0.7 or caregiver >= 0.7
        ):
            return PriorityLevel.HIGH
        if has_evidence and (meaningful or actionability >= 0.55 or caregiver >= 0.65):
            return PriorityLevel.MODERATE
        if confidence < 0.35 or not has_evidence:
            return PriorityLevel.INSUFFICIENT_EVIDENCE
        return PriorityLevel.LOW

    def _trajectory(
        self,
        scores: Dict[str, float],
        changes: Sequence[Change],
    ) -> TrajectoryType:
        change_types = {_value(change.change_type) for change in changes}
        if scores[PriorityDimension.TRAJECTORY.value] >= 0.7:
            return TrajectoryType.WORSENING
        if "recurrence" in change_types or scores[PriorityDimension.RECURRENCE.value] >= 0.7:
            return TrajectoryType.RECURRENCE
        if scores[PriorityDimension.PERSISTENCE.value] >= 0.6:
            return TrajectoryType.PERSISTENT_DEVIATION
        if len(changes) >= 2:
            return TrajectoryType.REPEATED
        if change_types & {"decrease", "cessation", "recovery", "stabilization"}:
            return TrajectoryType.RECOVERING
        if changes:
            return TrajectoryType.ISOLATED
        return TrajectoryType.UNKNOWN

    def _reason_categories(
        self,
        priority: PriorityLevel,
        scores: Dict[str, float],
        context: Dict[str, List[Any]],
    ) -> List[PriorityReasonCategory]:
        reasons = []
        if context["contradictions"]:
            reasons.append(PriorityReasonCategory.CONFLICTING_EVIDENCE)
        if context["questions"] or context["gaps"]:
            reasons.append(PriorityReasonCategory.CAREGIVER_EXPRESSED_CONCERN)
        if scores[PriorityDimension.TRAJECTORY.value] >= 0.7:
            reasons.append(PriorityReasonCategory.WORSENING_TRAJECTORY)
        if scores[PriorityDimension.RECURRENCE.value] >= 0.7:
            reasons.append(PriorityReasonCategory.RECURRENT_CHANGE)
        if scores[PriorityDimension.PERSISTENCE.value] >= 0.6:
            reasons.append(PriorityReasonCategory.PERSISTENT_DEVIATION)
        if context["baselines"] and any(
            _baseline_score(baseline.confidence) < 0.7 for baseline in context["baselines"]
        ):
            reasons.append(PriorityReasonCategory.BASELINE_QUALITY_CONCERN)
        if scores[PriorityDimension.SAFETY_SIGNIFICANCE.value] >= 0.6:
            reasons.append(PriorityReasonCategory.FUNCTIONAL_IMPACT_DOCUMENTED)
        if sum(scores[name] >= 0.6 for name in scores) >= 3:
            reasons.append(PriorityReasonCategory.MULTIPLE_DIMENSIONS_ALIGN)
        if scores[PriorityDimension.ACTIONABILITY.value] >= 0.6:
            reasons.append(PriorityReasonCategory.UPCOMING_DECISION_POINT)
        if priority == PriorityLevel.INSUFFICIENT_EVIDENCE:
            reasons.append(PriorityReasonCategory.INSUFFICIENT_EVIDENCE)
        if not reasons:
            reasons.append(PriorityReasonCategory.STABLE)
        return _unique(reasons)

    def _possible_context(
        self,
        context: Dict[str, List[Any]],
        scores: Dict[str, float],
    ) -> List[str]:
        values = []
        if not context["baselines"]:
            values.append("No established baseline is available for this subject.")
        if not context["evidence"]:
            values.append("No linked evidence record is available.")
        if context["contradictions"]:
            values.append("Conflicting records remain unresolved.")
        if context["gaps"] or context["questions"]:
            values.append("One or more care questions remain unresolved.")
        if scores[PriorityDimension.UNCERTAINTY.value] >= 0.6:
            values.append("Evidence quality or attribution may limit confidence.")
        if len(context["events"]) > 1:
            values.append("Repeated documentation may reflect reporting cadence.")
        values.append("Association does not establish causation or diagnosis.")
        return _unique(values)

    def _explanation(
        self,
        subject_type: str,
        subject_id: str,
        changes: Sequence[Change],
        scores: Dict[str, float],
        confidence: float,
        priority: PriorityLevel,
        context: Dict[str, List[Any]],
        possible_context: Sequence[str],
    ) -> str:
        evidence_ids = _unique(
            [item.id for item in context["evidence"]]
            + [change.id for change in changes]
            + [item.id for item in context["contradictions"]]
        )
        evidence_text = ", ".join(evidence_ids) if evidence_ids else "no linked evidence"
        dimensions = ", ".join(
            f"{name}={score:.2f}"
            for name, score in sorted(scores.items(), key=lambda item: item[1], reverse=True)[:4]
        )
        uncertainty = " ".join(possible_context)
        return (
            f"Attention priority for {subject_type} {subject_id or ''} is based on "
            f"{len(changes)} active change record(s), evidence {evidence_text}, and dimensions "
            f"{dimensions}. Overall confidence is {confidence:.2f}; priority is "
            f"{priority.value}. {uncertainty} This is an attention ranking, not a diagnosis or care instruction."
        )

    def _ranking_reason(self, item: Prioritization, rank: int) -> str:
        return f"Rank {rank}: {item.priority_level.value}. {item.explanation or 'No explanation recorded.'}"

    def _rank_key(self, item: Prioritization) -> Tuple[Any, ...]:
        dimensions = {entry.get("dimension"): _float(entry.get("score")) for entry in item.dimensions or []}
        priority = item.priority_level if hasattr(item.priority_level, "value") else PriorityLevel(item.priority_level)
        return (
            _PRIORITY_ORDER.get(priority, 99),
            -_float(item.overall_confidence),
            -dimensions.get(PriorityDimension.SAFETY_SIGNIFICANCE.value, 0.0),
            -dimensions.get(PriorityDimension.TRAJECTORY.value, 0.0),
            -dimensions.get(PriorityDimension.RECURRENCE.value, 0.0),
            -dimensions.get(PriorityDimension.PERSISTENCE.value, 0.0),
            _utc(item.created_at) or datetime.min.replace(tzinfo=timezone.utc),
        )

    def _persistence_days(
        self,
        changes: Sequence[Change],
        events: Sequence[CareEvent],
    ) -> int:
        values = [int(change.persistence_days or 0) for change in changes]
        dates = [_utc(event.occurred_at) for event in events if event.occurred_at]
        if len(dates) >= 2:
            values.append(int((max(dates) - min(dates)).total_seconds() // 86400))
        return max(values or [0])

    def _baseline_quality(self, baselines: Sequence[Baseline]) -> str:
        if not baselines:
            return "not established"
        values = [_baseline_score(baseline.confidence) for baseline in baselines]
        average = sum(values) / len(values)
        if average >= 0.85:
            return "high"
        if average >= 0.55:
            return "moderate"
        if average >= 0.3:
            return "low"
        return "insufficient"

    def _temporal_scope(
        self,
        changes: Sequence[Change],
        events: Sequence[CareEvent],
        reference_time: datetime,
    ) -> Dict[str, Any]:
        dates = [_utc(event.occurred_at) for event in events if event.occurred_at]
        dates += [_utc(change.created_at) for change in changes if change.created_at]
        start = min(dates) if dates else None
        end = max(dates) if dates else None
        return {
            "start": start.isoformat() if start else None,
            "end": end.isoformat() if end else None,
            "window_days": int((end - start).total_seconds() // 86400) if start and end else 0,
            "reference_time": reference_time.isoformat(),
        }

    def _concern_evidence_ids(
        self,
        evidence: Sequence[Evidence],
        observations: Sequence[CaregiverObservation],
        questions: Sequence[OpenQuestion],
    ) -> List[str]:
        ids = [item.evidence_ref for item in observations if item.evidence_ref]
        ids += [item.evidence_ids[0] for item in questions if item.evidence_ids]
        ids += [item.id for item in evidence if _has(item.source_text, _CONCERN_KEYWORDS)]
        return _unique(ids)

    def _uncertainty_factors(
        self,
        context: Dict[str, List[Any]],
        scores: Dict[str, float],
    ) -> List[str]:
        factors = []
        if not context["baselines"]:
            factors.append(UncertaintyFactor.BASELINE_POORLY_ESTABLISHED.value)
        if not context["evidence"]:
            factors.append(UncertaintyFactor.EVIDENCE_QUALITY_LOW.value)
        if context["gaps"]:
            factors.append(UncertaintyFactor.IMPORTANT_INFORMATION_ABSENT.value)
        if context["contradictions"]:
            factors.append(UncertaintyFactor.CAREGIVER_ACCOUNTS_CONFLICT.value)
        if any(not event.occurred_at or not event.time_provenance for event in context["events"]):
            factors.append(UncertaintyFactor.TIMING_UNCERTAIN.value)
        if not _reporters(self.db, context["events"], context["evidence"]):
            factors.append(UncertaintyFactor.ATTRIBUTION_UNCERTAIN.value)
        if scores[PriorityDimension.ACTIONABILITY.value] >= 0.6 and _has(
            _text(*[item.source_text for item in context["evidence"]]),
            _MEDICATION_KEYWORDS,
        ):
            factors.append(UncertaintyFactor.MEDICATION_ADMINISTRATION_UNCLEAR.value)
        return _unique(factors)


PrioritizationService = PrioritizationEngine
CarePrioritizationEngine = PrioritizationEngine


def detect_prioritization(
    db: Session,
    person_id: str,
    subject_type: Optional[str] = None,
    subject_id: Optional[str] = None,
    reference_time: Optional[Any] = None,
    changes: Optional[Sequence[Change]] = None,
    situations: Optional[Sequence[Situation]] = None,
) -> List[Prioritization]:
    return PrioritizationEngine(db).detect(
        person_id,
        subject_type,
        subject_id,
        reference_time,
        changes,
        situations,
    )


def detect_prioritizations(
    db: Session,
    person_id: str,
    subject_type: Optional[str] = None,
    subject_id: Optional[str] = None,
    reference_time: Optional[Any] = None,
    changes: Optional[Sequence[Change]] = None,
    situations: Optional[Sequence[Situation]] = None,
) -> List[Prioritization]:
    return detect_prioritization(
        db,
        person_id,
        subject_type,
        subject_id,
        reference_time,
        changes,
        situations,
    )


def prioritize_changes(
    db: Session,
    person_id: str,
    subject_type: Optional[str] = None,
    subject_id: Optional[str] = None,
    reference_time: Optional[Any] = None,
    changes: Optional[Sequence[Change]] = None,
    situations: Optional[Sequence[Situation]] = None,
) -> List[Prioritization]:
    return detect_prioritization(
        db,
        person_id,
        subject_type,
        subject_id,
        reference_time,
        changes,
        situations,
    )


def rank_prioritizations(
    db: Session,
    person_id: str,
    prioritizations: Optional[Sequence[Prioritization]] = None,
    reference_time: Optional[Any] = None,
) -> List[PrioritizationRanking]:
    return PrioritizationEngine(db).rank(person_id, prioritizations, reference_time)

