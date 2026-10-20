"use client";

import type { CurrentStateViewResult } from "@/lib/current-state-view-engine";

type Props = {
  layer: CurrentStateViewResult;
  tasks?: import("@/lib/task-extraction-engine").TaskExtractionResult;
};

export function CurrentStateViewPanel({ layer, tasks }: Props) {
  if (!layer.active) return null;

  const { view } = layer;

  return (
    <div className="current-state-view-panel">
      <h4>Current care state</h4>
      <p className="panel-muted">{layer.defining_principle}</p>
      <p className="current-state-headline">
        <strong>{view.snapshot_summary}</strong>
      </p>

      {view.active_medications.length > 0 && (
        <div>
          <h5>Active medications</h5>
          <ul>
            {view.active_medications.map((med) => (
              <li key={med.id}>
                {med.name}
                {med.state.value ? ` — ${med.state.value}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {view.recent_changes.length > 0 && (
        <div>
          <h5>Recent changes (7 days)</h5>
          <ul>
            {view.recent_changes.slice(-5).map((event) => (
              <li key={event.id}>{event.abstract_label}</li>
            ))}
          </ul>
        </div>
      )}

      {view.open_tasks.length > 0 && (
        <div>
          <h5>Open tasks</h5>
          <ul>
            {view.open_tasks.map((task) => (
              <li key={task.id}>
                {task.description}
                {task.due_date ? ` (due ${task.due_date})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {tasks && tasks.open_tasks.length > view.open_tasks.length && (
        <p className="panel-muted">{tasks.open_tasks.length} derived task(s) total</p>
      )}

      {view.alerts.length > 0 && (
        <div>
          <h5>Alerts</h5>
          <ul>
            {view.alerts.map((alert) => (
              <li key={alert.alert_id}>{alert.message}</li>
            ))}
          </ul>
        </div>
      )}

      {view.unresolved_issues.length > 0 && (
        <div>
          <h5>Unresolved issues</h5>
          <ul>
            {view.unresolved_issues.map((issue) => (
              <li key={issue.conflict_id}>{issue.shared_message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
