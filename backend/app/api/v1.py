from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.core.database import get_db
from app.models.care import (
    Person as PersonModel,
    Caregiver as CaregiverModel,
    Evidence as EvidenceModel,
    CareEvent as CareEventModel,
    Insight as InsightModel,
    Correction as CorrectionModel,
)
from app.models.memory import (
    ReasoningMemory as ReasoningMemoryModel,
    Observation as ObservationModel,
    LearningEvent as LearningEventModel,
)
from app.models.time_location import (
    CareWindow as CareWindowModel,
    Appointment as AppointmentModel,
    CareTransition as CareTransitionModel,
    Location as LocationModel,
    DailyIntelligence as DailyIntelligenceModel,
    TimezoneContext as TimezoneContextModel,
    TemporalRelationship as TemporalRelationshipModel,
)
from app.schemas.care import (
    PersonCreate,
    Person,
    CaregiverCreate,
    Caregiver as CaregiverSchema,
    EvidenceCreate,
    Evidence as EvidenceSchema,
    CareEventCreate,
    CareEvent as CareEventSchema,
    InsightCreate,
    Insight as InsightSchema,
    CorrectionCreate,
    Correction as CorrectionSchema,
)
from app.schemas.memory import (
    ReasoningMemoryCreate,
    ReasoningMemory as ReasoningMemorySchema,
    ObservationCreate,
    Observation as ObservationSchema,
    LearningEvent as LearningEventSchema,
    ReasoningSummary,
    ObservationTrend,
)
from app.schemas.time_location import (
    CareWindow as CareWindowSchema,
    AppointmentCreate,
    Appointment as AppointmentSchema,
    CareTransitionCreate,
    CareTransition as CareTransitionSchema,
    LocationCreate,
    Location as LocationSchema,
    DailyIntelligence as DailyIntelligenceSchema,
    TimezoneContext as TimezoneContextSchema,
    TemporalRelationship as TemporalRelationshipSchema,
    NaturalLanguageTimeParse,
)
from app.services.learning import LearningEngine, SavePipelineEvent
from app.services.time_intelligence import (
    parse_natural_language_time,
    calculate_care_windows,
    generate_daily_intelligence,
    update_appointment_lifecycle,
    infer_temporal_relationship,
    detect_time_patterns,
    natural_language_time_ago,
    natural_language_time_until,
    format_local,
    format_date_local,
    format_time_local,
    utc_now,
)
from app.services.location_intelligence import (
    validate_timezone,
    infer_transition_type,
    enrich_location_with_geographic_intelligence,
    format_location_for_display,
)

router = APIRouter()


def _log_and_learn(
    db: Session,
    person_id: str,
    event_type: str,
    detail: str,
    source_type: str,
    source_id: str = None,
    caregiver_id: str = None,
):
    engine = LearningEngine(db)
    engine.log_pipeline_event(
        SavePipelineEvent(step=f"{event_type}_saved", person_id=person_id, detail=detail)
    )
    engine.record_learning_event(
        person_id, event_type, detail, source_type, source_id, caregiver_id
    )
    engine.after_save(person_id)


@router.post("/persons", response_model=Person)
def create_person(person: PersonCreate, db: Session = Depends(get_db)):
    db_person = PersonModel(**person.model_dump())
    db.add(db_person)
    db.commit()
    db.refresh(db_person)
    _log_and_learn(
        db,
        db_person.id,
        "person_created",
        f"Created person {db_person.name}",
        "api",
        caregiver_id=None,
    )
    return db_person


@router.get("/persons/{person_id}", response_model=Person)
def get_person(person_id: str, db: Session = Depends(get_db)):
    person = db.query(PersonModel).filter(PersonModel.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    return person


@router.post("/caregivers", response_model=CaregiverSchema)
def create_caregiver(caregiver: CaregiverCreate, db: Session = Depends(get_db)):
    db_caregiver = CaregiverModel(**caregiver.model_dump())
    db.add(db_caregiver)
    db.commit()
    db.refresh(db_caregiver)
    _log_and_learn(
        db,
        db_caregiver.person_id,
        "caregiver_added",
        f"Added caregiver {db_caregiver.name}",
        "api",
        caregiver_id=db_caregiver.id,
    )
    return db_caregiver


@router.post("/evidence", response_model=EvidenceSchema)
def create_evidence(evidence: EvidenceCreate, db: Session = Depends(get_db)):
    db_evidence = EvidenceModel(**evidence.model_dump())
    db.add(db_evidence)
    db.commit()
    db.refresh(db_evidence)
    _log_and_learn(
        db,
        db_evidence.person_id,
        "evidence_added",
        f"Added {evidence.type} evidence",
        "evidence",
        source_id=db_evidence.id,
        caregiver_id=evidence.uploaded_by_caregiver_id,
    )
    return db_evidence


@router.get("/evidence/{person_id}", response_model=List[EvidenceSchema])
def list_evidence(person_id: str, db: Session = Depends(get_db)):
    return db.query(EvidenceModel).filter(EvidenceModel.person_id == person_id).all()


@router.post("/events", response_model=CareEventSchema)
def create_event(event: CareEventCreate, db: Session = Depends(get_db)):
    db_event = CareEventModel(**event.model_dump())
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    _log_and_learn(
        db,
        db_event.person_id,
        "event_recorded",
        f"Recorded {event.event_type}: {event.title}",
        "event",
        source_id=db_event.id,
        caregiver_id=event.created_by_caregiver_id,
    )
    return db_event


@router.get("/events/{person_id}", response_model=List[CareEventSchema])
def list_events(person_id: str, db: Session = Depends(get_db)):
    return (
        db.query(CareEventModel)
        .filter(CareEventModel.person_id == person_id)
        .order_by(CareEventModel.occurred_at.desc())
        .all()
    )


@router.post("/insights", response_model=InsightSchema)
def create_insight(insight: InsightCreate, db: Session = Depends(get_db)):
    if not insight.evidence_ids:
        raise HTTPException(
            status_code=400, detail="Insight must link to at least one evidence item"
        )
    db_insight = InsightModel(**insight.model_dump())
    db.add(db_insight)
    db.commit()
    db.refresh(db_insight)
    _log_and_learn(
        db,
        db_insight.person_id,
        "insight_created",
        f"Created insight: {insight.title}",
        "insight",
        source_id=db_insight.id,
    )
    return db_insight


@router.get("/insights/{person_id}", response_model=List[InsightSchema])
def list_insights(person_id: str, db: Session = Depends(get_db)):
    return (
        db.query(InsightModel)
        .filter(InsightModel.person_id == person_id, InsightModel.is_active)
        .order_by(InsightModel.created_at.desc())
        .all()
    )


@router.post("/corrections", response_model=CorrectionSchema)
def create_correction(correction: CorrectionCreate, db: Session = Depends(get_db)):
    db_correction = CorrectionModel(**correction.model_dump())
    db.add(db_correction)
    db.commit()
    db.refresh(db_correction)

    engine = LearningEngine(db)
    engine.apply_correction(db_correction)
    engine.record_learning_event(
        db_correction.person_id,
        "correction_applied",
        f"Corrected {correction.target_type}: {correction.original_text} -> {correction.corrected_text}",
        "correction",
        source_id=db_correction.id,
        caregiver_id=correction.caregiver_id,
    )
    engine.after_save(db_correction.person_id)

    return db_correction


@router.get("/corrections/{person_id}", response_model=List[CorrectionSchema])
def list_corrections(person_id: str, db: Session = Depends(get_db)):
    return (
        db.query(CorrectionModel)
        .filter(CorrectionModel.person_id == person_id)
        .order_by(CorrectionModel.created_at.desc())
        .all()
    )


@router.post("/observations", response_model=ObservationSchema)
def create_observation(observation: ObservationCreate, db: Session = Depends(get_db)):
    db_obs = ObservationModel(**observation.model_dump())
    db.add(db_obs)
    db.commit()
    db.refresh(db_obs)
    _log_and_learn(
        db,
        db_obs.person_id,
        "observation_recorded",
        "Recorded observation",
        "observation",
        source_id=db_obs.id,
        caregiver_id=observation.caregiver_id,
    )
    return db_obs


@router.get("/observations/{person_id}", response_model=List[ObservationSchema])
def list_observations(person_id: str, db: Session = Depends(get_db)):
    return (
        db.query(ObservationModel)
        .filter(ObservationModel.person_id == person_id)
        .order_by(ObservationModel.observed_at.desc())
        .all()
    )


@router.get("/observations/{person_id}/trends", response_model=List[ObservationTrend])
def get_observation_trends(person_id: str, db: Session = Depends(get_db)):
    engine = LearningEngine(db)
    return engine.get_observation_trends(person_id)


@router.post("/reasoning-memory", response_model=ReasoningMemorySchema)
def create_reasoning_memory(memory: ReasoningMemoryCreate, db: Session = Depends(get_db)):
    db_memory = ReasoningMemoryModel(**memory.model_dump())
    db.add(db_memory)
    db.commit()
    db.refresh(db_memory)
    return db_memory


@router.get("/reasoning-memory/{person_id}", response_model=List[ReasoningMemorySchema])
def list_reasoning_memory(person_id: str, db: Session = Depends(get_db)):
    return (
        db.query(ReasoningMemoryModel)
        .filter(
            ReasoningMemoryModel.person_id == person_id,
            ReasoningMemoryModel.superseded_by_memory_id.is_(None),
        )
        .order_by(ReasoningMemoryModel.created_at.desc())
        .all()
    )


@router.get("/reasoning/{person_id}/summary", response_model=ReasoningSummary)
def get_reasoning_summary(person_id: str, db: Session = Depends(get_db)):
    engine = LearningEngine(db)
    return engine.get_reasoning_summary(person_id)


@router.get("/learning-events/{person_id}", response_model=List[LearningEventSchema])
def list_learning_events(person_id: str, limit: int = 50, db: Session = Depends(get_db)):
    return (
        db.query(LearningEventModel)
        .filter(LearningEventModel.person_id == person_id)
        .order_by(LearningEventModel.created_at.desc())
        .limit(limit)
        .all()
    )


@router.post("/feedback", response_model=LearningEventSchema)
def record_feedback(
    person_id: str, category: str, detail: str, caregiver_id: str, db: Session = Depends(get_db)
):
    engine = LearningEngine(db)
    engine.record_feedback(person_id, category, detail, caregiver_id)
    engine.after_save(person_id)
    event = LearningEventModel(
        person_id=person_id,
        event_type="feedback",
        detail=f"{category}: {detail}",
        source_type="feedback",
        caregiver_id=caregiver_id,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.post("/parse-time", response_model=NaturalLanguageTimeParse)
def parse_time(text: str, timezone: Optional[str] = None):
    result = parse_natural_language_time(text, source_tz=timezone)
    if timezone and validate_timezone(timezone):
        result["timezone_id"] = timezone
    return result


@router.get("/time/display")
def display_time(iso_datetime: str, timezone: Optional[str] = None, format_type: str = "full"):
    dt = datetime.fromisoformat(iso_datetime)
    if format_type == "date":
        result = format_date_local(dt, timezone)
    elif format_type == "time":
        result = format_time_local(dt, timezone)
    else:
        result = format_local(dt, timezone)
    return {"formatted": result, "timezone": timezone}


@router.get("/time/now")
def get_now(timezone: Optional[str] = None):
    now = utc_now()
    return {
        "utc": now.isoformat(),
        "local": format_local(now, timezone),
        "timezone": timezone,
    }


@router.post("/time/ago")
def time_ago(reference_datetime: str, target_datetime: str):
    ref = datetime.fromisoformat(reference_datetime)
    target = datetime.fromisoformat(target_datetime)
    return {"natural": natural_language_time_ago(ref, target)}


@router.post("/time/until")
def time_until(reference_datetime: str, target_datetime: str):
    ref = datetime.fromisoformat(reference_datetime)
    target = datetime.fromisoformat(target_datetime)
    return {"natural": natural_language_time_until(ref, target)}


@router.post("/care-windows", response_model=List[CareWindowSchema])
def create_care_windows_from_event(
    person_id: str, event_type: str, occurred_at: str, db: Session = Depends(get_db)
):
    event_dt = datetime.fromisoformat(occurred_at)
    windows = calculate_care_windows(event_type, event_dt)
    db_windows = []
    for w in windows:
        db_window = CareWindowModel(
            person_id=person_id,
            window_type=w["window_type"],
            started_at=datetime.fromisoformat(w["started_at"]),
            ends_at=datetime.fromisoformat(w["ends_at"]),
            status=w["status"],
            time_provenance=w.get("provenance"),
        )
        db.add(db_window)
        db_windows.append(db_window)
    db.commit()
    for w in db_windows:
        db.refresh(w)
    return db_windows


@router.get("/care-windows/{person_id}", response_model=List[CareWindowSchema])
def list_care_windows(person_id: str, status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(CareWindowModel).filter(CareWindowModel.person_id == person_id)
    if status:
        query = query.filter(CareWindowModel.status == status)
    return query.order_by(CareWindowModel.started_at.desc()).all()


@router.post("/appointments", response_model=AppointmentSchema)
def create_appointment(appointment: AppointmentCreate, db: Session = Depends(get_db)):
    db_appt = AppointmentModel(**appointment.model_dump())
    db.add(db_appt)
    db.commit()
    db.refresh(db_appt)
    _log_and_learn(
        db,
        db_appt.person_id,
        "appointment_scheduled",
        f"Scheduled: {appointment.title}",
        "appointment",
        source_id=db_appt.id,
        caregiver_id=appointment.created_by_caregiver_id,
    )
    return db_appt


@router.get("/appointments/{person_id}", response_model=List[AppointmentSchema])
def list_appointments(person_id: str, db: Session = Depends(get_db)):
    return (
        db.query(AppointmentModel)
        .filter(AppointmentModel.person_id == person_id)
        .order_by(AppointmentModel.scheduled_at.asc())
        .all()
    )


@router.patch("/appointments/{appointment_id}/lifecycle")
def update_appointment_lifecycle_endpoint(
    appointment_id: str, db: Session = Depends(get_db)
):
    appointment = (
        db.query(AppointmentModel).filter(AppointmentModel.id == appointment_id).first()
    )
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    appt_dict = {
        "id": appointment.id,
        "scheduled_at": appointment.scheduled_at,
        "status": appointment.status,
    }
    new_status = update_appointment_lifecycle(appt_dict)

    if new_status != appointment.status:
        appointment.status = new_status
        if new_status == "completed":
            appointment.completed_at = utc_now()
        elif new_status == "resolved":
            appointment.resolved_at = utc_now()
        db.commit()
        db.refresh(appointment)

    return {"id": appointment.id, "status": appointment.status}


@router.post("/transitions", response_model=CareTransitionSchema)
def create_care_transition(transition: CareTransitionCreate, db: Session = Depends(get_db)):
    if not transition.transition_type or transition.transition_type == "unknown":
        inferred = infer_transition_type(transition.from_location, transition.to_location)
        transition.transition_type = inferred

    db_transition = CareTransitionModel(**transition.model_dump())
    db.add(db_transition)
    db.commit()
    db.refresh(db_transition)
    _log_and_learn(
        db,
        db_transition.person_id,
        "transition_recorded",
        f"{transition.from_location or 'Unknown'} -> {transition.to_location}",
        "transition",
        source_id=db_transition.id,
    )
    return db_transition


@router.get("/transitions/{person_id}", response_model=List[CareTransitionSchema])
def list_care_transitions(person_id: str, db: Session = Depends(get_db)):
    return (
        db.query(CareTransitionModel)
        .filter(CareTransitionModel.person_id == person_id)
        .order_by(CareTransitionModel.occurred_at.desc())
        .all()
    )


@router.get("/transitions/{person_id}/sequence/{transition_type}")
def get_care_transition_sequence(person_id: str, transition_type: str, db: Session = Depends(get_db)):
    from app.services.location_intelligence import CARE_TRANSITION_SEQUENCES

    sequence = CARE_TRANSITION_SEQUENCES.get(transition_type, [])
    transitions = (
        db.query(CareTransitionModel)
        .filter(CareTransitionModel.person_id == person_id)
        .order_by(CareTransitionModel.occurred_at.asc())
        .all()
    )

    return {
        "sequence_name": transition_type,
        "known_sequence": sequence,
        "actual_transitions": [
            {
                "from": t.from_location,
                "to": t.to_location,
                "type": t.transition_type,
                "occurred_at": t.occurred_at.isoformat(),
            }
            for t in transitions
        ],
    }


@router.post("/locations", response_model=LocationSchema)
def create_location(location: LocationCreate, db: Session = Depends(get_db)):
    db_location = LocationModel(**location.model_dump())
    db.add(db_location)
    db.commit()
    db.refresh(db_location)
    return db_location


@router.get("/locations/{person_id}", response_model=List[LocationSchema])
def list_locations(person_id: str, db: Session = Depends(get_db)):
    return (
        db.query(LocationModel)
        .filter(LocationModel.person_id == person_id)
        .order_by(LocationModel.is_primary.desc())
        .all()
    )


@router.get("/locations/{person_id}/enriched")
def get_enriched_locations(person_id: str, timezone: Optional[str] = None, db: Session = Depends(get_db)):
    locations = (
        db.query(LocationModel)
        .filter(LocationModel.person_id == person_id)
        .order_by(LocationModel.is_primary.desc())
        .all()
    )
    result = []
    for loc in locations:
        loc_dict = {
            "id": loc.id,
            "name": loc.name,
            "location_type": loc.location_type,
            "city": loc.city,
            "state": loc.state,
            "timezone": loc.timezone,
        }
        enriched = enrich_location_with_geographic_intelligence(loc_dict)
        enriched["display"] = format_location_for_display(loc_dict, timezone)
        result.append(enriched)
    return result


@router.get("/daily-intelligence/{person_id}", response_model=DailyIntelligenceSchema)
def get_daily_intelligence(person_id: str, db: Session = Depends(get_db)):
    events = (
        db.query(CareEventModel)
        .filter(CareEventModel.person_id == person_id)
        .order_by(CareEventModel.occurred_at.desc())
        .limit(50)
        .all()
    )
    appointments = (
        db.query(AppointmentModel)
        .filter(AppointmentModel.person_id == person_id)
        .order_by(AppointmentModel.scheduled_at.asc())
        .all()
    )
    windows = (
        db.query(CareWindowModel)
        .filter(CareWindowModel.person_id == person_id, CareWindowModel.status == "active")
        .all()
    )
    event_dicts = [
        {
            "id": e.id,
            "title": e.title,
            "occurred_at": e.occurred_at.isoformat(),
            "status": e.status,
            "event_type": e.event_type,
        }
        for e in events
    ]
    appointment_dicts = [
        {
            "id": a.id,
            "title": a.title,
            "scheduled_at": a.scheduled_at.isoformat(),
            "location": a.location,
            "status": a.status,
        }
        for a in appointments
    ]
    window_dicts = [
        {
            "id": w.id,
            "window_type": w.window_type,
            "started_at": w.started_at.isoformat(),
            "ends_at": w.ends_at.isoformat(),
            "status": w.status,
        }
        for w in windows
    ]
    result = generate_daily_intelligence(person_id, event_dicts, appointment_dicts, window_dicts)
    db_intel = DailyIntelligenceModel(
        person_id=person_id,
        intelligence_date=datetime.fromisoformat(result["intelligence_date"]),
        overdue_items=result["overdue_items"],
        upcoming_items=result["upcoming_items"],
        active_windows=result["active_windows"],
        expired_windows=result["expired_windows"],
        daily_summary=result["daily_summary"],
    )
    db.add(db_intel)
    db.commit()
    db.refresh(db_intel)
    return db_intel


@router.post("/timezones", response_model=TimezoneContextSchema)
def create_timezone_context(
    person_id: str, caregiver_id: Optional[str] = None, timezone_id: str = "UTC", is_primary: bool = False, db: Session = Depends(get_db)
):
    if not validate_timezone(timezone_id):
        raise HTTPException(status_code=400, detail="Invalid or unsupported timezone")

    tz_context = TimezoneContextModel(
        person_id=person_id,
        caregiver_id=caregiver_id,
        timezone_id=timezone_id,
        is_primary=is_primary,
    )
    db.add(tz_context)
    db.commit()
    db.refresh(tz_context)
    return tz_context


@router.get("/timezones/{person_id}", response_model=List[TimezoneContextSchema])
def list_timezone_contexts(person_id: str, db: Session = Depends(get_db)):
    return (
        db.query(TimezoneContextModel)
        .filter(TimezoneContextModel.person_id == person_id)
        .all()
    )


@router.post("/temporal-relationships", response_model=TemporalRelationshipSchema)
def create_temporal_relationship(
    person_id: str, event_a_id: str, event_b_id: str, db: Session = Depends(get_db)
):
    event_a = (
        db.query(CareEventModel)
        .filter(CareEventModel.id == event_a_id, CareEventModel.person_id == person_id)
        .first()
    )
    event_b = (
        db.query(CareEventModel)
        .filter(CareEventModel.id == event_b_id, CareEventModel.person_id == person_id)
        .first()
    )
    if not event_a or not event_b:
        raise HTTPException(status_code=404, detail="One or both events not found")

    event_a_dict = {
        "id": event_a.id,
        "occurred_at": event_a.occurred_at.isoformat(),
    }
    event_b_dict = {
        "id": event_b.id,
        "occurred_at": event_b.occurred_at.isoformat(),
    }
    relationship = infer_temporal_relationship(event_a_dict, event_b_dict)

    db_rel = TemporalRelationshipModel(
        person_id=person_id,
        event_a_id=event_a_id,
        event_b_id=event_b_id,
        relationship_type=relationship["relationship"],
        time_difference_seconds=str(relationship["time_difference_seconds"]),
        confidence="0.9",
    )
    db.add(db_rel)
    db.commit()
    db.refresh(db_rel)
    return db_rel


@router.get("/temporal-relationships/{person_id}", response_model=List[TemporalRelationshipSchema])
def list_temporal_relationships(person_id: str, db: Session = Depends(get_db)):
    return (
        db.query(TemporalRelationshipModel)
        .filter(TemporalRelationshipModel.person_id == person_id)
        .order_by(TemporalRelationshipModel.created_at.desc())
        .all()
    )


@router.get("/time-patterns/{person_id}")
def get_time_patterns(person_id: str, window_days: int = 30, db: Session = Depends(get_db)):
    events = (
        db.query(CareEventModel)
        .filter(CareEventModel.person_id == person_id)
        .order_by(CareEventModel.occurred_at.desc())
        .all()
    )
    event_dicts = [
        {
            "id": e.id,
            "title": e.title,
            "occurred_at": e.occurred_at.isoformat(),
            "status": e.status,
            "event_type": e.event_type,
        }
        for e in events
    ]
    patterns = detect_time_patterns(event_dicts, window_days=window_days)
    return {"person_id": person_id, "window_days": window_days, "patterns": patterns}
