"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ensureAnonymousSession, getJSON } from "@/api/client";
import { caregiverSourceText, caregiverSafeAssistantText, caregiverSafeGeneratedText, caregiverStatusLabel } from "@/lib/caregiver-language";

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
    observed: "Seen by a caregiver", 
    confirmed: "Checked against a source", 
    inferred: "Possible explanation", 
    uncertain: "Not sure yet", 
    unverified: "Not confirmed",
    disputed: "Reports do not match",
    needs_clarification: "Needs checking",
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
  return labels[value] || caregiverStatusLabel(value) || "Not available";
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
        <p className="persisted-care-orientation-error" role="alert">{caregiverSafeAssistantText(error) || "Your saved care information isn't available right now."}</p>
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
        <div><h2>Your Care Record</h2></div>
      </div>

      {items.length > 0 ? (
        <>
          <p>{projection.item_count} saved care detail{projection.item_count === 1 ? "" : "s"} shown.</p>
          {items.map((item) => (
            <article className="persisted-care-orientation-latest" key={item.source_collection + ":" + item.id}>
              <strong>{caregiverSourceText(item.title) || "Saved care detail"}</strong>
              {caregiverSourceText(item.description) && <p>{caregiverSourceText(item.description)}</p>}
              <p>{readableStatus(item.epistemic_status)} · {readableStatus(item.status)}</p>
              <p>{caregiverSafeGeneratedText(item.source_label) || "Who shared this was not recorded"} · {formatDate(item.occurred_at || item.reported_at || item.recorded_at)}</p>
              {item.evidence_ids.length > 0 && (
                <small>The original note or document is available to review.</small>
              )}
            </article>
          ))}
          {projection.has_more && <p>More saved care details are available in your full Care Record.</p>}
        </>
      ) : (
        hasRequiredSourceGaps || hasOptionalSourceGaps || projection.schema_status !== "complete" || projection.item_count > 0 ? (
          <div>
            <p>We couldn’t show your saved care information in this view.</p>
            <p>This does not mean your Care Record is empty. Some information may be unavailable right now.</p>
            <button type="button" onClick={() => void load()}>Try again</button>
            <Link href="/workspace/timeline">Open care history</Link>
          </div>
        ) : (
          <div>
            <p>Your Care Record does not have any care information yet.</p>
            <p>When you share an update or document, it can be reviewed and added to this record.</p>
            <Link href="/workspace">Add a care update</Link>
          </div>
        )
      )}

      {(hasRequiredSourceGaps || hasOptionalSourceGaps || projection.schema_status !== "complete") && (
        <p role="note">
          Some parts of the record may not be available in this view. Missing information does not mean that nothing happened.
        </p>
      )}
      {projection.notice && <p role="note">{caregiverSafeGeneratedText(projection.notice) || "This view reflects the care information currently available."}</p>}

      <div className="persisted-care-orientation-links">
        <Link href="/workspace/timeline">View care history</Link>
        <Link href="/workspace/documents">View documents</Link>
      </div>
    </section>
  );
}
