from datetime import datetime
from typing import Any
from sqlalchemy.orm import Session
from app.models.memory import (
    ReasoningMemory as ReasoningMemoryModel,
    Observation as ObservationModel,
    LearningEvent as LearningEventModel,
)
from app.models.care import Insight as InsightModel


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

                memory = ReasoningMemoryModel(
                    person_id=person_id,
                    memory_type="correction_history",
                    key=f"insight_{target_id}",
                    value=[
                        {
                            "original": old_description,
                            "corrected": corrected_text,
                            "reason": reason,
                            "corrected_at": datetime.utcnow().isoformat(),
                        }
                    ],
                    confidence=1.0,
                    source_evidence_ids=[],
                )
                self.db.add(memory)
                self.db.commit()

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
