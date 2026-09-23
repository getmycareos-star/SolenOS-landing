from sqlalchemy import Column, String, DateTime, Text, Float, Integer, ForeignKey
from sqlalchemy.sql import func
import uuid
from app.core.database import Base
from app.core.types import JSONList


class Document(Base):
    __tablename__ = "documents"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    person_id = Column(String, ForeignKey("persons.id"), nullable=False, index=True)
    uploaded_by_caregiver_id = Column(String, ForeignKey("caregivers.id"), nullable=False)
    original_filename = Column(String, nullable=False)
    stored_filename = Column(String, nullable=False)
    storage_path = Column(String, nullable=False)
    mime_type = Column(String, nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    content_hash = Column(String, nullable=True)
    document_type = Column(String, nullable=False, default="unknown")
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    processing_status = Column(String, nullable=False, default="pending")
    processing_started_at = Column(DateTime(timezone=True), nullable=True)
    processing_completed_at = Column(DateTime(timezone=True), nullable=True)
    processing_error = Column(Text, nullable=True)
    extraction_method = Column(String, nullable=True)
    extracted_text = Column(Text, nullable=True)
    extraction_confidence = Column(Float, nullable=True)
    ocr_status = Column(String, nullable=True, default="not_required")
    ocr_confidence = Column(Float, nullable=True)
    ocr_engine = Column(String, nullable=True)
    evidence_id = Column(String, ForeignKey("evidence.id"), nullable=True)
    care_event_id = Column(String, ForeignKey("care_events.id"), nullable=True)
    provenance = Column(JSONList, nullable=True)
    page_count = Column(Integer, nullable=True)
    is_image = Column(String, nullable=False, default="false")
