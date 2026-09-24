from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.change_enums import (
    BaselineConfidence,
    BaselineType,
    ChangeDirection,
    ChangeType,
    EvidenceStatus,
    SignificanceVerdict,
)
from app.core.database import Base, get_db
from app.main import app
from app.models.care import CareEvent, Caregiver, Evidence, Person
from app.models.change import Baseline, Change
from app.models.prioritization import PrioritizationDimension, PrioritizationRanking
from app.models.significance import SignificanceAssessment
from app.models.uncertainty import Contradiction
from app.schemas.situation import SituationInput
from app.services.prioritization import PrioritizationEngine

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
    app.dependency_overrides.clear()


def seed_people(db, count=1):
    people = []
    caregivers = []
    for index in range(count):
        person = Person(id=f"person-{index}", name=f"Person {index}")
        caregiver = Caregiver(
            id=f"caregiver-{index}",
            name=f"Caregiver {index}",
            email=f"caregiver-{index}@example.com",
            relationship="Family",
            person_id=person.id,
        )
        db.add_all([person, caregiver])
        people.append(person)
        caregivers.append(caregiver)
    db.commit()
    return people[0], caregivers[0]


def seed_change(
    db,
    person,
    caregiver,
    now,
    *,
    subject_id="fall",
    count=3,
    confidence=0.9,
    significance=SignificanceVerdict.MEANINGFUL_CANDIDATE,
    evidence_text="Three falls occurred this month and the caregiver is concerned.",
    change_type=ChangeType.RECURRENCE,
):
    evidence = Evidence(
        person_id=person.id,
        type="note",
        source_text=evidence_text,
        uploaded_by_caregiver_id=caregiver.id,
        confidence=confidence,
        evidence_status=EvidenceStatus.REPORTED.value,
    )
    db.add(evidence)
    db.flush()

    event = CareEvent(
        person_id=person.id,
        event_type="fall",
        status="recorded",
        occurred_at=now,
        title="Fall",
        description=evidence_text,
        evidence_ids=[evidence.id],
        created_by_caregiver_id=caregiver.id,
        confidence=confidence,
    )
    db.add(event)
    db.flush()

    baseline = Baseline(
        person_id=person.id,
        subject_type="fall",
        subject_id=subject_id,
        baseline_type=BaselineType.PERSONAL_HISTORICAL,
        window_start=now - timedelta(days=90),
        window_end=now,
        event_count=0,
        confidence=BaselineConfidence.HIGH,
        is_active=True,
    )
    db.add(baseline)
    db.flush()

    change = Change(
        person_id=person.id,
        subject_type="fall",
        subject_id=subject_id,
        change_type=change_type,
        change_direction=ChangeDirection.INCREASING,
        previous_count=0,
        current_count=count,
        magnitude=float(count),
        baseline_id=baseline.id,
        comparison_window_start=now - timedelta(days=90),
        comparison_window_end=now,
        persistence_days=14,
        is_persistent=True,
        confidence=confidence,
        evidence_ids=[evidence.id],
        explanation="Repeated fall reports require attention.",
        significance_assessment_id=None,
        significance_verdict=significance,
        attention_candidate=significance == SignificanceVerdict.MEANINGFUL_CANDIDATE,
        follow_up_candidate=True,
        is_active=True,
    )
    db.add(change)
    db.flush()

    assessment = SignificanceAssessment(
        person_id=person.id,
        subject_type="fall",
        subject_id=subject_id,
        target_type="change",
        target_id=change.id,
        baseline_id=baseline.id,
        verdict=significance,
        evidence_status=EvidenceStatus.CONTRADICTORY if significance == SignificanceVerdict.INSUFFICIENT_EVIDENCE else EvidenceStatus.REPORTED,
        significance_confidence=confidence,
        evidence_confidence=confidence,
        dimensions=[
            {"name": "magnitude", "score": min(count / 3.0, 1.0)},
            {"name": "functional_consequence", "score": 0.8},
        ],
        possible_context=["Evidence remains a caregiver report."],
        reporters=[caregiver.name],
        attention_candidate=significance == SignificanceVerdict.MEANINGFUL_CANDIDATE,
        follow_up_candidate=True,
        explanation="Repeated fall reports are a meaningful change candidate.",
        evidence_ids=[evidence.id],
        is_active=True,
    )
    db.add(assessment)
    change.significance_assessment_id = assessment.id
    db.commit()
    return change, evidence, event


def test_detect_scores_all_dimensions_and_persists_traceability():
    setup_db()
    try:
        from app.core.database import get_db
        app.dependency_overrides[get_db] = override_get_db
        db = TestingSessionLocal()
        person, caregiver = seed_people(db)
        now = datetime.now(timezone.utc)
        change, evidence, event = seed_change(db, person, caregiver, now)

        items = PrioritizationEngine(db).detect(person.id, reference_time=now)
        assert len(items) == 1
        item = items[0]
        assert item.priority_level.value == "critical"
        assert item.overall_confidence > 0.5
        assert len(item.dimensions) == 10
        assert {dimension["dimension"] for dimension in item.dimensions} == {
            "safety_significance",
            "magnitude",
            "trajectory",
            "persistence",
            "recurrence",
            "uncertainty",
            "contradiction",
            "vulnerability_context",
            "caregiver_concern",
            "actionability",
        }
        assert evidence.id in item.evidence_ids
        assert change.id in item.change_ids
        assert event.id in item.dimensions[3]["evidence_ids"]
        assert "not a diagnosis" in item.explanation.lower()
        assert item.possible_context

        db.refresh(item)
        assert db.query(PrioritizationDimension).filter(
            PrioritizationDimension.prioritization_id == item.id
        ).count() == 10
        db.close()
    finally:
        teardown_db()


def test_conflict_is_explicitly_preserved():
    setup_db()
    try:
        db = TestingSessionLocal()
        person, caregiver = seed_people(db)
        now = datetime.now(timezone.utc)
        _, evidence, _ = seed_change(
            db,
            person,
            caregiver,
            now,
            subject_id="medication",
            count=1,
            confidence=0.9,
            significance=SignificanceVerdict.MEANINGFUL_CANDIDATE,
            evidence_text="Medication status is unclear and caregivers disagree.",
            change_type=ChangeType.ONSET,
        )
        other = Caregiver(
            id="caregiver-other",
            name="Other Caregiver",
            email="other@example.com",
            relationship="Friend",
            person_id=person.id,
        )
        db.add(other)
        db.commit()
        conflict = Contradiction(
            person_id=person.id,
            subject_type="fall",
            subject_id="fall",
            field="occurrence",
            description="Caregivers disagree about whether a fall occurred.",
            evidence_ids=[evidence.id],
            resolution_status="unresolved",
        )
        db.add(conflict)
        db.commit()

        item = PrioritizationEngine(db).detect(person.id, reference_time=now)[0]
        assert item.priority_level.value in {"critical", "high", "moderate", "low", "insufficient_evidence"}
        assert item.contradiction_types
        assert "caregiver_accounts_conflict" in item.uncertainty_factors
        assert item.possible_context
        assert evidence.id in item.evidence_ids
        db.close()
    finally:
        teardown_db()


def test_missing_evidence_is_explicitly_insufficient():
    setup_db()
    try:
        db = TestingSessionLocal()
        person, caregiver = seed_people(db)
        now = datetime.now(timezone.utc)
        change, _, _ = seed_change(db, person, caregiver, now)
        assessment = db.query(SignificanceAssessment).filter(
            SignificanceAssessment.target_id == change.id
        ).one()
        change.evidence_ids = []
        assessment.evidence_ids = []
        db.commit()

        item = PrioritizationEngine(db).detect(person.id, reference_time=now)[0]
        assert item.priority_level.value == "insufficient_evidence"
        assert "evidence_quality_low" in item.uncertainty_factors
        assert item.possible_context
        db.close()
    finally:
        teardown_db()


def test_rank_is_relative_and_persisted_for_multiple_changes():
    setup_db()
    try:
        db = TestingSessionLocal()
        person, caregiver = seed_people(db)
        now = datetime.now(timezone.utc)
        first, _, _ = seed_change(db, person, caregiver, now, subject_id="fall", count=3)
        second, _, _ = seed_change(
            db,
            person,
            caregiver,
            now,
            subject_id="medication",
            count=1,
            confidence=0.4,
            significance=SignificanceVerdict.INSUFFICIENT_EVIDENCE,
            evidence_text="Medication status is unclear.",
            change_type=ChangeType.ONSET,
        )

        items = PrioritizationEngine(db).detect(person.id, reference_time=now)
        rankings = PrioritizationEngine(db).rank(person.id, items, now)
        assert len(items) == 2
        assert len(rankings) == 2
        assert rankings[0].rank == 1
        assert rankings[1].rank == 2
        assert rankings[0].prioritization_id != rankings[1].prioritization_id
        assert db.query(PrioritizationRanking).filter(
            PrioritizationRanking.person_id == person.id
        ).count() == 2

        rerun = PrioritizationEngine(db).detect(person.id, reference_time=now)
        assert len(rerun) == 2
        assert {item.id for item in rerun} == {item.id for item in items}
        db.close()
    finally:
        teardown_db()


def test_api_detect_list_and_rank_routes():
    setup_db()
    try:
        app.dependency_overrides[get_db] = override_get_db
        db = TestingSessionLocal()
        person, caregiver = seed_people(db)
        now = datetime.now(timezone.utc)
        person_id = person.id
        seed_change(db, person, caregiver, now)
        db.close()

        client = TestClient(app)
        response = client.get(
            "/api/v1/prioritization/detect",
            params={"person_id": person_id},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True
        assert len(data["prioritizations"]) == 1
        assert len(data["rankings"]) == 1

        response = client.get(f"/api/v1/prioritization/{person_id}")
        assert response.status_code == 200
        assert len(response.json()) == 1

        response = client.get(f"/api/v1/prioritization/{person_id}/rank")
        assert response.status_code == 200
        assert response.json()["rankings"][0]["rank"] == 1

        response = client.post(
            "/api/v1/prioritization/detect",
            json={"person_id": person_id},
        )
        assert response.status_code == 200
        assert response.json()["prioritizations"][0]["id"] == data["prioritizations"][0]["id"]
    finally:
        teardown_db()


def test_situation_pipeline_surfaces_top_priority():
    setup_db()
    try:
        app.dependency_overrides[get_db] = override_get_db
        db = TestingSessionLocal()
        person, caregiver = seed_people(db)
        person_id = person.id
        caregiver_id = caregiver.id
        db.close()

        client = TestClient(app)
        response = client.post(
            "/api/situation",
            json=SituationInput(
                caregiver_id=caregiver_id,
                person_id=person_id,
                raw_input="Three falls occurred this month and the caregiver is concerned.",
                timestamp=datetime.now(timezone.utc).isoformat(),
            ).model_dump(mode="json"),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True
        assert data["prioritization_ids"]
        assert data["top_priority"]["priority_level"] in {"critical", "high", "moderate", "low"}
        assert data["top_priority"]["explanation"]
        assert data["situations"][0]["prioritization_ids"] == data["prioritization_ids"]
    finally:
        teardown_db()
