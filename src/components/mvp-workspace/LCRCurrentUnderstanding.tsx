"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { ensureAnonymousSession, getJSON } from "@/api/client";

type CareFact = {
  id: string;
  fact_type?: string | null;
  fact_value: unknown;
  epistemic_status?: string | null;
  effective_at?: string | null;
  recorded_at?: string | null;
  superseded_by_fact_id?: string | null;
  review_notes?: string | null;
};

type Uncertainty = {
  id: string;
  question?: string | null;
  uncertainty_type?: string | null;
  status?: string | null;
};

type MissingInformation = {
  id: string;
  topic?: string | null;
  description?: string | null;
  priority?: string | null;
  status?: string | null;
};

function displayValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "Value not recorded";
  try {
    return JSON.stringify(value);
  } catch {
    return "Value could not be displayed";
  }
}

function isOpenStatus(status?: string | null): boolean {
  const normalized = (status ?? "").trim().toLowerCase();
  return !["resolved", "closed", "complete", "completed", "dismissed", "rejected"].includes(normalized);
}

export function LCRCurrentUnderstanding() {
  const [facts, setFacts] = useState<CareFact[]>([]);
  const [uncertainties, setUncertainties] = useState<Uncertainty[]>([]);
  const [gaps, setGaps] = useState<MissingInformation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setErrors([]);
    try {
      const session = await ensureAnonymousSession();
      if (!session.access_token || !session.person?.id) {
        throw new Error("A valid care-record session is required to read the longitudinal record.");
      }

      const requests = await Promise.allSettled([
        getJSON("/care-continuity/facts?limit=100"),
        getJSON("/care-continuity/uncertainties?limit=100"),
        getJSON("/care-continuity/missing-information?limit=100"),
      ]);
      const messages: string[] = [];

      if (requests[0].status === "fulfilled" && Array.isArray(requests[0].value)) {
        setFacts(requests[0].value.filter((item: CareFact) =>
          item && typeof item.id === "string" && !item.superseded_by_fact_id
        ));
      } else {
        setFacts([]);
        messages.push("Persisted care facts could not be loaded.");
      }

      if (requests[1].status === "fulfilled" && Array.isArray(requests[1].value)) {
        setUncertainties(requests[1].value.filter((item: Uncertainty) =>
          item && typeof item.id === "string" && isOpenStatus(item.status)
        ));
      } else {
        setUncertainties([]);
        messages.push("Open uncertainties could not be loaded.");
      }

      if (requests[2].status === "fulfilled" && Array.isArray(requests[2].value)) {
        setGaps(requests[2].value.filter((item: MissingInformation) =>
          item && typeof item.id === "string" && isOpenStatus(item.status)
        ));
      } else {
        setGaps([]);
        messages.push("Missing information could not be loaded.");
      }
      setErrors(messages);
    } catch (error) {
      setFacts([]);
      setUncertainties([]);
      setGaps([]);
      setErrors([error instanceof Error ? error.message : "The longitudinal care record could not be loaded."]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="lcr-record-section" aria-labelledby="lcr-current-understanding-heading">
      <div className="lcr-section-heading">
        <div>
          <p className="lcr-eyebrow">LONGITUDINAL RECORD</p>
          <h2 id="lcr-current-understanding-heading">Current care understanding</h2>
          <p>Persisted care facts are shown separately from unresolved questions and missing information.</p>
        </div>
        <button type="button" className="lcr-text-action" onClick={() => void load(true)} disabled={loading || refreshing} aria-label="Refresh current care understanding">
          <RefreshCw size={16} aria-hidden="true" /> Refresh
        </button>
      </div>

      {errors.length > 0 && (
        <div role="alert" className="lcr-empty-state">
          <AlertCircle size={20} aria-hidden="true" />
          <h3>Some record information is unavailable</h3>
          <ul>{errors.map((message) => <li key={message}>{message}</li>)}</ul>
          <p>Unavailable information is not treated as empty or resolved.</p>
        </div>
      )}

      {loading ? (
        <p role="status">Loading persisted care information…</p>
      ) : (
        <>
          <div className="lcr-current-facts">
            <h3>Care facts</h3>
            {facts.length === 0 ? (
              <p>No persisted care facts were returned. This does not mean that no care needs exist.</p>
            ) : (
              <ul>
                {facts.map((fact) => (
                  <li key={fact.id} className="lcr-current-fact">
                    <div className="lcr-entry-heading">
                      <strong>{(fact.fact_type || "Care detail").replaceAll("_", " ")}</strong>
                      <span>{fact.epistemic_status || "Status not recorded"}</span>
                    </div>
                    <p>{displayValue(fact.fact_value)}</p>
                    {fact.effective_at && <small>Effective from {fact.effective_at}</small>}
                    {fact.review_notes && <p>{fact.review_notes}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="lcr-current-uncertainties">
            <h3>Unresolved questions</h3>
            {uncertainties.length === 0 && gaps.length === 0 ? (
              <p>No open uncertainties or missing-information items were returned by the available endpoints.</p>
            ) : (
              <ul>
                {uncertainties.map((item) => (
                  <li key={item.id}>
                    <strong>{item.question || "Question not specified"}</strong>
                    <span>{item.uncertainty_type || "Uncertainty"} · {item.status || "Status not recorded"}</span>
                  </li>
                ))}
                {gaps.map((item) => (
                  <li key={item.id}>
                    <strong>{item.topic || "Missing information"}</strong>
                    <p>{item.description || "No further description was recorded."}</p>
                    <span>{item.priority || "Priority not recorded"} · {item.status || "Status not recorded"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
