from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session

from app.models.knowledge_revision import (
    KnowledgeClaim as KnowledgeClaimModel,
    KnowledgeRevision as KnowledgeRevisionModel,
)
from app.core.revision_enums import RevisionType, KnowledgeState
from app.schemas.knowledge_revision import (
    RevisionEvaluationResult,
    ClaimComparison,
    CurrentKnowledgeView,
    CurrentKnowledgeEntry,
    KnowledgeHistoryView,
    KnowledgeHistoryEntry,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


_EXPLICIT_SUPERSESSION_PATTERNS = [
    re.compile(r"\bincreas\w*.*\bto\s+\S", re.I),
    re.compile(r"\bchange\s+(?:dose|to)\s+\S", re.I),
    re.compile(r"\bstop\b", re.I),
    re.compile(r"\bdiscontinue\b", re.I),
    re.compile(r"\breduc\w*.*\bto\s+\S", re.I),
    re.compile(r"\bdecreas\w*.*\bto\s+\S", re.I),
    re.compile(r"\bnew\s+dose\s+is\s+\S", re.I),
    re.compile(r"\bfrom\s+\S+\s+to\s+\S", re.I),
]

_CORRECTION_PATTERNS = [
    re.compile(r"\bcorrection\b", re.I),
    re.compile(r"\bnot\s+(\S+)\b", re.I),
]

_VERSION_PATTERNS = [
    re.compile(r"\b(?:final|revised|updated|new)\b.*\bsummary\b", re.I),
    re.compile(r"\bdraft\b.*\bfinal\b", re.I),
]

_RESOLUTION_PATTERNS = [
    re.compile(r"\bcompleted\b", re.I),
    re.compile(r"\bresolved\b", re.I),
    re.compile(r"\bclosed\b", re.I),
]

_INVALIDATION_PATTERNS = [
    re.compile(r"\bn(?:o|one)\s+(?:known\s+)?(?:allerg|medication\s+allerg)", re.I),
    re.compile(r"\b(?:developed|has)\s+(?:an\s+)?allerg", re.I),
    re.compile(r"\bnegative\b.*\bfor\b", re.I),
]

_UPDATE_PATTERNS = [
    re.compile(r"\bnow\s+(?:uses|needs|takes|on)", re.I),
    re.compile(r"\bcurrently\s+", re.I),
    re.compile(r"\bat\s+present\b", re.I),
    re.compile(r"\bpreviously\b.*\bnow\b", re.I),
]

_AMBIGUITY_MARKERS = [
    "seems", "appears", "might", "maybe", "possibly", "perhaps",
    "could", "may", "uncertain", "unsure", "not sure", "apparently",
    "reportedly", "allegedly", "vague", "unclear", "tentative",
]


class KnowledgeRevisionEngine:
    def __init__(self, db: Session):
        self.db = db

    # --- Claim management ---

    def create_claim(
        self,
        person_id: str,
        subject_type: str,
        subject_id: str,
        field: str,
        value: str,
        evidence_ids: list[str] | None = None,
        context: list[dict] | dict | None = None,
        valid_from: datetime | None = None,
        valid_until: datetime | None = None,
        confidence: float | None = None,
        caregiver_id: str | None = None,
    ) -> KnowledgeClaimModel:
        claim = KnowledgeClaimModel(
            person_id=person_id,
            subject_type=subject_type,
            subject_id=subject_id,
            field=field,
            value=value,
            confidence=confidence or 1.0,
            valid_from=valid_from,
            valid_until=valid_until,
            evidence_ids=evidence_ids,
            context=context,
            state=KnowledgeState.CURRENT,
            is_active=True,
            recorded_at=_utc_now(),
        )
        self.db.add(claim)
        self.db.flush()
        return claim

    def record_claim(
        self, person_id: str, subject_type: str, subject_id: Optional[str], field: str,
        new_value: str, evidence_id: Optional[str] = None,
        triggering_text: Optional[str] = None,
        context: Optional[List[dict]] = None,
        valid_from: Optional[datetime] = None,
        confidence: Optional[float] = None,
        caregiver_id: Optional[str] = None,
        reason: Optional[str] = None,
    ) -> RevisionEvaluationResult:
        """Create or revise a knowledge claim based on new evidence.

        This implements the revision hierarchy:
          1. Same entity?
          2. Same claim? (same field)
          3. Temporally applicable?
          4. Actually contradictory?
          5. Can relationship be established?

        If no existing active claim exists for this entity+field, a new claim is created.
        If an existing claim is found, the comparison runs and a revision is applied
        or uncertainty/conflict is preserved.
        """
        existing = self._find_active_claim(
            person_id, subject_type, subject_id, field
        )

        if not existing:
            broader = self._find_invalidatable_broader_claim(
                person_id, subject_type, subject_id, field, new_value
            )
            if broader:
                self.invalidate_claim(
                    person_id=person_id,
                    old_claim_id=broader.id,
                    evidence_id=evidence_id,
                    triggering_text=triggering_text,
                    reason=f"Specific positive finding '{new_value}' invalidates general negative claim '{broader.value}'",
                    valid_from=valid_from,
                    caregiver_id=caregiver_id,
                )
                new_claim = self.create_claim(
                    person_id=person_id,
                    subject_type=subject_type,
                    subject_id=subject_id,
                    field=field,
                    value=new_value,
                    evidence_ids=[evidence_id] if evidence_id else None,
                    context=context,
                    confidence=confidence,
                    valid_from=valid_from,
                    caregiver_id=caregiver_id,
                )
                self.db.commit()
                return RevisionEvaluationResult(
                    evaluation="invalidation_and_new_claim",
                    old_claim_id=broader.id,
                    old_claim_value=broader.value,
                    old_claim_state=KnowledgeState.INVALIDATED.value,
                    new_claim_id=new_claim.id,
                    new_claim_value=new_claim.value,
                    revision_type=RevisionType.INVALIDATION,
                    confidence=confidence,
                    reason=f"New positive finding '{new_value}' invalidates broader claim '{broader.value}'.",
                    applied=True,
                )
            new_claim = self.create_claim(
                person_id=person_id,
                subject_type=subject_type,
                subject_id=subject_id,
                field=field,
                value=new_value,
                evidence_ids=[evidence_id] if evidence_id else None,
                context=context,
                confidence=confidence,
                valid_from=valid_from,
                caregiver_id=caregiver_id,
            )
            self.db.commit()
            return RevisionEvaluationResult(
                evaluation="new_claim_created",
                new_claim_id=new_claim.id,
                new_claim_value=new_claim.value,
                confidence=confidence,
                reason="No existing claim found; created new knowledge claim.",
                applied=True,
            )

        comparison = self._compare_claims(
            existing, new_value, evidence_id, triggering_text, context, valid_from
        )

        if self._is_ambiguous(triggering_text, new_value):
            self.db.commit()
            return RevisionEvaluationResult(
                evaluation="uncertainty_preserved",
                old_claim_id=existing.id,
                old_claim_value=existing.value,
                old_claim_state=existing.state.value,
                comparison=comparison,
                decisions=comparison.model_dump(),
                confidence=confidence,
                reason="New evidence contains ambiguous or hedging language; uncertainty preserved.",
                applied=False,
            )

        revision_type = self._determine_revision_type(
            comparison, triggering_text, existing.value, new_value
        )

        if comparison.same_entity and comparison.same_claim and comparison.context_compatible and (
            comparison.temporally_applicable or revision_type == RevisionType.CORRECTION
        ):
            if revision_type is not None:
                new_claim = self._create_new_claim_and_supersede(
                    person_id=person_id,
                    subject_type=subject_type,
                    subject_id=subject_id,
                    field=field,
                    new_value=new_value,
                    old_claim=existing,
                    evidence_id=evidence_id,
                    triggering_text=triggering_text,
                    context=context,
                    valid_from=valid_from,
                    confidence=confidence,
                    caregiver_id=caregiver_id,
                    revision_type=revision_type,
                    comparison=comparison,
                    reason=reason,
                )
                self.db.commit()
                return RevisionEvaluationResult(
                    evaluation=f"{revision_type.value}_applied",
                    revision_type=revision_type,
                    old_claim_id=existing.id,
                    old_claim_value=existing.value,
                    old_claim_state=existing.state.value,
                    new_claim_id=new_claim.id,
                    new_claim_value=new_claim.value,
                    comparison=comparison,
                    decisions=comparison.model_dump(),
                    confidence=confidence,
                    reason=reason,
                    applied=True,
                )

        if comparison.actually_contradictory and not comparison.context_compatible:
            self._record_conflict(
                person_id, subject_type, subject_id, field,
                existing, new_value, evidence_id, triggering_text, context,
            )
            self.db.commit()
            return RevisionEvaluationResult(
                evaluation="conflict_recorded",
                old_claim_id=existing.id,
                old_claim_value=existing.value,
                old_claim_state=existing.state.value,
                comparison=comparison,
                decisions=comparison.model_dump(),
                reason="New evidence conflicts with existing claim but context differs; conflict preserved.",
                applied=False,
            )

        if comparison.actually_contradictory and comparison.context_compatible:
            self._record_conflict(
                person_id, subject_type, subject_id, field,
                existing, new_value, evidence_id, triggering_text, context,
            )
            self.db.commit()
            return RevisionEvaluationResult(
                evaluation="conflict_recorded",
                old_claim_id=existing.id,
                old_claim_value=existing.value,
                old_claim_state=existing.state.value,
                comparison=comparison,
                decisions=comparison.model_dump(),
                reason="Contradictory reports exist for the same entity/claim/time; not automatically resolved.",
                applied=False,
            )

        if not comparison.temporally_applicable:
            self.db.commit()
            return RevisionEvaluationResult(
                evaluation="temporal_overlap",
                old_claim_id=existing.id,
                old_claim_value=existing.value,
                old_claim_state=existing.state.value,
                comparison=comparison,
                decisions=comparison.model_dump(),
                reason="New evidence is not temporally after the existing claim; preserving both.",
                applied=False,
            )

        if not comparison.same_entity or not comparison.same_claim:
            self.db.commit()
            return RevisionEvaluationResult(
                evaluation="uncertainty_preserved",
                old_claim_id=existing.id,
                old_claim_value=existing.value,
                old_claim_state=existing.state.value,
                comparison=comparison,
                decisions=comparison.model_dump(),
                reason="New evidence refers to a different entity or claim field; not superseding.",
                applied=False,
            )

        if not comparison.context_compatible:
            self.db.commit()
            return RevisionEvaluationResult(
                evaluation="context_preserved",
                old_claim_id=existing.id,
                old_claim_value=existing.value,
                old_claim_state=existing.state.value,
                comparison=comparison,
                decisions=comparison.model_dump(),
                reason="New evidence has a different context; both claims preserved.",
                applied=False,
            )

        self.db.commit()
        return RevisionEvaluationResult(
            evaluation="uncertainty_preserved",
            old_claim_id=existing.id,
            old_claim_value=existing.value,
            old_claim_state=existing.state.value,
            comparison=comparison,
            decisions=comparison.model_dump(),
            reason="Relationship could not be established; uncertainty preserved.",
            applied=False,
        )

    # --- Explicit supersession / correction / invalidation ---

    def supersede_claim(
        self,
        person_id: str,
        old_claim_id: str,
        new_value: str,
        evidence_id: Optional[str] = None,
        triggering_text: Optional[str] = None,
        confidence: Optional[float] = None,
        caregiver_id: Optional[str] = None,
        reason: Optional[str] = None,
        valid_from: Optional[datetime] = None,
    ) -> Tuple[KnowledgeRevisionModel, KnowledgeClaimModel]:
        old_claim = self._fetch_claim(person_id, old_claim_id)
        revision = KnowledgeRevisionModel(
            person_id=person_id,
            revision_type=RevisionType.SUPERSEDE,
            outcome=KnowledgeState.SUPERSEDED,
            old_claim_id=old_claim.id,
            old_knowledge_type="knowledge_claim",
            old_value=old_claim.value,
            new_knowledge_type="knowledge_claim",
            evidence_id=evidence_id,
            triggering_text=triggering_text,
            reason=reason or "Explicit supersession",
            confidence=confidence,
            valid_from=valid_from or old_claim.valid_from,
            valid_until=valid_from or _utc_now(),
            superseded_at=_utc_now(),
            caregiver_id=caregiver_id,
        )
        self.db.add(revision)
        self.db.flush()

        old_claim.state = KnowledgeState.SUPERSEDED
        old_claim.superseded_by_claim_id = None
        old_claim.superseded_at = _utc_now()
        old_claim.superseded_by_revision_id = revision.id
        old_claim.is_active = False
        self.db.add(old_claim)

        new_claim = KnowledgeClaimModel(
            person_id=person_id,
            subject_type=old_claim.subject_type,
            subject_id=old_claim.subject_id,
            field=old_claim.field,
            value=new_value,
            confidence=confidence,
            valid_from=valid_from or _utc_now(),
            evidence_ids=[evidence_id] if evidence_id else None,
            context=old_claim.context,
            state=KnowledgeState.CURRENT,
            is_active=True,
            recorded_at=_utc_now(),
        )
        self.db.add(new_claim)
        self.db.flush()

        old_claim.superseded_by_claim_id = new_claim.id
        self.db.commit()

        revision.new_claim_id = new_claim.id
        revision.new_value = new_value
        self.db.commit()

        self.db.refresh(revision)
        self.db.refresh(old_claim)
        self.db.refresh(new_claim)
        return revision, new_claim

    def correct_claim(
        self,
        person_id: str,
        old_claim_id: str,
        corrected_value: str,
        evidence_id: Optional[str] = None,
        triggering_text: Optional[str] = None,
        confidence: Optional[float] = None,
        caregiver_id: Optional[str] = None,
        reason: Optional[str] = None,
        valid_from: Optional[datetime] = None,
    ) -> Tuple[KnowledgeRevisionModel, KnowledgeClaimModel]:
        old_claim = self._fetch_claim(person_id, old_claim_id)
        revision = KnowledgeRevisionModel(
            person_id=person_id,
            revision_type=RevisionType.CORRECTION,
            outcome=KnowledgeState.CORRECTED,
            old_claim_id=old_claim.id,
            old_knowledge_type="knowledge_claim",
            old_value=old_claim.value,
            new_knowledge_type="knowledge_claim",
            evidence_id=evidence_id,
            triggering_text=triggering_text,
            reason=reason or "Correction applied",
            confidence=confidence,
            valid_from=old_claim.valid_from,
            valid_until=valid_from or _utc_now(),
            superseded_at=_utc_now(),
            caregiver_id=caregiver_id,
        )
        self.db.add(revision)
        self.db.flush()

        old_claim.state = KnowledgeState.CORRECTED
        old_claim.superseded_by_claim_id = None
        old_claim.superseded_at = _utc_now()
        old_claim.superseded_by_revision_id = revision.id
        old_claim.is_active = False
        self.db.add(old_claim)

        new_claim = KnowledgeClaimModel(
            person_id=person_id,
            subject_type=old_claim.subject_type,
            subject_id=old_claim.subject_id,
            field=old_claim.field,
            value=corrected_value,
            confidence=confidence,
            valid_from=valid_from or _utc_now(),
            evidence_ids=[evidence_id] if evidence_id else None,
            context=old_claim.context,
            state=KnowledgeState.CURRENT,
            is_active=True,
            recorded_at=_utc_now(),
        )
        self.db.add(new_claim)
        self.db.flush()

        old_claim.superseded_by_claim_id = new_claim.id
        self.db.commit()

        revision.new_claim_id = new_claim.id
        revision.new_value = corrected_value
        self.db.commit()

        self.db.refresh(revision)
        self.db.refresh(old_claim)
        self.db.refresh(new_claim)
        return revision, new_claim

    def invalidate_claim(
        self,
        person_id: str,
        old_claim_id: str,
        evidence_id: Optional[str] = None,
        triggering_text: Optional[str] = None,
        reason: Optional[str] = None,
        caregiver_id: Optional[str] = None,
        valid_from: Optional[datetime] = None,
    ) -> KnowledgeRevisionModel:
        old_claim = self._fetch_claim(person_id, old_claim_id)
        revision = KnowledgeRevisionModel(
            person_id=person_id,
            revision_type=RevisionType.INVALIDATION,
            outcome=KnowledgeState.INVALIDATED,
            old_claim_id=old_claim.id,
            old_knowledge_type="knowledge_claim",
            old_value=old_claim.value,
            new_knowledge_type="knowledge_claim",
            evidence_id=evidence_id,
            triggering_text=triggering_text,
            reason=reason or "Claim invalidated by new evidence",
            confidence=None,
            valid_from=old_claim.valid_from,
            valid_until=valid_from or _utc_now(),
            superseded_at=_utc_now(),
            caregiver_id=caregiver_id,
        )
        self.db.add(revision)

        old_claim.state = KnowledgeState.INVALIDATED
        old_claim.superseded_by_claim_id = None
        old_claim.superseded_at = _utc_now()
        old_claim.superseded_by_revision_id = revision.id
        old_claim.is_active = False
        self.db.commit()
        self.db.refresh(revision)
        self.db.refresh(old_claim)
        return revision

    def resolve_claim(
        self,
        person_id: str,
        old_claim_id: str,
        new_value: str,
        evidence_id: Optional[str] = None,
        triggering_text: Optional[str] = None,
        confidence: Optional[float] = None,
        caregiver_id: Optional[str] = None,
        reason: Optional[str] = None,
        valid_from: Optional[datetime] = None,
    ) -> Tuple[KnowledgeRevisionModel, KnowledgeClaimModel]:
        old_claim = self._fetch_claim(person_id, old_claim_id)
        revision = KnowledgeRevisionModel(
            person_id=person_id,
            revision_type=RevisionType.RESOLUTION,
            outcome=KnowledgeState.RESOLVED,
            old_claim_id=old_claim.id,
            old_knowledge_type="knowledge_claim",
            old_value=old_claim.value,
            new_knowledge_type="knowledge_claim",
            evidence_id=evidence_id,
            triggering_text=triggering_text,
            reason=reason or "Open item resolved",
            confidence=confidence,
            valid_from=old_claim.valid_from,
            valid_until=valid_from or _utc_now(),
            superseded_at=_utc_now(),
            caregiver_id=caregiver_id,
        )
        self.db.add(revision)
        self.db.flush()

        old_claim.state = KnowledgeState.RESOLVED
        old_claim.superseded_by_claim_id = None
        old_claim.superseded_at = _utc_now()
        old_claim.superseded_by_revision_id = revision.id
        old_claim.is_active = False
        self.db.add(old_claim)

        new_claim = KnowledgeClaimModel(
            person_id=person_id,
            subject_type=old_claim.subject_type,
            subject_id=old_claim.subject_id,
            field=old_claim.field,
            value=new_value,
            confidence=confidence,
            valid_from=valid_from or _utc_now(),
            evidence_ids=[evidence_id] if evidence_id else None,
            context=old_claim.context,
            state=KnowledgeState.CURRENT,
            is_active=True,
            recorded_at=_utc_now(),
        )
        self.db.add(new_claim)
        self.db.flush()

        old_claim.superseded_by_claim_id = new_claim.id
        self.db.commit()

        revision.new_claim_id = new_claim.id
        revision.new_value = new_value
        self.db.commit()

        self.db.refresh(revision)
        self.db.refresh(old_claim)
        self.db.refresh(new_claim)
        return revision, new_claim

    def supersede_with_version(
        self,
        person_id: str,
        old_claim_id: str,
        new_value: str,
        evidence_id: Optional[str] = None,
        triggering_text: Optional[str] = None,
        confidence: Optional[float] = None,
        caregiver_id: Optional[str] = None,
        reason: Optional[str] = None,
        valid_from: Optional[datetime] = None,
    ) -> Tuple[KnowledgeRevisionModel, KnowledgeClaimModel]:
        old_claim = self._fetch_claim(person_id, old_claim_id)
        revision = KnowledgeRevisionModel(
            person_id=person_id,
            revision_type=RevisionType.VERSION_SUPERSESSION,
            outcome=KnowledgeState.SUPERSEDED,
            old_claim_id=old_claim.id,
            old_knowledge_type="knowledge_claim",
            old_value=old_claim.value,
            new_knowledge_type="knowledge_claim",
            evidence_id=evidence_id,
            triggering_text=triggering_text,
            reason=reason or "Document version superseded",
            confidence=confidence,
            valid_from=old_claim.valid_from,
            valid_until=valid_from or _utc_now(),
            superseded_at=_utc_now(),
            caregiver_id=caregiver_id,
        )
        self.db.add(revision)
        self.db.flush()

        old_claim.state = KnowledgeState.SUPERSEDED
        old_claim.superseded_by_claim_id = None
        old_claim.superseded_at = _utc_now()
        old_claim.superseded_by_revision_id = revision.id
        old_claim.is_active = False
        self.db.add(old_claim)

        new_claim = KnowledgeClaimModel(
            person_id=person_id,
            subject_type=old_claim.subject_type,
            subject_id=old_claim.subject_id,
            field=old_claim.field,
            value=new_value,
            confidence=confidence,
            valid_from=valid_from or _utc_now(),
            evidence_ids=[evidence_id] if evidence_id else None,
            context=old_claim.context,
            state=KnowledgeState.CURRENT,
            is_active=True,
            recorded_at=_utc_now(),
        )
        self.db.add(new_claim)
        self.db.flush()

        old_claim.superseded_by_claim_id = new_claim.id
        self.db.commit()

        revision.new_claim_id = new_claim.id
        revision.new_value = new_value
        self.db.commit()

        self.db.refresh(revision)
        self.db.refresh(old_claim)
        self.db.refresh(new_claim)
        return revision, new_claim

    # --- Querying / reconstruction ---

    def get_current_knowledge(self, person_id: str) -> CurrentKnowledgeView:
        claims = (
            self.db.query(KnowledgeClaimModel)
            .filter(
                KnowledgeClaimModel.person_id == person_id,
                KnowledgeClaimModel.is_active.is_(True),
            )
            .all()
        )

        historical = (
            self.db.query(KnowledgeClaimModel)
            .filter(
                KnowledgeClaimModel.person_id == person_id,
                KnowledgeClaimModel.is_active.is_(False),
            )
            .count()
        )

        current_entries = [
            CurrentKnowledgeEntry(
                claim_id=c.id,
                subject_type=c.subject_type,
                subject_id=c.subject_id,
                field=c.field,
                value=c.value,
                state=c.state.value,
                confidence=c.confidence,
                valid_from=c.valid_from,
                valid_until=c.valid_until,
                evidence_ids=c.evidence_ids,
                context=c.context,
                recorded_at=c.recorded_at,
            )
            for c in claims
        ]

        superseded_count = sum(1 for c in claims if c.state in (KnowledgeState.SUPERSEDED, KnowledgeState.HISTORICAL, KnowledgeState.CORRECTED, KnowledgeState.INVALIDATED, KnowledgeState.RESOLVED))

        return CurrentKnowledgeView(
            person_id=person_id,
            current_knowledge=current_entries,
            historical_knowledge_count=historical,
            superseded_count=superseded_count,
        )

    def get_knowledge_at_point(self, person_id: str, point_in_time: datetime) -> CurrentKnowledgeView:
        point = _ensure_utc(point_in_time)
        all_claims = (
            self.db.query(KnowledgeClaimModel)
            .filter(KnowledgeClaimModel.person_id == person_id)
            .order_by(KnowledgeClaimModel.created_at.asc())
            .all()
        )

        active_at_point = []
        for c in all_claims:
            valid_from = _ensure_utc(c.valid_from) if c.valid_from else c.created_at
            valid_until = _ensure_utc(c.valid_until) if c.valid_until else None

            if valid_from and valid_from > point:
                continue
            if valid_until and valid_until <= point:
                continue
            active_at_point.append(c)

        historical_count = len(all_claims) - len(active_at_point)
        current_entries = [
            CurrentKnowledgeEntry(
                claim_id=c.id,
                subject_type=c.subject_type,
                subject_id=c.subject_id,
                field=c.field,
                value=c.value,
                state=c.state.value,
                confidence=c.confidence,
                valid_from=c.valid_from,
                valid_until=c.valid_until,
                evidence_ids=c.evidence_ids,
                context=c.context,
                recorded_at=c.recorded_at,
            )
            for c in active_at_point
        ]

        return CurrentKnowledgeView(
            person_id=person_id,
            current_knowledge=current_entries,
            historical_knowledge_count=historical_count,
            superseded_count=0,
        )

    def get_knowledge_history(
        self, person_id: str, subject_type: Optional[str] = None,
        subject_id: Optional[str] = None, field: Optional[str] = None,
    ) -> List[KnowledgeRevisionModel]:
        query = self.db.query(KnowledgeRevisionModel).filter(
            KnowledgeRevisionModel.person_id == person_id
        )
        if subject_type:
            query = query.filter(KnowledgeRevisionModel.new_knowledge_type == "knowledge_claim")
            query = query.join(KnowledgeClaimModel, KnowledgeClaimModel.id == KnowledgeRevisionModel.old_claim_id)
            query = query.filter(KnowledgeClaimModel.subject_type == subject_type)
        if subject_id:
            query = query.join(KnowledgeClaimModel, KnowledgeClaimModel.id == KnowledgeRevisionModel.old_claim_id)
            query = query.filter(KnowledgeClaimModel.subject_id == subject_id)
        if field:
            query = query.join(KnowledgeClaimModel, KnowledgeClaimModel.id == KnowledgeRevisionModel.old_claim_id)
            query = query.filter(KnowledgeClaimModel.field == field)
        return query.order_by(KnowledgeRevisionModel.created_at.desc()).all()

    def get_knowledge_history_for_claim(self, person_id: str, claim_id: str) -> KnowledgeHistoryView:
        claim = self.db.query(KnowledgeClaimModel).filter(
            KnowledgeClaimModel.id == claim_id,
            KnowledgeClaimModel.person_id == person_id,
        ).first()
        if not claim:
            return KnowledgeHistoryView(
                person_id=person_id,
                subject_type="",
                field="",
                chain=[],
            )

        chain: List[KnowledgeHistoryEntry] = []
        current: Optional[KnowledgeClaimModel] = claim
        seen_ids: set = set()

        while current and current.id not in seen_ids:
            seen_ids.add(current.id)

            revision = None
            if current.superseded_by_revision_id:
                revision = self.db.query(KnowledgeRevisionModel).filter(
                    KnowledgeRevisionModel.id == current.superseded_by_revision_id
                ).first()

            next_claim = None
            if current.superseded_by_claim_id:
                next_claim = self.db.query(KnowledgeClaimModel).filter(
                    KnowledgeClaimModel.id == current.superseded_by_claim_id
                ).first()

            chain.append(KnowledgeHistoryEntry(
                revision_id=revision.id if revision else "",
                revision_type=revision.revision_type if revision else None,
                old_claim_id=current.id,
                old_value=current.value,
                old_state=current.state.value,
                new_claim_id=next_claim.id if next_claim else None,
                new_value=next_claim.value if next_claim else None,
                new_state=next_claim.state.value if next_claim else None,
                evidence_id=revision.evidence_id if revision else None,
                reason=revision.reason if revision else None,
                confidence=revision.confidence if revision else None,
                valid_from=current.valid_from,
                valid_until=current.valid_until,
                superseded_at=current.superseded_at,
                decisions=revision.decisions if revision else None,
                created_at=revision.created_at if revision else current.created_at,
            ))

            current = next_claim

        current_claim = self.db.query(KnowledgeClaimModel).filter(
            KnowledgeClaimModel.person_id == person_id,
            KnowledgeClaimModel.subject_type == claim.subject_type,
            KnowledgeClaimModel.subject_id == claim.subject_id,
            KnowledgeClaimModel.field == claim.field,
            KnowledgeClaimModel.is_active.is_(True),
        ).first()

        return KnowledgeHistoryView(
            person_id=person_id,
            subject_type=claim.subject_type,
            subject_id=claim.subject_id,
            field=claim.field,
            chain=chain,
            current_state=current_claim.state.value if current_claim else None,
            current_value=current_claim.value if current_claim else None,
        )

    def get_all_claims(self, person_id: str) -> List[KnowledgeClaimModel]:
        return (
            self.db.query(KnowledgeClaimModel)
            .filter(KnowledgeClaimModel.person_id == person_id)
            .order_by(KnowledgeClaimModel.created_at.desc())
            .all()
        )

    def get_claim(self, person_id: str, claim_id: str) -> Optional[KnowledgeClaimModel]:
        return self.db.query(KnowledgeClaimModel).filter(
            KnowledgeClaimModel.id == claim_id,
            KnowledgeClaimModel.person_id == person_id,
        ).first()

    # --- Internal: comparison logic ---

    def _find_active_claim(self, person_id: str, subject_type: str,
                           subject_id: Optional[str], field: str
                           ) -> Optional[KnowledgeClaimModel]:
        query = self.db.query(KnowledgeClaimModel).filter(
            KnowledgeClaimModel.person_id == person_id,
            KnowledgeClaimModel.subject_type == subject_type,
            KnowledgeClaimModel.field == field,
            KnowledgeClaimModel.is_active.is_(True),
        )
        if subject_id is not None:
            query = query.filter(KnowledgeClaimModel.subject_id == subject_id)
        else:
            query = query.filter(KnowledgeClaimModel.subject_id.is_(None))
        return query.order_by(KnowledgeClaimModel.created_at.desc()).first()

    def _find_invalidatable_broader_claim(
        self,
        person_id: str,
        subject_type: str,
        subject_id: str,
        field: str,
        new_value: str,
    ) -> Optional[KnowledgeClaimModel]:
        """Search for broader claims with the same subject_type and field but a different subject_id
        that are negated and therefore invalidated by a positive finding."""
        if not subject_id or self._is_negated(new_value):
            return None
        broader = self.db.query(KnowledgeClaimModel).filter(
            KnowledgeClaimModel.person_id == person_id,
            KnowledgeClaimModel.subject_type == subject_type,
            KnowledgeClaimModel.field == field,
            KnowledgeClaimModel.is_active.is_(True),
            KnowledgeClaimModel.subject_id != subject_id,
        ).order_by(KnowledgeClaimModel.created_at.desc()).all()
        for claim in broader:
            if self._is_negated(claim.value):
                return claim
        return None

    def _find_claims_for_entity(self, person_id: str, subject_type: str,
                                subject_id: Optional[str]) -> List[KnowledgeClaimModel]:
        query = self.db.query(KnowledgeClaimModel).filter(
            KnowledgeClaimModel.person_id == person_id,
            KnowledgeClaimModel.subject_type == subject_type,
        )
        if subject_id is not None:
            query = query.filter(KnowledgeClaimModel.subject_id == subject_id)
        return query.order_by(KnowledgeClaimModel.created_at.desc()).all()

    def _compare_claims(
        self,
        old_claim: KnowledgeClaimModel,
        new_value: str,
        evidence_id: Optional[str],
        triggering_text: Optional[str],
        new_context: Optional[List[dict]],
        valid_from: Optional[datetime],
    ) -> ClaimComparison:
        same_entity = True

        same_claim = True

        temporally_applicable = True
        old_valid_from = _ensure_utc(old_claim.valid_from)
        new_valid_from = _ensure_utc(valid_from)
        if old_valid_from and new_valid_from:
            temporally_applicable = new_valid_from > old_valid_from
        elif old_valid_from:
            temporally_applicable = True

        old_valid_until = _ensure_utc(old_claim.valid_until)
        if old_valid_until and new_valid_from:
            temporally_applicable = new_valid_from > old_valid_until

        context_compatible = self._contexts_compatible(old_claim.context, new_context)

        actually_contradictory = self._values_conflict(old_claim.value, new_value)

        if not context_compatible and actually_contradictory:
            explanation = (
                f"New evidence '{new_value}' conflicts with old claim '{old_claim.value}' "
                f"but the contexts differ; preserving as uncertainty/conflict."
            )
        elif actually_contradictory and context_compatible:
            explanation = (
                f"New evidence '{new_value}' directly conflicts with old claim '{old_claim.value}'. "
            )
        elif not temporally_applicable:
            explanation = "New evidence is not temporally after the existing claim; temporal validity would overlap."
        elif not context_compatible:
            explanation = "New evidence refers to the same entity/claim but has a different context; both preserved."
        else:
            explanation = (
                f"New evidence '{new_value}' is compatible with old claim '{old_claim.value}'; "
                "relationship can be established."
            )

        return ClaimComparison(
            same_entity=same_entity,
            same_claim=same_claim,
            temporally_applicable=temporally_applicable,
            actually_contradictory=actually_contradictory,
            context_compatible=context_compatible,
            explanation=explanation,
        )

    def _values_conflict(self, old_value: Optional[str], new_value: str) -> bool:
        if old_value is None:
            return False
        old_norm = self._normalize_value(old_value)
        new_norm = self._normalize_value(new_value)
        if old_norm == new_norm:
            return False
        if self._is_numeric_pair(old_norm, new_norm):
            return True
        old_negated = self._is_negated(old_norm)
        new_negated = self._is_negated(new_norm)
        if old_negated != new_negated:
            return True
        return False

    def _normalize_value(self, value: str) -> str:
        v = re.sub(r"\s+", " ", value.strip().lower())
        return v

    def _is_numeric_pair(self, old_val: str, new_val: str) -> bool:
        old_num = re.search(r"(\d+(?:\.\d+)?)", old_val)
        new_num = re.search(r"(\d+(?:\.\d+)?)", new_val)
        if old_num and new_num:
            return old_num.group(1) != new_num.group(1)
        return False

    def _is_negated(self, value: str) -> bool:
        negation_markers = [
            r"\bno\b", r"\bnot\b", r"\bnone\b", r"\bnever\b", r"\bwithout\b",
            r"\babsent\b", r"\bnegative\b", r"\bdenies\b", r"\bdiscontinued\b",
        ]
        return any(re.search(m, value) for m in negation_markers)

    def _contexts_compatible(self, old_context: Optional[list[dict] | dict], new_context: Optional[list[dict] | dict]) -> bool:
        if not old_context and not new_context:
            return True
        if not old_context or not new_context:
            return True
        old_set = self._context_to_set(old_context)
        new_set = self._context_to_set(new_context)
        new_specific = new_set - old_set
        if new_specific:
            return False
        return True

    def _context_to_set(self, context: list[dict] | dict | None) -> set:
        result = set()
        if context is None:
            return result
        if isinstance(context, dict):
            context = [context]
        for item in context:
            if isinstance(item, dict):
                for k, v in item.items():
                    result.add((k, str(v)))
            elif isinstance(item, str):
                result.add(("label", item))
        return result

    def _is_ambiguous(self, triggering_text: Optional[str], new_value: str) -> bool:
        text_lower = (triggering_text or "").lower()
        value_lower = new_value.lower()
        combined = f"{text_lower} {value_lower}"
        return any(marker in combined for marker in _AMBIGUITY_MARKERS)

    def _has_explicit_revision_language(self, triggering_text: str) -> bool:
        text_lower = triggering_text.lower()
        return any(
            p.search(text_lower)
            for p in _EXPLICIT_SUPERSESSION_PATTERNS
        )

    def _determine_revision_type(
        self, comparison: ClaimComparison, triggering_text: Optional[str],
        old_value: Optional[str], new_value: str,
    ) -> Optional[RevisionType]:
        if triggering_text:
            text_lower = triggering_text.lower()
            if any(p.search(text_lower) for p in _CORRECTION_PATTERNS):
                return RevisionType.CORRECTION
            if any(p.search(text_lower) for p in _VERSION_PATTERNS):
                return RevisionType.VERSION_SUPERSESSION
            if any(p.search(text_lower) for p in _RESOLUTION_PATTERNS):
                return RevisionType.RESOLUTION
            if any(p.search(text_lower) for p in _INVALIDATION_PATTERNS):
                return RevisionType.INVALIDATION
            if any(p.search(text_lower) for p in _EXPLICIT_SUPERSESSION_PATTERNS):
                return RevisionType.SUPERSEDE
            if any(p.search(text_lower) for p in _UPDATE_PATTERNS):
                return RevisionType.UPDATE

        if comparison.actually_contradictory:
            if old_value and self._is_negated(self._normalize_value(old_value)) != self._is_negated(self._normalize_value(new_value)):
                return RevisionType.INVALIDATION
            if triggering_text and not self._has_explicit_revision_language(triggering_text):
                return None
            return RevisionType.SUPERSEDE

        return RevisionType.UPDATE

    def _record_conflict(
        self, person_id: str, subject_type: str, subject_id: Optional[str], field: str,
        old_claim: KnowledgeClaimModel, new_value: str,
        evidence_id: Optional[str], triggering_text: Optional[str],
        context: Optional[List[dict]],
    ) -> None:
        from app.models.uncertainty import Contradiction as ContradictionModel

        evidence_ids = list(old_claim.evidence_ids or [])
        if evidence_id:
            evidence_ids.append(evidence_id)

        contradiction = ContradictionModel(
            person_id=person_id,
            subject_type=subject_type,
            subject_id=subject_id or "",
            field=field,
            description=(
                f"Conflicting knowledge: old claim '{old_claim.value}' vs new evidence '{new_value}'. "
                "This requires investigation rather than automatic supersession."
            ),
            evidence_ids=evidence_ids,
            resolution_status="unresolved",
        )
        self.db.add(contradiction)

    def _fetch_claim(self, person_id: str, claim_id: str) -> KnowledgeClaimModel:
        claim = self.db.query(KnowledgeClaimModel).filter(
            KnowledgeClaimModel.id == claim_id,
            KnowledgeClaimModel.person_id == person_id,
        ).first()
        if not claim:
            raise ValueError(f"Knowledge claim {claim_id} not found for person {person_id}")
        return claim

    def _create_new_claim_and_supersede(
        self,
        person_id: str,
        subject_type: str,
        subject_id: Optional[str],
        field: str,
        new_value: str,
        old_claim: KnowledgeClaimModel,
        evidence_id: Optional[str],
        triggering_text: Optional[str],
        context: Optional[List[dict]],
        valid_from: Optional[datetime],
        confidence: Optional[float],
        caregiver_id: Optional[str],
        revision_type: RevisionType,
        comparison: ClaimComparison,
        reason: Optional[str],
    ) -> KnowledgeClaimModel:
        new_claim = KnowledgeClaimModel(
            person_id=person_id,
            subject_type=subject_type,
            subject_id=subject_id,
            field=field,
            value=new_value,
            confidence=confidence,
            valid_from=valid_from or old_claim.valid_from,
            evidence_ids=[evidence_id] if evidence_id else old_claim.evidence_ids,
            context=context or old_claim.context,
            state=KnowledgeState.CURRENT,
            is_active=True,
            recorded_at=_utc_now(),
        )
        self.db.add(new_claim)
        self.db.flush()

        outcome = KnowledgeState.CURRENT
        if revision_type == RevisionType.CORRECTION:
            outcome = KnowledgeState.CORRECTED
            old_claim.state = KnowledgeState.CORRECTED
        elif revision_type == RevisionType.INVALIDATION:
            outcome = KnowledgeState.INVALIDATED
            old_claim.state = KnowledgeState.INVALIDATED
        elif revision_type == RevisionType.RESOLUTION:
            outcome = KnowledgeState.RESOLVED
            old_claim.state = KnowledgeState.RESOLVED
        elif revision_type == RevisionType.VERSION_SUPERSESSION:
            outcome = KnowledgeState.HISTORICAL
            old_claim.state = KnowledgeState.HISTORICAL
        elif revision_type == RevisionType.SUPERSEDE:
            outcome = KnowledgeState.SUPERSEDED
            old_claim.state = KnowledgeState.SUPERSEDED
        elif revision_type == RevisionType.UPDATE:
            outcome = KnowledgeState.SUPERSEDED
            old_claim.state = KnowledgeState.SUPERSEDED

        old_claim.is_active = False
        old_claim.superseded_by_claim_id = new_claim.id
        old_claim.superseded_at = _utc_now()
        self.db.add(old_claim)

        revision = KnowledgeRevisionModel(
            id=str(uuid.uuid4()),
            person_id=person_id,
            revision_type=revision_type,
            outcome=outcome,
            old_claim_id=old_claim.id,
            old_knowledge_type="knowledge_claim",
            old_value=old_claim.value,
            new_claim_id=new_claim.id,
            new_knowledge_type="knowledge_claim",
            new_value=new_value,
            evidence_id=evidence_id,
            triggering_text=triggering_text,
            reason=reason,
            confidence=confidence,
            decisions={
                "same_entity": comparison.same_entity,
                "same_claim": comparison.same_claim,
                "temporally_applicable": comparison.temporally_applicable,
                "actually_contradictory": comparison.actually_contradictory,
                "context_compatible": comparison.context_compatible,
            },
            valid_from=old_claim.valid_from,
            valid_until=valid_from or _utc_now(),
            superseded_at=_utc_now(),
            caregiver_id=caregiver_id,
        )
        old_claim.superseded_by_revision_id = revision.id
        self.db.add(old_claim)
        self.db.add(revision)
        self.db.flush()
        return new_claim
