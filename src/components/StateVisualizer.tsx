import type { StateTrace } from "@/lib/engine";

interface StateVisualizerProps {
  trace: StateTrace;
}

/** Debug-only — shows state transformation pipeline. */
export function StateVisualizer({ trace }: StateVisualizerProps) {
  return (
    <section className="panel debug-panel">
      <h2 className="debug-title">State trace (debug)</h2>

      <div className="debug-block">
        <h3>Interpreted</h3>
        <p>Uncertain: {trace.interpreted.uncertain_elements ? "yes" : "no"}</p>
        <p>Entities: {trace.interpreted.interpretation.entities.join(", ") || "none"}</p>
      </div>

      <div className="debug-block">
        <h3>Cognitive load</h3>
        <p>Level: {trace.cognitive_load.load_level}</p>
        <p>{trace.cognitive_load.why}</p>
        <p className="debug-scores">
          complexity {trace.cognitive_load.complexity_score} · emotional{" "}
          {trace.cognitive_load.emotional_intensity_score} · urgency{" "}
          {trace.cognitive_load.urgency_pressure_score}
        </p>
      </div>

      <div className="debug-block">
        <h3>Priority</h3>
        <p>{trace.priority.classification}</p>
      </div>

      <div className="debug-block">
        <h3>Loop signals</h3>
        <p>Emotional noise removed: {trace.clarity.emotional_noise_removed ? "yes" : "no"}</p>
      </div>
    </section>
  );
}
