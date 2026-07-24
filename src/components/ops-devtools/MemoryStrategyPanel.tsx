"use client";

import type { MemoryStrategyResult } from "@/lib/memory-strategy-engine";

type Props = {
  layer: MemoryStrategyResult;
};

export function MemoryStrategyPanel({ layer }: Props) {
  if (!layer.active) return null;

  return (
    <div className="memory-strategy-panel">
      <h4>Memory strategy</h4>
      <p className="panel-muted">{layer.defining_principle}</p>

      <p>
        Tiers active — permanent: {layer.tier_counts.permanent}, long-lived:{" "}
        {layer.tier_counts.long_lived}, short-lived: {layer.tier_counts.short_lived}, session:{" "}
        {layer.tier_counts.session}
      </p>

      {layer.current_status_summary.length > 0 && (
        <section>
          <h5>Current status</h5>
          <ul>
            {layer.current_status_summary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      {layer.compressed_trends.length > 0 && (
        <section>
          <h5>Compressed trends</h5>
          <ul>
            {layer.compressed_trends.map((t) => (
              <li key={t.trend_id}>
                {t.narrative} ({t.event_count} events)
              </li>
            ))}
          </ul>
        </section>
      )}

      {layer.conflicts.length > 0 && (
        <section>
          <h5>Transitions preserved</h5>
          <ul>
            {layer.conflicts.map((c) => (
              <li key={c.conflict_id}>{c.description}</li>
            ))}
          </ul>
        </section>
      )}

      {layer.explainable_facts.length > 0 && (
        <section>
          <h5>Explainable memory</h5>
          <ul>
            {layer.explainable_facts.map((f) => (
              <li key={`${f.tier}-${f.label}`}>
                [{f.tier.replace(/_/g, " ")}] {f.label} — {f.why_remembered}
              </li>
            ))}
          </ul>
        </section>
      )}

      {layer.personal_memory_hints.length > 0 && (
        <section>
          <h5>Personal memory hints</h5>
          <ul>
            {layer.personal_memory_hints.map((h) => (
              <li key={h.hint_id}>
                [{h.category}] {h.label}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
