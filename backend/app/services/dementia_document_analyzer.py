from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session

from app.models.dementia import (
    DementiaBaselineModel,
    DementiaObservationModel,
    DementiaChangeAssessmentModel,
    DementiaSafetyEventModel,
    DementiaTimelineEventModel,
    DementiaObservationEvidenceModel,
)
from app.core.dementia_enums import (
    DementiaDomain,
    DementiaChangeType,
    FluctuationPattern,
    SafetySignificance,
    CaregiverLanguageCategory,
    DementiaBaselineType,
)
from app.services.dementia_reasoning import DementiaReasoningEngine


DOCTOR_NOTE_PATTERNS = {
    "mmse_score": r"MMSE[^0-9]*(\d+)/(\d+)",
    "moca_score": r"MoCA[^0-9]*(\d+)/(\d+)",
    "functional_status": r"(independent of|requires assistance with|unable to)\s+(.*?)(?:[.;]|$)",
    "memory_assessment": r"(forgets|memory loss|recollect|recalled|recalled\s+\d+)",
    "safety_concerns": r"(wandering|elopement|fall|fells|left\s+the\s+stove|driving|confused)",
    "medication_changes": r"(started|stopped|increased|decreased|changed|adjusted).*?(medication|medicine|drug|dose)",
    "diagnosis_mentions": r"(dementia|alzheimer|lewy\s+body|frontotemporal|vascular)",
    "acute_symptoms": r"(acute|suddenly|acutely|decline|worsening|worse|rapid\s+decline)",
    "caregiver_strain": r"(caregiver|family|burden|exhausted|difficult)",
}

CLINICAL_OBSERVATION_PATTERNS: Dict[DementiaDomain, List[Tuple[str, str]]] = {
    DementiaDomain.MEMORY: [
        ("forgets", "Word-finding/memory issue"),
        ("memory", "Memory concern"),
        ("recalls", "Recall ability"),
        ("recollect", "Recollection issue"),
        ("forgetful", "Forgetfulness"),
    ],
    DementiaDomain.ORIENTATION: [
        ("disorient", "Disorientation"),
        ("orient", "Orientation concern"),
        ("confused about", "Confusion about place/person/time"),
        ("doesn't know", "Knowledge deficit"),
    ],
    DementiaDomain.RECOGNITION: [
        ("doesn't recognize", "Recognition failure"),
        ("didn't recognize", "Recognition failure"),
        ("doesn't know", "Recognition failure"),
        ("stranger", "Person recognition issue"),
    ],
    DementiaDomain.COMMUNICATION: [
        ("word-finding", "Word-finding difficulty"),
        ("aphasia", "Aphasia"),
        ("language", "Language difficulty"),
        ("trouble.*speak", "Speech difficulty"),
        ("find the words", "Word-finding difficulty"),
    ],
    DementiaDomain.JUDGMENT: [
        ("poor judgment", "Impaired judgment"),
        ("poor decision", "Impaired judgment"),
        ("decision-making", "Judgment concern"),
    ],
    DementiaDomain.EXECUTIVE_FUNCTION: [
        ("organize", "Organization difficulty"),
        ("plan", "Planning difficulty"),
        ("sequence", "Sequencing issue"),
        ("task", "Task completion issue"),
        ("procedure", "Procedural difficulty"),
    ],
    DementiaDomain.AGITATION: [
        ("agitat", "Agitation"),
        ("aggressive", "Aggression"),
        ("verbal aggression", "Verbal aggression"),
        ("physical aggression", "Physical aggression"),
        ("resist", "Resistance/aggression"),
    ],
    DementiaDomain.WANDERING: [
        ("wander", "Wandering"),
        ("elop", "Elopement"),
        ("left the house", "Unsupervised exit"),
    ],
    DementiaDomain.REPETITIVE_BEHAVIORS: [
        ("repetitive", "Repetitive behavior"),
        ("stereotyp", "Stereotypic behavior"),
        ("ritual", "Ritualistic behavior"),
    ],
    DementiaDomain.SLEEP_WAKE_PATTERNS: [
        ("sleep", "Sleep disturbance"),
        ("night", "Nighttime disturbance"),
        ("circadian", "Circadian rhythm issue"),
        ("REM", "REM sleep behavior"),
    ],
    DementiaDomain.ADLS_IADLS: [
        ("dress", "Dressing difficulty"),
        ("bath", "Bathing difficulty"),
        ("toilet", "Toileting difficulty"),
        ("eat", "Feeding difficulty"),
        ("cook", "Cooking difficulty"),
        ("medication", "Medication management"),
        ("finance", "Financial management"),
        ("drive", "Driving difficulty"),
        ("groom", "Grooming difficulty"),
    ],
}

TIME_INDICATORS = {
    "today": r"(today|this\s+day|currently)",
    "this_week": r"(this\s+week|recently|these\s+days)",
    "this_month": r"(this\s+month|past\s+month|last\s+month)",
    "gradual": r"(gradually|over\s+time|slowly|progressively)",
    "acute": r"(suddenly|acutely|overnight|rapidly|abruptly|immediately)",
}


class DementiaDocumentAnalyzer:
    """Analyzes clinical documents and extracts structured dementia observations."""

    def __init__(self, db: Session):
        self.db = db
        self.engine = DementiaReasoningEngine(db)

    def analyze_document(
        self,
        person_id: str,
        text: str,
        document_type: str = "clinical_note",
        document_id: Optional[str] = None,
        visit_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        text_lower = text.lower()
        structured_observations: List[Dict[str, Any]] = []

        # Extract MMSE/MoCA scores
        scores = self._extract_scores(text)

        # Extract clinical observations by domain
        for domain, patterns in CLINICAL_OBSERVATION_PATTERNS.items():
            for keyword, description in patterns:
                if re.search(keyword, text_lower, re.IGNORECASE):
                    change_type = DementiaChangeType.NEW_CHANGE
                    baseline_comparison = self.engine.compare_to_baseline(
                        person_id, domain, text
                    )
                    if baseline_comparison.change_type == DementiaChangeType.BASELINE_CONSISTENT:
                        change_type = DementiaChangeType.BASELINE_CONSISTENT

                    observation = {
                        "domain": domain.value,
                        "observation_text": text.strip()[:500],
                        "structured_summary": description,
                        "change_type": change_type.value,
                        "source_section": description,
                        "time_indicator": self._detect_time_indicator(text),
                        "safety_significance": self._assess_from_text(text, domain),
                        "document_type": document_type,
                    }
                    structured_observations.append(observation)
                    break  # Only record first match per domain

        # Extract specific clinical patterns
        clinical_notes = self._extract_clinical_patterns(text)

        # Create timeline event
        timeline_event = self._create_timeline_event(
            person_id, text, document_type, document_id,
            scores, clinical_notes, visit_date
        )

        # Create observations from structured data
        for obs_data in structured_observations:
            self._create_observation_from_document(
                person_id, obs_data, document_id, visit_date
            )

        return {
            "document_type": document_type,
            "visit_date": visit_date.isoformat() if visit_date else None,
            "scores": scores,
            "structured_observations": structured_observations,
            "clinical_patterns": clinical_notes,
            "timeline_event_id": timeline_event.id if timeline_event else None,
            "observations_created": len(structured_observations),
        }

    def _extract_scores(self, text: str) -> Dict[str, Any]:
        scores = {}
        mmse_match = re.search(r"MMSE[^0-9]*(\d+)/(\d+)", text, re.IGNORECASE)
        if mmse_match:
            scores["mmse"] = {
                "score": int(mmse_match.group(1)),
                "max": int(mmse_match.group(2)),
            }
        moca_match = re.search(r"MoCA[^0-9]*(\d+)/(\d+)", text, re.IGNORECASE)
        if moca_match:
            scores["moca"] = {
                "score": int(moca_match.group(1)),
                "max": int(moca_match.group(2)),
            }
        return scores

    def _extract_clinical_patterns(self, text: str) -> List[Dict[str, Any]]:
        patterns_found = []
        for pattern_name, pattern in DOCTOR_NOTE_PATTERNS.items():
            matches = re.findall(pattern, text, re.IGNORECASE)
            if matches:
                patterns_found.append({
                    "type": pattern_name,
                    "matches": matches[:5],
                })
        return patterns_found

    def _detect_time_indicator(self, text: str) -> Optional[str]:
        text_lower = text.lower()
        for label, pattern in TIME_INDICATORS.items():
            if re.search(pattern, text_lower, re.IGNORECASE):
                return label
        return None

    def _assess_from_text(self, text: str, domain: DementiaDomain) -> str:
        text_lower = text.lower()
        if any(kw in text_lower for kw in ["wandering", "elop", "left the house"]):
            return SafetySignificance.CRITICAL.value
        if any(kw in text_lower for kw in ["stove", "oven", "drive", "medication", "fall", "fell"]):
            return SafetySignificance.HIGH.value
        if domain in [DementiaDomain.ADLS_IADLS, DementiaDomain.WANDERING]:
            return SafetySignificance.MODERATE.value
        return SafetySignificance.LOW.value

    def _create_timeline_event(
        self,
        person_id: str,
        text: str,
        document_type: str,
        document_id: Optional[str],
        scores: Dict[str, Any],
        clinical_patterns: List[Dict[str, Any]],
        visit_date: Optional[datetime],
    ) -> Optional[DementiaTimelineEventModel]:
        event = DementiaTimelineEventModel(
            person_id=person_id,
            event_type="document_ingestion",
            title=f"{document_type.replace('_', ' ').title()} processed",
            description=f"Analyzed document: {len(text)} characters, {len(clinical_patterns)} clinical patterns",
            occurred_at=visit_date or datetime.now(timezone.utc),
            significance=self._calculate_significance(text, scores),
            related_document_id=document_id,
            metadata={
                "document_type": document_type,
                "text_length": len(text),
                "scores": scores,
                "clinical_patterns": clinical_patterns,
            },
        )
        self.db.add(event)
        self.db.flush()
        return event

    def _calculate_significance(self, text: str, scores: Dict[str, Any]) -> str:
        text_lower = text.lower()
        if any(kw in text_lower for kw in ["critical", "emergency", "immediate", "hospital"]):
            return "critical"
        if any(kw in text_lower for kw in ["wander", "fall", "elop", "stove", "drive"]):
            return "high"
        if "mmse" in scores and scores["mmse"]["score"] < 18:
            return "high"
        return "moderate"

    def _create_observation_from_document(
        self,
        person_id: str,
        obs_data: Dict[str, Any],
        document_id: Optional[str],
        occurred_at: Optional[datetime],
    ) -> Optional[DementiaObservationModel]:
        from app.schemas.dementia import DementiaObservationCreate

        domain = DementiaDomain(obs_data["domain"])
        observation_data = DementiaObservationCreate(
            person_id=person_id,
            domain=domain,
            change_type=DementiaChangeType(obs_data["change_type"]),
            observation_text=obs_data["observation_text"],
            structured_summary=obs_data["structured_summary"],
            occurred_at=occurred_at or datetime.now(timezone.utc),
            evidence_ids=[document_id] if document_id else [],
        )
        return self.engine.create_observation(observation_data)

    def get_timeline_analysis(self, person_id: str, days: int = 90) -> Dict[str, Any]:
        since = datetime.now(timezone.utc) - timezone.utc.utcoffset() if False else None
        from datetime import timedelta
        since = datetime.now(timezone.utc) - timedelta(days=days)

        timeline_events = self.db.query(DementiaTimelineEventModel).filter(
            DementiaTimelineEventModel.person_id == person_id,
            DementiaTimelineEventModel.occurred_at >= since,
        ).order_by(DementiaTimelineEventModel.occurred_at.desc()).all()

        observations = self.db.query(DementiaObservationModel).filter(
            DementiaObservationModel.person_id == person_id,
            DementiaObservationModel.occurred_at >= since,
        ).order_by(DementiaObservationModel.occurred_at.desc()).all()

        baselines = self.db.query(DementiaBaselineModel).filter(
            DementiaBaselineModel.person_id == person_id,
            DementiaBaselineModel.is_active == True,
        ).all()

        # Build domain-specific trends
        domain_trends: Dict[str, List[Dict[str, Any]]] = {}
        for obs in observations:
            domain_str = obs.domain.value
            if domain_str not in domain_trends:
                domain_trends[domain_str] = []
            domain_trends[domain_str].append({
                "date": obs.occurred_at.isoformat(),
                "change_type": obs.change_type.value,
                "safety_significance": obs.safety_significance.value if obs.safety_significance else None,
                "text_snippet": obs.observation_text[:100],
            })

        # Detect acceleration patterns
        acceleration = self._detect_acceleration(observations)

        return {
            "person_id": person_id,
            "period_days": days,
            "timeline_events": [
                {
                    "id": e.id,
                    "type": e.event_type,
                    "title": e.title,
                    "description": e.description,
                    "date": e.occurred_at.isoformat(),
                    "significance": e.significance,
                }
                for e in timeline_events
            ],
            "domain_trends": domain_trends,
            "baselines": [{"domain": b.domain.value, "description": b.description, "confidence": b.confidence} for b in baselines],
            "acceleration_detected": acceleration,
            "total_observations": len(observations),
            "total_events": len(timeline_events),
        }

    def _detect_acceleration(self, observations: List[DementiaObservationModel]) -> Optional[Dict[str, Any]]:
        if len(observations) < 3:
            return None

        # Group by domain and check if new changes are increasing
        by_domain: Dict[str, List[DementiaObservationModel]] = {}
        for obs in observations:
            ds = obs.domain.value
            if ds not in by_domain:
                by_domain[ds] = []
            by_domain[ds].append(obs)

        for domain_str, domain_obs in by_domain.items():
            if len(domain_obs) < 3:
                continue
            new_changes = [o for o in domain_obs if o.change_type == DementiaChangeType.NEW_CHANGE]
            if len(new_changes) >= 2:
                dates = sorted([o.occurred_at for o in new_changes])
                if len(dates) >= 2:
                    days_between = (dates[-1] - dates[0]).days
                    if days_between > 0 and len(new_changes) / max(days_between, 1) > 0.1:
                        return {
                            "domain": domain_str,
                            "new_events": len(new_changes),
                            "period_days": days_between,
                            "pattern": "accelerating",
                            "recommendation": "Increased monitoring and clinical review recommended",
                        }
        return None