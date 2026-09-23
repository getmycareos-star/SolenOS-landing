"""End-to-end tests for document upload pipeline.

Trace: file upload → document processing → text extraction → evidence → reasoning
"""
import os
import io
import tempfile
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.main import app
from app.models.care import Person, Caregiver, Evidence, CareEvent
from app.models.document import Document
from app.models.change import Change, Situation
from app.core.config import get_settings

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def setup_db():
    Base.metadata.create_all(bind=engine)


def teardown_db():
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides = {}


def _create_person_caregiver():
    db = TestingSessionLocal()
    person = Person(id="doc-person-1", name="John Doe")
    caregiver = Caregiver(
        id="doc-cg-1",
        name="Jane Doe",
        email="doc-test-1@example.com",
        relationship="Spouse",
        person_id=person.id,
        timezone="UTC",
    )
    db.add_all([person, caregiver])
    db.commit()
    person_id = person.id
    caregiver_id = caregiver.id
    db.close()
    return person_id, caregiver_id


TXT_CONTENT = """Discharge Summary
Patient: John Doe
Date: 2024-01-15
Attending: Dr. Smith

The patient was admitted on 2024-01-10 with dizziness and unsteady gait.
Two falls were noted during the 5-day hospitalization.
Physical therapy was consulted.
Recommendations: home physical therapy twice weekly, follow-up with neurology in 2 weeks.
"""

PDF_CONTENT = (
    b"%PDF-1.4\n"
    b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
    b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n"
    b'4 0 obj<</Length 200>>stream\nBT /F1 12 Tf 72 720 Td (Patient discharged after successful treatment.) Tj 0 -18 Td (Falls noted during stay.) Tj 0 -18 Td (Recommend follow-up.) Tj ET\nendstream\nendobj\n'
    b"5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n"
    b"xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000266 00000 n \n0000000535 00000 n \n"
    b"trailer<</Size 6/Root 1 0 R>>\nstartxref\n606\n%%EOF\n"
)


def test_upload_txt_document_full_pipeline():
    setup_db()
    try:
        from app.core.database import get_db
        app.dependency_overrides[get_db] = override_get_db
        client = TestClient(app)

        person_id, caregiver_id = _create_person_caregiver()

        response = client.post(
            "/api/files/upload",
            files={"file": ("discharge.txt", io.BytesIO(TXT_CONTENT.encode()), "text/plain")},
            data={"caregiver_id": caregiver_id, "person_id": person_id},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True
        assert data["filename"] == "discharge.txt"
        assert data["processing_status"] == "completed"
        assert data["extraction_method"] == "direct_text"
        assert data["extraction_confidence"] == 1.0
        assert data["evidence_id"] is not None
        assert data["care_event_id"] is not None
        assert "fall" in (data.get("extracted_text") or "").lower()

        db = TestingSessionLocal()
        doc = db.query(Document).filter(Document.person_id == person_id).first()
        assert doc is not None
        assert doc.processing_status == "completed"
        assert doc.document_type == "text"
        assert doc.evidence_id is not None
        assert doc.care_event_id is not None
        assert "fall" in (doc.extracted_text or "").lower()

        evidence = db.query(Evidence).filter(Evidence.id == doc.evidence_id).first()
        assert evidence is not None
        assert evidence.source_type == "uploaded_document"
        assert evidence.evidence_status == "processed"
        assert evidence.uploaded_by_caregiver_id == caregiver_id

        event = db.query(CareEvent).filter(CareEvent.id == doc.care_event_id).first()
        assert event is not None
        assert event.event_type == "observation"

        changes = db.query(Change).filter(Change.person_id == person_id).all()
        for c in changes:
            print(f"  {c.id[:12]}... | type={c.change_type}")

        db.close()
    finally:
        teardown_db()


def test_upload_pdf_document_full_pipeline():
    setup_db()
    try:
        from app.core.database import get_db
        app.dependency_overrides[get_db] = override_get_db
        client = TestClient(app)

        person_id, caregiver_id = _create_person_caregiver()

        response = client.post(
            "/api/files/upload",
            files={"file": ("report.pdf", io.BytesIO(PDF_CONTENT), "application/pdf")},
            data={"caregiver_id": caregiver_id, "person_id": person_id},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True
        assert data["document_type"] == "pdf"
        assert data["extraction_method"] == "pdf_text"
        assert data["evidence_id"] is not None
        assert data["care_event_id"] is not None

        db = TestingSessionLocal()
        doc = db.query(Document).filter(Document.person_id == person_id).first()
        assert doc is not None
        assert doc.processing_status == "completed"
        assert doc.document_type == "pdf"
        assert "Patient discharged" in (doc.extracted_text or "")
        db.close()
    finally:
        teardown_db()


def test_upload_empty_file_returns_400():
    setup_db()
    try:
        from app.core.database import get_db
        app.dependency_overrides[get_db] = override_get_db
        client = TestClient(app)

        person_id, caregiver_id = _create_person_caregiver()

        response = client.post(
            "/api/files/upload",
            files={"file": ("empty.txt", io.BytesIO(b""), "text/plain")},
            data={"caregiver_id": caregiver_id, "person_id": person_id},
        )
        assert response.status_code == 400
    finally:
        teardown_db()


def test_upload_unsupported_file_returns_415():
    setup_db()
    try:
        from app.core.database import get_db
        app.dependency_overrides[get_db] = override_get_db
        client = TestClient(app)

        person_id, caregiver_id = _create_person_caregiver()

        response = client.post(
            "/api/files/upload",
            files={"file": ("malware.exe", io.BytesIO(b"\x4d\x5a\x90\x00"), "application/x-msdownload")},
            data={"caregiver_id": caregiver_id, "person_id": person_id},
        )
        assert response.status_code == 415
    finally:
        teardown_db()


def test_upload_unauthorized_caregiver_returns_403():
    setup_db()
    try:
        from app.core.database import get_db
        app.dependency_overrides[get_db] = override_get_db
        client = TestClient(app)

        person_id, _ = _create_person_caregiver()
        db = TestingSessionLocal()
        other_caregiver = Caregiver(
            id="doc-other-cg",
            name="Other Person",
            email="other_test@example.com",
            relationship="Friend",
            person_id=person_id,
        )
        db.add(other_caregiver)
        db.commit()
        db.close()

        response = client.post(
            "/api/files/upload",
            files={"file": ("test.txt", io.BytesIO(b"Test content"), "text/plain")},
            data={"caregiver_id": "nonexistent-caregiver", "person_id": person_id},
        )
        assert response.status_code == 403
    finally:
        teardown_db()


def test_upload_creates_care_record_entry():
    setup_db()
    try:
        from app.core.database import get_db
        app.dependency_overrides[get_db] = override_get_db
        client = TestClient(app)

        person_id, caregiver_id = _create_person_caregiver()

        response = client.post(
            "/api/files/upload",
            files={"file": ("notes.txt", io.BytesIO(b"Patient has diabetes and takes metformin."), "text/plain")},
            data={"caregiver_id": caregiver_id, "person_id": person_id},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True

        db = TestingSessionLocal()
        evidence = db.query(Evidence).filter(Evidence.person_id == person_id, Evidence.source_type == "uploaded_document").first()
        assert evidence is not None
        assert "diabetes" in evidence.source_text

        events = db.query(CareEvent).filter(CareEvent.person_id == person_id).all()
        assert len(events) == 1
        assert events[0].title is not None
        db.close()
    finally:
        teardown_db()


def test_frontend_served():
    setup_db()
    try:
        client = TestClient(app)
        response = client.get("/")
        assert response.status_code == 200
        assert "text/html" in response.headers.get("content-type", "")
        assert "upload" in response.text.lower()
        assert "/api/files/upload" in response.text
    finally:
        teardown_db()
