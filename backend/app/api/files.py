from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
import os
import shutil
import uuid

from app.core.database import get_db
from app.core.config import get_settings
from app.models.document import Document as DocumentModel
from app.models.care import Person as PersonModel, Caregiver as CaregiverModel, Evidence as EvidenceModel, CareEvent as CareEventModel
from app.schemas.document import DocumentResponse, DocumentUploadResponse
from app.services.document_processing import (
    save_uploaded_file,
    process_and_persist_document,
    SUPPORTED_MIME_TYPES,
    MAX_FILE_SIZE_BYTES,
)
from app.services.situation import process_situation_input
from app.schemas.situation import SituationInput
from app.services.learning import LearningEngine, SavePipelineEvent

router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "uploads")
@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    caregiver_id: str = Form(...),
    person_id: str = Form(...),
    timestamp: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    person = db.query(PersonModel).filter(PersonModel.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    caregiver = db.query(CaregiverModel).filter(
        CaregiverModel.id == caregiver_id,
        CaregiverModel.person_id == person_id,
    ).first()
    if not caregiver:
        raise HTTPException(
            status_code=403,
            detail="Caregiver not authorized for this person",
        )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty file not allowed")
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE_BYTES // (1024*1024)}MB",
        )

    mime_type = file.content_type or "application/octet-stream"
    filename = file.filename or "upload"
    ext = os.path.splitext(filename)[1].lower()
    if not ext:
        ext = SUPPORTED_MIME_TYPES.get(mime_type, "")

    if not SUPPORTED_MIME_TYPES.get(mime_type) and ext not in [".txt", ".pdf", ".docx", ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff"]:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {mime_type or ext}. Supported: txt, pdf, docx, png, jpg, jpeg, gif, bmp, tiff",
        )

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    doc = save_uploaded_file(content, filename, mime_type, person_id, UPLOAD_DIR)
    doc.uploaded_by_caregiver_id = caregiver_id
    db.add(doc)
    db.commit()
    db.refresh(doc)

    result = process_and_persist_document(db, doc)

    evidence = EvidenceModel(
        person_id=person_id,
        type="document",
        source_text=result.text,
        original_file_path=doc.storage_path,
        uploaded_by_caregiver_id=caregiver_id,
        confidence=result.confidence,
        evidence_status="processed",
        source_type="uploaded_document",
    )
    db.add(evidence)
    db.flush()
    doc.evidence_id = evidence.id

    happened_at = timestamp if timestamp else datetime.now(timezone.utc).isoformat()

    situation_payload = SituationInput(
        caregiver_id=caregiver_id,
        person_id=person_id,
        raw_input=result.text if result.text.strip() else f"[Document: {filename}] No extractable text",
        documents=[{
            "id": doc.id,
            "name": filename,
            "extracted_text": result.text,
            "mime_type": mime_type,
            "ocr_confidence": result.ocr_confidence,
        }],
        provenance={
            "input_type": "ocr_text" if result.ocr_status.value != "not_required" else "document",
            "entry_method": "upload",
            "recognition_confidence": result.confidence,
            "transcript_uncertain": result.ocr_confidence is not None and result.ocr_confidence < 0.7 if result.ocr_confidence else False,
        },
        timestamp=timestamp,
    )

    try:
        situation_result = process_situation_input(db, situation_payload)
        doc.care_event_id = situation_result.care_event_id
    except Exception as e:
        doc.processing_error = (doc.processing_error or "") + f"; situation_pipeline: {str(e)}"
        doc.evidence_id = evidence.id
        db.commit()
        return DocumentUploadResponse(
            ok=True,
            document_id=doc.id,
            message=f"Document uploaded and extracted. Reasoning pipeline encountered an error: {str(e)}",
            filename=filename,
            mime_type=mime_type,
            file_size_bytes=len(content),
            document_type=doc.document_type,
            processing_status=doc.processing_status,
            extraction_method=result.method.value,
            extracted_text=result.text,
            extraction_confidence=result.confidence,
            ocr_status=result.ocr_status.value,
            ocr_confidence=result.ocr_confidence,
            ocr_engine=result.ocr_engine,
            page_count=doc.page_count,
            evidence_id=evidence.id,
            care_event_id=doc.care_event_id,
            situations=getattr(situation_result, "situations", None) if situation_result else None,
            attention_candidate=getattr(situation_result, "attention_candidate", False) if situation_result else False,
            follow_up_candidate=getattr(situation_result, "follow_up_candidate", False) if situation_result else False,
            what_changed=getattr(situation_result, "what_changed", None) if situation_result else None,
        )

    db.commit()
    db.refresh(doc)
    learning = LearningEngine(db)
    learning.log_pipeline_event(SavePipelineEvent(
        step="document_upload_processed",
        person_id=person_id,
        detail=f"Processed {filename}: {len(result.text)} chars extracted via {result.method.value}",
    ))
    learning.record_learning_event(
        person_id,
        "document_uploaded",
        f"Uploaded document {filename}, extracted {len(result.text)} chars",
        "document",
        doc.id,
        caregiver_id,
    )
    learning.after_save(person_id)

    return DocumentUploadResponse(
        ok=True,
        document_id=doc.id,
        message="Document uploaded, processed, and integrated into care reasoning." if result.text.strip() else "Document uploaded but contained no extractable text.",
        filename=filename,
        mime_type=mime_type,
        file_size_bytes=len(content),
        document_type=doc.document_type,
        processing_status=doc.processing_status,
        extraction_method=result.method.value,
        extracted_text=result.text,
        extraction_confidence=result.confidence,
        ocr_status=result.ocr_status.value,
        ocr_confidence=result.ocr_confidence,
        ocr_engine=result.ocr_engine,
        page_count=doc.page_count,
        evidence_id=evidence.id,
        care_event_id=doc.care_event_id,
        situations=getattr(situation_result, "situations", None) if situation_result else None,
        attention_candidate=getattr(situation_result, "attention_candidate", False) if situation_result else False,
        follow_up_candidate=getattr(situation_result, "follow_up_candidate", False) if situation_result else False,
        what_changed=getattr(situation_result, "what_changed", None) if situation_result else None,
    )


@router.get("/{person_id}", response_model=List[DocumentResponse])
def list_documents(person_id: str, db: Session = Depends(get_db)):
    person = db.query(PersonModel).filter(PersonModel.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    docs = (
        db.query(DocumentModel)
        .filter(DocumentModel.person_id == person_id)
        .order_by(DocumentModel.uploaded_at.desc())
        .all()
    )
    return [DocumentResponse.from_orm(doc) for doc in docs]


@router.get("/{person_id}/documents/{document_id}", response_model=DocumentResponse)
def get_document(person_id: str, document_id: str, db: Session = Depends(get_db)):
    doc = db.query(DocumentModel).filter(
        DocumentModel.id == document_id,
        DocumentModel.person_id == person_id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentResponse.from_orm(doc)


@router.get("/{person_id}/documents/{document_id}/download")
def download_document(person_id: str, document_id: str, db: Session = Depends(get_db)):
    from fastapi.responses import FileResponse
    doc = db.query(DocumentModel).filter(
        DocumentModel.id == document_id,
        DocumentModel.person_id == person_id,
    ).first()
    if not doc or not os.path.exists(doc.storage_path):
        raise HTTPException(status_code=404, detail="Document file not found")
    return FileResponse(
        path=doc.storage_path,
        media_type=doc.mime_type,
        filename=doc.original_filename,
    )


@router.post("/{person_id}/documents/{document_id}/reprocess")
def reprocess_document(
    person_id: str,
    document_id: str,
    caregiver_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    doc = db.query(DocumentModel).filter(
        DocumentModel.id == document_id,
        DocumentModel.person_id == person_id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if caregiver_id:
        caregiver = db.query(CaregiverModel).filter(
            CaregiverModel.id == caregiver_id,
            CaregiverModel.person_id == person_id,
        ).first()
        if not caregiver:
            raise HTTPException(status_code=403, detail="Caregiver not authorized")

    result = process_and_persist_document(db, doc)
    if doc.evidence_id:
        evidence = db.query(EvidenceModel).filter(EvidenceModel.id == doc.evidence_id).first()
        if evidence:
            evidence.source_text = result.text
            evidence.confidence = result.confidence
            evidence.evidence_status = "processed"
            evidence.extra_metadata = result.errors[0] if result.errors else None
    db.commit()
    db.refresh(doc)
    return {
        "ok": True,
        "document_id": doc.id,
        "processing_status": doc.processing_status,
        "extraction_method": result.method.value,
        "extracted_text_length": len(result.text),
        "ocr_status": result.ocr_status.value,
        "extraction_confidence": result.confidence,
        "errors": result.errors,
    }
