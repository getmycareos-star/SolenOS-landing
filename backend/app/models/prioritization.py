from sqlalchemy import Column, String, DateTime, Text, Boolean, Float, ForeignKey, Enum as SQLEnum, Integer
from sqlalchemy.sql import func
import uuid
from app.core.database import Base
from app.core.types import JSONList
from app.core.prioritization_enums import (
    PriorityLevel,
    PriorityDimension,
    PriorityReasonCategory,
    TrajectoryType,
)


class Prioritization(Base):
    __tablename__ = "prioritizations"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    person_id = Column(String, ForeignKey("persons.id"), nullable=False, index=True)
    subject_type = Column(String, nullable=False)
    subject_id = Column(String, nullable=False)
    priority_level = Column(SQLEnum(PriorityLevel), nullable=False, default=PriorityLevel.INSUFFICIENT_EVIDENCE)
    overall_confidence = Column(Float, nullable=False, default=0.0)
    change_ids = Column(JSONList, nullable=False)
    evidence_ids = Column(JSONList, nullable=False)
    baseline_reference = Column(String, nullable=True)
    trajectory = Column(SQLEnum(TrajectoryType), nullable=True)
    persistence_days = Column(Integer, nullable=True)
    is_persistent = Column(Boolean, nullable=True)
    is_recurrent = Column(Boolean, nullable=True)
    recurrence_count = Column(Integer, nullable=True)
    dimensions = Column(JSONList, nullable=False)
    uncertainty_factors = Column(JSONList, nullable=True)
    contradiction_types = Column(JSONList, nullable=True)
    vulnerability_factors = Column(JSONList, nullable=True)
    actionability_factors = Column(JSONList, nullable=True)
    caregiver_concern_expressed = Column(Boolean, nullable=False, default=False)
    caregiver_concern_evidence_ids = Column(JSONList, nullable=True)
    primary_reason_category = Column(SQLEnum(PriorityReasonCategory), nullable=True)
    reason_categories = Column(JSONList, nullable=False)
    possible_context = Column(JSONList, nullable=True)
    explanation = Column(Text, nullable=True)
    attribution = Column(JSONList, nullable=True)
    temporal_scope = Column(JSONList, nullable=True)
    comparison_baseline_quality = Column(String, nullable=True)
    superseded_by_prioritization_id = Column(String, ForeignKey("prioritizations.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class PrioritizationDimension(Base):
    __tablename__ = "prioritization_dimensions"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    prioritization_id = Column(String, ForeignKey("prioritizations.id"), nullable=False, index=True)
    dimension = Column(SQLEnum(PriorityDimension), nullable=False)
    score = Column(Float, nullable=True)
    label = Column(String, nullable=True)
    evidence_ids = Column(JSONList, nullable=True)
    explanation = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PrioritizationRanking(Base):
    __tablename__ = "prioritization_rankings"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    person_id = Column(String, ForeignKey("persons.id"), nullable=False, index=True)
    prioritization_id = Column(String, ForeignKey("prioritizations.id"), nullable=False, index=True)
    rank = Column(Integer, nullable=False)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())