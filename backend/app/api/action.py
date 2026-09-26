"""API endpoints for the Action Intelligence Engine."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.core.action_enums import ActionStatus as ActStatus, SafetyClassification
from app.models.meaning import (
    Change,
    ClinicianInstruction,
    Contradiction,
    CareAppointment,
    Evidence,
    InformationGap,
    MeaningOutput,
    OpenQuestion,
    PriorityAssessment,
    SignificanceAssessment,
)
from app.schemas.action import (
    ActionGenerateRequest,
    ActionGenerateResponse,
    ActionListResponse,
    ActionSchema,
    ActionSetSchema,
    ActionUpdateRequest,
    ActionHistoryResponse,
    ActionSupersedeRequest,
    ErrorResponse,
)
from app.services.action import ActionEngine

router = APIRouter(prefix="/api/v1/action", tags=["action"])
engine = ActionEngine()

# In-memory storage for demo (replace with database persistence)
_action_sets: dict[str, ActionSetSchema] = {}
_action_history: dict[str, list] = {}


@router.post("/generate", response_model=ActionGenerateResponse)
async def generate_actions(request: ActionGenerateRequest) -> ActionGenerateResponse:
    """Generate actions from structured reasoning state.

    Accepts full structured state from Tasks 1-5 (changes, evidence,
    contradictions, priorities, significance, clinician instructions, etc.)
    or reference IDs to fetch pre-computed meaning state.
    """
    try:
        # If full meaning is provided, use it directly
        meaning = None
        if request.meaning:
            meaning = MeaningOutput(**request.meaning)
            action_set = engine.generate_actions(
                person_id=request.person_id,
                meaning=meaning,
            )
        else:
            # Build structured objects from dict input
            changes = [Change(**d) for d in request.changes]
            evidence_list = [Evidence(**d) for d in request.evidence]
            contradictions = [Contradiction(**d) for d in request.contradictions]
            information_gaps = [InformationGap(**d) for d in request.information_gaps]
            open_questions = [OpenQuestion(**d) for d in request.open_questions]
            significance_assessments = [SignificanceAssessment(**d) for d in request.significance_assessments]
            priorities = [PriorityAssessment(**d) for d in request.priorities]
            clinician_instructions = [ClinicianInstruction(**d) for d in request.clinician_instructions]
            upcoming_appointments = [CareAppointment(**d) for d in request.upcoming_appointments]

            action_set = engine.generate_actions(
                person_id=request.person_id,
                meaning=None,
                changes=changes,
                priorities=priorities,
                significance_assessments=significance_assessments,
                evidence_list=evidence_list,
                contradictions=contradictions,
                information_gaps=information_gaps,
                open_questions=open_questions,
                clinician_instructions=clinician_instructions,
                upcoming_appointments=upcoming_appointments,
            )

        # Convert to schema
        action_set_schema = ActionSetSchema(
            id=action_set.id,
            person_id=action_set.person_id,
            meaning_id=action_set.meaning_id,
            actions=[ActionSchema.model_validate(a.model_dump()) for a in action_set.actions],
            generated_at=action_set.generated_at,
            source_reasoning=action_set.source_reasoning,
            ask_count=action_set.ask_count,
            check_count=action_set.check_count,
            monitor_count=action_set.monitor_count,
            do_count=action_set.do_count,
            prepare_count=action_set.prepare_count,
            document_count=action_set.document_count,
            professional_input_count=action_set.professional_input_count,
            escalation_count=action_set.escalation_count,
            highest_priority=action_set.highest_priority,
            highest_safety=action_set.highest_safety,
            has_insufficient_evidence=action_set.has_insufficient_evidence,
        )

        _action_sets[action_set.id] = action_set_schema
        _action_history[action_set.id] = []

        return ActionGenerateResponse(
            action_set_id=action_set.id,
            person_id=action_set.person_id,
            actions=action_set_schema.actions,
            generated_at=action_set.generated_at,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Action generation failed: {str(e)}")


@router.get("/set/{action_set_id}", response_model=ActionSetSchema)
async def get_action_set(action_set_id: str) -> ActionSetSchema:
    """Get a complete action set by ID."""
    if action_set_id not in _action_sets:
        raise HTTPException(status_code=404, detail=f"Action set {action_set_id} not found")
    return _action_sets[action_set_id]


@router.get("/person/{person_id}", response_model=ActionListResponse)
async def get_actions_by_person(person_id: str) -> ActionListResponse:
    """Get all actions for a person."""
    items = []
    for action_set in _action_sets.values():
        if action_set.person_id == person_id:
            items.extend(action_set.actions)

    return ActionListResponse(
        person_id=person_id,
        count=len(items),
        items=items,
    )


@router.get("/{action_id}", response_model=ActionSchema)
async def get_action_by_id(action_id: str) -> ActionSchema:
    """Get a single action by ID."""
    for action_set in _action_sets.values():
        for action in action_set.actions:
            if action.id == action_id:
                return action
    raise HTTPException(status_code=404, detail=f"Action {action_id} not found")


@router.patch("/{action_id}/status", response_model=ActionSchema)
async def update_action_status(
    action_id: str,
    request: ActionUpdateRequest,
) -> ActionSchema:
    """Update an action's status."""
    for action_set in _action_sets.values():
        for action in action_set.actions:
            if action.id == action_id:
                old_status = action.status
                action.status = request.status

                if request.status == ActStatus.ACKNOWLEDGED:
                    action.acknowledged_at = datetime.utcnow()
                elif request.status == ActStatus.COMPLETED:
                    action.completed_at = datetime.utcnow()

                # Record history
                history_entry = {
                    "id": f"ah_{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}",
                    "action_id": action_id,
                    "person_id": action.person_id,
                    "change_type": request.status.value,
                    "previous_state": {"status": old_status.value},
                    "new_state": {"status": request.status.value},
                    "reason": request.completion_notes,
                    "triggered_by": request.acknowledged_by or "caregiver",
                    "timestamp": datetime.utcnow(),
                }
                if action_set.id in _action_history:
                    _action_history[action_set.id].append(history_entry)

                return action

    raise HTTPException(status_code=404, detail=f"Action {action_id} not found")


@router.post("/{action_id}/supersede", response_model=ActionSchema)
async def supersede_action(
    action_id: str,
    request: ActionSupersedeRequest,
) -> ActionSchema:
    """Mark an action as superseded by another action."""
    for action_set in _action_sets.values():
        for action in action_set.actions:
            if action.id == action_id:
                old_status = action.status
                action.status = ActStatus.SUPERSEDED
                action.superseded_by = request.superseded_by_id
                action.superseded_at = datetime.utcnow()
                action.superseded_reason = request.reason

                # Record history
                history_entry = {
                    "id": f"ah_{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}",
                    "action_id": action_id,
                    "person_id": action.person_id,
                    "change_type": "superseded",
                    "previous_state": {"status": old_status.value, "superseded_by": None},
                    "new_state": {
                        "status": ActStatus.SUPERSEDED.value,
                        "superseded_by": request.superseded_by_id,
                        "superseded_at": action.superseded_at,
                    },
                    "reason": request.reason,
                    "triggered_by": "system",
                    "timestamp": datetime.utcnow(),
                }
                if action_set.id in _action_history:
                    _action_history[action_set.id].append(history_entry)

                return action

    raise HTTPException(status_code=404, detail=f"Action {action_id} not found")


@router.get("/{action_id}/history", response_model=ActionHistoryResponse)
async def get_action_history(action_id: str) -> ActionHistoryResponse:
    """Get history for an action."""
    items = []
    for action_set_id, history in _action_history.items():
        for entry in history:
            if entry["action_id"] == action_id:
                items.append(ActionHistoryEntrySchema(**entry))

    if not items:
        raise HTTPException(status_code=404, detail=f"No history found for action {action_id}")

    return ActionHistoryResponse(
        action_id=action_id,
        count=len(items),
        items=items,
    )


@router.get("/person/{person_id}/summary")
async def get_action_summary(person_id: str) -> dict:
    """Get a caregiver-facing summary grouped by action type."""
    actions = []
    for action_set in _action_sets.values():
        if action_set.person_id == person_id:
            actions.extend(action_set.actions)

    summary = {
        "person_id": person_id,
        "total_actions": len(actions),
        "by_type": {
            "ask": [],
            "check": [],
            "monitor": [],
            "do": [],
            "prepare": [],
            "document": [],
            "professional_input": [],
            "escalation": [],
        },
        "highest_priority": "low",
        "highest_safety": "routine",
        "has_insufficient_evidence": False,
    }

    priority_order = {"immediate": 5, "urgent": 4, "routine": 3, "low": 2, "deferred": 1}
    safety_order = {
        "potential_urgent_concern": 5,
        "prompt_professional_review": 4,
        "attention_worthy": 3,
        "routine": 2,
        "insufficient_evidence": 1,
    }

    max_priority = 0
    max_safety = 0

    for action in actions:
        action_type = action.action_type.value
        if action_type in summary["by_type"]:
            summary["by_type"][action_type].append({
                "id": action.id,
                "title": action.title,
                "what": action.what,
                "why": action.why,
                "based_on": action.based_on,
                "who": action.who,
                "when": action.when,
                "what_we_dont_know": action.what_we_dont_know,
                "what_solenos_is_not_concluding": action.what_solenos_is_not_concluding,
                "priority": action.priority.value,
                "safety": action.safety_classification.value,
                "confidence": action.confidence,
                "uncertainty": action.uncertainty,
                "status": action.status.value,
            })

        p_val = priority_order.get(action.priority.value, 0)
        s_val = safety_order.get(action.safety_classification.value, 0)
        max_priority = max(max_priority, p_val)
        max_safety = max(max_safety, s_val)

        if action.safety_classification == SafetyClassification.INSUFFICIENT_EVIDENCE:
            summary["has_insufficient_evidence"] = True

    # Reverse map
    priority_rev = {v: k for k, v in priority_order.items()}
    safety_rev = {v: k for k, v in safety_order.items()}
    summary["highest_priority"] = priority_rev.get(max_priority, "low")
    summary["highest_safety"] = safety_rev.get(max_safety, "routine")

    return summary