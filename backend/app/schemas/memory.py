from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Any, Dict


class ReasoningMemoryBase(BaseModel):
    person_id: str
    memory_type: str
    key: str
    value: List[Any]
    confidence: float = Field(ge=0.0, le=1.0)
    source_evidence_ids: Optional[List[str]] = None
    is_open_question: bool = False


class ReasoningMemoryCreate(ReasoningMemoryBase):
    pass


class ReasoningMemory(ReasoningMemoryBase):
    id: str
    superseded_by_memory_id: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ObservationBase(BaseModel):
    person_id: str
    observed_at: datetime
    observed_at_timezone: Optional[str] = None
    original_text: str
    structured_data: Optional[List[Any]] = None
    tags: Optional[List[str]] = None
    location: Optional[str] = None
    caregiver_id: str


class ObservationCreate(ObservationBase):
    pass


class Observation(ObservationBase):
    id: str
    recorded_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LearningEventBase(BaseModel):
    person_id: str
    event_type: str
    detail: str
    source_type: str
    source_id: Optional[str] = None
    caregiver_id: Optional[str] = None


class LearningEventCreate(LearningEventBase):
    pass


class LearningEvent(LearningEventBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True


class ReasoningSummary(BaseModel):
    confirmed_facts: List[Dict[str, Any]]
    open_questions: List[Dict[str, Any]]
    preferences: List[Dict[str, Any]]
    rejected_assumptions: List[Dict[str, Any]]
    care_patterns: List[Dict[str, Any]]
    coordination_decisions: List[Dict[str, Any]]


class ObservationTrend(BaseModel):
    tag: str
    count: int
    first_observed: datetime
    last_observed: datetime
    trend: str
