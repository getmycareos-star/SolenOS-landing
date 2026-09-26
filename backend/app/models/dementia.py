from sqlalchemy import Column, String, DateTime, Text, Boolean, Float, ForeignKey, Integer, Enum as SQLEnum
from sqlalchemy.sql import func
import uuid
from app.core.database import Base
from app.core.types import JSONList
from app.core.dementia_enums import (
    DementiaDomain,
    DementiaChangeType,
    FluctuationPattern,
    SafetySignificance,
    CaregiverLanguageCategory,
    DementiaBaselineType,
    EvidenceStatus,
)


class DementiaBaselineModel(Base):
    __tablename__ = "dementia_baselines"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    person_id = Column(String, ForeignKey("persons.id"), nullable=False, index=True)

    baseline_type = Column(SQLEnum(DementiaBaselineType), nullable=False)
    domain = Column(SQLEnum(DementiaDomain), nullable=False, index=True)

    description = Column(Text, nullable=False)
    severity = Column(String, nullable=True)
    frequency = Column(String, nullable=True)
    context = Column(Text, nullable=True)

    established_date = Column(DateTime(timezone=True), nullable=False)
    last_confirmed_date = Column(DateTime(timezone=True), nullable=True)
    confidence = Column(Float, nullable=False, default=0.5)

    evidence_ids = Column(JSONList, nullable=True)
    caregiver_reports = Column(JSONList, nullable=True)

    is_active = Column(Boolean, default=True)
    superseded_by = Column(String, nullable=True)

    evidence_status = Column(SQLEnum(EvidenceStatus), nullable=False, default=EvidenceStatus.INFERRED)
    source_span_verified = Column(Boolean, nullable=False, default=False)
    source_span_start_offset = Column(Integer, nullable=True)
    source_span_end_offset = Column(Integer, nullable=True)
    source_span_text = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class DementiaObservationModel(Base):
    __tablename__ = "dementia_observations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    person_id = Column(String, ForeignKey("persons.id"), nullable=False, index=True)

    domain = Column(SQLEnum(DementiaDomain), nullable=False, index=True)
    change_type = Column(SQLEnum(DementiaChangeType), nullable=False)

    observation_text = Column(Text, nullable=False)
    structured_summary = Column(Text, nullable=True)

    caregiver_id = Column(String, ForeignKey("caregivers.id"), nullable=True)
    caregiver_language = Column(Text, nullable=True)
    caregiver_language_category = Column(SQLEnum(CaregiverLanguageCategory), nullable=True)

    occurred_at = Column(DateTime(timezone=True), nullable=False, index=True)
    observation_window_start = Column(DateTime(timezone=True), nullable=True)
    observation_window_end = Column(DateTime(timezone=True), nullable=True)

    fluctuation_pattern = Column(SQLEnum(FluctuationPattern), nullable=True)
    time_of_day = Column(String, nullable=True)

    compared_to_baseline = Column(Boolean, default=False)
    baseline_id = Column(String, ForeignKey("dementia_baselines.id"), nullable=True)
    deviation_description = Column(Text, nullable=True)

    safety_significance = Column(SQLEnum(SafetySignificance), nullable=True)
    safety_concerns = Column(JSONList, nullable=True)

    possible_contributors = Column(JSONList, nullable=True)
    uncertainty_notes = Column(Text, nullable=True)

    evidence_ids = Column(JSONList, nullable=True)

    evidence_status = Column(SQLEnum(EvidenceStatus), nullable=False, default=EvidenceStatus.INFERRED)
    source_span_verified = Column(Boolean, nullable=False, default=False)
    source_span_start_offset = Column(Integer, nullable=True)
    source_span_end_offset = Column(Integer, nullable=True)
    source_span_text = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class DementiaChangeAssessmentModel(Base):
    __tablename__ = "dementia_change_assessments"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    person_id = Column(String, ForeignKey("persons.id"), nullable=False, index=True)

    observation_id = Column(String, ForeignKey("dementia_observations.id"), nullable=False)
    baseline_id = Column(String, ForeignKey("dementia_baselines.id"), nullable=True)

    is_new_change = Column(Boolean, nullable=False)
    change_classification = Column(String, nullable=False)

    acute_vs_gradual = Column(String, nullable=True)
    progression_vs_episode = Column(String, nullable=True)
    recurrence_assessment = Column(String, nullable=True)

    cognitive_domain_specific = Column(Boolean, default=False)
    functional_domain_specific = Column(Boolean, default=False)
    behavioral_domain_specific = Column(Boolean, default=False)

    domain_identified = Column(SQLEnum(DementiaDomain), nullable=True)

    safety_significance = Column(SQLEnum(SafetySignificance), nullable=True)
    safety_implications = Column(JSONList, nullable=True)

    possible_contributing_factors = Column(JSONList, nullable=True)
    uncertainty = Column(Text, nullable=True)
    next_appropriate_action = Column(Text, nullable=True)

    dementia_as_explanation_flag = Column(Boolean, default=False)
    baseline_erasure_flag = Column(Boolean, default=False)

    assessed_at = Column(DateTime(timezone=True), server_default=func.now())
    assessed_by = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class DementiaCaregiverDisagreementModel(Base):
    __tablename__ = "dementia_caregiver_disagreements"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    person_id = Column(String, ForeignKey("persons.id"), nullable=False, index=True)

    caregiver_a_id = Column(String, ForeignKey("caregivers.id"), nullable=False)
    caregiver_b_id = Column(String, ForeignKey("caregivers.id"), nullable=False)

    observation_domain = Column(SQLEnum(DementiaDomain), nullable=False)
    caregiver_a_observation = Column(Text, nullable=False)
    caregiver_b_observation = Column(Text, nullable=False)

    baseline_comparison_a = Column(Text, nullable=True)
    baseline_comparison_b = Column(Text, nullable=True)

    resolution_status = Column(String, nullable=False, default="unresolved")
    concrete_examples_requested = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)


class DementiaSafetyEventModel(Base):
    __tablename__ = "dementia_safety_events"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    person_id = Column(String, ForeignKey("persons.id"), nullable=False, index=True)

    observation_id = Column(String, ForeignKey("dementia_observations.id"), nullable=True)

    event_type = Column(String, nullable=False)
    description = Column(Text, nullable=False)

    safety_significance = Column(SQLEnum(SafetySignificance), nullable=False)
    immediate_action_required = Column(Boolean, default=False)
    recommended_actions = Column(JSONList, nullable=True)

    wandering_risk = Column(Boolean, default=False)
    medication_safety_risk = Column(Boolean, default=False)
    fall_risk = Column(Boolean, default=False)
    appliance_safety_risk = Column(Boolean, default=False)
    driving_safety_risk = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class DementiaTimelineEventModel(Base):
    __tablename__ = "dementia_timeline_events"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    person_id = Column(String, ForeignKey("persons.id"), nullable=False, index=True)

    event_type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    occurred_at = Column(DateTime(timezone=True), nullable=False, index=True)

    significance = Column(String, nullable=True)

    related_observation_id = Column(String, ForeignKey("dementia_observations.id"), nullable=True)
    related_document_id = Column(String, ForeignKey("documents.id"), nullable=True)

    metadata_ = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class DementiaObservationEvidenceModel(Base):
    __tablename__ = "dementia_observation_evidence"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    observation_id = Column(String, ForeignKey("dementia_observations.id"), nullable=False)

    evidence_type = Column(String, nullable=False)
    source = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    confidence = Column(Float, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())


class DementiaCarePlanModel(Base):
    __tablename__ = "dementia_care_plans"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    person_id = Column(String, ForeignKey("persons.id"), nullable=False, index=True)

    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    priority_level = Column(String, nullable=False, default="moderate")
    assigned_to = Column(String, ForeignKey("caregivers.id"), nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True)
    status = Column(String, nullable=False, default="active")

    related_observations = Column(JSONList, nullable=True)
    related_safety_events = Column(JSONList, nullable=True)
    actions_json = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class DementiaCaregiverOnboardingModel(Base):
    __tablename__ = "dementia_caregiver_onboarding"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    person_id = Column(String, ForeignKey("persons.id"), nullable=False, index=True)
    caregiver_id = Column(String, ForeignKey("caregivers.id"), nullable=True)

    status = Column(String, nullable=False, default="in_progress")

    baseline_questions_json = Column(Text, nullable=True)
    baseline_progress_json = Column(Text, nullable=True)
    daily_checkin_questions_json = Column(Text, nullable=True)
    safety_monitor_items_json = Column(Text, nullable=True)
    emergency_contacts_json = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())