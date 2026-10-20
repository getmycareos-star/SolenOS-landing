"use client";



import type { ContinuityDecayResult } from "@/lib/continuity-decay-engine";



type Props = {

  layer: ContinuityDecayResult;

};



export function ContinuityDecayPanel({ layer }: Props) {

  if (!layer.triggered) return null;



  return (

    <div className="continuity-decay-panel">

      <h4>Continuity freshness</h4>

      <p className="panel-muted">

        Confidence in how current understanding remains — not a health score.

      </p>



      <p>

        <strong>Continuity freshness:</strong>{" "}
        {layer.family_rhythm.meaningful_gap
          ? "may need a fresh update"
          : "recent enough to orient"}

      </p>



      {layer.family_rhythm.meaningful_gap && (

        <p className="panel-muted">

          Update gap detected — {layer.family_rhythm.days_since_last_update}d since last update

          (typical cadence: {layer.family_rhythm.typical_cadence_days}d).

        </p>

      )}



      {layer.refresh_session && (

        <section>

          <h5>Refresh session</h5>

          <p>{layer.refresh_session.welcome_message}</p>

          <ul>

            {layer.refresh_session.questions.map((q) => (

              <li key={q}>{q}</li>

            ))}

          </ul>

        </section>

      )}



      {layer.stale_items.length > 0 && (

        <section>

          <h5>Becoming uncertain</h5>

          <ul>

            {layer.stale_items.slice(0, 5).map((s) => (

              <li key={s.object_id}>

                {s.label} — {s.stale_reason}

              </li>

            ))}

          </ul>

        </section>

      )}



      {layer.continuity_gaps.length > 0 && (

        <section>

          <h5>Continuity gaps</h5>

          <ul>

            {layer.continuity_gaps.slice(0, 5).map((g) => (

              <li key={g.gap_id}>

                [{g.importance}] {g.label} — {g.reason}

              </li>

            ))}

          </ul>

        </section>

      )}



      {layer.recheck_prompts.length > 0 && (

        <section>

          <h5>Contextual reminders</h5>

          <ul>

            {layer.recheck_prompts.map((p) => (

              <li key={p}>{p}</li>

            ))}

          </ul>

        </section>

      )}



      {layer.decision_trace_reasons.length > 0 && (

        <section>

          <h5>Why we're asking</h5>

          <ul>

            {layer.decision_trace_reasons.map((r) => (

              <li key={r}>{r}</li>

            ))}

          </ul>

        </section>

      )}

    </div>

  );

}


