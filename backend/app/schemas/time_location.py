from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Any, Dict


class CareWindowBase(BaseModel):
    person_id: str
    window_type: str
    source_event_id: Optional[str] = None
    started_at: datetime
    ended_at: Optional[datetime] = None
    ends_at: datetime
    status: str = "active"
    time_provenance: Optional[str] = None
    extra_metadata: Optional[List[Any]] = None


class CareWindowCreate(CareWindowBase):
    pass


class CareWindow(CareWindowBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True


class AppointmentBase(BaseModel):
    person_id: str
    title: str
    scheduled_at: datetime
    scheduled_at_timezone: Optional[str] = None
    location: Optional[str] = None
    location_type: Optional[str] = None
    provider: Optional[str] = None
    healthcare_org: Optional[str] = None
    preparation_notes: Optional[str] = None
    documents_to_bring: Optional[List[str]] = None
    medication_questions: Optional[List[str]] = None
    travel_notes: Optional[str] = None
    status: str = "scheduled"
    time_provenance: Optional[str] = None
    location_provenance: Optional[str] = None
    evidence_ids: Optional[List[str]] = None
    created_by_caregiver_id: str


class AppointmentCreate(AppointmentBase):
    pass


class Appointment(AppointmentBase):
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CareTransitionBase(BaseModel):
    person_id: str
    from_location: Optional[str] = None
    to_location: str
    transition_type: str
    triggered_by_event_id: Optional[str] = None
    occurred_at: datetime
    time_provenance: Optional[str] = None
    location_provenance: Optional[str] = None
    notes: Optional[str] = None


class CareTransitionCreate(CareTransitionBase):
    pass


class CareTransition(CareTransitionBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True


class LocationBase(BaseModel):
    person_id: str
    name: str
    location_type: str
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: str = "US"
    timezone: Optional[str] = None
    is_primary: bool = False
    healthcare_org: Optional[str] = None
    provider: Optional[str] = None
    preferred_pharmacy: Optional[str] = None
    laboratory: Optional[str] = None
    specialists: Optional[List[str]] = None
    nearby_hospitals: Optional[List[str]] = None
    location_provenance: Optional[str] = None
    extra_metadata: Optional[List[Any]] = None


class LocationCreate(LocationBase):
    pass


class Location(LocationBase):
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DailyIntelligenceBase(BaseModel):
    person_id: str
    intelligence_date: datetime
    overdue_items: Optional[List[Dict[str, Any]]] = None
    upcoming_items: Optional[List[Dict[str, Any]]] = None
    active_windows: Optional[List[Dict[str, Any]]] = None
    expired_windows: Optional[List[Dict[str, Any]]] = None
    daily_summary: Optional[str] = None


class DailyIntelligenceCreate(DailyIntelligenceBase):
    pass


class DailyIntelligence(DailyIntelligenceBase):
    id: str
    generated_at: datetime

    class Config:
        from_attributes = True


class TimezoneContextBase(BaseModel):
    person_id: str
    caregiver_id: Optional[str] = None
    timezone_id: str
    is_primary: bool = False


class TimezoneContextCreate(TimezoneContextBase):
    pass


class TimezoneContext(TimezoneContextBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True


class TemporalRelationshipBase(BaseModel):
    person_id: str
    event_a_id: Optional[str] = None
    event_b_id: Optional[str] = None
    relationship_type: str
    time_difference_seconds: Optional[str] = None
    confidence: Optional[str] = None


class TemporalRelationshipCreate(TemporalRelationshipBase):
    pass


class TemporalRelationship(TemporalRelationshipBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True


class NaturalLanguageTimeParse(BaseModel):
    original_text: str
    parsed_datetime: Optional[datetime] = None
    timezone: Optional[str] = None
    timezone_id: Optional[str] = None
    confidence: float = Field(ge=0.0, le=1.0)
    interpretation: str
    is_ambiguous: bool = False
    provenance: Optional[str] = None
