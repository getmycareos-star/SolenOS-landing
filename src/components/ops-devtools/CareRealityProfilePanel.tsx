"use client";

import type { CareRealityProfileResult } from "@/lib/care-reality-profile-engine";
import { PROFILE_SECTIONS } from "@/lib/care-reality-profile-engine";

type Props = {
  layer: CareRealityProfileResult;
};

const SECTION_LABELS: Record<(typeof PROFILE_SECTIONS)[number], string> = {
  baseline_reality: "Baseline reality",
  important_routines: "Important routines",
  known_changes: "Known changes",
  previous_decisions: "Previous decisions",
  what_helped: "What helped",
  what_did_not_help: "What did not help",
  family_observations: "Family observations",
  unresolved_questions: "Unresolved questions",
};

export function CareRealityProfilePanel({ layer }: Props) {
  if (!layer.active) return null;

  return (
    <div className="care-reality-profile-panel">
      <h4>Care reality profile</h4>
      <p className="panel-muted">{layer.profile.person_specific_summary}</p>

      {PROFILE_SECTIONS.map((key) => {
        const entries = layer.profile.sections[key];
        if (entries.length === 0) return null;
        return (
          <section key={key}>
            <h5>{SECTION_LABELS[key]}</h5>
            <ul>
              {entries.slice(0, 4).map((e) => (
                <li key={`${key}-${e.label}`}>
                  {e.label}{" "}
                  <span className="panel-muted">
                    ({e.evolution_stage}, {e.confidence})
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {layer.profile.relationship_insights.length > 0 && (
        <section>
          <h5>Relationships over time</h5>
          <ul>
            {layer.profile.relationship_insights.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
