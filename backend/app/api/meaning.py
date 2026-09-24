"""API endpoints for the Meaning/Contextual Understanding Engine."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas.meaning import (
    MeaningGenerateAllRequest,
    MeaningGenerateFromPriorityRequest,
    MeaningGenerateRequest,
    MeaningListResponse,
    MeaningResponse,
)
from app.services.meaning import MeaningEngine

router = APIRouter(prefix="/api/v1/meaning", tags=["meaning"])
engine = MeaningEngine()


@router.post("/generate", response_model=MeaningResponse)
async def generate_meaning(request: MeaningGenerateRequest) -> MeaningResponse:
    """Generate meaning for a person."""
    result = engine.generate(
        person_id=request.person_id,
        change_id=request.change_id,
        priority_id=request.priority_id,
    )

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="No meaningful data found for this person",
        )

    return MeaningResponse(
        id=result.id,
        person_id=result.person_id,
        what_is_happening=result.what_is_happening,
        epistemic_level=result.epistemic_level,
        rationale=result.rationale,
        confidence=result.confidence,
        confidence_type=result.confidence_type,
        evidence_confidence=result.evidence_confidence,
        changes=[c.model_dump() for c in result.changes],
        contradictions=[c.model_dump() for c in result.contradictions],
        information_gaps=[g.model_dump() for g in result.information_gaps],
        open_questions=[q.model_dump() for q in result.open_questions],
        causal_hypotheses=[h.model_dump() for h in result.causal_hypotheses],
        caregiver_attribution=result.caregiver_attribution,
        created_at=result.created_at,
    )


@router.post("/generate-from-priority", response_model=MeaningResponse)
async def generate_from_priority(
    request: MeaningGenerateFromPriorityRequest,
) -> MeaningResponse:
    """Generate meaning from a priority assessment."""
    result = engine.generate_from_priority(
        person_id=request.person_id,
        priority_id=request.priority_id,
    )

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="No meaningful data found for this priority",
        )

    return MeaningResponse(
        id=result.id,
        person_id=result.person_id,
        what_is_happening=result.what_is_happening,
        epistemic_level=result.epistemic_level,
        rationale=result.rationale,
        confidence=result.confidence,
        confidence_type=result.confidence_type,
        evidence_confidence=result.evidence_confidence,
        changes=[c.model_dump() for c in result.changes],
        contradictions=[c.model_dump() for c in result.contradictions],
        information_gaps=[g.model_dump() for g in result.information_gaps],
        open_questions=[q.model_dump() for q in result.open_questions],
        causal_hypotheses=[h.model_dump() for h in result.causal_hypotheses],
        caregiver_attribution=result.caregiver_attribution,
        created_at=result.created_at,
    )


@router.post("/generate-all", response_model=MeaningListResponse)
async def generate_all(request: MeaningGenerateAllRequest) -> MeaningListResponse:
    """Generate all meanings for a person."""
    results = engine.generate_all(person_id=request.person_id)

    items = [
        MeaningResponse(
            id=r.id,
            person_id=r.person_id,
            what_is_happening=r.what_is_happening,
            epistemic_level=r.epistemic_level,
            rationale=r.rationale,
            confidence=r.confidence,
            confidence_type=r.confidence_type,
            evidence_confidence=r.evidence_confidence,
            changes=[c.model_dump() for c in r.changes],
            contradictions=[c.model_dump() for c in r.contradictions],
            information_gaps=[g.model_dump() for g in r.information_gaps],
            open_questions=[q.model_dump() for q in r.open_questions],
            causal_hypotheses=[h.model_dump() for h in r.causal_hypotheses],
            caregiver_attribution=r.caregiver_attribution,
            created_at=r.created_at,
        )
        for r in results
    ]

    return MeaningListResponse(
        person_id=request.person_id,
        count=len(items),
        items=items,
    )


@router.get("/{person_id}", response_model=MeaningListResponse)
async def get_meanings_by_person(person_id: str) -> MeaningListResponse:
    """Get all meanings for a person."""
    results = engine.generate_all(person_id=person_id)

    items = [
        MeaningResponse(
            id=r.id,
            person_id=r.person_id,
            what_is_happening=r.what_is_happening,
            epistemic_level=r.epistemic_level,
            rationale=r.rationale,
            confidence=r.confidence,
            confidence_type=r.confidence_type,
            evidence_confidence=r.evidence_confidence,
            changes=[c.model_dump() for c in r.changes],
            contradictions=[c.model_dump() for c in r.contradictions],
            information_gaps=[g.model_dump() for g in r.information_gaps],
            open_questions=[q.model_dump() for q in r.open_questions],
            causal_hypotheses=[h.model_dump() for h in r.causal_hypotheses],
            caregiver_attribution=r.caregiver_attribution,
            created_at=r.created_at,
        )
        for r in results
    ]

    return MeaningListResponse(
        person_id=person_id,
        count=len(items),
        items=items,
    )


@router.get("/item/{meaning_id}", response_model=MeaningResponse)
async def get_meaning_by_id(meaning_id: str) -> MeaningResponse:
    """Get a single meaning by ID."""
    raise HTTPException(
        status_code=404,
        detail=f"Meaning {meaning_id} not found",
    )
