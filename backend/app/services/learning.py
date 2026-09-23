from datetime import datetime
from typing import Any
from sqlalchemy.orm import Session
from app.models.memory import (
    ReasoningMemory as ReasoningMemoryModel,
    Observation as ObservationModel,
    LearningEvent as LearningEventModel,
)
from app.models.care import Insight as InsightModel, CareEvent as CareEventModel, Evidence as EvidenceModel


class SavePipelineEvent:
    def __init__(self, step: str, person_id: str, detail: str = ""):
        self.step = step
        self.person_id = person_id
        self.detail = detail
        self.timestamp = datetime.utcnow().isoformat()


class LearningEngine:
    def __init__(self, db: Session):
        self.db = db

    def log_pipeline_event(self, event: SavePipelineEvent):
        pass

    def record_learning_event(
        self,
        person_id: str,
        event_type: str,
        detail: str,
        source_type: str,
        source_id: str = None,
        caregiver_id: str = None,
    ):
        event = LearningEventModel(
            person_id=person_id,
            event_type=event_type,
            detail=detail,
            source_type=source_type,
            source_id=source_id,
            caregiver_id=caregiver_id,
        )
        self.db.add(event)
        self.db.commit()

    def after_save(self, person_id: str):
        self.evaluate_understanding(person_id)

    def evaluate_understanding(self, person_id: str):
        pass

    def apply_correction(self, correction):
        target_type = correction.target_type
        target_id = correction.target_id
        corrected_text = correction.corrected_text
        reason = correction.reason
        person_id = correction.person_id

        if target_type == "insight":
            insight = self.db.query(InsightModel).filter(InsightModel.id == target_id).first()
            if insight:
                old_description = insight.description
                insight.description = corrected_text
                insight.updated_at = datetime.utcnow()
                self.db.commit()
                self._log_correction_memory(person_id, target_type, target_id, old_description, corrected_text, reason)
                self._invalidate_derived_state(person_id, insight.evidence_ids or [])

        elif target_type == "care_event":
            care_event = self.db.query(CareEventModel).filter(CareEventModel.id == target_id).first()
            if care_event:
                old_description = care_event.description
                if old_description == correction.original_text or not old_description:
                    care_event.description = corrected_text
                else:
                    care_event.description = corrected_text
                if care_event.title == (correction.original_text or "")[:200] or not care_event.title or care_event.title == "Document observation":
                    care_event.title = (corrected_text or "")[:200]
                care_event.updated_at = datetime.utcnow()
                self.db.commit()
                self._log_correction_memory(person_id, target_type, target_id, old_description, corrected_text, reason)
                self._recompute_derived_state(person_id, care_event)

        elif target_type == "evidence":
            evidence = self.db.query(EvidenceModel).filter(EvidenceModel.id == target_id).first()
            if evidence:
                old_text = evidence.source_text
                evidence.source_text = corrected_text
                evidence.updated_at = datetime.utcnow()
                self.db.commit()
                self._log_correction_memory(person_id, target_type, target_id, old_text, corrected_text, reason)
                self._recompute_derived_state_for_evidence(person_id, evidence, old_text)

        self.record_learning_event(
            person_id,
            "correction_applied",
            f"Corrected {target_type}: {correction.original_text} -> {corrected_text}",
            "correction",
            source_id=correction.id,
            caregiver_id=correction.caregiver_id,
        )
        self.after_save(person_id)

    def _log_correction_memory(self, person_id, target_type, target_id, original, corrected, reason):
        memory = ReasoningMemoryModel(
            person_id=person_id,
            memory_type="correction_history",
            key=f"{target_type}_{target_id}",
            value=[
                {
                    "original": original,
                    "corrected": corrected,
                    "reason": reason,
                    "corrected_at": datetime.utcnow().isoformat(),
                }
            ],
            confidence=1.0,
            source_evidence_ids=[],
        )
        self.db.add(memory)
        self.db.commit()

    def _invalidate_derived_state(self, person_id: str, evidence_ids: list):
        from app.models.change import Change as ChangeModel, Situation as SituationModel
        from app.models.significance import SignificanceAssessment
        ev_set = set(evidence_ids)
        old_changes = (
            self.db.query(ChangeModel)
            .filter(ChangeModel.person_id == person_id, ChangeModel.is_active.is_(True))
            .all()
        )
        affected_change_ids = []
        for c in old_changes:
            if ev_set & set(c.evidence_ids or []):
                c.is_active = False
                affected_change_ids.append(c.id)
        old_assessments = (
            self.db.query(SignificanceAssessment)
            .filter(
                SignificanceAssessment.person_id == person_id,
                SignificanceAssessment.target_type == "change",
                SignificanceAssessment.is_active.is_(True),
            )
            .all()
        )
        for a in old_assessments:
            if (ev_set & set(a.evidence_ids or [])) or (a.target_id in affected_change_ids):
                a.is_active = False
        old_situations = (
            self.db.query(SituationModel)
            .filter(
                SituationModel.person_id == person_id,
                SituationModel.is_active.is_(True),
            )
            .all()
        )
        old_change_id_set = set(affected_change_ids)
        for s in old_situations:
            sids = set(s.signal_ids or [])
            cids = set(s.change_ids or [])
            if (ev_set & sids) or (old_change_id_set & cids):
                s.is_active = False
        self.db.commit()

    def _recompute_derived_state(self, person_id, care_event):
        try:
            from app.services.change_detection import detect_event_changes
            from app.services.situation_formation import detect_situations

            self._invalidate_derived_state(person_id, care_event.evidence_ids or [])
            changes = detect_event_changes(
                self.db, person_id, care_event.event_type, None, care_event.occurred_at
            )
            sig_changes = [
                c for c in changes
                if c.significance_verdict and c.significance_verdict.value != "insufficient_evidence"
            ]
            attention_candidate = any(c.attention_candidate for c in sig_changes) if sig_changes else False
            follow_up_candidate = any(c.follow_up_candidate for c in sig_changes) if sig_changes else False
            situations = detect_situations(self.db, person_id, care_event.occurred_at)
            care_event.significance_verdict = (
                sig_changes[0].significance_verdict.value if sig_changes else None
            )
            care_event.attention_candidate = attention_candidate
            care_event.follow_up_candidate = follow_up_candidate
            care_event.confidence = sig_changes[0].confidence if sig_changes else None
            care_event.situation_id = situations[0].id if situations else None
            self.db.commit()
        except Exception:
            self.db.rollback()

    def _recompute_derived_state_for_evidence(self, person_id, evidence, original_text=None):
        try:
            care_events = (
                self.db.query(CareEventModel)
                .filter(
                    CareEventModel.person_id == person_id,
                    CareEventModel.evidence_ids.contains(evidence.id),
                )
                .all()
            )
            for ce in care_events:
                if original_text and (ce.description == original_text or ce.description is None):
                    ce.description = evidence.source_text
                self._recompute_derived_state(person_id, ce)
        except Exception:
            self.db.rollback()

    def record_feedback(self, person_id: str, category: str, detail: str, caregiver_id: str):
        memory = ReasoningMemoryModel(
            person_id=person_id,
            memory_type="feedback",
            key=category,
            value=[
                {
                    "detail": detail,
                    "caregiver_id": caregiver_id,
                    "recorded_at": datetime.utcnow().isoformat(),
                }
            ],
            confidence=1.0,
            source_evidence_ids=[],
        )
        self.db.add(memory)
        self.db.commit()

    def get_reasoning_summary(self, person_id: str) -> dict[str, Any]:
        memories = (
            self.db.query(ReasoningMemoryModel)
            .filter(
                ReasoningMemoryModel.person_id == person_id,
                ReasoningMemoryModel.superseded_by_memory_id.is_(None),
            )
            .all()
        )

        confirmed_facts = []
        open_questions = []
        preferences = []
        rejected_assumptions = []
        care_patterns = []
        coordination_decisions = []

        for m in memories:
            entry = {
                "key": m.key,
                "value": m.value,
                "confidence": m.confidence,
                "updated_at": m.updated_at.isoformat()
                if m.updated_at
                else m.created_at.isoformat(),
            }
            if m.memory_type == "confirmed_fact":
                confirmed_facts.append(entry)
            elif m.memory_type == "open_question":
                open_questions.append(entry)
            elif m.memory_type == "preference":
                preferences.append(entry)
            elif m.memory_type == "rejected_assumption":
                rejected_assumptions.append(entry)
            elif m.memory_type == "care_pattern":
                care_patterns.append(entry)
            elif m.memory_type == "coordination_decision":
                coordination_decisions.append(entry)

        return {
            "confirmed_facts": confirmed_facts,
            "open_questions": open_questions,
            "preferences": preferences,
            "rejected_assumptions": rejected_assumptions,
            "care_patterns": care_patterns,
            "coordination_decisions": coordination_decisions,
        }

    def get_observation_trends(self, person_id: str) -> list[dict[str, Any]]:
        observations = (
            self.db.query(ObservationModel)
            .filter(ObservationModel.person_id == person_id)
            .order_by(ObservationModel.observed_at.asc())
            .all()
        )

        tag_observations: dict[str, list[ObservationModel]] = {}
        for obs in observations:
            tags = obs.tags or []
            for tag in tags:
                tag_observations.setdefault(tag, []).append(obs)

        trends = []
        for tag, obs_list in tag_observations.items():
            if len(obs_list) < 2:
                continue
            first = obs_list[0].observed_at
            last = obs_list[-1].observed_at
            count = len(obs_list)
            if count >= 5:
                trend = "Strong pattern"
            elif count >= 3:
                trend = "Emerging pattern"
            else:
                trend = "Observed"
            trends.append(
                {
                    "tag": tag,
                    "count": count,
                    "first_observed": first.isoformat(),
                    "last_observed": last.isoformat(),
                    "trend": trend,
                }
            )

        return sorted(trends, key=lambda x: x["count"], reverse=True)
