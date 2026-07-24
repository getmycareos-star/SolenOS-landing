"use client";

import type { NorthStarExperienceResult } from "@/lib/north-star-experience";

type Props = {
  layer: NorthStarExperienceResult;
};

/** Internal layer — north star philosophy evaluation (not shown in care record surfaces). */
export function NorthStarExperiencePanel({ layer }: Props) {
  if (!layer.active) return null;

  return (
    <div className="north-star-experience-panel">
      <h4>North star experience</h4>
      <p className="panel-muted">{layer.defining_principle}</p>

      <p>
        <strong>Target feeling:</strong> {layer.north_star_feeling}
      </p>

      <p>
        Experience score: {layer.experience_score}% —{" "}
        {layer.experience_test_passed ? "passes experience test" : "needs continuity improvement"}
      </p>

      {layer.continuity_recognition && (
        <section>
          <h5>Continuity recognition</h5>
          <p>{layer.continuity_recognition}</p>
        </section>
      )}

      {layer.principles_upheld.length > 0 && (
        <section>
          <h5>Principles upheld</h5>
          <ul>
            {layer.principles_upheld.map((p) => (
              <li key={p}>{p.replace(/_/g, " ")}</li>
            ))}
          </ul>
        </section>
      )}

      {layer.anti_patterns_detected.length > 0 && (
        <section>
          <h5>Anti-patterns flagged</h5>
          <ul>
            {layer.anti_patterns_detected.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
