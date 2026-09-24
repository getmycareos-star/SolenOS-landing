from datetime import datetime, timezone, timedelta
from typing import List, Optional
import json
from sqlalchemy.orm import Session
from app.models.care import Caregiver, Person, Evidence, CareEvent
from app.schemas.situation import SituationInput, SituationResponse, SituationEvent, SituationDocument
from app.services.change_detection import detect_event_changes
from app.services.situation_formation import detect_situations
from app.services.prioritization import PrioritizationEngine
from app.services.safety import SafetyEngine
from app.services.action_extraction import ActionExtractionEngine
from app.services.caregiver_intelligence import CaregiverIntelligenceService
from app.services.temporal_intelligence import create_temporal_fact
from app.services.uncertainty import UncertaintyEngine
from app.services.learning import LearningEngine, SavePipelineEvent
from app.services.claim_extraction import ClaimExtractionEngine
from app.models.safety import SafetyDecisionModel
from app.models.action import Action as ActionModel
from app.schemas.safety import EvidenceReference, SafetyContractInput
from app.schemas.temporal import TemporalFactCreate
from app.schemas.caregiver_intelligence import CaregiverObservationCreate
from app.core.safety_enums import (
    SourceAuthority,
    SourceQuality,
    CurrentnessStatus,
    RiskClass,
    ClaimType,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _infer_source_type(raw_input: str, doc: Optional[SituationDocument]) -> str:
    lower = raw_input.lower()
    if doc and doc.mime_type and "ocr" in (doc.mime_type or "").lower():
        return "document_ocr"
    if doc and doc.name:
        return "document"
    report_markers = [
        "said", "reported", "mentioned", "told", "stated",
        "according to", "noticed", "observed", "says", "reports",
    ]
    if any(marker in lower for marker in report_markers):
        return "reported_observation"
    return "caregiver_observation"


def _derive_evidence_status(source_type: str) -> str:
    """Derive evidence status from the actual source type.

    Raw caregiver input and document text are reports, not established facts.
    Never label a caregiver report as confirmed or an inference as observed.
    """
    if source_type in ("caregiver_observation", "reported_observation"):
        return "reported"
    if source_type in ("document", "document_ocr"):
        return "reported"
    return "reported"


def _derive_evidence_confidence(evidence: Evidence) -> Optional[float]:
    """Return evidence confidence only when it can be genuinely derived.

    Raw text evidence has no basis for a numeric confidence. Keep it unknown
    rather than fabricating a value.
    """
    return evidence.confidence


def _derive_temporal_confidence(time_provenance_note: Optional[str]) -> Optional[float]:
    """Temporal confidence is unknown unless we have a basis to calculate it."""
    return None


def _derive_change_confidence(sig_changes: List) -> Optional[float]:
    """Use the change's own confidence, never a fallback default."""
    if not sig_changes:
        return None
    return sig_changes[0].confidence if sig_changes[0].confidence is not None else None


def _infer_observation_type(raw_input: str, doc: Optional[SituationDocument]) -> str:
    if doc and doc.name:
        return "document_review"
    lower = raw_input.lower()
    direct_markers = [
        "i saw", "i observed", "i noticed", "i watched", "i witnessed",
        "saw the person", "watched the person",
    ]
    secondhand_markers = [
        "said", "reported", "mentioned", "told", "stated",
        "according to", "says", "reports", "told me", "heard that",
    ]
    if any(marker in lower for marker in direct_markers):
        return "direct"
    if any(marker in lower for marker in secondhand_markers):
        return "second_hand"
    return "indirect"


def _derive_caregiver_intent(raw_input: str) -> Optional[str]:
    lower = raw_input.lower()
    intent_markers = [
        "what to ask", "questions for", "prepare questions",
        "want to know what to ask", "need to know", "what should i ask",
        "should i ask", "how do i", "when should", "is it normal",
        "what should i do", "can you tell", "help me understand",
        "what does this mean", "what does it mean",
        "what to do",
    ]
    for marker in intent_markers:
        if marker in lower:
            return "seeking_provider_clarification"
    if "?" in raw_input:
        return "seeking_information"
    return None


def _ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _record_contradictions(
    db: Session,
    person_id: str,
    current_event: CareEvent,
    current_evidence_ids: List[str],
    now: Optional[datetime],
) -> None:
    from app.models.uncertainty import Contradiction as ContradictionModel
    from app.services.significance import _reports_conflict
    from app.models.care import CareEvent as CareEventModel

    recent = (
        db.query(CareEventModel)
        .filter(
            CareEventModel.person_id == person_id,
            CareEventModel.id != current_event.id,
        )
        .order_by(CareEventModel.occurred_at.desc())
        .all()
    )
    if now is not None:
        now_utc = _ensure_utc(now)
        recent = [
            e for e in recent
            if e.occurred_at is not None and _ensure_utc(e.occurred_at) >= now_utc - timedelta(days=14)
        ]
    if not recent:
        return
    evidence_set = set(current_evidence_ids or [])
    for prior in recent:
        if _reports_conflict([prior, current_event]):
            evidence_set = evidence_set | set(prior.evidence_ids or [])
            existing = (
                db.query(ContradictionModel)
                .filter(
                    ContradictionModel.person_id == person_id,
                    ContradictionModel.subject_type == current_event.event_type,
                    ContradictionModel.resolution_status == "unresolved",
                )
                .all()
            )
            duplicate = any(evidence_set & set(ex.evidence_ids or []) for ex in existing)
            if duplicate:
                return
            contradiction = ContradictionModel(
                person_id=person_id,
                subject_type=current_event.event_type,
                subject_id="",
                field="observation",
                description="Conflicting reports across reporters for the same subject.",
                evidence_ids=sorted(evidence_set),
                resolution_status="unresolved",
            )
            db.add(contradiction)
    db.flush()


def _record_open_items(
    db: Session,
    person_id: str,
    combined_text: str,
    evidence_ids: List[str],
    care_event_id: str,
    caregiver_id: str,
) -> None:
    from app.models.uncertainty import OpenQuestion as OpenQuestionModel
    import re as _re

    sentences = _re.split(r"(?<=[.!?])\s+", combined_text)
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        if "?" in sentence or _derive_caregiver_intent(sentence):
            if sentence.endswith("?"):
                cleaned = sentence.rstrip("?").strip()
            else:
                cleaned = sentence
            if not cleaned:
                continue
            existing = (
                db.query(OpenQuestionModel)
                .filter(
                    OpenQuestionModel.person_id == person_id,
                    OpenQuestionModel.question == cleaned,
                    OpenQuestionModel.status == "open",
                )
                .first()
            )
            if existing:
                continue
            open_q = OpenQuestionModel(
                person_id=person_id,
                question=cleaned,
                subject_type="observation",
                subject_id=care_event_id,
                status="open",
                evidence_ids=evidence_ids,
                created_by_caregiver_id=caregiver_id,
            )
            db.add(open_q)
    db.flush()


def process_situation_input(db: Session, payload: SituationInput) -> SituationResponse:
    caregiver = db.query(Caregiver).filter(Caregiver.id == payload.caregiver_id).first()
    if not caregiver:
        raise ValueError("Caregiver not found")

    person = db.query(Person).filter(Person.id == payload.person_id).first()
    if not person:
        raise ValueError("Person not found")

    timestamp = payload.timestamp
    time_provenance_note = None
    if timestamp:
        try:
            occurred_at = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
            if occurred_at.tzinfo is None:
                occurred_at = occurred_at.replace(tzinfo=timezone.utc)
        except ValueError:
            occurred_at = None
            time_provenance_note = f"submission_time_used:unparseable_timestamp:{timestamp}"
    else:
        occurred_at = None
        time_provenance_note = "submission_time_used:no_timestamp_provided"

    evidence_ids: List[str] = []
    event_ids: List[str] = []
    warnings: List[str] = []

    def create_evidence(source_text: str, doc: Optional[SituationDocument] = None) -> Evidence:
        metadata = None
        if doc and (doc.ocr_confidence is not None or doc.mime_type):
            metadata = {
                "ocr_confidence": doc.ocr_confidence,
                "mime_type": doc.mime_type,
            }
        source_type = _infer_source_type(source_text, doc)
        evidence = Evidence(
            person_id=payload.person_id,
            type="note" if not doc else "document",
            source_text=source_text,
            original_file_path=doc.name if doc else None,
            extra_metadata=json.dumps(metadata) if metadata else None,
            time_provenance=payload.provenance.captured_at if payload.provenance else None,
            uploaded_by_caregiver_id=payload.caregiver_id,
            confidence=None,
            evidence_status="reported",
            source_type=source_type,
        )
        db.add(evidence)
        db.flush()
        evidence_ids.append(evidence.id)
        return evidence

    raw_texts = []
    if payload.raw_input and payload.raw_input.strip():
        raw_texts.append(payload.raw_input.strip())
        create_evidence(payload.raw_input.strip())

    if payload.documents:
        for doc in payload.documents:
            if doc.extracted_text and doc.extracted_text.strip():
                raw_texts.append(doc.extracted_text.strip())
                create_evidence(doc.extracted_text.strip(), doc)

    if not evidence_ids:
        raise ValueError("No valid evidence provided")

    care_event = CareEvent(
        person_id=payload.person_id,
        event_type="observation",
        status="recorded",
        occurred_at=occurred_at,
        occurred_at_timezone=caregiver.timezone,
        title=payload.raw_input.strip()[:200] if payload.raw_input and payload.raw_input.strip() else "Document observation",
        description=payload.raw_input.strip() if payload.raw_input and payload.raw_input.strip() else None,
        evidence_ids=evidence_ids,
        created_by_caregiver_id=payload.caregiver_id,
        reporter_ids=[payload.caregiver_id],
        time_provenance=time_provenance_note,
    )
    db.add(care_event)
    db.flush()
    event_ids.append(care_event.id)
    db.commit()

    combined_text = " ".join(raw_texts)
    event_utc = occurred_at

    try:
        _record_contradictions(db, payload.person_id, care_event, evidence_ids, event_utc)
        _record_open_items(db, payload.person_id, combined_text, evidence_ids, care_event.id, payload.caregiver_id)
    except Exception as exc:
        warnings.append(f"Uncertainty recording failed: {exc}")

    action_ids: List[str] = []
    try:
        action_engine = ActionExtractionEngine()
        extracted_actions = action_engine.extract(combined_text, evidence_ids[0], reference_date=occurred_at)
        for action_candidate in extracted_actions:
            db_action = ActionModel(
                person_id=payload.person_id,
                source_evidence_id=evidence_ids[0],
                source_passage=action_candidate.source_passage,
                source_document_type=None,
                source_authority="caregiver",
                extraction_confidence=action_candidate.extraction_confidence,
                provenance_notes=action_candidate.provenance_notes,
                actor_type=action_candidate.actor_type,
                actor_label=action_candidate.actor_label,
                subject_type="patient",
                subject_id=payload.person_id,
                action_type=action_candidate.action_type,
                action_object=action_candidate.action_object,
                normalized_action=action_candidate.normalized_action,
                original_text=action_candidate.original_text,
                modality=action_candidate.modality,
                condition_text=action_candidate.condition_text,
                trigger_text=action_candidate.trigger_text,
                deadline=action_candidate.deadline,
                status=action_candidate.status,
                is_explicit=action_candidate.is_explicit,
                is_medication_action=action_candidate.is_medication_action,
                risk_tier=action_candidate.risk_tier,
                requires_confirmation=action_candidate.requires_confirmation,
                has_condition=action_candidate.has_condition,
                is_recurring=action_candidate.is_recurring,
                created_by_caregiver_id=payload.caregiver_id,
            )
            db.add(db_action)
            db.flush()
            action_ids.append(db_action.id)
    except Exception as exc:
        warnings.append(f"Action extraction failed: {exc}")

    try:
        safety_engine = SafetyEngine(db)
        claim_extractor = ClaimExtractionEngine()
        claims = claim_extractor.extract(combined_text, evidence_ids[0])

        evidence_refs = []
        for ev_id in evidence_ids:
            ev = db.query(Evidence).filter(Evidence.id == ev_id).first()
            if ev:
                evidence_refs.append(EvidenceReference(
                    evidence_id=ev.id,
                    source_text=ev.source_text,
                    authority=SourceAuthority.CAREGIVER_REPORT,
                    quality=SourceQuality.MODERATE,
                    currentness=CurrentnessStatus.CURRENT,
                    confidence=ev.confidence,
                ))

        risk_class = RiskClass.INFORMATIONAL
        for claim in claims:
            if claim.claim_type == ClaimType.MEDICAL_ACTION:
                risk_class = RiskClass.HIGH_RISK_MEDICAL
                break
            elif claim.claim_type == ClaimType.DIAGNOSTIC:
                risk_class = RiskClass.HIGH_RISK_MEDICAL
            elif claim.claim_type == ClaimType.CAUSAL:
                risk_class = RiskClass.MODERATE_RISK

        safety_input = SafetyContractInput(
            user_intent=combined_text,
            candidate_claims=[c.text for c in claims],
            evidence_references=evidence_refs,
            risk_classification=risk_class,
            proposed_action_level="caregiver_observation",
            user_role="caregiver",
            person_id=payload.person_id,
        )
        safety_output = safety_engine.evaluate(safety_input)

        safety_decision = SafetyDecisionModel(
            person_id=payload.person_id,
            subject_type="observation",
            subject_id=care_event.id,
            decision=safety_output.decision,
            safety_state=safety_output.safety_state,
            risk_class=risk_class,
            qualifications=[q.model_dump() for q in safety_output.qualifications],
            violations=[v.value for v in safety_output.violations],
            escalation_required=safety_output.escalation_required,
            escalation_destination=safety_output.escalation_destination,
            escalation_reason=safety_output.escalation_reason,
            human_review_required=safety_output.human_review_required,
            rationale=safety_output.rationale,
            policy_references=safety_output.policy_references,
            input_claims=[c.text for c in claims],
            evidence_ids=evidence_ids,
            final_output=combined_text,
            safety_version="1.0",
            created_by_caregiver_id=payload.caregiver_id,
        )
        db.add(safety_decision)
        db.flush()
    except Exception as exc:
        warnings.append(f"Safety evaluation failed: {exc}")

    try:
        caregiver_service = CaregiverIntelligenceService(db)
        observation_type = _infer_observation_type(combined_text, payload.documents[0] if payload.documents else None)
        intent = _derive_caregiver_intent(combined_text)
        extra_meta = {"care_event_id": care_event.id, "action_ids": action_ids}
        if intent:
            extra_meta["intent"] = intent
        caregiver_service.record_observation(CaregiverObservationCreate(
            caregiver_id=payload.caregiver_id,
            person_id=payload.person_id,
            observation_content=combined_text,
            observation_type=observation_type,
            event_time=occurred_at,
            event_time_precision="estimated" if time_provenance_note else "exact",
            evidence_ref=evidence_ids[0],
            extra_metadata=extra_meta,
        ))
    except Exception as exc:
        warnings.append(f"Caregiver observation recording failed: {exc}")

    try:
        create_temporal_fact(db, TemporalFactCreate(
            person_id=payload.person_id,
            subject_type="observation",
            subject_id=care_event.id,
            temporal_mode="event",
            asserted_point=occurred_at,
            precision="unknown" if time_provenance_note else "exact",
            is_approximate=bool(time_provenance_note),
            time_provenance=time_provenance_note,
            source_assertion=combined_text,
            evidence_ids=evidence_ids,
            confidence=None,
            created_by_caregiver_id=payload.caregiver_id,
        ))
    except Exception as exc:
        warnings.append(f"Temporal fact creation failed: {exc}")

    try:
        uncertainty_engine = UncertaintyEngine(db)
        uncertainty_engine.list_contradictions(payload.person_id)
    except Exception as exc:
        warnings.append(f"Contradiction detection failed: {exc}")

    try:
        learning_engine = LearningEngine(db)
        learning_engine.log_pipeline_event(SavePipelineEvent(
            step="situation_input_processed",
            person_id=payload.person_id,
            detail=f"Processed observation with {len(evidence_ids)} evidence, {len(action_ids)} actions",
        ))
        learning_engine.record_learning_event(
            payload.person_id,
            "observation_recorded",
            f"Recorded observation: {combined_text[:100]}",
            "situation_input",
            care_event.id,
            payload.caregiver_id,
        )
    except Exception as exc:
        warnings.append(f"Learning engine failed: {exc}")

    changes: List = []
    situations: List = []
    prioritization_ids: List[str] = []
    top_priority = None
    attention_candidate = False
    follow_up_candidate = False
    what_changed = None

    try:
        changes = detect_event_changes(db, payload.person_id, care_event.event_type, None, event_utc)
        sig_changes = []
        if changes:
            sig_changes = [c for c in changes if c.significance_verdict and c.significance_verdict.value != "insufficient_evidence"]
            if sig_changes:
                attention_candidate = any(c.attention_candidate for c in sig_changes)
                follow_up_candidate = any(c.follow_up_candidate for c in sig_changes)
                parts = []
                for c in sig_changes:
                    if c.change_type:
                        parts.append(f"{c.change_type.value}: {c.subject_type}")
                if parts:
                    what_changed = "; ".join(parts)

        detected = detect_situations(db, payload.person_id, event_utc)
        if detected:
            situations = detected
            active_situations = [s for s in detected if s.state.value == "active"]
            if active_situations:
                attention_candidate = attention_candidate or any(s.attention_candidate for s in active_situations)
                follow_up_candidate = follow_up_candidate or any(s.follow_up_candidate for s in active_situations)

        prioritization_engine = PrioritizationEngine(db)
        prioritizations = prioritization_engine.detect(
            payload.person_id,
            changes=changes,
            situations=situations,
            reference_time=event_utc,
        )
        prioritization_ids = [item.id for item in prioritizations]
        if prioritizations:
            rankings = prioritization_engine.rank(
                payload.person_id,
                prioritizations,
                event_utc,
            )
            rank_by_id = {
                ranking.prioritization_id: ranking.rank
                for ranking in rankings
            }
            top_priority = min(
                prioritizations,
                key=lambda item: rank_by_id.get(item.id, 10**9),
            )
            for situation in situations:
                situation_change_ids = set(situation.change_ids or [])
                related_ids = [
                    item.id
                    for item in prioritizations
                    if not situation_change_ids
                    or bool(set(item.change_ids or []) & situation_change_ids)
                ]
                if not related_ids:
                    continue
                situation_context = dict(situation.context or {})
                situation_context["prioritization_ids"] = related_ids
                situation_context["top_priority_id"] = top_priority.id
                situation.context = situation_context
            top_level = top_priority.priority_level.value if hasattr(top_priority.priority_level, "value") else str(top_priority.priority_level)
            attention_candidate = attention_candidate or top_level in {"critical", "high"}
            follow_up_candidate = follow_up_candidate or top_level in {"critical", "high", "moderate"}

        care_event.significance_verdict = sig_changes[0].significance_verdict.value if sig_changes else None
        care_event.attention_candidate = attention_candidate
        care_event.follow_up_candidate = follow_up_candidate
        care_event.confidence = sig_changes[0].confidence if sig_changes else None
        if situations:
            care_event.situation_id = situations[0].id
        db.commit()
        db.refresh(care_event)
    except Exception as exc:
        warnings.append(f"Change detection or situation formation failed: {exc}")

    events = [
        SituationEvent(
            id=e.id,
            event_type=e.event_type,
            title=e.title,
            description=e.description,
            occurred_at=e.occurred_at,
            evidence_ids=e.evidence_ids or [],
        )
        for e in db.query(CareEvent).filter(CareEvent.id.in_(event_ids)).all()
    ]

    situation_responses = []
    for s in situations:
        situation_responses.append({
            "id": s.id,
            "title": s.title,
            "description": s.description,
            "situation_type": s.situation_type.value if s.situation_type else None,
            "state": s.state.value if s.state else None,
            "confidence": s.confidence,
            "attention_candidate": s.attention_candidate,
            "follow_up_candidate": s.follow_up_candidate,
            "prioritization_ids": prioritization_ids or None,
            "top_priority": {
                "id": top_priority.id,
                "priority_level": (
                    top_priority.priority_level.value
                    if hasattr(top_priority.priority_level, "value")
                    else str(top_priority.priority_level)
                ),
                "overall_confidence": top_priority.overall_confidence,
                "explanation": top_priority.explanation,
            } if top_priority else None,
        })

    ok = not warnings
    message = "Care input recorded successfully." if ok else "Care input recorded with processing warnings."

    return SituationResponse(
        ok=ok,
        situation_id=situations[0].id if situations else None,
        care_key=payload.caregiver_id,
        person_id=payload.person_id,
        evidence_id=evidence_ids[0],
        care_event_id=care_event.id,
        message=message,
        events=events,
        situations=situation_responses or None,
        attention_candidate=attention_candidate,
        follow_up_candidate=follow_up_candidate,
        what_changed=what_changed,
        prioritization_ids=prioritization_ids or None,
        top_priority={
            "id": top_priority.id,
            "priority_level": (
                top_priority.priority_level.value
                if hasattr(top_priority.priority_level, "value")
                else str(top_priority.priority_level)
            ),
            "overall_confidence": top_priority.overall_confidence,
            "explanation": top_priority.explanation,
        } if top_priority else None,
        warnings=warnings or None,
    )
