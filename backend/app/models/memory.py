from sqlalchemy import Column, String, DateTime, Text, Boolean, Float, ForeignKey
from sqlalchemy.sql import func
import uuid
from app.core.database import Base
from app.core.types import JSONList


class ReasoningMemory(Base):
    __tablename__ = "reasoning_memory"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    person_id = Column(String, ForeignKey("persons.id"), nullable=False, index=True)
    memory_type = Column(String, nullable=False)
    key = Column(String, nullable=False)
    value = Column(JSONList, nullable=False)
    confidence = Column(Float, nullable=False, default=1.0)
    source_evidence_ids = Column(JSONList, nullable=True)
    is_open_question = Column(Boolean, default=False)
    superseded_by_memory_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Observation(Base):
    __tablename__ = "observations"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    person_id = Column(String, ForeignKey("persons.id"), nullable=False, index=True)
    observed_at = Column(DateTime(timezone=True), nullable=False)
    observed_at_timezone = Column(String, nullable=True)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())
    original_text = Column(Text, nullable=False)
    structured_data = Column(JSONList, nullable=True)
    tags = Column(JSONList, nullable=True)
    location = Column(String, nullable=True)
    caregiver_id = Column(String, ForeignKey("caregivers.id"), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class LearningEvent(Base):
    __tablename__ = "learning_events"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    person_id = Column(String, ForeignKey("persons.id"), nullable=False, index=True)
    event_type = Column(String, nullable=False)
    detail = Column(Text, nullable=False)
    source_type = Column(String, nullable=False)
    source_id = Column(String, nullable=True)
    caregiver_id = Column(String, ForeignKey("caregivers.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
