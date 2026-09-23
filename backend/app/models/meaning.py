from sqlalchemy import Column, String, Text, ForeignKey, Float, DateTime
from sqlalchemy.sql import func
import uuid
from app.core.database import Base
from app.core.types import JSONList


class Meaning(Base):
    __tablename__ = "meanings"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    person_id = Column(String, ForeignKey("persons.id"), nullable=False, index=True)
    change_id = Column(String, ForeignKey("changes.id"), nullable=True, index=True)
    priority_id = Column(String, ForeignKey("prioritizations.id"), nullable=True, index=True)
    context_factors = Column(JSONList, nullable=True)
    baseline_relationship = Column(String, nullable=True)
    longitudinal_pattern = Column(String, nullable=True)
    temporal_scope = Column(String, nullable=True)
    evidence_relationship = Column(String, nullable=True)
    causal_status = Column(String, nullable=True)
    confidence_type = Column(String, nullable=True)
    confidence = Column(Float, nullable=True)
    supporting_state_elements = Column(JSONList, nullable=True)
    evidence_ids = Column(JSONList, nullable=True)
    uncertainty_ids = Column(JSONList, nullable=True)
    contradiction_ids = Column(JSONList, nullable=True)
    alternative_interpretations = Column(JSONList, nullable=True)
    not_established = Column(JSONList, nullable=True)
    caregiver_perspective = Column(String, nullable=True)
    attribution = Column(JSONList, nullable=True)
    rationale = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class MeaningEvidenceLink(Base):
    __tablename__ = "meaning_evidence_links"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    meaning_id = Column(String, ForeignKey("meanings.id"), nullable=False, index=True)
    evidence_id = Column(String, ForeignKey("evidence.id"), nullable=False, index=True)
    relationship = Column(String, nullable=False)
    epistemic_level = Column(String, nullable=False)
    confidence = Column(Float, nullable=True)
    attribution = Column(JSONList, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class MeaningChangeLink(Base):
    __tablename__ = "meaning_change_links"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    meaning_id = Column(String, ForeignKey("meanings.id"), nullable=False, index=True)
    change_id = Column(String, ForeignKey("changes.id"), nullable=False, index=True)
    relationship = Column(String, nullable=False)
    evidence_ids = Column(JSONList, nullable=True)
    attribution = Column(JSONList, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
