from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.prioritization import PrioritizationRanking as PrioritizationRankingModel
from app.schemas.prioritization import (
    Prioritization,
    PrioritizationDetectRequest,
    PrioritizationRankRequest,
    PrioritizationRankingInput,
    PrioritizationResponse,
)
from app.services.prioritization import PrioritizationEngine


router = APIRouter(prefix="/prioritization", tags=["prioritization"])


def _response(
    db: Session,
    person_id: str,
    prioritizations: List[Prioritization],
    message: str,
) -> PrioritizationResponse:
    engine = PrioritizationEngine(db)
    rankings = engine.rank(person_id, prioritizations) if prioritizations else []
    if prioritizations:
        db.commit()
    return PrioritizationResponse(
        ok=True,
        person_id=person_id,
        prioritizations=prioritizations,
        rankings=rankings,
        message=message,
        warnings=[],
    )


def _require_person_id(value: Optional[str]) -> str:
    if not value:
        raise HTTPException(status_code=400, detail="person_id is required")
    return value


def _record_explicit_rankings(
    db: Session,
    person_id: str,
    inputs: List[PrioritizationRankingInput],
) -> List[PrioritizationRankingModel]:
    engine = PrioritizationEngine(db)
    ranks = set()
    rankings = []
    for item in inputs:
        if item.rank in ranks:
            raise HTTPException(status_code=400, detail="ranking values must be unique")
        ranks.add(item.rank)
        prioritization = engine.get_prioritization(person_id, item.prioritization_id)
        if not prioritization:
            raise HTTPException(status_code=404, detail="Prioritization not found")
        existing = (
            db.query(PrioritizationRankingModel)
            .filter(
                PrioritizationRankingModel.person_id == person_id,
                PrioritizationRankingModel.prioritization_id == item.prioritization_id,
            )
            .order_by(PrioritizationRankingModel.created_at.desc())
            .first()
        )
        if existing:
            existing.rank = item.rank
            existing.reason = item.reason
            ranking = existing
        else:
            ranking = PrioritizationRankingModel(
                person_id=person_id,
                prioritization_id=item.prioritization_id,
                rank=item.rank,
                reason=item.reason,
            )
            db.add(ranking)
        rankings.append(ranking)
    db.commit()
    return rankings


@router.get("/detect", response_model=PrioritizationResponse)
def detect_prioritization_get(
    person_id: str = Query(...),
    subject_type: Optional[str] = Query(None),
    subject_id: Optional[str] = Query(None),
    reference_time: Optional[str] = Query(None),
    db: Session = Depends(get_db),
) -> PrioritizationResponse:
    engine = PrioritizationEngine(db)
    prioritizations = engine.detect(
        person_id,
        subject_type,
        subject_id,
        reference_time,
    )
    return _response(db, person_id, prioritizations, "Prioritizations detected")


@router.post("/detect", response_model=PrioritizationResponse)
def detect_prioritization_post(
    payload: Optional[PrioritizationDetectRequest] = None,
    person_id: Optional[str] = Query(None),
    subject_type: Optional[str] = Query(None),
    subject_id: Optional[str] = Query(None),
    reference_time: Optional[str] = Query(None),
    db: Session = Depends(get_db),
) -> PrioritizationResponse:
    selected_person_id = _require_person_id(payload.person_id if payload else person_id)
    selected_subject_type = subject_type or (payload.subject_type if payload else None)
    selected_subject_id = subject_id if subject_id is not None else (payload.subject_id if payload else None)
    selected_reference_time = reference_time or (payload.reference_time if payload else None)
    engine = PrioritizationEngine(db)
    prioritizations = engine.detect(
        selected_person_id,
        selected_subject_type,
        selected_subject_id,
        selected_reference_time,
    )
    return _response(db, selected_person_id, prioritizations, "Prioritizations detected")


@router.get("/rank", response_model=PrioritizationResponse)
def rank_prioritizations_get(
    person_id: str = Query(...),
    prioritization_ids: Optional[List[str]] = Query(None),
    db: Session = Depends(get_db),
) -> PrioritizationResponse:
    engine = PrioritizationEngine(db)
    prioritizations = engine.list_prioritizations(person_id)
    if prioritization_ids:
        allowed = set(prioritization_ids)
        prioritizations = [item for item in prioritizations if item.id in allowed]
    return _response(db, person_id, prioritizations, "Prioritizations ranked")


@router.post("/rank", response_model=PrioritizationResponse)
def rank_prioritizations_post(
    payload: Optional[PrioritizationRankRequest] = None,
    person_id: Optional[str] = Query(None),
    prioritization_ids: Optional[List[str]] = Query(None),
    db: Session = Depends(get_db),
) -> PrioritizationResponse:
    selected_person_id = _require_person_id((payload.person_id if payload else None) or person_id)
    engine = PrioritizationEngine(db)
    inputs = (payload.rankings if payload and payload.rankings else None) or (
        payload.prioritizations if payload else None
    )
    if inputs:
        rankings = _record_explicit_rankings(db, selected_person_id, inputs)
        prioritizations = [
            engine.get_prioritization(selected_person_id, item.prioritization_id)
            for item in inputs
        ]
        prioritizations = [item for item in prioritizations if item]
        return PrioritizationResponse(
            ok=True,
            person_id=selected_person_id,
            prioritizations=prioritizations,
            rankings=rankings,
            message="Prioritization rankings recorded",
            warnings=[],
        )

    prioritizations = engine.list_prioritizations(selected_person_id)
    selected_ids = prioritization_ids or (payload.prioritization_ids if payload else None)
    if selected_ids:
        allowed = set(selected_ids)
        prioritizations = [item for item in prioritizations if item.id in allowed]
    return _response(db, selected_person_id, prioritizations, "Prioritizations ranked")


@router.get("/{person_id}", response_model=List[Prioritization])
def list_prioritizations(
    person_id: str,
    subject_type: Optional[str] = Query(None),
    subject_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
) -> List[Prioritization]:
    return PrioritizationEngine(db).list_prioritizations(
        person_id,
        subject_type,
        subject_id,
    )


@router.get("/{person_id}/rank", response_model=PrioritizationResponse)
def rank_person_prioritizations(
    person_id: str,
    db: Session = Depends(get_db),
) -> PrioritizationResponse:
    engine = PrioritizationEngine(db)
    prioritizations = engine.list_prioritizations(person_id)
    return _response(db, person_id, prioritizations, "Prioritizations ranked")


@router.get("/{person_id}/{prioritization_id}", response_model=Prioritization)
def get_prioritization(
    person_id: str,
    prioritization_id: str,
    db: Session = Depends(get_db),
) -> Prioritization:
    prioritization = PrioritizationEngine(db).get_prioritization(person_id, prioritization_id)
    if not prioritization:
        raise HTTPException(status_code=404, detail="Prioritization not found")
    return prioritization
