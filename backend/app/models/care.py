from sqlalchemy import Column, String, DateTime, Date, Boolean, Text, ForeignKey, Float
from sqlalchemy.sql import func
import uuid
from app.core.database import Base
from app.core.types import JSONList


class Person(Base):
    __tablename__ = "persons"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    date_of_birth = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Caregiver(Base):
    __tablename__ = "caregivers"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    relationship = Column(String, nullable=False)
    person_id = Column(String, ForeignKey("persons.id"), nullable=False)
    timezone = Column(String, nullable=False, default="UTC")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Evidence(Base):
    __tablename__ = "evidence"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    person_id = Column(String, ForeignKey("persons.id"), nullable=False, index=True)
    type = Column(String, nullable=False)
    source_text = Column(Text, nullable=False)
    original_file_path = Column(String, nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    uploaded_by_caregiver_id = Column(String, ForeignKey("caregivers.id"), nullable=False)
    extra_metadata = Column(Text, nullable=True)
    time_provenance = Column(String, nullable=True)
    location = Column(String, nullable=True)


class CareEvent(Base):
    __tablename__ = "care_events"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    person_id = Column(String, ForeignKey("persons.id"), nullable=False, index=True)
    event_type = Column(String, nullable=False)
    status = Column(String, nullable=False, default="recorded")
    occurred_at = Column(DateTime(timezone=True), nullable=False)
    occurred_at_timezone = Column(String, nullable=True)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    evidence_ids = Column(JSONList, nullable=True)
    location = Column(String, nullable=True)
    location_provenance = Column(String, nullable=True)
    time_provenance = Column(String, nullable=True)
    tags = Column(JSONList, nullable=True)
    created_by_caregiver_id = Column(String, ForeignKey("caregivers.id"), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Insight(Base):
    __tablename__ = "insights"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    person_id = Column(String, ForeignKey("persons.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    insight_type = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)
    evidence_ids = Column(JSONList, nullable=False)
    possible_context = Column(Text, nullable=True)
    time_provenance = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    superseded_by_insight_id = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)


class Correction(Base):
    __tablename__ = "corrections"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    person_id = Column(String, ForeignKey("persons.id"), nullable=False, index=True)
    target_type = Column(String, nullable=False)
    target_id = Column(String, nullable=False)
    original_text = Column(Text, nullable=False)
    corrected_text = Column(Text, nullable=False)
    reason = Column(Text, nullable=True)
    caregiver_id = Column(String, ForeignKey("caregivers.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
