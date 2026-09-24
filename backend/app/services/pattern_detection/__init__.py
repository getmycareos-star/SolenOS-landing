"""Pattern detection service — no hard-coded values."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from app.models.meaning import CareEvent, Change, Contradiction, Evidence


class PatternDetectionService:
    """Detects patterns in care data — no hard-coded values."""

    def detect_contradictions(
        self,
        evidence_list: list[Evidence],
    ) -> list[Contradiction]:
        """Detect contradictions between evidence sources."""
        contradictions: list[Contradiction] = []

        # Group evidence by measurement_type
        by_type: dict[str, list[Evidence]] = {}
        for ev in evidence_list:
            mtype = ev.metadata.get("measurement_type", "")
            if mtype:
                by_type.setdefault(mtype, []).append(ev)

        # Check for conflicting values
        for mtype, evs in by_type.items():
            values: dict[float, list[str]] = {}
            for ev in evs:
                try:
                    val = float(ev.metadata.get("value", 0))
                except (ValueError, TypeError):
                    continue
                values.setdefault(val, []).append(ev.id)

            if len(values) > 1:
                contradictions.append(
                    Contradiction(
                        id=f"ct_{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}",
                        person_id=evs[0].person_id,
                        contradiction_type="direct",
                        description=(
                            f"Conflicting values for {mtype}: "
                            f"{list(values.keys())}"
                        ),
                        evidence_ids=[eid for ids in values.values() for eid in ids],
                    )
                )

        return contradictions

    def detect_temporal_patterns(
        self,
        changes: list[Change],
    ) -> list[dict]:
        """Detect temporal patterns in changes."""
        patterns: list[dict] = []
        if len(changes) < 2:
            return patterns

        # Simple pattern: check for repeated change types
        change_types: dict[str, int] = {}
        for change in changes:
            change_types[change.change_type] = (
                change_types.get(change.change_type, 0) + 1
            )

        for ctype, count in change_types.items():
            if count >= 2:
                patterns.append(
                    {
                        "pattern_type": "repeated_change",
                        "change_type": ctype,
                        "count": count,
                    }
                )

        return patterns