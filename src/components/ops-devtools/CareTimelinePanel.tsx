"use client";

import type { CareTimelineEngineResult } from "@/lib/care-timeline-engine";

type Props = {
  layer: CareTimelineEngineResult;
};

export function CareTimelinePanel({ layer }: Props) {
  if (!layer.active) return null;

  const { care_record, care_truth } = layer;

  const eventsByDay = new Map<string, typeof care_record.events>();
  for (const event of care_truth.timeline) {
    const day = event.timestamp.slice(0, 10);
    const list = eventsByDay.get(day) ?? [];
    list.push(event);
    eventsByDay.set(day, list);
  }

  return (
    <div className="care-timeline-panel">
      <h4>Care timeline</h4>
      <p className="panel-muted">{layer.defining_principle}</p>
      <p>
        {care_truth.timeline.length} events · {care_truth.facts.length} canonical facts ·{" "}
        {care_truth.conflicts.length} conflict(s)
      </p>

      {care_truth.facts.length > 0 && (
        <div className="care-timeline-facts">
          <h5>Canonical facts</h5>
          <ul>
            {care_truth.facts.slice(-8).map((fact) => (
              <li key={fact.id}>
                {fact.type}: {fact.name}
                {fact.state.value ? ` — ${fact.state.value}` : ""} ({fact.state.status})
              </li>
            ))}
          </ul>
        </div>
      )}

      {[...eventsByDay.entries()]
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, 5)
        .map(([day, events]) => (
          <div key={day} className="care-timeline-day">
            <h5>{day}</h5>
            <ul>
              {events.map((event) => (
                <li key={event.id}>
                  {event.abstract_label}
                  <span className="panel-muted"> · {event.type.replace(/_/g, " ")}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
    </div>
  );
}
