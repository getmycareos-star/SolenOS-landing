"""Meaning/Contextual Understanding Engine service.

No hard-coded names, medications, symptoms, or measurements.
Preserves caregiver attribution.
Distinguishes epistemic layers: Fact -> State/Change -> Interpretation -> Hypothesis
"""

from __future__ import annotations

from datetime import datetime

from app.core.meaning_enums import (
    CausalityStatus,
    ConfidenceType,
    EpistemicLevel,
    GapType,
)
from app.models.meaning import (
    Baseline,
    CareEvent,
    CausalHypothesis,
    Change,
    Contradiction,
    Evidence,
    InformationGap,
    MeaningOutput,
    OpenQuestion,
    Person,
    SignificanceAssessment,
)
from app.services.baseline import BaselineService
from app.services.change_detection import ChangeDetectionService
from app.services.pattern_detection import PatternDetectionService
from app.services.significance import SignificanceService


class MeaningEngine:
    """Generates structured meaning from care data."""

    def __init__(self) -> None:
        self.change_detector = ChangeDetectionService()
        self.significance_service = SignificanceService()
        self.baseline_service = BaselineService()
        self.pattern_detector = PatternDetectionService()

    def generate(
        self,
        person_id: str,
        person: Person | None = None,
        baselines: list[Baseline] | None = None,
        evidence_list: list[Evidence] | None = None,
        care_events: list[CareEvent] | None = None,
        changes: list[Change] | None = None,
        contradictions: list[Contradiction] | None = None,
        information_gaps: list[InformationGap] | None = None,
        open_questions: list[OpenQuestion] | None = None,
        causal_hypotheses: list[CausalHypothesis] | None = None,
        significance_assessments: list[SignificanceAssessment] | None = None,
        change_id: str | None = None,
        priority_id: str | None = None,
    ) -> MeaningOutput | None:
        """Generate meaning output for a person."""
        if not person_id:
            return None

        baselines = baselines or []
        evidence_list = evidence_list or []
        care_events = care_events or []
        changes = changes or []
        contradictions = contradictions or []
        information_gaps = information_gaps or []
        open_questions = open_questions or []
        causal_hypotheses = causal_hypotheses or []
        significance_assessments = significance_assessments or []

        if change_id:
            changes = [c for c in changes if c.id == change_id]
            if not changes:
                return None

        if not changes and baselines and evidence_list:
            changes = self.change_detector.detect_changes_from_evidence(
                baselines, evidence_list
            )

        if not contradictions and evidence_list:
            contradictions = self.pattern_detector.detect_contradictions(
                evidence_list
            )

        identified_gaps = self._identify_gaps(
            person_id, baselines, evidence_list, care_events
        )
        information_gaps = self._merge_information_gaps(
            information_gaps, identified_gaps
        )

        what_is_happening = self._build_what_is_happening(
            changes, contradictions, information_gaps
        )

        epistemic_level = self._determine_epistemic_level(
            changes, causal_hypotheses, contradictions
        )

        rationale = self._build_rationale(
            changes, contradictions, information_gaps, causal_hypotheses
        )

        meaning_confidence = self._calculate_meaning_confidence(
            changes, contradictions, information_gaps, evidence_list
        )

        evidence_confidence = self._calculate_evidence_confidence(evidence_list)

        caregiver_attribution = self._collect_caregiver_attribution(
            evidence_list, care_events
        )

        if not causal_hypotheses and changes:
            causal_hypotheses = self._build_causal_hypotheses(changes)

        causal_hypotheses = [
            ch
            for ch in causal_hypotheses
            if ch.causality_status != CausalityStatus.CAUSALITY_ESTABLISHED
            or ch.supporting_evidence_ids
        ]

        meaning_id = f"mean_{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}"

        return MeaningOutput(
            id=meaning_id,
            person_id=person_id,
            what_is_happening=what_is_happening,
            epistemic_level=epistemic_level,
            rationale=rationale,
            confidence=meaning_confidence,
            confidence_type=ConfidenceType.MEANING_CONFIDENCE,
            evidence_confidence=evidence_confidence,
            changes=changes,
            contradictions=contradictions,
            information_gaps=information_gaps,
            open_questions=open_questions,
            causal_hypotheses=causal_hypotheses,
            caregiver_attribution=caregiver_attribution,
        )

    def generate_from_priority(
        self,
        person_id: str,
        priority_id: str,
        **kwargs,
    ) -> MeaningOutput | None:
        """Generate meaning from a priority assessment."""
        return self.generate(person_id=person_id, priority_id=priority_id, **kwargs)

    def generate_all(
        self,
        person_id: str,
        **kwargs,
    ) -> list[MeaningOutput]:
        """Generate all meanings for a person."""
        result = self.generate(person_id=person_id, **kwargs)
        return [result] if result else []

    def _build_what_is_happening(
        self,
        changes: list[Change],
        contradictions: list[Contradiction],
        information_gaps: list[InformationGap],
    ) -> str:
        """Build the what_is_happening description."""
        parts: list[str] = []

        if changes:
            for change in changes:
                parts.append(
                    f"{change.measurement_type} changed "
                    f"({change.change_type})"
                )
        elif contradictions:
            parts.append("Conflicting information detected")
        elif information_gaps:
            parts.append("Incomplete information available")
        else:
            parts.append("No significant changes detected")

        return "; ".join(parts)

    def _determine_epistemic_level(
        self,
        changes: list[Change],
        causal_hypotheses: list[CausalHypothesis],
        contradictions: list[Contradiction],
    ) -> EpistemicLevel:
        """Determine the epistemic level of the meaning output."""
        if causal_hypotheses:
            return EpistemicLevel.HYPOTHESIS
        if changes:
            return EpistemicLevel.INTERPRETATION
        if contradictions:
            return EpistemicLevel.STATE
        return EpistemicLevel.FACT

    def _build_rationale(
        self,
        changes: list[Change],
        contradictions: list[Contradiction],
        information_gaps: list[InformationGap],
        causal_hypotheses: list[CausalHypothesis],
    ) -> str:
        """Build the rationale for the meaning output."""
        parts: list[str] = []

        if changes:
            parts.append(
                f"Based on {len(changes)} detected change(s) from baseline"
            )
        if contradictions:
            parts.append(
                f"{len(contradictions)} contradiction(s) preserved"
            )
        if information_gaps:
            parts.append(
                f"{len(information_gaps)} information gap(s) identified"
            )
        if causal_hypotheses:
            parts.append(
                f"{len(causal_hypotheses)} causal hypothesis(es) noted "
                f"(not established)"
            )

        if not parts:
            parts.append("No significant data to interpret")

        return "; ".join(parts)

    def _calculate_meaning_confidence(
        self,
        changes: list[Change],
        contradictions: list[Contradiction],
        information_gaps: list[InformationGap],
        evidence_list: list[Evidence],
    ) -> float:
        """Calculate meaning confidence."""
        confidence = 0.95

        if contradictions:
            confidence -= 0.2 * min(len(contradictions), 3)

        if information_gaps:
            confidence -= 0.15 * min(len(information_gaps), 3)

        if not evidence_list:
            confidence -= 0.3
        elif len(evidence_list) < 2:
            confidence -= 0.1

        if changes and not any(c.baseline_id for c in changes):
            confidence -= 0.15

        return max(0.0, min(1.0, confidence))

    def _calculate_evidence_confidence(
        self,
        evidence_list: list[Evidence],
    ) -> float:
        """Calculate evidence confidence separately from meaning confidence."""
        if not evidence_list:
            return 0.0
        if len(evidence_list) == 1:
            return 0.6
        if len(evidence_list) < 4:
            return 0.8
        return 0.95

    def _collect_caregiver_attribution(
        self,
        evidence_list: list[Evidence],
        care_events: list[CareEvent],
    ) -> list[str]:
        """Collect distinct caregiver attributions."""
        attributions: set[str] = set()

        for ev in evidence_list:
            if ev.uploaded_by_caregiver_id:
                attributions.add(ev.uploaded_by_caregiver_id)

        for event in care_events:
            if event.created_by_caregiver_id:
                attributions.add(event.created_by_caregiver_id)

        return sorted(attributions)

    def _merge_information_gaps(
        self,
        provided_gaps: list[InformationGap],
        identified_gaps: list[InformationGap],
    ) -> list[InformationGap]:
        """Merge provided and identified information gaps."""
        merged: list[InformationGap] = list(provided_gaps)
        existing_ids = {gap.id for gap in merged}
        existing_types = {gap.gap_type for gap in merged}

        for gap in identified_gaps:
            if gap.id not in existing_ids and gap.gap_type not in existing_types:
                merged.append(gap)
                existing_ids.add(gap.id)
                existing_types.add(gap.gap_type)

        return merged

    def _identify_gaps(
        self,
        person_id: str,
        baselines: list[Baseline],
        evidence_list: list[Evidence],
        care_events: list[CareEvent],
    ) -> list[InformationGap]:
        """Identify information gaps."""
        gaps: list[InformationGap] = []

        measurement_types: set[str] = set()
        for ev in evidence_list:
            mtype = ev.metadata.get("measurement_type", "")
            if mtype:
                measurement_types.add(mtype)

        baseline_types: set[str] = {b.measurement_type for b in baselines}
        missing_types = measurement_types - baseline_types

        for mtype in missing_types:
            gaps.append(
                InformationGap(
                    id=f"gap_{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}",
                    person_id=person_id,
                    gap_type=GapType.MISSING_BASELINE,
                    description=f"No baseline established for {mtype}",
                    severity="moderate",
                )
            )

        for ev in evidence_list:
            if not ev.uploaded_by_caregiver_id:
                gaps.append(
                    InformationGap(
                        id=f"gap_{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}",
                        person_id=person_id,
                        gap_type=GapType.MISSING_REPORTER,
                        description="Evidence missing reporter attribution",
                        severity="low",
                    )
                )

        if len(evidence_list) < 2:
            gaps.append(
                InformationGap(
                    id=f"gap_{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}",
                    person_id=person_id,
                    gap_type=GapType.INCOMPLETE_HISTORY,
                    description="Limited evidence history available",
                    severity="moderate",
                )
            )

        return gaps

    def _build_causal_hypotheses(
        self,
        changes: list[Change],
    ) -> list[CausalHypothesis]:
        """Build causal hypotheses."""
        hypotheses: list[CausalHypothesis] = []

        for change in changes:
            if not change.evidence_ids:
                continue

            hypotheses.append(
                CausalHypothesis(
                    id=f"ch_{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}",
                    person_id=change.person_id,
                    hypothesis=(
                        f"Change in {change.measurement_type} may be "
                        f"related to recent events"
                    ),
                    supporting_evidence_ids=change.evidence_ids,
                    causality_status=CausalityStatus.CAUSALITY_NOT_ESTABLISHED,
                    confidence=0.3,
                )
            )

        return hypotheses
