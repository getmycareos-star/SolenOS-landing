from sqlalchemy import Column, String, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.sql import func
import uuid
from app.core.database import Base
from app.core.types import JSONList


class CareWindow(Base):
    __tablename__ = "care_windows"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    person_id = Column(String, ForeignKey("persons.id"), nullable=False, index=True)
    window_type = Column(String, nullable=False)
    source_event_id = Column(String, ForeignKey("care_events.id"), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=False)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    ends_at = Column(DateTime(timezone=True), nullable=False)
    status = Column(String, nullable=False, default="active")
    time_provenance = Column(String, nullable=True)
    extra_metadata = Column(JSONList, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Appointment(Base):
    __tablename__ = "appointments"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    person_id = Column(String, ForeignKey("persons.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    scheduled_at = Column(DateTime(timezone=True), nullable=False)
    scheduled_at_timezone = Column(String, nullable=True)
    location = Column(String, nullable=True)
    location_type = Column(String, nullable=True)
    provider = Column(String, nullable=True)
    healthcare_org = Column(String, nullable=True)
    preparation_notes = Column(Text, nullable=True)
    documents_to_bring = Column(JSONList, nullable=True)
    medication_questions = Column(JSONList, nullable=True)
    travel_notes = Column(Text, nullable=True)
    status = Column(String, nullable=False, default="scheduled")
    time_provenance = Column(String, nullable=True)
    location_provenance = Column(String, nullable=True)
    evidence_ids = Column(JSONList, nullable=True)
    created_by_caregiver_id = Column(String, ForeignKey("caregivers.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)


class CareTransition(Base):
    __tablename__ = "care_transitions"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    person_id = Column(String, ForeignKey("persons.id"), nullable=False, index=True)
    from_location = Column(String, nullable=True)
    to_location = Column(String, nullable=False)
    transition_type = Column(String, nullable=False)
    triggered_by_event_id = Column(String, ForeignKey("care_events.id"), nullable=True)
    occurred_at = Column(DateTime(timezone=True), nullable=False)
    time_provenance = Column(String, nullable=True)
    location_provenance = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Location(Base):
    __tablename__ = "locations"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    person_id = Column(String, ForeignKey("persons.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    location_type = Column(String, nullable=False)
    address = Column(Text, nullable=True)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    country = Column(String, nullable=False, default="US")
    timezone = Column(String, nullable=True)
    is_primary = Column(Boolean, default=False)
    healthcare_org = Column(String, nullable=True)
    provider = Column(String, nullable=True)
    preferred_pharmacy = Column(String, nullable=True)
    laboratory = Column(String, nullable=True)
    specialists = Column(JSONList, nullable=True)
    nearby_hospitals = Column(JSONList, nullable=True)
    location_provenance = Column(String, nullable=True)
    extra_metadata = Column(JSONList, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class DailyIntelligence(Base):
    __tablename__ = "daily_intelligence"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    person_id = Column(String, ForeignKey("persons.id"), nullable=False, index=True)
    intelligence_date = Column(DateTime(timezone=True), nullable=False)
    overdue_items = Column(JSONList, nullable=True)
    upcoming_items = Column(JSONList, nullable=True)
    active_windows = Column(JSONList, nullable=True)
    expired_windows = Column(JSONList, nullable=True)
    daily_summary = Column(Text, nullable=True)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())


class TimezoneContext(Base):
    __tablename__ = "timezone_contexts"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    person_id = Column(String, ForeignKey("persons.id"), nullable=False, index=True)
    caregiver_id = Column(String, ForeignKey("caregivers.id"), nullable=True)
    timezone_id = Column(String, nullable=False)
    is_primary = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TemporalRelationship(Base):
    __tablename__ = "temporal_relationships"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    person_id = Column(String, ForeignKey("persons.id"), nullable=False, index=True)
    event_a_id = Column(String, ForeignKey("care_events.id"), nullable=True)
    event_b_id = Column(String, ForeignKey("care_events.id"), nullable=True)
    relationship_type = Column(String, nullable=False)
    time_difference_seconds = Column(String, nullable=True)
    confidence = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
