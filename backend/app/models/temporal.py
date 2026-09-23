from sqlalchemy import Column, String, DateTime, Text, Boolean, Float, ForeignKey, Enum as SQLEnum
from sqlalchemy.sql import func
import uuid
from app.core.database import Base
from app.core.types import JSONList
from app.core.temporal_enums import (
    TemporalPrecision,
    TemporalMode,
    TemporalStatus,
    TemporalRelationType,
    TemporalResolutionStatus,
)


class TemporalFact(Base):
    __tablename__ = "temporal_facts"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    person_id = Column(String, ForeignKey("persons.id"), nullable=False, index=True)

    subject_type = Column(String, nullable=False)
    subject_id = Column(String, nullable=False)

    temporal_mode = Column(SQLEnum(TemporalMode), nullable=False, default=TemporalMode.EVENT)
    status = Column(SQLEnum(TemporalStatus), nullable=False, default=TemporalStatus.ASSERTED)

    asserted_point = Column(DateTime(timezone=True), nullable=True)
    asserted_start = Column(DateTime(timezone=True), nullable=True)
    asserted_end = Column(DateTime(timezone=True), nullable=True)

    precision = Column(SQLEnum(TemporalPrecision), nullable=False, default=TemporalPrecision.UNKNOWN)
    is_approximate = Column(Boolean, nullable=False, default=False)
    lower_bound = Column(DateTime(timezone=True), nullable=True)
    upper_bound = Column(DateTime(timezone=True), nullable=True)

    document_time = Column(DateTime(timezone=True), nullable=True)
    effective_time = Column(DateTime(timezone=True), nullable=True)

    time_provenance = Column(String, nullable=True)
    source_assertion = Column(Text, nullable=True)

    evidence_ids = Column(JSONList, nullable=True)
    confidence = Column(Float, nullable=True)

    superseded_by_fact_id = Column(String, ForeignKey("temporal_facts.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by_caregiver_id = Column(String, ForeignKey("caregivers.id"), nullable=True)


class TemporalReferenceFrame(Base):
    __tablename__ = "temporal_reference_frames"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    person_id = Column(String, ForeignKey("persons.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    reference_time = Column(DateTime(timezone=True), nullable=True)
    source_event_id = Column(String, ForeignKey("care_events.id"), nullable=True)
    source_fact_id = Column(String, ForeignKey("temporal_facts.id"), nullable=True)
    is_resolved = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TemporalRelation(Base):
    __tablename__ = "temporal_relations"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    person_id = Column(String, ForeignKey("persons.id"), nullable=False, index=True)
    fact_a_id = Column(String, ForeignKey("temporal_facts.id"), nullable=False)
    fact_b_id = Column(String, ForeignKey("temporal_facts.id"), nullable=False)
    relation_type = Column(SQLEnum(TemporalRelationType), nullable=False)
    confidence = Column(Float, nullable=False, default=1.0)
    is_derived = Column(Boolean, nullable=False, default=False)
    derivation_method = Column(String, nullable=True)
    evidence_ids = Column(JSONList, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TemporalContradiction(Base):
    __tablename__ = "temporal_contradictions"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    person_id = Column(String, ForeignKey("persons.id"), nullable=False, index=True)
    subject_type = Column(String, nullable=False)
    subject_id = Column(String, nullable=False)
    fact_a_id = Column(String, ForeignKey("temporal_facts.id"), nullable=False)
    fact_b_id = Column(String, ForeignKey("temporal_facts.id"), nullable=False)
    description = Column(Text, nullable=True)
    resolution_status = Column(
        SQLEnum(TemporalResolutionStatus), nullable=False, default=TemporalResolutionStatus.UNRESOLVED
    )
    resolution_notes = Column(Text, nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by_caregiver_id = Column(String, ForeignKey("caregivers.id"), nullable=True)
    evidence_ids = Column(JSONList, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
