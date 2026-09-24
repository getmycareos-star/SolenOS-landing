from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Any, Dict
from app.core.revision_enums import (
    RevisionType,
    KnowledgeState,
)


class KnowledgeClaimBase(BaseModel):
    person_id: str
    subject_type: str
    subject_id: Optional[str] = None
    field: str
    value: Optional[str] = None
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    evidence_ids: Optional[List[str]] = None
    context: Optional[List[Dict[str, Any]]] = None


class KnowledgeClaimCreate(KnowledgeClaimBase):
    pass


class KnowledgeClaimUpdate(BaseModel):
    value: Optional[str] = None
    state: Optional[KnowledgeState] = None
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    evidence_ids: Optional[List[str]] = None
    context: Optional[List[Dict[str, Any]]] = None
    is_active: Optional[bool] = None


class KnowledgeClaim(KnowledgeClaimBase):
    id: str
    state: KnowledgeState
    superseded_by_claim_id: Optional[str] = None
    superseded_at: Optional[datetime] = None
    superseded_by_revision_id: Optional[str] = None
    is_active: bool
    recorded_at: datetime
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class KnowledgeRevisionBase(BaseModel):
    person_id: str
    revision_type: RevisionType
    old_claim_id: str
    old_knowledge_type: str
    old_value: Optional[str] = None
    new_claim_id: Optional[str] = None
    new_knowledge_type: Optional[str] = None
    new_value: Optional[str] = None
    evidence_id: Optional[str] = None
    triggering_text: Optional[str] = None
    reason: Optional[str] = None
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    decision_chain: Optional[List[str]] = None
    decisions: Optional[Dict[str, Any]] = None
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    superseded_at: Optional[datetime] = None
    caregiver_id: Optional[str] = None


class KnowledgeRevisionCreate(KnowledgeRevisionBase):
    pass


class KnowledgeRevision(KnowledgeRevisionBase):
    id: str
    outcome: KnowledgeState
    created_at: datetime

    class Config:
        from_attributes = True


class ClaimComparison(BaseModel):
    same_entity: bool
    same_claim: bool
    temporally_applicable: bool
    actually_contradictory: bool
    context_compatible: bool
    explanation: str


class RevisionEvaluationResult(BaseModel):
    evaluation: str
    revision_type: Optional[RevisionType] = None
    old_claim_id: Optional[str] = None
    old_claim_value: Optional[str] = None
    old_claim_state: Optional[str] = None
    new_claim_id: Optional[str] = None
    new_claim_value: Optional[str] = None
    comparison: Optional[ClaimComparison] = None
    decisions: Optional[Dict[str, Any]] = None
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    reason: Optional[str] = None
    applied: bool = False


class RevisionApplyRequest(BaseModel):
    person_id: str
    subject_type: str
    subject_id: Optional[str] = None
    field: str
    new_value: str
    evidence_id: Optional[str] = None
    triggering_text: Optional[str] = None
    context: Optional[List[Dict[str, Any]]] = None
    valid_from: Optional[datetime] = None
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    caregiver_id: Optional[str] = None
    reason: Optional[str] = None


class CurrentKnowledgeEntry(BaseModel):
    claim_id: str
    subject_type: str
    subject_id: Optional[str] = None
    field: str
    value: Optional[str] = None
    state: KnowledgeState
    confidence: Optional[float] = None
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    evidence_ids: Optional[List[str]] = None
    context: Optional[List[Dict[str, Any]]] = None
    recorded_at: datetime


class CurrentKnowledgeView(BaseModel):
    person_id: str
    current_knowledge: List[CurrentKnowledgeEntry]
    historical_knowledge_count: int
    superseded_count: int


class KnowledgeHistoryEntry(BaseModel):
    revision_id: str
    revision_type: Optional[RevisionType] = None
    old_claim_id: str
    old_value: Optional[str] = None
    old_state: Optional[str] = None
    new_claim_id: Optional[str] = None
    new_value: Optional[str] = None
    new_state: Optional[str] = None
    evidence_id: Optional[str] = None
    reason: Optional[str] = None
    confidence: Optional[float] = None
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    superseded_at: Optional[datetime] = None
    decisions: Optional[Dict[str, Any]] = None
    created_at: datetime


class KnowledgeHistoryView(BaseModel):
    person_id: str
    subject_type: str
    subject_id: Optional[str] = None
    field: str
    chain: List[KnowledgeHistoryEntry]
    current_state: Optional[str] = None
    current_value: Optional[str] = None
