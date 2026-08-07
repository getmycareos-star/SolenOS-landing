from app.core.database import SessionLocal, engine
from app.models.care import (
    Base as CareBase,
    Person,
    Caregiver,
    Evidence,
    CareEvent,
    Insight,
    Correction,
)
from app.models.memory import Base as MemoryBase, ReasoningMemory, Observation
from app.models.time_location import (
    Base as TimeLocationBase,
    CareWindow,
    Appointment,
    CareTransition,
    Location,
)
from app.services.time_intelligence import calculate_care_windows
from datetime import datetime, timedelta, date
import uuid


def seed():
    CareBase.metadata.create_all(bind=engine)
    MemoryBase.metadata.create_all(bind=engine)
    TimeLocationBase.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        existing = db.query(Person).filter(Person.id == "demo-person-id").first()
        if existing:
            print("Seed already exists.")
            return

        person = Person(id="demo-person-id", name="Alex Johnson", date_of_birth=date(1952, 3, 15))
        db.add(person)
        db.flush()

        caregiver = Caregiver(
            id=str(uuid.uuid4()),
            name="Sam Johnson",
            email="sam@example.com",
            relationship="Child",
            person_id=person.id,
            timezone="America/Los_Angeles",
        )
        db.add(caregiver)
        db.flush()

        ev1 = Evidence(
            id=str(uuid.uuid4()),
            person_id=person.id,
            type="note",
            source_text="Alex mentioned some dizziness after standing up quickly this morning.",
            extra_metadata=None,
            time_provenance="Caregiver observation",
            location="Home",
            uploaded_by_caregiver_id=caregiver.id,
        )
        ev2 = Evidence(
            id=str(uuid.uuid4()),
            person_id=person.id,
            type="conversation",
            source_text="Care team noted mild cognitive changes during visit. Recommended follow-up in 2 weeks.",
            extra_metadata=None,
            time_provenance="Extracted from hospital discharge summary",
            location="Primary care clinic",
            uploaded_by_caregiver_id=caregiver.id,
        )
        db.add_all([ev1, ev2])
        db.flush()

        event = CareEvent(
            id=str(uuid.uuid4()),
            person_id=person.id,
            event_type="observation",
            occurred_at=datetime.now() - timedelta(days=1),
            occurred_at_timezone="America/Los_Angeles",
            title="Morning dizziness noted",
            description="Alex felt lightheaded when standing. Sat back down.",
            evidence_ids=f'["{ev1.id}"]',
            location="Home",
            time_provenance="Caregiver observation",
            created_by_caregiver_id=caregiver.id,
        )
        db.add(event)
        db.flush()

        insight = Insight(
            id=str(uuid.uuid4()),
            person_id=person.id,
            title="Possible orthostatic hypotension pattern",
            description="Recurring dizziness upon standing may indicate blood pressure changes. This is not confirmed.",
            insight_type="observation",
            confidence=0.72,
            evidence_ids=f'["{ev1.id}","{ev2.id}"]',
            possible_context="Blood pressure readings during morning hours would help confirm.",
            time_provenance="AI-generated with evidence",
        )
        db.add(insight)
        db.flush()

        correction = Correction(
            id=str(uuid.uuid4()),
            person_id=person.id,
            target_type="insight",
            target_id=insight.id,
            original_text="Possible orthostatic hypotension pattern",
            corrected_text="Possible orthostatic hypotension pattern, though Alex has a history of dehydration on warm days.",
            caregiver_id=caregiver.id,
            reason="Add context about recent heat and fluid intake.",
        )
        db.add(correction)

        obs1 = Observation(
            id=str(uuid.uuid4()),
            person_id=person.id,
            observed_at=datetime.now() - timedelta(days=2),
            observed_at_timezone="America/Los_Angeles",
            original_text="Seemed a bit more tired than usual today.",
            tags=["energy", "tiredness"],
            location="Home",
            caregiver_id=caregiver.id,
        )
        obs2 = Observation(
            id=str(uuid.uuid4()),
            person_id=person.id,
            observed_at=datetime.now() - timedelta(days=1),
            observed_at_timezone="America/Los_Angeles",
            original_text="Dizziness after standing up.",
            tags=["dizziness", "balance"],
            location="Home",
            caregiver_id=caregiver.id,
        )
        obs3 = Observation(
            id=str(uuid.uuid4()),
            person_id=person.id,
            observed_at=datetime.now(),
            observed_at_timezone="America/Los_Angeles",
            original_text="Energy seems better today, no dizziness.",
            tags=["energy", "dizziness"],
            location="Home",
            caregiver_id=caregiver.id,
        )
        db.add_all([obs1, obs2, obs3])

        memory1 = ReasoningMemory(
            id=str(uuid.uuid4()),
            person_id=person.id,
            memory_type="confirmed_fact",
            key="has_diabetes",
            value=[{"value": "Type 2 diabetes, diagnosed 2018"}],
            confidence=1.0,
            source_evidence_ids=[ev2.id],
        )
        memory2 = ReasoningMemory(
            id=str(uuid.uuid4()),
            person_id=person.id,
            memory_type="open_question",
            key="dizziness_cause",
            value=[
                {
                    "question": "Is dizziness related to blood pressure or dehydration?",
                    "asked_at": datetime.utcnow().isoformat(),
                }
            ],
            confidence=0.5,
            is_open_question=True,
        )
        memory3 = ReasoningMemory(
            id=str(uuid.uuid4()),
            person_id=person.id,
            memory_type="preference",
            key="preferred_hospital",
            value=[{"value": "St. Mary's Hospital", "note": "Prefers this hospital for ER visits"}],
            confidence=1.0,
        )
        db.add_all([memory1, memory2, memory3])

        location1 = Location(
            id=str(uuid.uuid4()),
            person_id=person.id,
            name="Home",
            location_type="home",
            address="123 Main St",
            city="Los Angeles",
            state="CA",
            timezone="America/Los_Angeles",
            is_primary=True,
        )
        location2 = Location(
            id=str(uuid.uuid4()),
            person_id=person.id,
            name="St. Mary's Hospital",
            location_type="hospital",
            city="Los Angeles",
            state="CA",
            timezone="America/Los_Angeles",
        )
        db.add_all([location1, location2])

        appointment = Appointment(
            id=str(uuid.uuid4()),
            person_id=person.id,
            title="Follow-up with Dr. Smith",
            scheduled_at=datetime.now() + timedelta(days=3),
            scheduled_at_timezone="America/Los_Angeles",
            location="Primary care clinic",
            provider="Dr. Smith",
            status="scheduled",
            created_by_caregiver_id=caregiver.id,
        )
        db.add(appointment)
        db.flush()

        transition = CareTransition(
            id=str(uuid.uuid4()),
            person_id=person.id,
            from_location="Home",
            to_location="Primary care clinic",
            transition_type="routine_follow_up",
            triggered_by_event_id=event.id,
            occurred_at=datetime.now() - timedelta(days=7),
        )
        db.add(transition)

        windows = calculate_care_windows("observation", datetime.now() - timedelta(days=1))
        for w in windows:
            db_window = CareWindow(
                person_id=person.id,
                window_type=w["window_type"],
                started_at=datetime.fromisoformat(w["started_at"]),
                ends_at=datetime.fromisoformat(w["ends_at"]),
                status=w["status"],
            )
            db.add(db_window)

        db.commit()
        print("Seed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
