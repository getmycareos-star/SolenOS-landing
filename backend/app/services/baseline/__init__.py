"""Baseline management service — no hard-coded values."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from app.models.meaning import Baseline, Evidence


class BaselineService:
    """Manages baseline measurements — no hard-coded values."""

    def establish_baseline(
        self,
        person_id: str,
        measurement_type: str,
        value: float,
        unit: str,
        source_evidence_id: Optional[str] = None,
    ) -> Baseline:
        """Establish a new baseline measurement."""
        return Baseline(
            id=f"bl_{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}",
            person_id=person_id,
            measurement_type=measurement_type,
            value=value,
            unit=unit,
            source_evidence_id=source_evidence_id,
        )

    def get_baseline(
        self,
        baselines: list[Baseline],
        measurement_type: str,
    ) -> Optional[Baseline]:
        """Get the baseline for a measurement type."""
        for baseline in baselines:
            if baseline.measurement_type == measurement_type:
                return baseline
        return None

    def establish_from_evidence(
        self,
        person_id: str,
        evidence: Evidence,
    ) -> Optional[Baseline]:
        """Establish baseline from evidence metadata."""
        metadata = evidence.metadata
        measurement_type = metadata.get("measurement_type", "")
        if not measurement_type:
            return None

        try:
            value = float(metadata.get("value", 0))
        except (ValueError, TypeError):
            return None

        unit = metadata.get("unit", "")
        return self.establish_baseline(
            person_id=person_id,
            measurement_type=measurement_type,
            value=value,
            unit=unit,
            source_evidence_id=evidence.id,
        )