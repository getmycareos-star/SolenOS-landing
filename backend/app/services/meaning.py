from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any, Tuple
import math

from sqlalchemy.orm import Session

from app.core.meaning_enums import (
    EpistemicLevel,
    TemporalScopeClassification,
    LongitudinalPatternCategory,
    BaselineRelationship,
    EvidenceRelationship,
    CausalStatus,
    MeaningConfidenceType,
    ContextFactorType,
    CaregiverPerspective,
)
from app.core.change_enums import SignificanceVerdict, EvidenceStatus, BaselineConfidence
from app.models.meaning import Meaning, MeaningEvidenceLink, MeaningChangeLink
from app.models.change import Change, Baseline, Pattern
from app.models.prioritization import Prioritization
from app.models.care import Evidence, CareEvent, Caregiver
from app.models.significance import SignificanceAssessment
from app.models.causal import CausalHypothesis
from app.models.uncertainty import Contradiction, InformationGap, OpenQuestion

def _ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    if math.isinf(f) or math.isnan(f):
        return None
    return f


def _resolve_reporters(db: Session, reporter_ids: Optional[List[str]]) -> List[str]:
    if not reporter_ids:
        return []
    seen = []
    for r in reporter_ids:
        if r not in seen:
            seen.append(r)
    rows = dict(
        db.query(Caregiver.id, Caregiver.name)
        .filter(Caregiver.id.in_(seen))
        .all()
    )
    return [rows.get(r, r) for r in seen]


def _classify_baseline_relationship(
    current_value: Optional[Any],
    baseline_state: Optional[str],
    change_direction: Optional[Any],
) -> BaselineRelationship:
    if current_value is None and baseline_state is None:
        return BaselineRelationship.NEW
    if current_value is None or baseline_state is None:
        return BaselineRelationship.UNKNOWN
    try:
        if float(current_value) > float(baseline_state):
            return BaselineRelationship.ABOVE_BASELINE
        if float(current_value) < float(baseline_state):
            return BaselineRelationship.BELOW_BASELINE
        return BaselineRelationship.SAME_AS_BASELINE
    except (TypeError, ValueError):
        if str(current_value) == str(baseline_state):
            return BaselineRelationship.SAME_AS_BASELINE
        return BaselineRelationship.ABOVE_BASELINE


def _classify_longitudinal_pattern(
    changes: List[Change],
    patterns: List[Pattern],
) -> LongitudinalPatternCategory:
    if not changes and not patterns:
        return LongitudinalPatternCategory.NOT_ENOUGH_DATA

    if patterns:
        for p in patterns:
            pt = p.pattern_type.value if hasattr(p.pattern_type, 'value') else str(p.pattern_type)
            if pt == "trend" and p.direction:
                dir_val = p.direction.value if hasattr(p.direction, 'value') else str(p.direction)
                if dir_val == "increasing":
                    return LongitudinalPatternCategory.DECLINING
                if dir_val == "decreasing":
                    return LongitudinalPatternCategory.IMPROVING
                if dir_val == "stable":
                    return LongitudinalPatternCategory.STABLE
                if dir_val == "fluctuating":
                    return LongitudinalPatternCategory.FLUCTUATING

    if len(changes) < 2:
        return LongitudinalPatternCategory.NOT_ENOUGH_DATA

    directions = []
    for c in changes:
        d = c.change_direction.value if hasattr(c.change_direction, 'value') else str(c.change_direction)
        directions.append(d)

    if all(d == "stable" for d in directions):
        return LongitudinalPatternCategory.STABLE
    if all(d == "increasing" for d in directions):
        return LongitudinalPatternCategory.DECLINING
    if all(d == "decreasing" for d in directions):
        return LongitudinalPatternCategory.IMPROVING
    if len(set(directions)) > 1:
        return LongitudinalPatternCategory.FLUCTUATING
    return LongitudinalPatternCategory.NOT_ENOUGH_DATA


def _classify_temporal_scope(
    changes: List[Change],
    baseline: Optional[Baseline],
) -> TemporalScopeClassification:
    now = datetime.now(timezone.utc)
    relevant_dates: List[datetime] = []

    if baseline:
        relevant_dates.append(_ensure_utc(baseline.window_start) or now)
        if baseline.window_end:
            relevant_dates.append(_ensure_utc(baseline.window_end))

    for c in changes:
        if c.created_at:
            relevant_dates.append(_ensure_utc(c.created_at) or now)

    if not relevant_dates:
        return TemporalScopeClassification.UNKNOWN

    earliest = min(relevant_dates)
    span_days = (now - earliest).total_seconds() / 86400.0

    if span_days < 1:
        return TemporalScopeClassification.POINT_IN_TIME
    if span_days <= 7:
        return TemporalScopeClassification.SHORT_TERM
    if span_days >= 90:
        return TemporalScopeClassification.CHRONIC
    return TemporalScopeClassification.LONG_TERM


def _classify_causal_status(
    causal_hypotheses: List[CausalHypothesis],
) -> CausalStatus:
    if not causal_hypotheses:
        return CausalStatus.CAUSALITY_NOT_ESTABLISHED
    for h in causal_hypotheses:
        status = h.relationship_status.value if hasattr(h.relationship_status, 'value') else str(h.relationship_status)
        confidence = h.causal_confidence.value if hasattr(h.causal_confidence, 'value') else str(h.causal_confidence)
        if status == "supported" and confidence in ("supported", "established"):
            return CausalStatus.CAUSAL_RELATIONSHIP
        if status == "conflicting":
            return CausalStatus.ASSOCIATED
        if status == "causality_unknown":
            return CausalStatus.CAUSALITY_NOT_ESTABLISHED
    return CausalStatus.ASSOCIATED


def _classify_evidence_relationship(
    evidence_status: EvidenceStatus,
    has_contradictions: bool,
    has_gaps: bool,
) -> EvidenceRelationship:
    if has_contradictions:
        return EvidenceRelationship.MIXED
    if evidence_status == EvidenceStatus.CONFIRMED:
        return EvidenceRelationship.SUPPORTS
    if evidence_status == EvidenceStatus.CONTRADICTORY:
        return EvidenceRelationship.CONTRADICTS
    if evidence_status == EvidenceStatus.REPORTED:
        return EvidenceRelationship.SUPPORTS
    return EvidenceRelationship.NOT_SUPPORTED


def _compute_meaning_confidence(
    significance: Optional[SignificanceAssessment],
    change_confidence: float,
    baseline_confidence: BaselineConfidence,
    has_contradictions: bool,
    has_gaps: bool,
    has_open_questions: bool,
    n_evidence: int,
) -> Tuple[float, MeaningConfidenceType]:
    if significance:
        evidence_conf = _float(significance.evidence_confidence) or 0.0
        sig_conf = _float(significance.significance_confidence) or 0.0
        base = (evidence_conf * 0.5 + sig_conf * 0.5)
    else:
        base = change_confidence * 0.6 + 0.4 * (1.0 if n_evidence > 0 else 0.0)

    bc_map = {
        BaselineConfidence.HIGH: 1.0,
        BaselineConfidence.MODERATE: 0.7,
        BaselineConfidence.LOW: 0.4,
        BaselineConfidence.INSUFFICIENT: 0.2,
    }
    baseline_factor = bc_map.get(baseline_confidence, 0.2)

    penalty = 0.0
    if has_contradictions:
        penalty += 0.3
    if has_gaps:
        penalty += 0.15
    if has_open_questions:
        penalty += 0.1

    meaning_confidence = max(0.0, min(1.0, base * 0.7 + baseline_factor * 0.3 - penalty))
    meaning_confidence = round(meaning_confidence, 3)

    if has_contradictions:
        conf_type = MeaningConfidenceType.UNCERTAINTY
    elif has_gaps or has_open_questions:
        conf_type = MeaningConfidenceType.UNCERTAINTY
    else:
        conf_type = MeaningConfidenceType.MEANING_CONFIDENCE

    return meaning_confidence, conf_type


def _determine_caregiver_perspective(
    evidence: List[Evidence],
    events: List[CareEvent],
    significance: Optional[SignificanceAssessment],
) -> CaregiverPerspective:
    for ev in evidence:
        if ev.source_type and "clinician" in ev.source_type.lower():
            return CaregiverPerspective.OBSERVATION
        if ev.evidence_status and "confirm" in ev.evidence_status.lower():
            return CaregiverPerspective.OBSERVATION

    reporters = []
    for e in events:
        if e.created_by_caregiver_id:
            reporters.append(e.created_by_caregiver_id)
    if not reporters and significance:
        reporters = _resolve_reporters(None, significance.reporters if hasattr(significance, 'reporters') else None)

    if len(reporters) > 1:
        return CaregiverPerspective.CAREGIVER_REPORTED
    if len(reporters) == 1:
        return CaregiverPerspective.CAREGIVER_REPORTED
    return CaregiverPerspective.UNKNOWN


def _build_context_factors(
    db: Session,
    person_id: str,
    change: Change,
    prioritization: Optional[Prioritization],
    events: List[CareEvent],
    significance: Optional[SignificanceAssessment],
) -> List[Dict[str, Any]]:
    factors: List[Dict[str, Any]] = []

    now = datetime.now(timezone.utc)
    relevant_events = [
        e for e in events
        if _ensure_utc(e.occurred_at) is not None
    ]
    if relevant_events:
        window_start = min(_ensure_utc(e.occurred_at) for e in relevant_events)
        window_end = max(_ensure_utc(e.occurred_at) for e in relevant_events)
        start = window_start or now
        end = window_end or now
        associated = (
            db.query(CareEvent)
            .filter(
                CareEvent.person_id == person_id,
                CareEvent.occurred_at >= start - timedelta(days=14),
                CareEvent.occurred_at <= end + timedelta(days=14),
                CareEvent.event_type != change.subject_type,
            )
            .all()
        )
        if associated:
            factors.append({
                "factor_type": ContextFactorType.TEMPORAL_CONTEXT.value,
                "description": f"{len(associated)} associated care event(s) within 14 days of the change observation",
                "evidence_ids": [eid for e in associated for eid in (e.evidence_ids or [])],
                "epistemic_level": EpistemicLevel.OBSERVED_FACT.value,
            })

    if significance:
        possible_context = significance.possible_context or []
        for ctx in possible_context:
            factors.append({
                "factor_type": ContextFactorType.CAREGIVER_PRACTICE.value,
                "description": ctx,
                "evidence_ids": significance.evidence_ids or [],
                "epistemic_level": EpistemicLevel.CONTEXTUAL_INTERPRETATION.value,
            })

    if prioritization:
        for vf in (prioritization.vulnerability_factors or []):
            factors.append({
                "factor_type": ContextFactorType.SOCIAL_CONTEXT.value,
                "description": vf,
                "evidence_ids": prioritization.evidence_ids or [],
                "epistemic_level": EpistemicLevel.CONTEXTUAL_INTERPRETATION.value,
            })

    return factors


def _build_alternative_interpretations(
    db: Session,
    person_id: str,
    contradictions: List[Contradiction],
    subject_type: str,
    subject_id: str,
) -> List[Dict[str, Any]]:
    alternatives: List[Dict[str, Any]] = []
    for c in contradictions:
        description = c.description
        alt_desc = (
            f"Alternative interpretation: {description}. "
            f"This contradiction is preserved as-is without resolution or merging."
        )
        alternatives.append({
            "description": alt_desc,
            "supporting_evidence_ids": c.evidence_ids or [],
            "confidence": 0.5,
            "attribution": _resolve_reporters(db, []),
        })
    return alternatives


def _build_not_established(
    db: Session,
    person_id: str,
    subject_type: str,
    subject_id: str,
) -> List[Dict[str, Any]]:
    not_est = []

    causal = (
        db.query(CausalHypothesis)
        .filter(
            CausalHypothesis.person_id == person_id,
        )
        .all()
    )
    has_causal_link = any(
        (h.relationship_status.value if hasattr(h.relationship_status, 'value') else str(h.relationship_status)) == "supported"
        and (h.causal_confidence.value if hasattr(h.causal_confidence, 'value') else str(h.causal_confidence)) in ("supported", "established")
        for h in causal
    )
    if not has_causal_link:
        not_est.append({
            "category": "causal_relationship",
            "statement": f"No causal relationship established between {subject_type} change and other care events.",
            "reason": "absence of confirmed causal hypothesis record" if not causal
            else "existing hypotheses do not establish causation",
        })

    not_est.append({
        "category": "diagnosis",
        "statement": "No diagnosis is established from this change observation.",
        "reason": "meaning engine derives contextual interpretation only, not clinical diagnosis",
    })

    gaps = (
        db.query(InformationGap)
        .filter(
            InformationGap.person_id == person_id,
            InformationGap.subject_type == subject_type,
            InformationGap.subject_id == subject_id,
        )
        .all()
    )
    for g in gaps:
        not_est.append({
            "category": "missing_information",
            "statement": f"Information gap: {g.field} — {g.description or 'not documented'}",
            "evidence_ids": g.evidence_ids or [],
        })

    return not_est


class MeaningEngine:
    def __init__(self, db: Session):
        self.db = db

    def generate_meaning(
        self,
        person_id: str,
        change_id: str,
    ) -> Optional[Meaning]:
        change = (
            self.db.query(Change)
            .filter(Change.id == change_id, Change.person_id == person_id)
            .first()
        )
        if not change:
            return None

        return self._generate_meaning_for_change(person_id, change, priority=None)

    def generate_meaning_from_priority(
        self,
        person_id: str,
        priority_id: str,
    ) -> Optional[Meaning]:
        priority = (
            self.db.query(Prioritization)
            .filter(Prioritization.id == priority_id, Prioritization.person_id == person_id)
            .first()
        )
        if not priority:
            return None

        change_ids = priority.change_ids or []
        if not change_ids:
            return None

        change = (
            self.db.query(Change)
            .filter(Change.id == change_ids[0], Change.person_id == person_id)
            .first()
        )
        if not change:
            return None

        return self._generate_meaning_for_change(person_id, change, priority=priority)

    def _generate_meaning_for_change(
        self,
        person_id: str,
        change: Change,
        priority: Optional[Prioritization],
    ) -> Meaning:
        subject_type = change.subject_type
        subject_id = change.subject_id

        baseline = None
        if change.baseline_id:
            baseline = (
                self.db.query(Baseline)
                .filter(Baseline.id == change.baseline_id, Baseline.person_id == person_id)
                .first()
            )
        if not baseline:
            baseline = (
                self.db.query(Baseline)
                .filter(
                    Baseline.person_id == person_id,
                    Baseline.subject_type == subject_type,
                    Baseline.subject_id == subject_id,
                    Baseline.is_active == True,
                )
                .order_by(Baseline.created_at.desc())
                .first()
            )

        significance = None
        if change.significance_assessment_id:
            significance = (
                self.db.query(SignificanceAssessment)
                .filter(
                    SignificanceAssessment.id == change.significance_assessment_id,
                    SignificanceAssessment.person_id == person_id,
                )
                .first()
            )

        related_changes = (
            self.db.query(Change)
            .filter(
                Change.person_id == person_id,
                Change.subject_type == subject_type,
                Change.subject_id == subject_id,
                Change.is_active == True,
            )
            .order_by(Change.created_at.desc())
            .all()
        )

        patterns = (
            self.db.query(Pattern)
            .filter(
                Pattern.person_id == person_id,
                Pattern.subject_type == subject_type,
                Pattern.subject_id == subject_id,
                Pattern.is_active == True,
            )
            .order_by(Pattern.created_at.desc())
            .all()
        )

        evidence_ids = set(change.evidence_ids or [])
        if significance:
            evidence_ids.update(significance.evidence_ids or [])

        evidence_list = (
            self.db.query(Evidence)
            .filter(Evidence.id.in_(evidence_ids))
            .all()
        ) if evidence_ids else []

        events = (
            self.db.query(CareEvent)
            .filter(
                CareEvent.person_id == person_id,
                CareEvent.event_type == subject_type,
            )
            .order_by(CareEvent.occurred_at.desc())
            .all()
        )

        contradictions = (
            self.db.query(Contradiction)
            .filter(
                Contradiction.person_id == person_id,
            )
            .all()
        )
        relevant_contradictions = [
            c for c in contradictions
            if (set(c.evidence_ids or []) & evidence_ids)
            or (c.subject_type == subject_type and c.subject_id == subject_id)
        ]

        gaps = (
            self.db.query(InformationGap)
            .filter(
                InformationGap.person_id == person_id,
                InformationGap.subject_type == subject_type,
                InformationGap.subject_id == subject_id,
            )
            .all()
        )

        open_questions = (
            self.db.query(OpenQuestion)
            .filter(
                OpenQuestion.person_id == person_id,
                OpenQuestion.subject_type == subject_type,
                OpenQuestion.subject_id == subject_id,
            )
            .all()
        )

        causal_hypotheses = (
            self.db.query(CausalHypothesis)
            .filter(CausalHypothesis.person_id == person_id)
            .all()
        )

        reporter_ids = []
        for e in events:
            if e.created_by_caregiver_id:
                reporter_ids.append(e.created_by_caregiver_id)
        if significance and hasattr(significance, 'reporters'):
            reporter_ids.extend(significance.reporters or [])
        attribution = _resolve_reporters(self.db, reporter_ids)

        baseline_conf = baseline.confidence if baseline else BaselineConfidence.MODERATE
        change_confidence = change.confidence or 0.0

        meaning_confidence, conf_type = _compute_meaning_confidence(
            significance=significance,
            change_confidence=change_confidence,
            baseline_confidence=baseline_conf,
            has_contradictions=bool(relevant_contradictions),
            has_gaps=bool(gaps),
            has_open_questions=bool(open_questions),
            n_evidence=len(evidence_ids),
        )

        baseline_rel = _classify_baseline_relationship(
            current_value=change.current_count,
            baseline_state=baseline.state_value if baseline else None,
            change_direction=change.change_direction,
        )

        longitudinal = _classify_longitudinal_pattern(related_changes, patterns)
        temporal_scope = _classify_temporal_scope(related_changes, baseline)

        evidence_relationship = _classify_evidence_relationship(
            evidence_status=(significance.evidence_status if significance else EvidenceStatus.UNKNOWN),
            has_contradictions=bool(relevant_contradictions),
            has_gaps=bool(gaps),
        )

        causal_status = _classify_causal_status(causal_hypotheses)
        caregiver_perspective = _determine_caregiver_perspective(evidence_list, events, significance)

        context_factors = _build_context_factors(
            self.db, person_id, change, priority, events, significance
        )

        alternative_interpretations = _build_alternative_interpretations(
            self.db, person_id, relevant_contradictions, subject_type, subject_id
        )

        not_established = _build_not_established(
            self.db, person_id, subject_type, subject_id
        )

        evidence_links: List[Dict[str, Any]] = []
        for ev in evidence_list:
            is_contradicted = any(
                ev.id in (c.evidence_ids or [])
                for c in relevant_contradictions
            )
            rel = EvidenceRelationship.CONTRADICTS if is_contradicted else EvidenceRelationship.SUPPORTS
            evidence_links.append({
                "evidence_id": ev.id,
                "relationship": rel.value,
                "epistemic_level": EpistemicLevel.OBSERVED_FACT.value,
                "confidence": ev.confidence,
                "attribution": _resolve_reporters(self.db, [ev.uploaded_by_caregiver_id] if ev.uploaded_by_caregiver_id else []),
            })

        supporting_state: List[Dict[str, Any]] = []
        if baseline:
            supporting_state.append({
                "type": "baseline",
                "id": baseline.id,
                "confidence": baseline.confidence.value if hasattr(baseline.confidence, 'value') else baseline.confidence,
                "window_start": baseline.window_start.isoformat() if baseline.window_start else None,
                "window_end": baseline.window_end.isoformat() if baseline.window_end else None,
                "event_count": baseline.event_count,
            })
        for c in related_changes:
            if c.id != change.id:
                supporting_state.append({
                    "type": "change",
                    "id": c.id,
                    "change_type": c.change_type.value if hasattr(c.change_type, 'value') else str(c.change_type),
                    "direction": c.change_direction.value if hasattr(c.change_direction, 'value') else str(c.change_direction),
                    "created_at": c.created_at.isoformat() if c.created_at else None,
                    "confidence": c.confidence,
                })
        for p in patterns:
            supporting_state.append({
                "type": "pattern",
                "id": p.id,
                "pattern_type": p.pattern_type.value if hasattr(p.pattern_type, 'value') else str(p.pattern_type),
                "strength": p.pattern_strength.value if hasattr(p.pattern_strength, 'value') else str(p.pattern_strength),
                "confidence": p.confidence,
            })

        if priority:
            supporting_state.append({
                "type": "prioritization",
                "id": priority.id,
                "priority_level": priority.priority_level.value if hasattr(priority.priority_level, 'value') else str(priority.priority_level),
                "overall_confidence": priority.overall_confidence,
                "trajectory": priority.trajectory.value if priority.trajectory and hasattr(priority.trajectory, 'value') else str(priority.trajectory) if priority.trajectory else None,
            })

        if significance:
            supporting_state.append({
                "type": "significance_assessment",
                "id": significance.id,
                "verdict": significance.verdict.value if hasattr(significance.verdict, 'value') else str(significance.verdict),
                "evidence_status": significance.evidence_status.value if hasattr(significance.evidence_status, 'value') else str(significance.evidence_status),
                "significance_confidence": significance.significance_confidence,
                "evidence_confidence": significance.evidence_confidence,
                "attention_candidate": significance.attention_candidate,
                "follow_up_candidate": significance.follow_up_candidate,
            })

        uncertainty_ids: List[str] = []
        for g in gaps:
            uncertainty_ids.append(g.id)
        for q in open_questions:
            uncertainty_ids.append(q.id)

        db_meaning = Meaning(
            person_id=person_id,
            change_id=change.id,
            priority_id=priority.id if priority else None,
            context_factors=context_factors,
            baseline_relationship=baseline_rel.value if hasattr(baseline_rel, 'value') else baseline_rel,
            longitudinal_pattern=longitudinal.value if hasattr(longitudinal, 'value') else longitudinal,
            temporal_scope=temporal_scope.value if hasattr(temporal_scope, 'value') else temporal_scope,
            evidence_relationship=evidence_relationship.value if hasattr(evidence_relationship, 'value') else evidence_relationship,
            causal_status=causal_status.value if hasattr(causal_status, 'value') else causal_status,
            confidence_type=conf_type.value if hasattr(conf_type, 'value') else conf_type,
            confidence=meaning_confidence,
            supporting_state_elements=supporting_state,
            evidence_ids=list(evidence_ids),
            uncertainty_ids=uncertainty_ids,
            contradiction_ids=[c.id for c in relevant_contradictions],
            alternative_interpretations=alternative_interpretations,
            not_established=not_established,
            caregiver_perspective=caregiver_perspective.value if hasattr(caregiver_perspective, 'value') else caregiver_perspective,
            attribution=attribution,
            rationale=self._build_rationale(
                change, baseline, significance, baseline_conf, evidence_relationship,
                causal_status, longitudinal, temporal_scope, meaning_confidence, attribution,
            ),
        )
        self.db.add(db_meaning)
        self.db.flush()

        for el in evidence_links:
            link = MeaningEvidenceLink(
                meaning_id=db_meaning.id,
                evidence_id=el["evidence_id"],
                relationship=el["relationship"],
                epistemic_level=el["epistemic_level"],
                confidence=el["confidence"],
                attribution=el["attribution"],
            )
            self.db.add(link)

        other_change_ids = [c.id for c in related_changes if c.id != change.id]
        if other_change_ids:
            for ocid in other_change_ids[:5]:
                link = MeaningChangeLink(
                    meaning_id=db_meaning.id,
                    change_id=ocid,
                    relationship="contextual_association",
                    evidence_ids=list(evidence_ids),
                    attribution=attribution,
                )
                self.db.add(link)

        return db_meaning

    def _build_rationale(
        self,
        change: Change,
        baseline: Optional[Baseline],
        significance: Optional[SignificanceAssessment],
        baseline_conf: BaselineConfidence,
        evidence_relationship: EvidenceRelationship,
        causal_status: CausalStatus,
        longitudinal: LongitudinalPatternCategory,
        temporal_scope: TemporalScopeClassification,
        meaning_confidence: float,
        attribution: List[str],
    ) -> str:
        parts = []

        ct = change.subject_type
        ctype = change.change_type.value if hasattr(change.change_type, 'value') else str(change.change_type)
        direction = change.change_direction.value if hasattr(change.change_direction, 'value') else str(change.change_direction)

        parts.append(
            f"Level 1 (Observed Fact): {len(change.evidence_ids or [])} evidence item(s) "
            f"report {ct} {ctype}/{direction}."
        )

        parts.append(
            f"Level 2 (State/Change): {ct} changed from "
            f"{change.previous_state or 'unrecorded'} to {change.current_state or 'unrecorded'} "
            f"(count {change.previous_count} -> {change.current_count})"
            f" compared to baseline "
            f"({baseline.window_start} to {baseline.window_end}, "
            f"event_count={baseline.event_count if baseline else 0}, "
            f"confidence={baseline_conf.value if hasattr(baseline_conf, 'value') else baseline_conf})"
            if baseline else
            f"Level 2 (State/Change): {ct} {ctype}/{direction} with no established baseline."
        )

        if significance:
            parts.append(
                f"Level 3 (Contextual Interpretation): Significance = "
                f"{significance.verdict.value if hasattr(significance.verdict, 'value') else significance.verdict}, "
                f"evidence_status = {significance.evidence_status.value if hasattr(significance.evidence_status, 'value') else significance.evidence_status}, "
                f"significance_confidence = {significance.significance_confidence:.3f}, "
                f"evidence_confidence = {significance.evidence_confidence:.3f}."
            )

        evidence_rel_val = evidence_relationship.value if hasattr(evidence_relationship, 'value') else evidence_relationship
        causal_val = causal_status.value if hasattr(causal_status, 'value') else causal_status
        long_val = longitudinal.value if hasattr(longitudinal, 'value') else longitudinal
        temp_val = temporal_scope.value if hasattr(temporal_scope, 'value') else temporal_scope

        parts.append(
            f"Contextual meaning: evidence relationship = {evidence_rel_val}, "
            f"longitudinal pattern = {long_val}, "
            f"temporal scope = {temp_val}."
        )

        parts.append(
            f"Level 4 (Hypothesis): Causal status = {causal_val} — "
            f"meaning confidence = {meaning_confidence:.3f}."
        )

        if attribution:
            parts.append(f"Attribution: {attribution}.")

        parts.append(
            "This meaning is derived from structured data (changes, baselines, evidence, "
            "prioritization, uncertainties, contradictions) and does not invent diagnosis or causation."
        )

        return " ".join(parts)

    def generate_all_meanings(
        self,
        person_id: str,
        reference_time: Optional[datetime] = None,
    ) -> List[Meaning]:
        from app.models.prioritization import Prioritization

        results: List[Meaning] = []
        priorities = (
            self.db.query(Prioritization)
            .filter(
                Prioritization.person_id == person_id,
                Prioritization.is_active == True,
            )
            .order_by(Prioritization.created_at.desc())
            .all()
        )

        for priority in priorities:
            change_ids = priority.change_ids or []
            if not change_ids:
                continue
            change = (
                self.db.query(Change)
                .filter(Change.id == change_ids[0], Change.person_id == person_id)
                .first()
            )
            if not change:
                continue
            meaning = self._generate_meaning_for_change(person_id, change, priority=priority)
            results.append(meaning)

        self.db.commit()
        return results

    def list_meanings(
        self,
        person_id: str,
    ) -> List[Meaning]:
        return (
            self.db.query(Meaning)
            .filter(Meaning.person_id == person_id)
            .order_by(Meaning.created_at.desc())
            .all()
        )

    def get_meaning(self, meaning_id: str) -> Optional[Meaning]:
        return self.db.query(Meaning).filter(Meaning.id == meaning_id).first()
