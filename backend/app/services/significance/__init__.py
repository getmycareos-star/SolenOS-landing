"""Significance assessment service — no hard-coded values."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from app.core.meaning_enums import SignificanceLevel
from app.models.meaning import Change, SignificanceAssessment


class SignificanceService:
    """Assesses significance of changes — no hard-coded values."""

    def assess(
        self,
        change: Change,
        person_id: str,
        rationale: str = "",
        supporting_evidence_ids: Optional[list[str]] = None,
    ) -> SignificanceAssessment:
        """Assess the significance of a change."""
        significance_level = self._classify_significance(change)
        confidence = self._calculate_confidence(change)

        return SignificanceAssessment(
            id=f"sig_{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}",
            person_id=person_id,
            change_id=change.id,
            significance_level=significance_level,
            confidence=confidence,
            rationale=rationale,
            supporting_evidence_ids=supporting_evidence_ids or [],
        )

    def _classify_significance(self, change: Change) -> SignificanceLevel:
        """Classify significance based on change magnitude."""
        if change.previous_value is None or change.current_value is None:
            return SignificanceLevel.UNKNOWN

        try:
            prev = float(change.previous_value)
            curr = float(change.current_value)
            if prev == 0:
                pct_change = 1.0 if curr != 0 else 0.0
            else:
                pct_change = abs((curr - prev) / prev)
        except (ValueError, TypeError):
            return SignificanceLevel.UNKNOWN

        if pct_change >= 0.5:
            return SignificanceLevel.CRITICAL
        if pct_change >= 0.2:
            return SignificanceLevel.HIGH
        if pct_change >= 0.1:
            return SignificanceLevel.MODERATE
        if pct_change > 0:
            return SignificanceLevel.LOW
        return SignificanceLevel.NONE

    def _calculate_confidence(self, change: Change) -> float:
        """Calculate confidence in the significance assessment."""
        if change.previous_value is None or change.current_value is None:
            return 0.0
        if not change.evidence_ids:
            return 0.5
        return 0.8