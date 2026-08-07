from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Any


class PersonBase(BaseModel):
    name: str
    date_of_birth: Optional[str] = None


class PersonCreate(PersonBase):
    pass


class Person(PersonBase):
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CaregiverBase(BaseModel):
    name: str
    email: str
    relationship: str
    person_id: str
    timezone: str = "UTC"


class CaregiverCreate(CaregiverBase):
    pass


class Caregiver(CaregiverBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True


class EvidenceBase(BaseModel):
    person_id: str
    type: str
    source_text: str
    original_file_path: Optional[str] = None
    extra_metadata: Optional[dict[str, Any]] = None
    time_provenance: Optional[str] = None
    location: Optional[str] = None


class EvidenceCreate(EvidenceBase):
    uploaded_by_caregiver_id: str


class Evidence(EvidenceBase):
    id: str
    uploaded_at: datetime
    uploaded_by_caregiver_id: str

    class Config:
        from_attributes = True


class CareEventBase(BaseModel):
    person_id: str
    event_type: str
    status: str = "recorded"
    occurred_at: datetime
    occurred_at_timezone: Optional[str] = None
    title: str
    description: Optional[str] = None
    evidence_ids: Optional[List[str]] = None
    location: Optional[str] = None
    location_provenance: Optional[str] = None
    time_provenance: Optional[str] = None
    tags: Optional[List[str]] = None
    created_by_caregiver_id: str


class CareEventCreate(CareEventBase):
    pass


class CareEvent(CareEventBase):
    id: str
    recorded_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class InsightBase(BaseModel):
    person_id: str
    title: str
    description: str
    insight_type: str
    confidence: float = Field(ge=0.0, le=1.0)
    evidence_ids: List[str]
    possible_context: Optional[str] = None
    time_provenance: Optional[str] = None


class InsightCreate(InsightBase):
    pass


class Insight(InsightBase):
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    superseded_by_insight_id: Optional[str] = None
    is_active: bool = True

    class Config:
        from_attributes = True


class CorrectionBase(BaseModel):
    person_id: str
    target_type: str
    target_id: str
    original_text: str
    corrected_text: str
    reason: Optional[str] = None
    caregiver_id: str


class CorrectionCreate(CorrectionBase):
    pass


class Correction(CorrectionBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True
