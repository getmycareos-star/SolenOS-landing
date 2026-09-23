from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from dateutil.relativedelta import relativedelta

from app.models.temporal import (
    TemporalFact as TemporalFactModel,
    TemporalRelation as TemporalRelationModel,
    TemporalReferenceFrame as TemporalReferenceFrameModel,
    TemporalContradiction as TemporalContradictionModel,
)
from app.schemas.temporal import (
    TemporalFactCreate,
    TemporalFactUpdate,
    TemporalRelationCreate,
    TemporalContradictionCreate,
    TemporalContradictionUpdate,
    RelativeTimeResolution,
    TemporalViewAtPoint,
    SubjectTemporalView,
)
from app.core.temporal_enums import (
    TemporalMode,
    TemporalStatus,
    TemporalRelationType,
    TemporalResolutionStatus,
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _diff_in_days(a: Optional[datetime], b: Optional[datetime]) -> Optional[float]:
    if a is None or b is None:
        return None
    a = _ensure_utc(a)
    b = _ensure_utc(b)
    return abs((b - a).total_seconds()) / 86400.0


def create_temporal_fact(db: Session, fact: TemporalFactCreate) -> TemporalFactModel:
    db_fact = TemporalFactModel(**fact.model_dump())
    db.add(db_fact)
    db.commit()
    db.refresh(db_fact)
    return db_fact


def update_temporal_fact(db: Session, fact_id: str, update: TemporalFactUpdate) -> Optional[TemporalFactModel]:
    db_fact = db.query(TemporalFactModel).filter(TemporalFactModel.id == fact_id).first()
    if not db_fact:
        return None

    update_data = update.model_dump(exclude_unset=True)

    if "temporal_mode" in update_data:
        db_fact.temporal_mode = update_data["temporal_mode"]
    if "asserted_point" in update_data:
        db_fact.asserted_point = _ensure_utc(update_data["asserted_point"])
    if "asserted_start" in update_data:
        db_fact.asserted_start = _ensure_utc(update_data["asserted_start"])
    if "asserted_end" in update_data:
        db_fact.asserted_end = _ensure_utc(update_data["asserted_end"])
    if "precision" in update_data:
        db_fact.precision = update_data["precision"]
    if "is_approximate" in update_data:
        db_fact.is_approximate = update_data["is_approximate"]
    if "lower_bound" in update_data:
        db_fact.lower_bound = _ensure_utc(update_data["lower_bound"])
    if "upper_bound" in update_data:
        db_fact.upper_bound = _ensure_utc(update_data["upper_bound"])
    if "document_time" in update_data:
        db_fact.document_time = _ensure_utc(update_data["document_time"])
    if "effective_time" in update_data:
        db_fact.effective_time = _ensure_utc(update_data["effective_time"])
    if "time_provenance" in update_data:
        db_fact.time_provenance = update_data["time_provenance"]
    if "source_assertion" in update_data:
        db_fact.source_assertion = update_data["source_assertion"]
    if "evidence_ids" in update_data:
        db_fact.evidence_ids = update_data["evidence_ids"]
    if "confidence" in update_data:
        db_fact.confidence = update_data["confidence"]

    db_fact.updated_at = utc_now()
    db.commit()
    db.refresh(db_fact)
    return db_fact


def supersede_temporal_fact(db: Session, old_fact_id: str, new_fact_id: str) -> Optional[TemporalFactModel]:
    old_fact = db.query(TemporalFactModel).filter(TemporalFactModel.id == old_fact_id).first()
    if not old_fact:
        return None

    old_fact.status = TemporalStatus.SUPERSEDED
    old_fact.superseded_by_fact_id = new_fact_id
    old_fact.updated_at = utc_now()
    db.commit()
    db.refresh(old_fact)
    return old_fact


def create_temporal_relation(db: Session, relation: TemporalRelationCreate) -> TemporalRelationModel:
    db_rel = TemporalRelationModel(**relation.model_dump())
    db.add(db_rel)
    db.commit()
    db.refresh(db_rel)
    return db_rel


def create_temporal_reference_frame(db: Session, person_id: str, name: str, reference_time: Optional[datetime] = None, source_event_id: Optional[str] = None, source_fact_id: Optional[str] = None, is_resolved: bool = False) -> TemporalReferenceFrameModel:
    frame = TemporalReferenceFrameModel(
        person_id=person_id,
        name=name,
        reference_time=_ensure_utc(reference_time),
        source_event_id=source_event_id,
        source_fact_id=source_fact_id,
        is_resolved=is_resolved,
    )
    db.add(frame)
    db.commit()
    db.refresh(frame)
    return frame


def resolve_relative_time(db: Session, person_id: str, expression: str, reference_frame_id: Optional[str] = None) -> RelativeTimeResolution:
    frame = None
    if reference_frame_id:
        frame = db.query(TemporalReferenceFrameModel).filter(
            TemporalReferenceFrameModel.id == reference_frame_id,
            TemporalReferenceFrameModel.person_id == person_id,
        ).first()

    if not frame or not frame.is_resolved or frame.reference_time is None:
        return RelativeTimeResolution(
            original_text=expression,
            reference_frame_id=reference_frame_id,
            reference_frame_name=frame.name if frame else None,
            resolved_point=None,
            is_resolved=False,
            confidence=0.0,
            derivation_method="missing_reference",
        )

    ref_time = frame.reference_time
    text_lower = expression.lower().strip()
    resolved_point = None
    confidence = 0.9
    derivation_method = "relative_calculation"
    lower_bound = None
    upper_bound = None

    if "day after" in text_lower:
        days = int(text_lower.split("day after")[0].strip().split()[-1]) if any(c.isdigit() for c in text_lower) else 1
        resolved_point = ref_time + timedelta(days=days)
    elif "days after" in text_lower:
        days_str = text_lower.split("days after")[0].strip().split()[-1]
        try:
            days = int(days_str)
            resolved_point = ref_time + timedelta(days=days)
        except ValueError:
            pass
    elif "week after" in text_lower:
        weeks_str = text_lower.split("week after")[0].strip().split()[-1]
        try:
            weeks = int(weeks_str)
            resolved_point = ref_time + timedelta(weeks=weeks)
        except ValueError:
            pass
    elif "weeks after" in text_lower:
        weeks_str = text_lower.split("weeks after")[0].strip().split()[-1]
        try:
            weeks = int(weeks_str)
            resolved_point = ref_time + timedelta(weeks=weeks)
        except ValueError:
            pass
    elif "month after" in text_lower:
        months_str = text_lower.split("month after")[0].strip().split()[-1]
        try:
            months = int(months_str)
            resolved_point = ref_time + relativedelta(months=months)
        except ValueError:
            pass
    elif "before" in text_lower and "after" not in text_lower:
        if ref_time:
            resolved_point = ref_time
            confidence = 0.5
            derivation_method = "relative_ordering"
    else:
        confidence = 0.0
        derivation_method = "unparseable"

    if resolved_point:
        return RelativeTimeResolution(
            original_text=expression,
            reference_frame_id=reference_frame_id,
            reference_frame_name=frame.name,
            resolved_point=resolved_point,
            is_resolved=True,
            confidence=confidence,
            derivation_method=derivation_method,
            lower_bound=lower_bound,
            upper_bound=upper_bound,
        )

    return RelativeTimeResolution(
        original_text=expression,
        reference_frame_id=reference_frame_id,
        reference_frame_name=frame.name if frame else None,
        resolved_point=None,
        is_resolved=False,
        confidence=0.0,
        derivation_method="unresolved",
    )


def infer_temporal_relation(db: Session, fact_a_id: str, fact_b_id: str) -> Optional[Dict[str, Any]]:
    fact_a = db.query(TemporalFactModel).filter(TemporalFactModel.id == fact_a_id).first()
    fact_b = db.query(TemporalFactModel).filter(TemporalFactModel.id == fact_b_id).first()

    if not fact_a or not fact_b:
        return None

    a_times = _extract_times(fact_a)
    b_times = _extract_times(fact_b)

    if not a_times or not b_times:
        return None

    relation = _determine_relation(a_times, b_times)
    if relation is None:
        return None

    a_conf = fact_a.confidence if fact_a.confidence is not None else 1.0
    b_conf = fact_b.confidence if fact_b.confidence is not None else 1.0
    confidences = [c for c in (fact_a.confidence, fact_b.confidence) if c is not None]
    confidence = min(confidences) if confidences else None

    return {
        "fact_a_id": fact_a_id,
        "fact_b_id": fact_b_id,
        "relation": relation.value,
        "confidence": confidence,
        "is_derived": True,
        "derivation_method": "temporal_calculation",
    }


def _extract_times(fact: TemporalFactModel) -> Optional[Dict[str, Any]]:
    if fact.asserted_point is not None:
        return {"type": "point", "time": fact.asserted_point}
    if fact.asserted_start is not None and fact.asserted_end is not None:
        return {"type": "interval", "start": fact.asserted_start, "end": fact.asserted_end}
    if fact.asserted_start is not None:
        return {"type": "open_interval", "start": fact.asserted_start}
    if fact.lower_bound is not None and fact.upper_bound is not None:
        return {"type": "range", "lower": fact.lower_bound, "upper": fact.upper_bound}
    return None


def _determine_relation(a: Dict[str, Any], b: Dict[str, Any]) -> Optional[TemporalRelationType]:
    if a["type"] == "point" and b["type"] == "point":
        diff = (b["time"] - a["time"]).total_seconds()
        if abs(diff) < 1:
            return TemporalRelationType.SIMULTANEOUS
        elif diff > 0:
            return TemporalRelationType.BEFORE
        else:
            return TemporalRelationType.AFTER

    if a["type"] == "interval" and b["type"] == "interval":
        a_start, a_end = a["start"], a["end"]
        b_start, b_end = b["start"], b["end"]

        if a_start == b_start and a_end == b_end:
            return TemporalRelationType.SIMULTANEOUS
        if a_end < b_start:
            return TemporalRelationType.BEFORE
        if a_start > b_end:
            return TemporalRelationType.AFTER
        if b_start >= a_start and b_end <= a_end:
            return TemporalRelationType.CONTAINS
        if a_start >= b_start and a_end <= b_end:
            return TemporalRelationType.DURING
        if b_start >= a_start and b_start < a_end:
            return TemporalRelationType.OVERLAPS

    if a["type"] == "point" and b["type"] == "interval":
        point = a["time"]
        b_start, b_end = b["start"], b["end"]
        if point < b_start:
            return TemporalRelationType.BEFORE
        if point > b_end:
            return TemporalRelationType.AFTER
        return TemporalRelationType.DURING

    if a["type"] == "interval" and b["type"] == "point":
        point = b["time"]
        a_start, a_end = a["start"], a["end"]
        if point < a_start:
            return TemporalRelationType.AFTER
        if point > a_end:
            return TemporalRelationType.BEFORE
        return TemporalRelationType.CONTAINS

    return None


def detect_temporal_conflicts(db: Session, person_id: str, subject_type: Optional[str] = None, subject_id: Optional[str] = None) -> List[Dict[str, Any]]:
    query = db.query(TemporalContradictionModel).filter(TemporalContradictionModel.person_id == person_id)
    if subject_type:
        query = query.filter(TemporalContradictionModel.subject_type == subject_type)
    if subject_id:
        query = query.filter(TemporalContradictionModel.subject_id == subject_id)

    conflicts = []
    for c in query.all():
        conflicts.append({
            "id": c.id,
            "subject_type": c.subject_type,
            "subject_id": c.subject_id,
            "fact_a_id": c.fact_a_id,
            "fact_b_id": c.fact_b_id,
            "description": c.description,
            "resolution_status": c.resolution_status.value,
            "resolution_notes": c.resolution_notes,
            "evidence_ids": c.evidence_ids,
            "created_at": c.created_at.isoformat(),
        })
    return conflicts


def create_temporal_contradiction(db: Session, contradiction: TemporalContradictionCreate) -> TemporalContradictionModel:
    db_contradiction = TemporalContradictionModel(**contradiction.model_dump())
    db.add(db_contradiction)
    db.commit()
    db.refresh(db_contradiction)
    return db_contradiction


def update_temporal_contradiction(db: Session, contradiction_id: str, update: TemporalContradictionUpdate) -> Optional[TemporalContradictionModel]:
    db_contradiction = db.query(TemporalContradictionModel).filter(TemporalContradictionModel.id == contradiction_id).first()
    if not db_contradiction:
        return None

    update_data = update.model_dump(exclude_unset=True)
    if "resolution_status" in update_data:
        db_contradiction.resolution_status = update_data["resolution_status"]
        if update_data["resolution_status"] == TemporalResolutionStatus.RESOLVED_A:
            db_contradiction.resolved_at = utc_now()
        elif update_data["resolution_status"] == TemporalResolutionStatus.RESOLVED_B:
            db_contradiction.resolved_at = utc_now()
        elif update_data["resolution_status"] == TemporalResolutionStatus.SUPERSEDED:
            db_contradiction.resolved_at = utc_now()
    if "resolution_notes" in update_data:
        db_contradiction.resolution_notes = update_data["resolution_notes"]
    if "resolved_by_caregiver_id" in update_data:
        db_contradiction.resolved_by_caregiver_id = update_data["resolved_by_caregiver_id"]
    if "evidence_ids" in update_data:
        db_contradiction.evidence_ids = update_data["evidence_ids"]

    db.commit()
    db.refresh(db_contradiction)
    return db_contradiction


def get_temporal_view_at_point(db: Session, person_id: str, point_in_time: datetime) -> TemporalViewAtPoint:
    point_in_time = _ensure_utc(point_in_time)

    facts = db.query(TemporalFactModel).filter(TemporalFactModel.person_id == person_id).all()

    active_facts = []
    historical_facts = []
    future_facts = []
    unknown_facts = []

    for f in facts:
        fact_dict = _fact_to_dict(f)
        temporal_status = _classify_temporal_status(f, point_in_time)
        if temporal_status == "active":
            active_facts.append(fact_dict)
        elif temporal_status == "historical":
            historical_facts.append(fact_dict)
        elif temporal_status == "future":
            future_facts.append(fact_dict)
        else:
            unknown_facts.append(fact_dict)

    return TemporalViewAtPoint(
        person_id=person_id,
        point_in_time=point_in_time,
        active_facts=active_facts,
        historical_facts=historical_facts,
        future_facts=future_facts,
        unknown_facts=unknown_facts,
    )


def get_subject_temporal_view(db: Session, person_id: str, subject_type: str, subject_id: str) -> SubjectTemporalView:
    facts = db.query(TemporalFactModel).filter(
        TemporalFactModel.person_id == person_id,
        TemporalFactModel.subject_type == subject_type,
        TemporalFactModel.subject_id == subject_id,
    ).all()

    relations = db.query(TemporalRelationModel).filter(
        TemporalRelationModel.person_id == person_id,
    ).all()

    related_relations = []
    for r in relations:
        if r.fact_a_id in [f.id for f in facts] or r.fact_b_id in [f.id for f in facts]:
            related_relations.append({
                "id": r.id,
                "fact_a_id": r.fact_a_id,
                "fact_b_id": r.fact_b_id,
                "relation_type": r.relation_type.value,
                "confidence": r.confidence,
                "is_derived": r.is_derived,
                "derivation_method": r.derivation_method,
                "evidence_ids": r.evidence_ids,
                "created_at": r.created_at.isoformat(),
            })

    contradictions = detect_temporal_conflicts(db, person_id, subject_type, subject_id)

    frames = db.query(TemporalReferenceFrameModel).filter(
        TemporalReferenceFrameModel.person_id == person_id,
    ).all()
    frame_dicts = []
    for frame in frames:
        frame_dicts.append({
            "id": frame.id,
            "name": frame.name,
            "reference_time": frame.reference_time.isoformat() if frame.reference_time else None,
            "source_event_id": frame.source_event_id,
            "source_fact_id": frame.source_fact_id,
            "is_resolved": frame.is_resolved,
            "created_at": frame.created_at.isoformat(),
        })

    return SubjectTemporalView(
        person_id=person_id,
        subject_type=subject_type,
        subject_id=subject_id,
        facts=[_fact_to_dict(f) for f in facts],
        relations=related_relations,
        contradictions=contradictions,
        reference_frames=frame_dicts,
    )


def calculate_duration(db: Session, fact_id: str) -> Optional[Dict[str, Any]]:
    fact = db.query(TemporalFactModel).filter(TemporalFactModel.id == fact_id).first()
    if not fact:
        return None

    if fact.temporal_mode != TemporalMode.EVENT:
        return None

    if fact.asserted_start is not None and fact.asserted_end is not None:
        duration = (fact.asserted_end - fact.asserted_start).total_seconds()
        return {
            "fact_id": fact_id,
            "duration_seconds": duration,
            "duration_days": duration / 86400.0,
            "is_exact": not fact.is_approximate,
            "precision": fact.precision.value,
            "confidence": fact.confidence,
        }

    if fact.asserted_point is not None:
        return {
            "fact_id": fact_id,
            "duration_seconds": 0.0,
            "duration_days": 0.0,
            "is_exact": not fact.is_approximate,
            "precision": fact.precision.value,
            "confidence": fact.confidence,
            "note": "Point event has zero duration",
        }

    return {
        "fact_id": fact_id,
        "duration_seconds": None,
        "duration_days": None,
        "is_exact": False,
        "precision": fact.precision.value,
        "confidence": fact.confidence,
        "note": "Insufficient temporal information for duration",
    }


def classify_temporal_status(fact: TemporalFactModel, reference_time: Optional[datetime] = None) -> str:
    if reference_time is None:
        reference_time = utc_now()
    reference_time = _ensure_utc(reference_time)

    point = fact.asserted_point
    start = fact.asserted_start
    end = fact.asserted_end

    if point is not None:
        point = _ensure_utc(point)
        if point > reference_time:
            return "future"
        else:
            return "historical"

    if start is not None and end is not None:
        start = _ensure_utc(start)
        end = _ensure_utc(end)
        if end < reference_time:
            return "historical"
        if start > reference_time:
            return "future"
        if start <= reference_time <= end:
            return "active"

    if fact.lower_bound is not None and fact.upper_bound is not None:
        lower = _ensure_utc(fact.lower_bound)
        upper = _ensure_utc(fact.upper_bound)
        if upper < reference_time:
            return "historical"
        if lower > reference_time:
            return "future"
        return "unknown"

    return "unknown"


def _classify_temporal_status(fact: TemporalFactModel, reference_time: datetime) -> str:
    return classify_temporal_status(fact, reference_time)


def _fact_to_dict(fact: TemporalFactModel) -> Dict[str, Any]:
    return {
        "id": fact.id,
        "subject_type": fact.subject_type,
        "subject_id": fact.subject_id,
        "temporal_mode": fact.temporal_mode.value,
        "status": fact.status.value,
        "asserted_point": fact.asserted_point.isoformat() if fact.asserted_point else None,
        "asserted_start": fact.asserted_start.isoformat() if fact.asserted_start else None,
        "asserted_end": fact.asserted_end.isoformat() if fact.asserted_end else None,
        "precision": fact.precision.value,
        "is_approximate": fact.is_approximate,
        "lower_bound": fact.lower_bound.isoformat() if fact.lower_bound else None,
        "upper_bound": fact.upper_bound.isoformat() if fact.upper_bound else None,
        "document_time": fact.document_time.isoformat() if fact.document_time else None,
        "effective_time": fact.effective_time.isoformat() if fact.effective_time else None,
        "time_provenance": fact.time_provenance,
        "source_assertion": fact.source_assertion,
        "evidence_ids": fact.evidence_ids,
        "confidence": fact.confidence,
        "superseded_by_fact_id": fact.superseded_by_fact_id,
        "created_at": fact.created_at.isoformat(),
        "updated_at": fact.updated_at.isoformat() if fact.updated_at else None,
    }


def check_temporal_conflict(db: Session, fact_a_id: str, fact_b_id: str) -> Optional[Dict[str, Any]]:
    fact_a = db.query(TemporalFactModel).filter(TemporalFactModel.id == fact_a_id).first()
    fact_b = db.query(TemporalFactModel).filter(TemporalFactModel.id == fact_b_id).first()

    if not fact_a or not fact_b:
        return None

    if fact_a.subject_type != fact_b.subject_type or fact_a.subject_id != fact_b.subject_id:
        return None

    a_times = _extract_times(fact_a)
    b_times = _extract_times(fact_b)

    if not a_times or not b_times:
        return None

    has_conflict = False
    conflict_type = None

    if a_times["type"] == "point" and b_times["type"] == "point":
        if a_times["time"] != b_times["time"]:
            has_conflict = True
            conflict_type = "competing_points"

    if a_times["type"] == "interval" and b_times["type"] == "interval":
        if a_times["start"] != b_times["start"] or a_times["end"] != b_times["end"]:
            has_conflict = True
            conflict_type = "competing_intervals"

    if not has_conflict:
        return None

    return {
        "fact_a_id": fact_a_id,
        "fact_b_id": fact_b_id,
        "conflict_type": conflict_type,
        "subject_type": fact_a.subject_type,
        "subject_id": fact_a.subject_id,
        "suggested_action": "create_temporal_contradiction",
    }
