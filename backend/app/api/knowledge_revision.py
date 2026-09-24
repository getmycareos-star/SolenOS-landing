from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models.knowledge_revision import (
    KnowledgeClaim as KnowledgeClaimModel,
)
from app.services.knowledge_revision import KnowledgeRevisionEngine
from app.schemas.knowledge_revision import (
    KnowledgeClaimCreate,
    KnowledgeClaim as KnowledgeClaimSchema,
    KnowledgeRevision as KnowledgeRevisionSchema,
    RevisionApplyRequest,
    RevisionEvaluationResult,
    CurrentKnowledgeView,
    KnowledgeHistoryView,
)
from app.core.revision_enums import RevisionType, KnowledgeState


router = APIRouter(prefix="/knowledge-revision", tags=["knowledge-revision"])


def get_engine(db: Session = Depends(get_db)) -> KnowledgeRevisionEngine:
    return KnowledgeRevisionEngine(db)


@router.post("/claims", response_model=KnowledgeClaimSchema)
def create_claim(
    claim: KnowledgeClaimCreate,
    engine: KnowledgeRevisionEngine = Depends(get_engine),
):
    existing = engine.get_current_knowledge(claim.person_id)
    for entry in existing.current_knowledge:
        if (
            entry.subject_type == claim.subject_type
            and entry.subject_id == claim.subject_id
            and entry.field == claim.field
        ):
            raise HTTPException(
                status_code=400,
                detail=f"An active claim already exists for {claim.subject_type}/{claim.subject_id}/{claim.field}. "
                "Use the evaluate or supersede endpoints to revise it.",
            )
    return engine.create_claim(
        person_id=claim.person_id,
        subject_type=claim.subject_type,
        subject_id=claim.subject_id,
        field=claim.field,
        value=claim.value,
        evidence_ids=claim.evidence_ids,
        context=claim.context,
        confidence=claim.confidence,
        valid_from=claim.valid_from,
        caregiver_id=None,
    )


@router.get("/claims/{person_id}", response_model=List[KnowledgeClaimSchema])
def list_claims(
    person_id: str,
    subject_type: Optional[str] = None,
    field: Optional[str] = None,
    include_historical: bool = False,
    engine: KnowledgeRevisionEngine = Depends(get_engine),
):
    query = engine.db.query(KnowledgeClaimModel).filter(
        KnowledgeClaimModel.person_id == person_id
    )
    if subject_type:
        query = query.filter(KnowledgeClaimModel.subject_type == subject_type)
    if field:
        query = query.filter(KnowledgeClaimModel.field == field)
    if not include_historical:
        query = query.filter(KnowledgeClaimModel.is_active.is_(True))
    return query.order_by(KnowledgeClaimModel.created_at.desc()).all()


@router.get("/claims/{person_id}/{claim_id}", response_model=KnowledgeClaimSchema)
def get_claim(
    person_id: str,
    claim_id: str,
    engine: KnowledgeRevisionEngine = Depends(get_engine),
):
    claim = engine.get_claim(person_id, claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    return claim


@router.post("/evaluate", response_model=RevisionEvaluationResult)
def evaluate_revision(
    request: RevisionApplyRequest,
    engine: KnowledgeRevisionEngine = Depends(get_engine),
):
    return engine.record_claim(
        person_id=request.person_id,
        subject_type=request.subject_type,
        subject_id=request.subject_id,
        field=request.field,
        new_value=request.new_value,
        evidence_id=request.evidence_id,
        triggering_text=request.triggering_text,
        context=request.context,
        valid_from=request.valid_from,
        confidence=request.confidence,
        caregiver_id=request.caregiver_id,
        reason=request.reason,
    )


@router.post("/supersede/{claim_id}", response_model=KnowledgeRevisionSchema)
def supersede_claim(
    person_id: str,
    claim_id: str,
    new_value: str,
    evidence_id: Optional[str] = None,
    triggering_text: Optional[str] = None,
    confidence: Optional[float] = None,
    caregiver_id: Optional[str] = None,
    valid_from: Optional[str] = None,
    reason: Optional[str] = None,
    engine: KnowledgeRevisionEngine = Depends(get_engine),
):
    from datetime import datetime

    vf = None
    if valid_from:
        try:
            vf = datetime.fromisoformat(valid_from.replace("Z", "+00:00"))
        except ValueError:
            pass

    revision, new_claim = engine.supersede_claim(
        person_id=person_id,
        old_claim_id=claim_id,
        new_value=new_value,
        evidence_id=evidence_id,
        triggering_text=triggering_text,
        confidence=confidence,
        caregiver_id=caregiver_id,
        reason=reason,
        valid_from=vf,
    )
    return revision


@router.post("/correct/{claim_id}", response_model=KnowledgeRevisionSchema)
def correct_claim(
    person_id: str,
    claim_id: str,
    corrected_value: str,
    evidence_id: Optional[str] = None,
    triggering_text: Optional[str] = None,
    confidence: Optional[float] = None,
    caregiver_id: Optional[str] = None,
    valid_from: Optional[str] = None,
    reason: Optional[str] = None,
    engine: KnowledgeRevisionEngine = Depends(get_engine),
):
    from datetime import datetime

    vf = None
    if valid_from:
        try:
            vf = datetime.fromisoformat(valid_from.replace("Z", "+00:00"))
        except ValueError:
            pass

    revision, new_claim = engine.correct_claim(
        person_id=person_id,
        old_claim_id=claim_id,
        corrected_value=corrected_value,
        evidence_id=evidence_id,
        triggering_text=triggering_text,
        confidence=confidence,
        caregiver_id=caregiver_id,
        reason=reason,
        valid_from=vf,
    )
    return revision


@router.post("/invalidate/{claim_id}", response_model=KnowledgeRevisionSchema)
def invalidate_claim(
    person_id: str,
    claim_id: str,
    evidence_id: Optional[str] = None,
    triggering_text: Optional[str] = None,
    reason: Optional[str] = None,
    caregiver_id: Optional[str] = None,
    valid_from: Optional[str] = None,
    engine: KnowledgeRevisionEngine = Depends(get_engine),
):
    from datetime import datetime

    vf = None
    if valid_from:
        try:
            vf = datetime.fromisoformat(valid_from.replace("Z", "+00:00"))
        except ValueError:
            pass

    revision = engine.invalidate_claim(
        person_id=person_id,
        old_claim_id=claim_id,
        evidence_id=evidence_id,
        triggering_text=triggering_text,
        reason=reason,
        caregiver_id=caregiver_id,
        valid_from=vf,
    )
    return revision


@router.post("/resolve/{claim_id}", response_model=KnowledgeRevisionSchema)
def resolve_claim(
    person_id: str,
    claim_id: str,
    new_value: str,
    evidence_id: Optional[str] = None,
    triggering_text: Optional[str] = None,
    confidence: Optional[float] = None,
    caregiver_id: Optional[str] = None,
    valid_from: Optional[str] = None,
    reason: Optional[str] = None,
    engine: KnowledgeRevisionEngine = Depends(get_engine),
):
    from datetime import datetime

    vf = None
    if valid_from:
        try:
            vf = datetime.fromisoformat(valid_from.replace("Z", "+00:00"))
        except ValueError:
            pass

    revision, new_claim = engine.resolve_claim(
        person_id=person_id,
        old_claim_id=claim_id,
        new_value=new_value,
        evidence_id=evidence_id,
        triggering_text=triggering_text,
        confidence=confidence,
        caregiver_id=caregiver_id,
        reason=reason,
        valid_from=vf,
    )
    return revision


@router.post("/supersede-version/{claim_id}", response_model=KnowledgeRevisionSchema)
def supersede_with_version(
    person_id: str,
    claim_id: str,
    new_value: str,
    evidence_id: Optional[str] = None,
    triggering_text: Optional[str] = None,
    confidence: Optional[float] = None,
    caregiver_id: Optional[str] = None,
    valid_from: Optional[str] = None,
    reason: Optional[str] = None,
    engine: KnowledgeRevisionEngine = Depends(get_engine),
):
    from datetime import datetime

    vf = None
    if valid_from:
        try:
            vf = datetime.fromisoformat(valid_from.replace("Z", "+00:00"))
        except ValueError:
            pass

    revision, new_claim = engine.supersede_with_version(
        person_id=person_id,
        old_claim_id=claim_id,
        new_value=new_value,
        evidence_id=evidence_id,
        triggering_text=triggering_text,
        confidence=confidence,
        caregiver_id=caregiver_id,
        reason=reason,
        valid_from=vf,
    )
    return revision


@router.get("/current/{person_id}", response_model=CurrentKnowledgeView)
def get_current_knowledge(
    person_id: str,
    engine: KnowledgeRevisionEngine = Depends(get_engine),
):
    return engine.get_current_knowledge(person_id)


@router.get("/revisions/{person_id}", response_model=List[KnowledgeRevisionSchema])
def list_revisions(
    person_id: str,
    revision_type: Optional[RevisionType] = None,
    state: Optional[KnowledgeState] = None,
    engine: KnowledgeRevisionEngine = Depends(get_engine),
):
    revisions = engine.get_knowledge_history(person_id)
    if revision_type:
        revisions = [r for r in revisions if r.revision_type == revision_type]
    if state:
        revisions = [r for r in revisions if r.outcome == state]
    return revisions


@router.get("/history/{person_id}/{claim_id}", response_model=KnowledgeHistoryView)
def get_claim_history(
    person_id: str,
    claim_id: str,
    engine: KnowledgeRevisionEngine = Depends(get_engine),
):
    history = engine.get_knowledge_history_for_claim(person_id, claim_id)
    if not history.chain and not history.current_value:
        raise HTTPException(status_code=404, detail="Claim not found or no revision history")
    return history


@router.get("/temporal/{person_id}", response_model=CurrentKnowledgeView)
def get_knowledge_at_time(
    person_id: str,
    point_in_time: str,
    engine: KnowledgeRevisionEngine = Depends(get_engine),
):
    from datetime import datetime

    try:
        point = datetime.fromisoformat(point_in_time.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid point_in_time format")
    return engine.get_knowledge_at_point(person_id, point)
