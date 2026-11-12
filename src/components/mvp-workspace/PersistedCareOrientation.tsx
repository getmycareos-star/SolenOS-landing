"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ensureAnonymousSession, getJSON } from "@/api/client";

type CurrentCareItem = {
  id: string;
  kind: string;
  title: string;
  description?: string;
  status: string;
  epistemic_status: string;
  source_collection: string;
  source_type: string;
  source_label: string;
  occurred_at?: string | null;
  reported_at?: string | null;
  recorded_at?: string | null;
  evidence_ids: string[];
  evidence_link_validation?: string;
};

type CurrentCareProjection = {
  person_id: string;
  projection_type: string;
  read_only: boolean;
  history_coverage: string;
  schema_status: string;
  missing_required_sources: string[];
  missing_optional_sources: string[];
  items: CurrentCareItem[];
  item_count: number;
  has_more: boolean;
  notice: string;
};

type LoadState = "loading" | "ready" | "unavailable";

function formatDate(value?: string | null): string {
  if (!value) return "Date not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not recorded";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function readableStatus(value?: string | null): string {
  if (!value?.trim()) return "Status not recorded";
  const labels: Record<string, string> = {
    reported: "Reported",
    observed: "Observed",
    confirmed: "Confirmed",
    inferred: "Possible interpretation",
    uncertain: "Still unclear",
    unverified: "Not confirmed",
    disputed: "Reports do not match",
    needs_clarification: "Needs clarification",
    awaiting_confirmation: "Needs review",
    active: "Current",
    open: "Open",
    completed: "Completed",
    resolved: "Resolved",
    superseded: "Replaced by a newer record",
    withdrawn: "Withdrawn",
    not_specified: "Not specified",
    status_unknown: "Status not recorded",
  };
  return labels[value] || value.replaceAll("_", " ");
}

export function PersistedCareOrientation() {
  const [state, setState] = useState<LoadState>("loading");
  const [projection, setProjection] = useState<CurrentCareProjection | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setState("loading");
    setError("");
    try {
      const session = await ensureAnonymousSession();
      if (!session.access_token || !session.person?.id) {
        throw new Error("A secure care record session is required.");
      }
      const data = await getJSON("/care-continuity/current-care?limit_per_source=12");
      if (
        !data ||
        data.read_only !== true ||
        data.projection_type !== "bounded_evidence_derived_current_care" ||
        data.person_id !== session.person.id ||
        !Array.isArray(data.items)
      ) {
        throw new Error("The current care record could not be verified for this session.");
      }
      setProjection(data as CurrentCareProjection);
      setState("ready");
    } catch {
      setProjection(null);
      setError("Your care information isn't available right now. Check your connection and try again.");
      setState("unavailable");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (state === "loading") {
    return (
      <section className="persisted-care-orientation" aria-busy="true" aria-label="Saved care information">
        <h2>Loading your care information…</h2>
      </section>
    );
  }

  if (state === "unavailable" || !projection) {
    return (
      <section className="persisted-care-orientation" aria-label="Saved care information">
        <div className="persisted-care-orientation-header">
          <div><h2>We couldn't load your care information</h2></div>
        </div>
        <p className="persisted-care-orientation-error" role="alert">{error || "Your saved care information isn't available right now."}</p>
        <button type="button" onClick={() => void load()}>Try again</button>
      </section>
    );
  }

  const items = projection.items;
  const hasRequiredSourceGaps = projection.missing_required_sources.length > 0;
  const hasOptionalSourceGaps = projection.missing_optional_sources.length > 0;

  return (
    <section className="persisted-care-orientation" aria-label="Saved care information">
      <div className="persisted-care-orientation-header">
        <div><h2>Your Living Care Record</h2></div>
      </div>

      {items.length > 0 ? (
        <>
          <p>{projection.item_count} care record item{projection.item_count === 1 ? "" : "s"} shown.</p>
          {items.map((item) => (
            <article className="persisted-care-orientation-latest" key={item.source_collection + ":" + item.id}>
              <strong>{item.title?.trim() || "Care record item"}</strong>
              {item.description?.trim() && <p>{item.description}</p>}
              <p>{readableStatus(item.epistemic_status)} · {readableStatus(item.status)}</p>
              <p>{item.source_label || "Source not recorded"} · {formatDate(item.occurred_at || item.reported_at || item.recorded_at)}</p>
              {item.evidence_ids.length > 0 && (
                <small>Linked source information is available for review.</small>
              )}
            </article>
          ))}
          {projection.has_more && <p>More care record items are available in the full record.</p>}
        </>
      ) : (
        <div>
          <p>Your Living Care Record does not have any care information available yet.</p>
          <p>When you share an update or document, it can be reviewed and added to this record.</p>
          <Link href="/workspace">Add a care update</Link>
        </div>
      )}

      {(hasRequiredSourceGaps || hasOptionalSourceGaps || projection.schema_status !== "complete") && (
        <p role="note">
          Some parts of the record may not be available in this view. Missing information does not mean that nothing happened.
        </p>
      )}
      <p role="note">{projection.notice}</p>

      <div className="persisted-care-orientation-links">
        <Link href="/workspace/timeline">Review timeline</Link>
        <Link href="/workspace/documents">Review documents</Link>
      </div>
    </section>
  );
}
