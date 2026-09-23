from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.core.database import get_db
from app.schemas.meaning import Meaning as MeaningSchema, MeaningResponse
from app.services.meaning import MeaningEngine


router = APIRouter(prefix="/meaning", tags=["meaning"])


def get_engine(db: Session = Depends(get_db)) -> MeaningEngine:
    return MeaningEngine(db)


@router.post("/generate", response_model=MeaningResponse)
def generate_meaning(
    person_id: str,
    change_id: str,
    engine: MeaningEngine = Depends(get_engine),
):
    meaning = engine.generate_meaning(person_id, change_id)
    if not meaning:
        raise HTTPException(
            status_code=404,
            detail="Change not found for this person",
        )
    return MeaningResponse(
        ok=True,
        person_id=person_id,
        meanings=[meaning],
        message=f"Generated meaning for change {change_id}",
    )


@router.post("/generate-from-priority", response_model=MeaningResponse)
def generate_meaning_from_priority(
    person_id: str,
    priority_id: str,
    engine: MeaningEngine = Depends(get_engine),
):
    meaning = engine.generate_meaning_from_priority(person_id, priority_id)
    if not meaning:
        raise HTTPException(
            status_code=404,
            detail="Priority or associated change not found",
        )
    return MeaningResponse(
        ok=True,
        person_id=person_id,
        meanings=[meaning],
        message=f"Generated meaning from priority {priority_id}",
    )


@router.post("/generate-all", response_model=MeaningResponse)
def generate_all_meanings(
    person_id: str,
    reference_time: Optional[str] = None,
    engine: MeaningEngine = Depends(get_engine),
):
    ref_time = datetime.fromisoformat(reference_time.replace("Z", "+00:00")) if reference_time else None
    meanings = engine.generate_all_meanings(person_id, ref_time)
    return MeaningResponse(
        ok=True,
        person_id=person_id,
        meanings=meanings,
        message=f"Generated {len(meanings)} meaning(s) for person {person_id}",
    )


@router.get("/{person_id}", response_model=List[MeaningSchema])
def list_meanings(
    person_id: str,
    engine: MeaningEngine = Depends(get_engine),
):
    return engine.list_meanings(person_id)


@router.get("/item/{meaning_id}", response_model=MeaningSchema)
def get_meaning(
    meaning_id: str,
    engine: MeaningEngine = Depends(get_engine),
):
    meaning = engine.get_meaning(meaning_id)
    if not meaning:
        raise HTTPException(status_code=404, detail="Meaning not found")
    return meaning
