"""Change detection service — no hard-coded values."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from app.core.meaning_enums import ChangeType
from app.models.meaning import Baseline, Change, Evidence


class ChangeDetectionService:
    """Detects changes from baseline data — no hard-coded values."""

    def detect_change(
        self,
        baseline: Optional[Baseline],
        evidence: Evidence,
        measurement_type: str,
        current_value: float,
        unit: str,
    ) -> Optional[Change]:
        """Detect a change from baseline. Returns None if no baseline exists."""
        if baseline is None:
            return None

        previous_value = baseline.value
        change_type = self._classify_change(previous_value, current_value)

        return Change(
            id=f"chg_{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}",
            person_id=evidence.person_id,
            baseline_id=baseline.id,
            measurement_type=measurement_type,
            change_type=change_type,
            previous_value=previous_value,
            current_value=current_value,
            unit=unit,
            evidence_ids=[evidence.id],
        )

    def _classify_change(self, previous: float, current: float) -> str:
        """Classify the type of change."""
        if current > previous:
            return ChangeType.INCREASE.value
        if current < previous:
            return ChangeType.DECREASE.value
        return ChangeType.UNCHANGED.value

    def detect_changes_from_evidence(
        self,
        baselines: list[Baseline],
        evidence_list: list[Evidence],
    ) -> list[Change]:
        """Detect changes from a list of baselines and evidence."""
        changes: list[Change] = []
        baseline_map: dict[str, Baseline] = {
            b.measurement_type: b for b in baselines
        }

        for evidence in evidence_list:
            # Extract measurement from evidence metadata if available
            metadata = evidence.metadata
            measurement_type = metadata.get("measurement_type", "")
            if not measurement_type:
                continue

            try:
                current_value = float(metadata.get("value", 0))
            except (ValueError, TypeError):
                continue

            unit = metadata.get("unit", "")
            baseline = baseline_map.get(measurement_type)

            change = self.detect_change(
                baseline, evidence, measurement_type, current_value, unit
            )
            if change is not None:
                changes.append(change)

        return changes