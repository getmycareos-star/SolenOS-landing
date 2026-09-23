from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime


class DocumentResponse(BaseModel):
    id: str
    person_id: str
    uploaded_by_caregiver_id: str
    original_filename: str
    stored_filename: str
    mime_type: str
    file_size_bytes: int
    document_type: str
    uploaded_at: Optional[datetime] = None
    processing_status: str
    processing_started_at: Optional[datetime] = None
    processing_completed_at: Optional[datetime] = None
    processing_error: Optional[str] = None
    extraction_method: Optional[str] = None
    extracted_text: Optional[str] = None
    extraction_confidence: Optional[float] = None
    ocr_status: Optional[str] = None
    ocr_confidence: Optional[float] = None
    ocr_engine: Optional[str] = None
    evidence_id: Optional[str] = None
    care_event_id: Optional[str] = None
    page_count: Optional[int] = None
    content_hash: Optional[str] = None
    provenance: Optional[List[Any]] = None

    class Config:
        from_attributes = True


class DocumentUploadResponse(BaseModel):
    ok: bool
    document_id: str
    message: str
    filename: str
    mime_type: str
    file_size_bytes: int
    document_type: str
    processing_status: str
    extraction_method: Optional[str] = None
    extracted_text: Optional[str] = None
    extraction_confidence: Optional[float] = None
    ocr_status: Optional[str] = None
    ocr_confidence: Optional[float] = None
    ocr_engine: Optional[str] = None
    page_count: Optional[int] = None
    evidence_id: Optional[str] = None
    care_event_id: Optional[str] = None
    situations: Optional[List[Any]] = None
    attention_candidate: bool = False
    follow_up_candidate: bool = False
    what_changed: Optional[str] = None
