"""Tests for Knowledge Revision / Supersession (Task 11).

These tests verify that SolenOS can distinguish between:
  - Old medication + explicit new dose → Supersession
  - Old medication + conflicting caregiver report → Potential contradiction
  - Corrected measurement → Correction
  - Draft → final document → Version supersession
  - Old baseline → new capability → Longitudinal change (update)
  - Resolved task → completed state → Loop closure (resolution)
  - Historical diagnosis → current status → Temporal validity
  - New evidence contradicts old assumption → Knowledge revision (invalidation)
  - New evidence has different context → Do not blindly supersede
  - New evidence is ambiguous → Preserve uncertainty

Core invariant: preserve what was previously believed, recognize when new
evidence changes validity, reconstruct correct current state without erasing history.
"""
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.models.care import Person, Caregiver
from app.models.knowledge_revision import KnowledgeClaim
from app.models.uncertainty import Contradiction
from app.core.revision_enums import RevisionType, KnowledgeState
from app.services.knowledge_revision import KnowledgeRevisionEngine

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def setup_db():
    Base.metadata.create_all(bind=engine)


def teardown_db():
    Base.metadata.drop_all(bind=engine)
    from app.main import app
    app.dependency_overrides.clear()


def make_person_caregiver(db):
    person = Person(id="test-person", name="Test Person")
    caregiver = Caregiver(
        id="test-cg",
        name="Test Caregiver",
        email="test@example.com",
        relationship="Family",
        person_id=person.id,
    )
    db.add_all([person, caregiver])
    db.commit()
    return person, caregiver


# ---------------------------------------------------------------------------
# 1. Old medication + explicit new dose → Supersession
# ---------------------------------------------------------------------------

def test_old_med_dose_explicit_new_dose_is_supersedure():
    setup_db()
    try:
        db = TestingSessionLocal()
        make_person_caregiver(db)
        engine_svc = KnowledgeRevisionEngine(db)

        monday = datetime(2026, 9, 21, 9, 0, tzinfo=timezone.utc)
        wednesday = datetime(2026, 9, 23, 9, 0, tzinfo=timezone.utc)

        claim = engine_svc.create_claim(
            person_id="test-person",
            subject_type="medication",
            subject_id="metoprolol",
            field="dose",
            value="25 mg",
            valid_from=monday,
            evidence_ids=["ev-1"],
        )

        result = engine_svc.record_claim(
            person_id="test-person",
            subject_type="medication",
            subject_id="metoprolol",
            field="dose",
            new_value="50 mg",
            evidence_id="ev-2",
            triggering_text="Doctor increases metoprolol to 50 mg starting Wednesday.",
            valid_from=wednesday,
            confidence=0.9,
        )

        assert result.applied is True
        assert result.revision_type == RevisionType.SUPERSEDE

        engine_svc.db.refresh(claim)
        assert claim.is_active is False
        assert claim.state == KnowledgeState.SUPERSEDED
        assert claim.superseded_by_claim_id == result.new_claim_id

        new_claim = engine_svc.get_claim("test-person", result.new_claim_id)
        assert new_claim.value == "50 mg"
        assert new_claim.is_active is True
        assert new_claim.state == KnowledgeState.CURRENT

        current = engine_svc.get_current_knowledge("test-person")
        current_dose = [c for c in current.current_knowledge if c.subject_type == "medication" and c.subject_id == "metoprolol"]
        assert len(current_dose) == 1
        assert current_dose[0].value == "50 mg"

        db.close()
    finally:
        teardown_db()


# ---------------------------------------------------------------------------
# 2. Old medication + conflicting caregiver report → Potential contradiction
# ---------------------------------------------------------------------------

def test_conflicting_caregiver_report_is_conflict_not_supersession():
    setup_db()
    try:
        db = TestingSessionLocal()
        make_person_caregiver(db)
        engine_svc = KnowledgeRevisionEngine(db)

        monday = datetime(2026, 9, 21, 9, 0, tzinfo=timezone.utc)

        claim = engine_svc.create_claim(
            person_id="test-person",
            subject_type="medication",
            subject_id="metoprolol",
            field="dose",
            value="25 mg",
            valid_from=monday,
            evidence_ids=["ev-doc-1"],
        )

        result = engine_svc.record_claim(
            person_id="test-person",
            subject_type="medication",
            subject_id="metoprolol",
            field="dose",
            new_value="50 mg",
            evidence_id="ev-cg-1",
            triggering_text="She takes 50 mg.",
            valid_from=monday + timedelta(hours=2),
            confidence=0.7,
        )

        assert result.applied is False
        assert result.evaluation == "conflict_recorded"

        assertion = db.query(Contradiction).filter(
            Contradiction.person_id == "test-person",
            Contradiction.subject_type == "medication",
            Contradiction.resolution_status == "unresolved",
        ).first()
        assert assertion is not None

        engine_svc.db.refresh(claim)
        assert claim.is_active is True
        assert claim.state == KnowledgeState.CURRENT
        assert claim.value == "25 mg"

        db.close()
    finally:
        teardown_db()


# ---------------------------------------------------------------------------
# 3. Corrected measurement → Correction
# ---------------------------------------------------------------------------

def test_corrected_measurement_is_correction():
    setup_db()
    try:
        db = TestingSessionLocal()
        make_person_caregiver(db)
        engine_svc = KnowledgeRevisionEngine(db)

        sept_8 = datetime(2026, 9, 8, 10, 0, tzinfo=timezone.utc)

        old_claim = engine_svc.create_claim(
            person_id="test-person",
            subject_type="vital",
            subject_id="weight",
            field="value",
            value="78 kg",
            valid_from=sept_8,
            evidence_ids=["ev-w1"],
        )

        result = engine_svc.record_claim(
            person_id="test-person",
            subject_type="vital",
            subject_id="weight",
            field="value",
            new_value="72 kg",
            evidence_id="ev-corr-1",
            triggering_text="Correction: the patient's weight was 72 kg, not 78 kg.",
            valid_from=sept_8,
            confidence=1.0,
        )

        assert result.applied is True
        assert result.revision_type == RevisionType.CORRECTION

        engine_svc.db.refresh(old_claim)
        assert old_claim.is_active is False
        assert old_claim.state == KnowledgeState.CORRECTED
        assert old_claim.value == "78 kg"

        new_claim = engine_svc.get_claim("test-person", result.new_claim_id)
        assert new_claim.value == "72 kg"
        assert new_claim.state == KnowledgeState.CURRENT

        current = engine_svc.get_current_knowledge("test-person")
        weight_entries = [c for c in current.current_knowledge if c.subject_id == "weight"]
        assert len(weight_entries) == 1
        assert weight_entries[0].value == "72 kg"

        db.close()
    finally:
        teardown_db()


# ---------------------------------------------------------------------------
# 4. Draft → final document → Version supersession
# ---------------------------------------------------------------------------

def test_draft_to_final_document_is_version_supersedence():
    setup_db()
    try:
        db = TestingSessionLocal()
        make_person_caregiver(db)
        engine_svc = KnowledgeRevisionEngine(db)

        draft_value = "Patient stable, discharge planned."
        final_value = "Patient stable, discharge planned. Follow-up in 1 week."

        draft_claim = engine_svc.create_claim(
            person_id="test-person",
            subject_type="document",
            subject_id="discharge_summary",
            field="content",
            value=draft_value,
            valid_from=datetime(2026, 9, 20, 14, 0, tzinfo=timezone.utc),
            evidence_ids=["ev-draft"],
        )

        result = engine_svc.record_claim(
            person_id="test-person",
            subject_type="document",
            subject_id="discharge_summary",
            field="content",
            new_value=final_value,
            evidence_id="ev-final",
            triggering_text="Updated/final discharge summary: Patient stable, discharge planned. Follow-up in 1 week.",
            valid_from=datetime(2026, 9, 21, 10, 0, tzinfo=timezone.utc),
            confidence=0.95,
        )

        assert result.applied is True
        assert result.revision_type == RevisionType.VERSION_SUPERSESSION

        engine_svc.db.refresh(draft_claim)
        assert draft_claim.is_active is False
        assert draft_claim.state == KnowledgeState.HISTORICAL
        assert draft_claim.value == draft_value

        new_claim = engine_svc.get_claim("test-person", result.new_claim_id)
        assert new_claim.value == final_value
        assert new_claim.is_active is True

        db.close()
    finally:
        teardown_db()


# ---------------------------------------------------------------------------
# 5. Old baseline → new capability → Longitudinal change (update)
# ---------------------------------------------------------------------------

def test_functional_decline_is_update():
    setup_db()
    try:
        db = TestingSessionLocal()
        make_person_caregiver(db)
        engine_svc = KnowledgeRevisionEngine(db)

        old_date = datetime(2026, 9, 15, 10, 0, tzinfo=timezone.utc)
        new_date = datetime(2026, 9, 22, 10, 0, tzinfo=timezone.utc)

        old_claim = engine_svc.create_claim(
            person_id="test-person",
            subject_type="functional_status",
            subject_id="mobility",
            field="walking",
            value="walks independently",
            valid_from=old_date,
            evidence_ids=["ev-walk-1"],
        )

        result = engine_svc.record_claim(
            person_id="test-person",
            subject_type="functional_status",
            subject_id="mobility",
            field="walking",
            new_value="uses a walker",
            evidence_id="ev-walk-2",
            triggering_text="Patient now uses a walker.",
            valid_from=new_date,
            confidence=0.85,
        )

        assert result.applied is True
        assert result.revision_type == RevisionType.UPDATE

        engine_svc.db.refresh(old_claim)
        assert old_claim.is_active is False
        assert old_claim.state == KnowledgeState.SUPERSEDED

        new_claim = engine_svc.get_claim("test-person", result.new_claim_id)
        assert new_claim.value == "uses a walker"
        assert new_claim.is_active is True

        db.close()
    finally:
        teardown_db()


# ---------------------------------------------------------------------------
# 6. Resolved task → completed state → Loop closure (resolution)
# ---------------------------------------------------------------------------

def test_resolved_open_loop_is_resolution():
    setup_db()
    try:
        db = TestingSessionLocal()
        make_person_caregiver(db)
        engine_svc = KnowledgeRevisionEngine(db)

        old_date = datetime(2026, 9, 10, 10, 0, tzinfo=timezone.utc)
        new_date = datetime(2026, 9, 22, 10, 0, tzinfo=timezone.utc)

        pending_claim = engine_svc.create_claim(
            person_id="test-person",
            subject_type="appointment",
            subject_id="neurology_followup",
            field="status",
            value="pending",
            valid_from=old_date,
            evidence_ids=["ev-appt-1"],
        )

        result = engine_svc.record_claim(
            person_id="test-person",
            subject_type="appointment",
            subject_id="neurology_followup",
            field="status",
            new_value="completed",
            evidence_id="ev-appt-2",
            triggering_text="Neurology appointment completed.",
            valid_from=new_date,
            confidence=1.0,
        )

        assert result.applied is True
        assert result.revision_type == RevisionType.RESOLUTION

        engine_svc.db.refresh(pending_claim)
        assert pending_claim.is_active is False
        assert pending_claim.state == KnowledgeState.RESOLVED

        new_claim = engine_svc.get_claim("test-person", result.new_claim_id)
        assert new_claim.value == "completed"

        db.close()
    finally:
        teardown_db()


# ---------------------------------------------------------------------------
# 7. Temporal validity — knowledge at a point in time
# ---------------------------------------------------------------------------

def test_temporal_validity_point_in_time_query():
    setup_db()
    try:
        db = TestingSessionLocal()
        make_person_caregiver(db)
        engine_svc = KnowledgeRevisionEngine(db)

        sept_7 = datetime(2026, 9, 7, 0, 0, tzinfo=timezone.utc)
        sept_8 = datetime(2026, 9, 8, 0, 0, tzinfo=timezone.utc)
        sept_20 = datetime(2026, 9, 20, 0, 0, tzinfo=timezone.utc)

        engine_svc.create_claim(
            person_id="test-person",
            subject_type="diagnosis",
            subject_id="dementia",
            field="status",
            value="suspected",
            valid_from=sept_7,
            valid_until=sept_20,
            evidence_ids=["ev-dx-1"],
        )

        # Before the diagnosis was known
        pre_view = engine_svc.get_knowledge_at_point("test-person", sept_7 - timedelta(days=1))
        dx_pre = [c for c in pre_view.current_knowledge if c.subject_id == "dementia"]
        assert len(dx_pre) == 0

        # During the period when "suspected" is valid
        during_view = engine_svc.get_knowledge_at_point("test-person", sept_8)
        dx_during = [c for c in during_view.current_knowledge if c.subject_id == "dementia"]
        assert len(dx_during) == 1
        assert dx_during[0].value == "suspected"

        # After the claim's valid_until — should not appear as current
        post_view = engine_svc.get_knowledge_at_point("test-person", sept_20 + timedelta(days=1))
        dx_post = [c for c in post_view.current_knowledge if c.subject_id == "dementia"]
        assert len(dx_post) == 0

        db.close()
    finally:
        teardown_db()


# ---------------------------------------------------------------------------
# 8. New evidence contradicts old assumption → Knowledge revision (invalidation)
# ---------------------------------------------------------------------------

def test_new_allergy_invalidates_no_allergies_assumption():
    setup_db()
    try:
        db = TestingSessionLocal()
        make_person_caregiver(db)
        engine_svc = KnowledgeRevisionEngine(db)

        old_date = datetime(2026, 9, 1, 10, 0, tzinfo=timezone.utc)
        new_date = datetime(2026, 9, 22, 10, 0, tzinfo=timezone.utc)

        no_allergy_claim = engine_svc.create_claim(
            person_id="test-person",
            subject_type="allergy",
            subject_id="medication_allergies",
            field="status",
            value="no known medication allergies",
            valid_from=old_date,
            evidence_ids=["ev-all-1"],
        )

        result = engine_svc.record_claim(
            person_id="test-person",
            subject_type="allergy",
            subject_id="penicillin",
            field="status",
            new_value="allergic",
            evidence_id="ev-all-2",
            triggering_text="Allergy to penicillin documented.",
            valid_from=new_date,
            confidence=0.95,
        )

        assert result.applied is True
        assert result.revision_type == RevisionType.INVALIDATION

        engine_svc.db.refresh(no_allergy_claim)
        assert no_allergy_claim.is_active is False
        assert no_allergy_claim.state == KnowledgeState.INVALIDATED

        new_claim = engine_svc.get_claim("test-person", result.new_claim_id)
        assert new_claim.value == "allergic"
        assert new_claim.is_active is True

        current = engine_svc.get_current_knowledge("test-person")
        allergy_entries = [c for c in current.current_knowledge if c.subject_type == "allergy"]
        statuses = {c.value for c in allergy_entries}
        assert "allergic" in statuses
        assert "no known medication allergies" not in statuses

        db.close()
    finally:
        teardown_db()


# ---------------------------------------------------------------------------
# 9. New evidence has different context → Do not blindly supersede
# ---------------------------------------------------------------------------

def test_different_context_does_not_supersede():
    setup_db()
    try:
        db = TestingSessionLocal()
        make_person_caregiver(db)
        engine_svc = KnowledgeRevisionEngine(db)

        old_date = datetime(2026, 9, 20, 10, 0, tzinfo=timezone.utc)
        new_date = datetime(2026, 9, 21, 10, 0, tzinfo=timezone.utc)

        old_claim = engine_svc.create_claim(
            person_id="test-person",
            subject_type="functional_status",
            subject_id="mobility",
            field="walking",
            value="walks independently",
            valid_from=old_date,
            evidence_ids=["ev-walk-3"],
            context=[{"time_of_day": "morning"}],
        )

        result = engine_svc.record_claim(
            person_id="test-person",
            subject_type="functional_status",
            subject_id="mobility",
            field="walking",
            new_value="needs help getting up",
            evidence_id="ev-walk-4",
            triggering_text="Mom needs help getting up after surgery.",
            valid_from=new_date,
            context=[{"time_of_day": "morning", "post_surgery": "true"}],
            confidence=0.8,
        )

        assert result.applied is False
        assert result.evaluation == "context_preserved"

        engine_svc.db.refresh(old_claim)
        assert old_claim.is_active is True
        assert old_claim.value == "walks independently"

        all_claims = (
            db.query(KnowledgeClaim)
            .filter(KnowledgeClaim.person_id == "test-person")
            .all()
        )
        assert len(all_claims) == 1
        assert all_claims[0].value == "walks independently"

        db.close()
    finally:
        teardown_db()


# ---------------------------------------------------------------------------
# 10. New evidence is ambiguous → Preserve uncertainty
# ---------------------------------------------------------------------------

def test_ambiguous_evidence_preserves_uncertainty():
    setup_db()
    try:
        db = TestingSessionLocal()
        make_person_caregiver(db)
        engine_svc = KnowledgeRevisionEngine(db)

        old_date = datetime(2026, 9, 18, 10, 0, tzinfo=timezone.utc)
        new_date = datetime(2026, 9, 22, 10, 0, tzinfo=timezone.utc)

        old_claim = engine_svc.create_claim(
            person_id="test-person",
            subject_type="functional_status",
            subject_id="mobility",
            field="walking",
            value="walks independently",
            valid_from=old_date,
            evidence_ids=["ev-amb-1"],
        )

        result = engine_svc.record_claim(
            person_id="test-person",
            subject_type="functional_status",
            subject_id="mobility",
            field="walking",
            new_value="seems a bit unsteady",
            evidence_id="ev-amb-2",
            triggering_text="She seemed a bit unsteady today, but maybe just tired.",
            valid_from=new_date,
            confidence=0.5,
        )

        assert result.applied is False

        engine_svc.db.refresh(old_claim)
        assert old_claim.is_active is True
        assert old_claim.state == KnowledgeState.CURRENT

        all_claims = (
            db.query(KnowledgeClaim)
            .filter(KnowledgeClaim.person_id == "test-person")
            .all()
        )
        assert len(all_claims) == 1

        db.close()
    finally:
        teardown_db()


# ---------------------------------------------------------------------------
# Core invariant: History preservation without erasing old claims
# ---------------------------------------------------------------------------

def test_history_preserved_and_current_state_reconstructed():
    setup_db()
    try:
        db = TestingSessionLocal()
        make_person_caregiver(db)
        engine_svc = KnowledgeRevisionEngine(db)

        t0 = datetime(2026, 9, 15, 9, 0, tzinfo=timezone.utc)
        t1 = datetime(2026, 9, 18, 9, 0, tzinfo=timezone.utc)
        t2 = datetime(2026, 9, 21, 9, 0, tzinfo=timezone.utc)

        c0 = engine_svc.create_claim(
            person_id="test-person",
            subject_type="medication",
            subject_id="metoprolol",
            field="dose",
            value="25 mg",
            valid_from=t0,
            evidence_ids=["ev-0"],
        )

        r1 = engine_svc.record_claim(
            person_id="test-person",
            subject_type="medication",
            subject_id="metoprolol",
            field="dose",
            new_value="37.5 mg",
            evidence_id="ev-1",
            triggering_text="Increase from 25 mg to 37.5 mg starting today.",
            valid_from=t1,
            confidence=0.9,
        )

        r2 = engine_svc.record_claim(
            person_id="test-person",
            subject_type="medication",
            subject_id="metoprolol",
            field="dose",
            new_value="50 mg",
            evidence_id="ev-2",
            triggering_text="Increase to 50 mg.",
            valid_from=t2,
            confidence=0.9,
        )

        c0_val = engine_svc.get_claim("test-person", c0.id)
        assert c0_val.is_active is False
        assert c0_val.value == "25 mg"

        c1 = engine_svc.get_claim("test-person", r1.new_claim_id)
        assert c1.is_active is False
        assert c1.value == "37.5 mg"

        c2 = engine_svc.get_claim("test-person", r2.new_claim_id)
        assert c2.is_active is True
        assert c2.value == "50 mg"

        history = engine_svc.get_knowledge_history_for_claim("test-person", c0.id)
        assert len(history.chain) == 3

        assert history.chain[0].old_value == "25 mg"
        assert history.chain[0].revision_type.value == "supersede"
        assert history.chain[1].old_value == "37.5 mg"
        assert history.chain[1].revision_type.value == "supersede"

        assert history.current_value == "50 mg"
        assert history.current_state == "current"

        all_claims = db.query(KnowledgeClaim).filter(
            KnowledgeClaim.person_id == "test-person"
        ).all()
        assert len(all_claims) == 3

        current_view = engine_svc.get_current_knowledge("test-person")
        metoprolol_doses = [
            c for c in current_view.current_knowledge
            if c.subject_type == "medication" and c.subject_id == "metoprolol"
        ]
        assert len(metoprolol_doses) == 1
        assert metoprolol_doses[0].value == "50 mg"

        db.close()
    finally:
        teardown_db()


# ---------------------------------------------------------------------------
# Explicit supersede_claim / correct_claim / invalidate_claim / resolve_claim APIs
# ---------------------------------------------------------------------------

def test_explicit_supersede_claim():
    setup_db()
    try:
        db = TestingSessionLocal()
        make_person_caregiver(db)
        engine_svc = KnowledgeRevisionEngine(db)

        claim = engine_svc.create_claim(
            person_id="test-person",
            subject_type="medication",
            subject_id="aspirin",
            field="status",
            value="active",
            evidence_ids=["ev-s1"],
        )

        revision, new_claim = engine_svc.supersede_claim(
            person_id="test-person",
            old_claim_id=claim.id,
            new_value="discontinued",
            triggering_text="Stop aspirin.",
            evidence_id="ev-s2",
            confidence=1.0,
        )

        assert revision.revision_type == RevisionType.SUPERSEDE
        assert revision.old_claim_id == claim.id
        assert revision.new_claim_id == new_claim.id

        engine_svc.db.refresh(claim)
        assert claim.is_active is False
        assert claim.state == KnowledgeState.SUPERSEDED
        assert new_claim.is_active is True
        assert new_claim.value == "discontinued"

        db.close()
    finally:
        teardown_db()


def test_explicit_correct_claim():
    setup_db()
    try:
        db = TestingSessionLocal()
        make_person_caregiver(db)
        engine_svc = KnowledgeRevisionEngine(db)

        claim = engine_svc.create_claim(
            person_id="test-person",
            subject_type="measurement",
            subject_id="blood_pressure",
            field="value",
            value="140/90",
            evidence_ids=["ev-bp1"],
        )

        revision, new_claim = engine_svc.correct_claim(
            person_id="test-person",
            old_claim_id=claim.id,
            corrected_value="120/80",
            triggering_text="Correction: the reading was 120/80, not 140/90.",
            evidence_id="ev-bp2",
            confidence=1.0,
        )

        assert revision.revision_type == RevisionType.CORRECTION
        engine_svc.db.refresh(claim)
        assert claim.is_active is False
        assert claim.state == KnowledgeState.CORRECTED
        assert claim.value == "140/90"
        assert new_claim.value == "120/80"

        db.close()
    finally:
        teardown_db()


def test_explicit_invalidate_claim():
    setup_db()
    try:
        db = TestingSessionLocal()
        make_person_caregiver(db)
        engine_svc = KnowledgeRevisionEngine(db)

        claim = engine_svc.create_claim(
            person_id="test-person",
            subject_type="diagnosis",
            subject_id="hypertension",
            field="status",
            value="active",
            evidence_ids=["ev-d1"],
        )

        revision = engine_svc.invalidate_claim(
            person_id="test-person",
            old_claim_id=claim.id,
            triggering_text="No evidence of hypertension on recent assessment.",
            evidence_id="ev-d2",
        )

        assert revision.revision_type == RevisionType.INVALIDATION
        engine_svc.db.refresh(claim)
        assert claim.is_active is False
        assert claim.state == KnowledgeState.INVALIDATED

        current = engine_svc.get_current_knowledge("test-person")
        active = [c for c in current.current_knowledge if c.subject_id == "hypertension"]
        assert len(active) == 0

        db.close()
    finally:
        teardown_db()


def test_explicit_resolve_claim():
    setup_db()
    try:
        db = TestingSessionLocal()
        make_person_caregiver(db)
        engine_svc = KnowledgeRevisionEngine(db)

        claim = engine_svc.create_claim(
            person_id="test-person",
            subject_type="care_plan",
            subject_id="review_meds",
            field="status",
            value="pending",
            evidence_ids=["ev-cp1"],
        )

        revision, new_claim = engine_svc.resolve_claim(
            person_id="test-person",
            old_claim_id=claim.id,
            new_value="done",
            triggering_text="Medication review completed with provider.",
            evidence_id="ev-cp2",
            confidence=1.0,
        )

        assert revision.revision_type == RevisionType.RESOLUTION
        engine_svc.db.refresh(claim)
        assert claim.is_active is False
        assert claim.state == KnowledgeState.RESOLVED
        assert new_claim.value == "done"

        db.close()
    finally:
        teardown_db()


# ---------------------------------------------------------------------------
# API integration tests
# ---------------------------------------------------------------------------

def test_api_create_and_evaluate_claim():
    from fastapi.testclient import TestClient
    from app.core.database import get_db
    from app.main import app

    setup_db()
    try:
        app.dependency_overrides[get_db] = lambda: TestingSessionLocal()

        db = TestingSessionLocal()
        make_person_caregiver(db)
        db.close()

        client = TestClient(app)

        resp = client.post(
            "/api/v1/knowledge-revision/claims",
            json={
                "person_id": "test-person",
                "subject_type": "medication",
                "subject_id": "metoprolol",
                "field": "dose",
                "value": "25 mg",
                "valid_from": "2026-09-21T09:00:00+00:00",
                "evidence_ids": ["ev-api-1"],
            },
        )
        assert resp.status_code == 200
        claim_data = resp.json()
        assert claim_data["value"] == "25 mg"

        resp_eval = client.post(
            "/api/v1/knowledge-revision/evaluate",
            json={
                "person_id": "test-person",
                "subject_type": "medication",
                "subject_id": "metoprolol",
                "field": "dose",
                "new_value": "50 mg",
                "evidence_id": "ev-api-2",
                "triggering_text": "Doctor increases metoprolol to 50 mg starting today.",
                "valid_from": "2026-09-23T09:00:00+00:00",
            },
        )
        assert resp_eval.status_code == 200
        eval_data = resp_eval.json()
        assert eval_data["applied"] is True
        assert eval_data["revision_type"] == "supersede"

        resp_current = client.get("/api/v1/knowledge-revision/current/test-person")
        assert resp_current.status_code == 200
        view = resp_current.json()
        doses = [c for c in view["current_knowledge"] if c["subject_id"] == "metoprolol"]
        assert len(doses) == 1
        assert doses[0]["value"] == "50 mg"
        assert view["historical_knowledge_count"] >= 1

        db.close()
    finally:
        teardown_db()


def test_api_explicit_supersede():
    from fastapi.testclient import TestClient
    from app.core.database import get_db
    from app.main import app

    setup_db()
    try:
        app.dependency_overrides[get_db] = lambda: TestingSessionLocal()

        db = TestingSessionLocal()
        make_person_caregiver(db)

        engine_svc = KnowledgeRevisionEngine(db)
        claim = engine_svc.create_claim(
            person_id="test-person",
            subject_type="medication",
            subject_id="aspirin",
            field="status",
            value="active",
            evidence_ids=["ev-asp"],
        )
        db.commit()
        claim_id = claim.id
        db.close()

        client = TestClient(app)

        resp = client.post(
            f"/api/v1/knowledge-revision/supersede/{claim_id}?person_id=test-person&new_value=discontinued&triggering_text=Stop aspirin.&evidence_id=ev-stop&confidence=1.0",
        )
        assert resp.status_code == 200
        rev_data = resp.json()
        assert rev_data["revision_type"] == "supersede"

        resp_history = client.get(f"/api/v1/knowledge-revision/history/test-person/{claim_id}")
        assert resp_history.status_code == 200
        history = resp_history.json()
        assert len(history["chain"]) >= 1
        assert history["current_value"] == "discontinued"

        db.close()
    finally:
        teardown_db()
