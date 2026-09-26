from __future__ import annotations
from datetime import datetime
from typing import List, Optional, Dict, Any
import json

from fastapi import APIRouter, Depends, HTTPException, Query, Body, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.dementia_reasoning import DementiaReasoningEngine
from app.schemas.dementia import (
    DementiaBaselineCreate,
    DementiaBaselineUpdate,
    DementiaBaselineResponse,
    DementiaObservationCreate,
    DementiaObservationResponse,
    DementiaReasoningRequest,
    DementiaReasoningResponse,
    DementiaBaselineComparisonRequest,
    DementiaBaselineComparisonResponse,
    DementiaCaregiverLanguageAnalysis,
    DementiaCaregiverDisagreementCreate,
    DementiaCaregiverDisagreementResponse,
    DementiaSafetyEventCreate,
    DementiaSafetyEventResponse,
    DementiaReasoningSummary,
    DementiaChangeAssessmentResponse,
    DementiaDocumentAnalysisResponse,
    DementiaDocumentUploadRequest,
    DementiaTimelineAnalysisResponse,
    DementiaCarePlanCreate,
    DementiaCarePlanResponse,
    DementiaCaregiverOnboardingResponse,
)

router = APIRouter(prefix="/dementia", tags=["dementia"])


def get_engine(db: Session = Depends(get_db)) -> DementiaReasoningEngine:
    return DementiaReasoningEngine(db)


@router.post("/baselines", response_model=DementiaBaselineResponse)
def create_baseline(
    baseline: DementiaBaselineCreate,
    engine: DementiaReasoningEngine = Depends(get_engine),
    db: Session = Depends(get_db),
):
    created = engine.create_baseline(baseline)
    db.commit()
    return created


@router.get("/baselines/{person_id}", response_model=List[DementiaBaselineResponse])
def list_baselines(
    person_id: str,
    domain: Optional[str] = Query(None),
    active_only: bool = Query(True),
    engine: DementiaReasoningEngine = Depends(get_engine),
    db: Session = Depends(get_db),
):
    from app.models.dementia import DementiaBaselineModel
    from app.core.dementia_enums import DementiaDomain

    query = db.query(DementiaBaselineModel).filter(DementiaBaselineModel.person_id == person_id)
    if active_only:
        query = query.filter(DementiaBaselineModel.is_active == True)
    if domain:
        query = query.filter(DementiaBaselineModel.domain == DementiaDomain(domain))
    return query.order_by(DementiaBaselineModel.established_date.desc()).all()


@router.get("/baselines/{baseline_id}", response_model=DementiaBaselineResponse)
def get_baseline(
    baseline_id: str,
    db: Session = Depends(get_db),
):
    from app.models.dementia import DementiaBaselineModel
    baseline = db.query(DementiaBaselineModel).filter(DementiaBaselineModel.id == baseline_id).first()
    if not baseline:
        raise HTTPException(status_code=404, detail="Baseline not found")
    return baseline


@router.patch("/baselines/{baseline_id}", response_model=DementiaBaselineResponse)
def update_baseline(
    baseline_id: str,
    update: DementiaBaselineUpdate,
    db: Session = Depends(get_db),
):
    from app.models.dementia import DementiaBaselineModel
    baseline = db.query(DementiaBaselineModel).filter(DementiaBaselineModel.id == baseline_id).first()
    if not baseline:
        raise HTTPException(status_code=404, detail="Baseline not found")

    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(baseline, field, value)

    baseline.updated_at = datetime.now(datetime.timezone.utc)
    db.commit()
    return baseline


@router.post("/observations", response_model=DementiaObservationResponse)
def create_observation(
    observation: DementiaObservationCreate,
    engine: DementiaReasoningEngine = Depends(get_engine),
    db: Session = Depends(get_db),
):
    created = engine.create_observation(observation)
    db.commit()
    return created


@router.get("/observations/{person_id}", response_model=List[DementiaObservationResponse])
def list_observations(
    person_id: str,
    domain: Optional[str] = Query(None),
    days: int = Query(30, ge=1, le=365),
    engine: DementiaReasoningEngine = Depends(get_engine),
    db: Session = Depends(get_db),
):
    from app.models.dementia import DementiaObservationModel
    from app.core.dementia_enums import DementiaDomain

    since = datetime.now(datetime.timezone.utc) - datetime.timedelta(days=days)
    query = db.query(DementiaObservationModel).filter(
        DementiaObservationModel.person_id == person_id,
        DementiaObservationModel.occurred_at >= since,
    )
    if domain:
        query = query.filter(DementiaObservationModel.domain == DementiaDomain(domain))
    return query.order_by(DementiaObservationModel.occurred_at.desc()).all()


@router.post("/reason", response_model=DementiaReasoningResponse)
def reason_about_observation(
    request: DementiaReasoningRequest,
    engine: DementiaReasoningEngine = Depends(get_engine),
    db: Session = Depends(get_db),
):
    result = engine.process_reasoning_request(request)
    db.commit()
    return result


@router.post("/compare-baseline", response_model=DementiaBaselineComparisonResponse)
def compare_to_baseline(
    request: DementiaBaselineComparisonRequest,
    engine: DementiaReasoningEngine = Depends(get_engine),
):
    return engine.compare_to_baseline(
        request.person_id,
        request.domain,
        request.current_observation,
    )


@router.post("/analyze-language", response_model=DementiaCaregiverLanguageAnalysis)
def analyze_caregiver_language(
    text: str = Query(..., min_length=1),
    engine: DementiaReasoningEngine = Depends(get_engine),
):
    return engine.analyze_caregiver_language(text)


@router.post("/caregiver-disagreements", response_model=DementiaCaregiverDisagreementResponse)
def record_caregiver_disagreement(
    disagreement: DementiaCaregiverDisagreementCreate,
    db: Session = Depends(get_db),
):
    from app.models.dementia import DementiaCaregiverDisagreementModel
    record = DementiaCaregiverDisagreementModel(**disagreement.model_dump())
    db.add(record)
    db.commit()
    return record


@router.get("/caregiver-disagreements/{person_id}", response_model=List[DementiaCaregiverDisagreementResponse])
def list_caregiver_disagreements(
    person_id: str,
    unresolved_only: bool = Query(True),
    db: Session = Depends(get_db),
):
    from app.models.dementia import DementiaCaregiverDisagreementModel
    query = db.query(DementiaCaregiverDisagreementModel).filter(
        DementiaCaregiverDisagreementModel.person_id == person_id
    )
    if unresolved_only:
        query = query.filter(DementiaCaregiverDisagreementModel.resolution_status == "unresolved")
    return query.order_by(DementiaCaregiverDisagreementModel.created_at.desc()).all()


@router.post("/safety-events", response_model=DementiaSafetyEventResponse)
def create_safety_event(
    event: DementiaSafetyEventCreate,
    db: Session = Depends(get_db),
):
    from app.models.dementia import DementiaSafetyEventModel
    record = DementiaSafetyEventModel(**event.model_dump())
    db.add(record)
    db.commit()
    return record


@router.get("/safety-events/{person_id}", response_model=List[DementiaSafetyEventResponse])
def list_safety_events(
    person_id: str,
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
):
    from app.models.dementia import DementiaSafetyEventModel
    since = datetime.now(datetime.timezone.utc) - datetime.timedelta(days=days)
    return db.query(DementiaSafetyEventModel).filter(
        DementiaSafetyEventModel.person_id == person_id,
        DementiaSafetyEventModel.created_at >= since,
    ).order_by(DementiaSafetyEventModel.created_at.desc()).all()


@router.get("/summary/{person_id}", response_model=DementiaReasoningSummary)
def get_dementia_summary(
    person_id: str,
    engine: DementiaReasoningEngine = Depends(get_engine),
):
    return engine.get_summary(person_id)


@router.get("/assessments/{person_id}", response_model=List[DementiaChangeAssessmentResponse])
def list_assessments(
    person_id: str,
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
):
    from app.models.dementia import DementiaChangeAssessmentModel
    since = datetime.now(datetime.timezone.utc) - datetime.timedelta(days=days)
    return db.query(DementiaChangeAssessmentModel).filter(
        DementiaChangeAssessmentModel.person_id == person_id,
        DementiaChangeAssessmentModel.assessed_at >= since,
    ).order_by(DementiaChangeAssessmentModel.assessed_at.desc()).all()


@router.post("/analyze-document", response_model=DementiaDocumentAnalysisResponse)
def analyze_document(
    request: DementiaDocumentUploadRequest,
    db: Session = Depends(get_db),
):
    from app.services.dementia_document_analyzer import DementiaDocumentAnalyzer
    analyzer = DementiaDocumentAnalyzer(db)
    result = analyzer.analyze_document(
        person_id=request.person_id,
        text=request.text,
        document_type=request.document_type,
        document_id=None,
        visit_date=request.visit_date,
    )
    db.commit()
    return DementiaDocumentAnalysisResponse(**result)


@router.get("/timeline/{person_id}", response_model=DementiaTimelineAnalysisResponse)
def get_timeline(
    person_id: str,
    days: int = Query(90, ge=1, le=365),
    db: Session = Depends(get_db),
):
    from app.services.dementia_document_analyzer import DementiaDocumentAnalyzer
    analyzer = DementiaDocumentAnalyzer(db)
    result = analyzer.get_timeline_analysis(person_id, days)
    db.commit()
    return DementiaTimelineAnalysisResponse(**result)


@router.post("/analyze-document/file", response_model=DementiaDocumentAnalysisResponse)
def analyze_uploaded_document(
    file: UploadFile = File(...),
    person_id: str = Form(...),
    document_type: str = Form("clinical_note"),
    visit_date: Optional[datetime] = Form(None),
    storage_base_dir: str = "uploads",
    db: Session = Depends(get_db),
):
    from app.services.document_processing import save_uploaded_file, process_and_persist_document
    from app.services.dementia_document_analyzer import DementiaDocumentAnalyzer

    file_content = file.file.read()
    doc = save_uploaded_file(file_content, file.filename, file.content_type, person_id, storage_base_dir)
    db.add(doc)
    db.flush()
    extraction_result = process_and_persist_document(db, doc)

    analyzer = DementiaDocumentAnalyzer(db)
    result = analyzer.analyze_document(
        person_id=person_id,
        text=extraction_result.text,
        document_type=document_type,
        document_id=str(doc.id) if doc.id else None,
        visit_date=visit_date,
    )
    db.commit()
    return DementiaDocumentAnalysisResponse(**result)


@router.post("/care-plans", response_model=DementiaCarePlanResponse)
def generate_care_plan(
    request: DementiaCarePlanCreate,
    db: Session = Depends(get_db),
):
    from app.services.dementia_reasoning import DementiaReasoningEngine
    engine = DementiaReasoningEngine(db)
    plan = engine.generate_care_plan(
        person_id=request.person_id,
        title=request.title,
        description=request.description,
        priority_level=request.priority_level,
        assigned_to=request.assigned_to,
        due_date=request.due_date,
        observation_ids=request.related_observations,
        safety_event_ids=request.related_safety_events,
    )
    actions = json.loads(plan.actions_json or "[]") if plan.actions_json else []
    return DementiaCarePlanResponse(
        id=plan.id,
        person_id=plan.person_id,
        title=plan.title,
        description=plan.description,
        priority_level=plan.priority_level,
        assigned_to=plan.assigned_to,
        due_date=plan.due_date,
        status=plan.status,
        actions=actions,
        related_observations=plan.related_observations or [],
        related_safety_events=plan.related_safety_events or [],
        created_at=plan.created_at,
        updated_at=plan.updated_at,
    )


@router.post("/caregiver-onboarding", response_model=DementiaCaregiverOnboardingResponse)
def init_onboarding(
    person_id: str,
    caregiver_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    from app.services.dementia_reasoning import DementiaReasoningEngine
    engine = DementiaReasoningEngine(db)
    onboarding = engine.init_caregiver_onboarding(person_id, caregiver_id)
    return DementiaCaregiverOnboardingResponse(
        id=onboarding.id,
        person_id=onboarding.person_id,
        caregiver_id=onboarding.caregiver_id,
        status=onboarding.status,
        baseline_questions=json.loads(onboarding.baseline_questions_json or "[]"),
        baseline_progress=json.loads(onboarding.baseline_progress_json or "{}"),
        daily_checkin_questions=json.loads(onboarding.daily_checkin_questions_json or "[]"),
        safety_monitor_items=json.loads(onboarding.safety_monitor_items_json or "[]"),
        emergency_contacts=json.loads(onboarding.emergency_contacts_json or "[]"),
        created_at=onboarding.created_at,
        updated_at=onboarding.updated_at,
    )


@router.get("/caregiver-onboarding/{person_id}", response_model=DementiaCaregiverOnboardingResponse)
def get_onboarding(
    person_id: str,
    db: Session = Depends(get_db),
):
    from app.models.dementia import DementiaCaregiverOnboardingModel
    onboarding = db.query(DementiaCaregiverOnboardingModel).filter(
        DementiaCaregiverOnboardingModel.person_id == person_id
    ).order_by(DementiaCaregiverOnboardingModel.created_at.desc()).first()
    if not onboarding:
        raise HTTPException(status_code=404, detail="No onboarding record found")
    return DementiaCaregiverOnboardingResponse(
        id=onboarding.id,
        person_id=onboarding.person_id,
        caregiver_id=onboarding.caregiver_id,
        status=onboarding.status,
        baseline_questions=json.loads(onboarding.baseline_questions_json or "[]"),
        baseline_progress=json.loads(onboarding.baseline_progress_json or "{}"),
        daily_checkin_questions=json.loads(onboarding.daily_checkin_questions_json or "[]"),
        safety_monitor_items=json.loads(onboarding.safety_monitor_items_json or "[]"),
        emergency_contacts=json.loads(onboarding.emergency_contacts_json or "[]"),
        created_at=onboarding.created_at,
        updated_at=onboarding.updated_at,
    )


@router.post("/caregiver-onboarding/{person_id}/progress", response_model=Dict[str, Any])
def update_onboarding_progress(
    person_id: str,
    progress_update: Dict[str, Any],
    db: Session = Depends(get_db),
):
    from app.services.dementia_reasoning import DementiaReasoningEngine
    engine = DementiaReasoningEngine(db)
    domain = progress_update.get("domain", "general")
    progress_data = {k: v for k, v in progress_update.items() if k != "domain"}
    result = engine.update_onboarding_progress(person_id, domain, progress_data)
    db.commit()
    return result