"use client";

import type { AuditTrailResult } from "@/lib/audit-trail-system";

type Props = {
  layer: AuditTrailResult;
};

export function AuditTrailPanel({ layer }: Props) {
  if (!layer.active) return null;

  return (
    <div className="audit-trail-panel">
      <h4>Audit trail (internal)</h4>
      <p className="panel-muted">{layer.defining_principle}</p>
      <p>
        Recipient {layer.care_recipient_id} — {layer.total_entries} entries, sequence{" "}
        {layer.latest_sequence}, replayable: {layer.replayable ? "yes" : "no"}
      </p>
      {layer.conflict_entries > 0 && (
        <p className="panel-muted">{layer.conflict_entries} conflict audit entry(ies)</p>
      )}
    </div>
  );
}
