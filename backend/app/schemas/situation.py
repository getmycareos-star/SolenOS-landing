from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Any, Dict


class SituationProvenance(BaseModel):
    input_type: Optional[str] = None
    entry_method: Optional[str] = None
    captured_at: Optional[str] = None
    recognition_confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    transcript_uncertain: bool = False


class SituationDocument(BaseModel):
    id: str
    name: str
    extracted_text: str
    mime_type: Optional[str] = None
    ocr_confidence: Optional[float] = Field(None, ge=0.0, le=1.0)


class SituationInput(BaseModel):
    caregiver_id: str
    person_id: str
    raw_input: str = ""
    documents: Optional[List[SituationDocument]] = None
    provenance: Optional[SituationProvenance] = None
    timestamp: Optional[str] = None


class SituationEvent(BaseModel):
    id: str
    event_type: str
    title: str
    description: Optional[str] = None
    occurred_at: Optional[datetime] = None
    evidence_ids: Optional[List[str]] = None


class SituationResponse(BaseModel):
    ok: bool
    situation_id: Optional[str]
    care_key: str
    person_id: str
    evidence_id: str
    care_event_id: str
    message: str
    events: List[SituationEvent]
    situations: Optional[List[dict[str, Any]]] = None
    attention_candidate: bool = False
    follow_up_candidate: bool = False
    what_changed: Optional[str] = None
    prioritization_ids: Optional[List[str]] = None
    top_priority: Optional[Dict[str, Any]] = None
    warnings: Optional[List[str]] = None
