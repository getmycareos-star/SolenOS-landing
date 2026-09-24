from sqlalchemy import Column, String, DateTime, Text, Boolean, Float, ForeignKey, Enum as SQLEnum
from sqlalchemy.sql import func
import uuid
from app.core.database import Base
from app.core.types import JSONList
from app.core.revision_enums import RevisionType, KnowledgeState


class KnowledgeClaim(Base):
    __tablename__ = "knowledge_claims"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    person_id = Column(String, ForeignKey("persons.id"), nullable=False, index=True)

    subject_type = Column(String, nullable=False)
    subject_id = Column(String, nullable=True)
    field = Column(String, nullable=False)

    value = Column(Text, nullable=True)

    state = Column(SQLEnum(KnowledgeState), nullable=False, default=KnowledgeState.CURRENT)
    confidence = Column(Float, nullable=True)

    valid_from = Column(DateTime(timezone=True), nullable=True)
    valid_until = Column(DateTime(timezone=True), nullable=True)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())

    evidence_ids = Column(JSONList, nullable=True)
    context = Column(JSONList, nullable=True)

    superseded_by_claim_id = Column(String, nullable=True)
    superseded_at = Column(DateTime(timezone=True), nullable=True)
    superseded_by_revision_id = Column(String, nullable=True)

    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class KnowledgeRevision(Base):
    __tablename__ = "knowledge_revisions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    person_id = Column(String, ForeignKey("persons.id"), nullable=False, index=True)

    revision_type = Column(SQLEnum(RevisionType), nullable=False)
    outcome = Column(SQLEnum(KnowledgeState), nullable=False, default=KnowledgeState.REVISED)

    old_claim_id = Column(String, ForeignKey("knowledge_claims.id"), nullable=False)
    old_knowledge_type = Column(String, nullable=False)
    old_value = Column(Text, nullable=True)

    new_claim_id = Column(String, ForeignKey("knowledge_claims.id"), nullable=True)
    new_knowledge_type = Column(String, nullable=True)
    new_value = Column(Text, nullable=True)

    evidence_id = Column(String, ForeignKey("evidence.id"), nullable=True)
    triggering_text = Column(Text, nullable=True)

    reason = Column(Text, nullable=True)
    confidence = Column(Float, nullable=True)

    decision_chain = Column(JSONList, nullable=True)
    decisions = Column(JSONList, nullable=True)

    valid_from = Column(DateTime(timezone=True), nullable=True)
    valid_until = Column(DateTime(timezone=True), nullable=True)
    superseded_at = Column(DateTime(timezone=True), nullable=True)

    caregiver_id = Column(String, ForeignKey("caregivers.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
