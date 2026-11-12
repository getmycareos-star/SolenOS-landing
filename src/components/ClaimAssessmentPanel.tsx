"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { ensureAnonymousSession, getJSON, postJSON } from "@/api/client";

type Claim = {
  id: string;
  person_id: string;
  asserted_value: string;
  field: string;
  source_label: string;
  assertion_status: string;
  evidence_ids: string[];
};
type Evidence = { id: string; person_id: string; type: string; source_text: string };
type Assessment = {
  id: string;
  claim_id: string;
  claim_version: number;
  status: string;
  rationale: string;
  policy_version: string;
  evidence_links: Array<{
    evidence_id: string;
    relationship: string;
    source_passage?: string | null;
    scope_note?: string | null;
  }>;
  reviewed_by_caregiver_id: string;
  supersedes_assessment_id?: string | null;
  superseded_by_claim_id?: string | null;
  created_at: string;
};
type AssessmentImpact = {
  claim_id: string;
  status: string;
  assessment_id?: string | null;
  assessment_version?: number | null;
  assessment_status?: string | null;
  review_required: boolean;
  reasons: string[];
  missing_evidence_ids: string[];
  unassessed_claim_evidence_ids: string[];
  changed_prerequisite_claim_ids: string[];
  changed_observation_ids?: string[];
  unresolved_conflicts?: Array<{ conflict_id: string; field: string; description: string; resolution_status: string; created_at?: string | null }>;
  interpretation_limit: string;
};
type DraftLink = {
  evidence_id: string;
  relationship: "supports" | "partial_support" | "scope_limited" | "contradicts" | "neutral";
  source_passage: string;
  scope_note: string;
};
type DependencyEdge = {
  id: string;
  person_id: string;
  claim_id: string;
  depends_on_claim_id: string;
  dependency_type: string;
  rationale: string;
  created_by_caregiver_id: string;
  created_at: string;
};

const statuses = [
  "supported", "partially_supported", "contradicted", "unverified", "uncertain",
  "conflicting", "missing_evidence", "stale", "superseded", "withdrawn",
] as const;
const relationships: DraftLink["relationship"][] = [
  "supports", "partial_support", "scope_limited", "contradicts", "neutral",
];
const panel: CSSProperties = {
  border: "1px solid var(--border)", borderRadius: 10, padding: 14,
  marginTop: 12, background: "var(--surface)",
};
const field: CSSProperties = {
  boxSizing: "border-box", width: "100%", padding: "9px 10px", borderRadius: 7,
  border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)",
};
const button: CSSProperties = {
  border: "1px solid var(--border)", borderRadius: 7, padding: "8px 11px",
  background: "var(--surface)", color: "var(--text)", cursor: "pointer",
};

function simpleReviewStatus(value: string): string {
  return ({
    supported: "Supported by the saved source",
    partially_supported: "Some details are supported",
    contradicted: "Does not match other information",
    unverified: "Not confirmed",
    uncertain: "Still unclear",
    conflicting: "Reports do not match",
    missing_evidence: "No source is attached",
    stale: "May be out of date",
    superseded: "Replaced by newer information",
    withdrawn: "No longer being used",
    derived_from: "Based on",
    requires: "Needs",
    supports: "Supports",
    qualifies: "Adds limits to",
    supersedes: "Replaces",
    partial_support: "Supports part of it",
    scope_limited: "Supports only part",
    contradicts: "Does not match",
    neutral: "No clear link",
    review_required: "Needs another review",
    source_observation_added_or_corrected_after_assessment: "A source detail was added or corrected after this review",
    prerequisite_claim_source_or_assessment_changed: "A related care detail or its supporting information changed after this review",
    current: "Current",
    outdated: "May be out of date",
    unchanged: "No change found",
  } as Record<string, string>)[value] ?? value.replaceAll("_", " ");
}

function emptyLink(): DraftLink {
  return { evidence_id: "", relationship: "supports", source_passage: "", scope_note: "" };
}

export default function ClaimAssessmentPanel() {
  const [personId, setPersonId] = useState("");
  const [claims, setClaims] = useState<Claim[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [selectedClaimId, setSelectedClaimId] = useState("");
  const [status, setStatus] = useState<(typeof statuses)[number]>("unverified");
  const [supersededByClaimId, setSupersededByClaimId] = useState("");
  const [rationale, setRationale] = useState("");
  const [links, setLinks] = useState<DraftLink[]>([emptyLink()]);
  const [history, setHistory] = useState<Assessment[]>([]);
  const [assessmentImpact, setAssessmentImpact] = useState<AssessmentImpact | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactError, setImpactError] = useState("");
  const [dependencies, setDependencies] = useState<DependencyEdge[]>([]);
  const [dependencyTargetId, setDependencyTargetId] = useState("");
  const [dependencyType, setDependencyType] = useState("derived_from");
  const [dependencyRationale, setDependencyRationale] = useState("");
  const [dependencyLoading, setDependencyLoading] = useState(false);
  const [dependencySaving, setDependencySaving] = useState(false);
  const [dependencyError, setDependencyError] = useState("");
  const [dependencyNotice, setDependencyNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedClaim = useMemo(
    () => claims.find((claim) => claim.id === selectedClaimId),
    [claims, selectedClaimId],
  );

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const session = await ensureAnonymousSession();
      const scopedPersonId = session.person?.id;
      if (!scopedPersonId) throw new Error("No authenticated care-record scope");
      const [claimRows, evidenceRows] = await Promise.all([
        getJSON("/care-continuity/assertions?limit=100"),
        getJSON("/care-continuity/evidence?limit=100"),
      ]);
      if (!Array.isArray(claimRows) || claimRows.some((item) =>
        item?.person_id !== scopedPersonId || typeof item?.id !== "string" ||
        typeof item?.asserted_value !== "string")) {
        throw new Error("Claim records were not valid for the authenticated care record");
      }
      if (!Array.isArray(evidenceRows) || evidenceRows.some((item) =>
        item?.person_id !== scopedPersonId || typeof item?.id !== "string" ||
        typeof item?.source_text !== "string")) {
        throw new Error("Source informations were not valid for the authenticated care record");
      }
      setPersonId(scopedPersonId);
      setClaims(claimRows as Claim[]);
      setEvidence(evidenceRows as Evidence[]);
      setSelectedClaimId((current) =>
        current && claimRows.some((claim) => claim.id === current)
          ? current
          : claimRows[0]?.id ?? "",
      );
    } catch {
      setPersonId("");
      setClaims([]);
      setEvidence([]);
      setSelectedClaimId("");
      setError("Care details and sources could not be loaded. This does not mean the record is empty. Try again when connected.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadRecords(); }, [loadRecords]);

  const loadHistory = useCallback(async () => {
    if (!selectedClaimId || !personId) {
      setHistory([]);
      setHistoryError("");
      return;
    }
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const rows = await getJSON(
        `/care-continuity/claims/${encodeURIComponent(selectedClaimId)}/assessments`,
      );
      if (!Array.isArray(rows) || rows.some((item) =>
        item?.claim_id !== selectedClaimId || typeof item?.claim_version !== "number")) {
        throw new Error("Invalid claim assessment history");
      }
      setHistory(rows as Assessment[]);
    } catch {
      setHistory([]);
      setHistoryError("Past reviews could not be loaded. This does not mean there are no past reviews.");
    } finally {
      setHistoryLoading(false);
    }
  }, [personId, selectedClaimId]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const loadAssessmentImpact = useCallback(async () => {
    if (!selectedClaimId || !personId) {
      setAssessmentImpact(null);
      setImpactError("");
      return;
    }
    setImpactLoading(true);
    setImpactError("");
    try {
      const result = await getJSON(
        `/care-continuity/claims/${encodeURIComponent(selectedClaimId)}/assessment-impact`,
      );
      if (!result || result.claim_id !== selectedClaimId ||
        typeof result.review_required !== "boolean" || !Array.isArray(result.reasons) ||
        !Array.isArray(result.missing_evidence_ids) ||
        !Array.isArray(result.unassessed_claim_evidence_ids) ||
        !Array.isArray(result.changed_prerequisite_claim_ids) ||
        typeof result.interpretation_limit !== "string") {
        throw new Error("Invalid claim assessment impact response");
      }
      setAssessmentImpact(result as AssessmentImpact);
    } catch {
      setAssessmentImpact(null);
      setImpactError("New information could not be checked. This does not mean this review is current.");
    } finally {
      setImpactLoading(false);
    }
  }, [personId, selectedClaimId]);

  useEffect(() => { void loadAssessmentImpact(); }, [loadAssessmentImpact]);
  useEffect(() => {
    let cancelled = false;
    async function loadDependencies() {
      if (!selectedClaimId || !personId) {
        setDependencies([]);
        setDependencyError("");
        return;
      }
      setDependencyLoading(true);
      setDependencyError("");
      try {
        const result = await getJSON(
          `/uncertainty/claims/${encodeURIComponent(selectedClaimId)}/dependencies`,
        );
        if (!result || result.claim_id !== selectedClaimId ||
          !Array.isArray(result.dependencies) || !Array.isArray(result.dependents)) {
          throw new Error("Invalid dependency graph response");
        }
        const rows = [...result.dependencies, ...result.dependents] as DependencyEdge[];
        if (rows.some((item) => item.person_id !== personId)) {
          throw new Error("Dependency graph escaped the authenticated care record");
        }
        if (!cancelled) setDependencies(rows);
      } catch {
        if (!cancelled) {
          setDependencies([]);
          setDependencyError("Claim dependency history is unavailable. A failed read is not an empty dependency graph.");
        }
      } finally {
        if (!cancelled) setDependencyLoading(false);
      }
    }
    void loadDependencies();
    return () => { cancelled = true; };
  }, [personId, selectedClaimId]);

  async function submitDependency() {
    if (!personId || !selectedClaim || !dependencyTargetId || dependencyTargetId === selectedClaim.id ||
      dependencyRationale.trim().length < 3) {
      setDependencyError("Select a different care detail and provide a rationale for the relationship.");
      return;
    }
    setDependencySaving(true);
    setDependencyError("");
    setDependencyNotice("");
    try {
      await postJSON("/uncertainty/claims/dependencies", {
        person_id: personId,
        claim_id: selectedClaim.id,
        depends_on_claim_id: dependencyTargetId,
        dependency_type: dependencyType,
        rationale: dependencyRationale.trim(),
      });
      setDependencyRationale("");
      setDependencyNotice("Dependency relationship saved. It records a declared link; it does not prove that either claim is true.");
      const result = await getJSON(
        `/uncertainty/claims/${encodeURIComponent(selectedClaim.id)}/dependencies`,
      );
      if (!result || result.claim_id !== selectedClaim.id ||
        !Array.isArray(result.dependencies) || !Array.isArray(result.dependents)) {
        throw new Error("Invalid dependency graph response");
      }
      const rows = [...result.dependencies, ...result.dependents] as DependencyEdge[];
      if (rows.some((item) => item.person_id !== personId)) {
        throw new Error("Dependency graph escaped the authenticated care record");
      }
      setDependencies(rows);
    } catch {
      setDependencyError("This link could not be saved. It may already exist or conflict with another care detail. No change was made.");
    } finally {
      setDependencySaving(false);
    }
  }

  function updateLink(index: number, patch: Partial<DraftLink>) {
    setLinks((current) => current.map((link, i) => i === index ? { ...link, ...patch } : link));
  }

  async function submit() {
    if (!selectedClaim || rationale.trim().length < 3) {
      setError("Choose a care detail and explain why you are reviewing it.");
      return;
    }
    if (status === "superseded" && (!supersededByClaimId || supersededByClaimId === selectedClaim.id)) {
      setError("Select a different care detail in this same care record as the supersession target.");
      return;
    }
    const completeLinks = links.filter((link) => link.evidence_id.trim());
    if (completeLinks.length !== links.length) {
      setError("Choose a source for each row or remove the row.");
      return;
    }
    if (new Set(completeLinks.map((link) => link.evidence_id)).size !== completeLinks.length) {
      setError("Use each source only once in this review.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await postJSON(
        `/care-continuity/claims/${encodeURIComponent(selectedClaim.id)}/assessments`,
        {
          status,
          superseded_by_claim_id: status === "superseded" ? supersededByClaimId : null,
          rationale: rationale.trim(),
          policy_version: "claim-assessment-v1",
          evidence_links: completeLinks.map((link) => ({
            evidence_id: link.evidence_id,
            relationship: link.relationship,
            source_passage: link.source_passage.trim() || null,
            scope_note: link.scope_note.trim() || null,
          })),
        },
      );
      setRationale("");
      setNotice("Review saved as a new version. Repeated reports or this review result do not prove that something is true.");
      await loadHistory();
    } catch {
      setError("The review could not be confirmed as saved. Check the selected sources and exact quoted words, then try again.");
    } finally {
      setSaving(false);
    }
  }

  return <section style={panel} aria-label="Review saved care information">
    <h3 style={{ fontSize: 15, marginTop: 0 }}>Review the information behind a care detail</h3>
    <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
      Compare a care detail with the saved sources. Any quoted passage must match the source exactly. Each review is saved as a new version. The original report is kept, and a review does not prove a medical fact.
    </p>
    {loading && <p role="status">Loading saved care details and sources…</p>}
    {error && <p role="alert" style={{ color: "var(--error)", fontSize: 12 }}>{error} <button type="button" style={button} onClick={() => void loadRecords()} disabled={loading}>Retry load</button></p>}
    {!loading && !error && claims.length === 0 && <p>There are no care details to review yet.</p>}
    {!loading && !error && claims.length > 0 && <>
      <label style={{ display: "block", fontSize: 12, marginBottom: 9 }}>Care detail
        <select style={field} value={selectedClaimId} onChange={(event) => setSelectedClaimId(event.target.value)}>
          {claims.map((claim) => <option key={claim.id} value={claim.id}>{simpleReviewStatus(claim.field)}: {claim.asserted_value.slice(0, 120)}</option>)}
        </select>
      </label>
      {selectedClaim && <div style={{ fontSize: 12, padding: 10, border: "1px solid var(--border)", borderRadius: 7, marginBottom: 10 }}>
        <div><strong>What was reported:</strong> {selectedClaim.asserted_value}</div>
        <div><strong>Who reported it:</strong> {selectedClaim.source_label || "Not recorded"}</div>
        <div><strong>Review status:</strong> {simpleReviewStatus(selectedClaim.assertion_status)}</div>
        <div><strong>Sources attached:</strong> {selectedClaim.evidence_ids?.length ?? 0}</div>
      </div>}
      <fieldset style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginBottom: 12, minWidth: 0 }}>
        <legend style={{ fontSize: 12 }}>How this detail relates to other details</legend>
        <p style={{ fontSize: 12 }}>Show how this care detail relates to another. These links help organize information; they do not prove it is true.</p>
        {dependencyLoading && <p role="status">Loading related care details…</p>}
        {dependencyError && <p role="alert" style={{ color: "var(--error)", fontSize: 12 }}>{dependencyError}</p>}
        {dependencyNotice && <p role="status" style={{ fontSize: 12 }}>{dependencyNotice}</p>}
        {!dependencyLoading && !dependencyError && dependencies.length === 0 &&
          <p style={{ fontSize: 12 }}>No related care details are linked to this one yet.</p>}
        {dependencies.length > 0 && <ul style={{ fontSize: 12, paddingLeft: 18 }}>
          {dependencies.map((edge) => <li key={edge.id}>
            {edge.claim_id === selectedClaimId ? "Depends on" : "Required by"}{" "}
            <strong>{claims.find((claim) => claim.id === (edge.claim_id === selectedClaimId ? edge.depends_on_claim_id : edge.claim_id))?.asserted_value || "Care detail not in this list"}</strong>
            {" · "}{simpleReviewStatus(edge.dependency_type)} · {edge.rationale}
          </li>)}
        </ul>}
        <label style={{ display: "block", fontSize: 12, marginBottom: 8 }}>Related care detail
          <select style={field} value={dependencyTargetId} onChange={(event) => setDependencyTargetId(event.target.value)}>
            <option value="">Select a different care detail</option>
            {claims.filter((claim) => claim.id !== selectedClaimId).map((claim) =>
              <option key={claim.id} value={claim.id}>{simpleReviewStatus(claim.field)}: {claim.asserted_value.slice(0, 100)}</option>)}
          </select>
        </label>
        <label style={{ display: "block", fontSize: 12, marginBottom: 8 }}>How they are related
          <select style={field} value={dependencyType} onChange={(event) => setDependencyType(event.target.value)}>
            {["derived_from", "requires", "supports", "qualifies", "supersedes"].map((value) =>
              <option key={value} value={value}>{simpleReviewStatus(value)}</option>)}
          </select>
        </label>
        <label style={{ display: "block", fontSize: 12, marginBottom: 8 }}>Why are these details related?
          <textarea style={{ ...field, minHeight: 60 }} value={dependencyRationale} onChange={(event) => setDependencyRationale(event.target.value)} />
        </label>
        <button type="button" style={button} onClick={() => void submitDependency()} disabled={dependencySaving || dependencyLoading}>
          {dependencySaving ? "Saving link…" : "Link these details"}
        </button>
      </fieldset>
      <label style={{ display: "block", fontSize: 12, marginBottom: 9 }}>Review result
        <select style={field} value={status} onChange={(event) => setStatus(event.target.value as (typeof statuses)[number])}>
          {statuses.map((value) => <option key={value} value={value}>{simpleReviewStatus(value)}</option>)}
        </select>
      </label>
      {status === "superseded" && <label style={{ display: "block", fontSize: 12, marginBottom: 9 }}>Replaced by
        <select style={field} value={supersededByClaimId} onChange={(event) => setSupersededByClaimId(event.target.value)}>
          <option value="">Choose the care detail that replaces this one</option>
          {claims.filter((claim) => claim.id !== selectedClaimId).map((claim) =>
            <option key={claim.id} value={claim.id}>{simpleReviewStatus(claim.field)}: {claim.asserted_value.slice(0, 120)}</option>
          )}
        </select>
      </label>}
      <div style={{ display: "grid", gap: 10 }}>
        {links.map((link, index) => <fieldset key={index} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10, minWidth: 0 }}>
          <legend style={{ fontSize: 12 }}>Source link {index + 1}</legend>
          <label style={{ display: "block", fontSize: 12, marginBottom: 8 }}>Source information
            <select style={field} value={link.evidence_id} onChange={(event) => updateLink(index, { evidence_id: event.target.value })}>
              <option value="">Choose a source</option>
              {evidence.map((item) => <option key={item.id} value={item.id}>{simpleReviewStatus(item.type)}</option>)}
            </select>
          </label>
          <label style={{ display: "block", fontSize: 12, marginBottom: 8 }}>How this source relates to the care detail
            <select style={field} value={link.relationship} onChange={(event) => updateLink(index, { relationship: event.target.value as DraftLink["relationship"] })}>
              {relationships.map((value) => <option key={value} value={value}>{simpleReviewStatus(value)}</option>)}
            </select>
          </label>
          <label style={{ display: "block", fontSize: 12, marginBottom: 8 }}>Exact words from the source
            <textarea style={{ ...field, minHeight: 68 }} value={link.source_passage} onChange={(event) => updateLink(index, { source_passage: event.target.value })} placeholder="Copy the exact words from the selected source. Do not rewrite them." />
          </label>
          <label style={{ display: "block", fontSize: 12 }}>What this source does not show (optional)
            <input style={field} value={link.scope_note} onChange={(event) => updateLink(index, { scope_note: event.target.value })} placeholder="What this passage does or does not establish" />
          </label>
          {links.length > 1 && <button type="button" style={{ ...button, marginTop: 8 }} onClick={() => setLinks((current) => current.filter((_, i) => i !== index))}>Remove source</button>}
        </fieldset>)}
      </div>
      <button type="button" style={{ ...button, marginTop: 9 }} onClick={() => setLinks((current) => [...current, emptyLink()])} disabled={links.length >= 10}>Add another source</button>
      <label style={{ display: "block", fontSize: 12, marginTop: 9 }}>Why this review was made
        <textarea style={{ ...field, minHeight: 75 }} value={rationale} onChange={(event) => setRationale(event.target.value)} placeholder="Explain what information you checked and what is still unclear." />
      </label>
      <button type="button" style={{ ...button, marginTop: 9 }} onClick={() => void submit()} disabled={saving || historyLoading}>{saving ? "Saving…" : "Save review"}</button>
      {notice && <p role="status" style={{ fontSize: 12 }}>{notice}</p>}
      <section aria-label="Check for new information" style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginTop: 12 }}>
        <h4 style={{ fontSize: 13, marginTop: 0, marginBottom: 5 }}>Check whether new information affects this review</h4>
        <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>This check looks for new or missing sources, changes to related care details, and reports that do not match. It does not prove that the information is true or complete.</p>
        {impactLoading && <p role="status">Checking whether new information affects this review…</p>}
        {impactError && <p role="alert" style={{ color: "var(--error)", fontSize: 12 }}>{impactError} <button type="button" style={button} onClick={() => void loadAssessmentImpact()} disabled={impactLoading}>Retry check</button></p>}
        {!impactLoading && !impactError && assessmentImpact && <>
          <strong>{assessmentImpact.review_required ? "Review required or not yet established as current" : "No reason to repeat this review was found"}</strong>
          <div style={{ fontSize: 12, marginTop: 5 }}>Status: {simpleReviewStatus(assessmentImpact.status)}{assessmentImpact.assessment_version != null ? ` · review version ${assessmentImpact.assessment_version}` : ""}</div>
          {assessmentImpact.reasons.length > 0
            ? <ul>{assessmentImpact.reasons.map((reason) => <li key={reason}>{simpleReviewStatus(reason)}</li>)}</ul>
            : <p style={{ fontSize: 12 }}>No reason to repeat this review was found in the information checked. This does not prove that the review is complete or correct.</p>}
          {assessmentImpact.missing_evidence_ids.length > 0 && <p>Sources that could not be found: {assessmentImpact.missing_evidence_ids.length}</p>}
          {assessmentImpact.unassessed_claim_evidence_ids.length > 0 && <p>Sources not included in the latest review: {assessmentImpact.unassessed_claim_evidence_ids.length}</p>}
          {assessmentImpact.changed_observation_ids && assessmentImpact.changed_observation_ids.length > 0 && <p>Source details added or corrected since this review: {assessmentImpact.changed_observation_ids.length}</p>}
          {assessmentImpact.changed_prerequisite_claim_ids.length > 0 && <p>Related care details that need another review: {assessmentImpact.changed_prerequisite_claim_ids.length}</p>}
          {assessmentImpact.unresolved_conflicts?.map((item) => <div key={item.conflict_id} style={{ borderTop: "1px solid var(--border)", paddingTop: 5, marginTop: 5 }}><strong>Reports that do not match · {item.field}</strong><div>{item.description}</div><small>{simpleReviewStatus(item.resolution_status)}</small></div>)}
          <p style={{ fontSize: 11, color: "var(--text-secondary)" }}>{assessmentImpact.interpretation_limit}</p>
        </>}
      </section>
      <h4 style={{ fontSize: 13, marginBottom: 5 }}>Past reviews</h4>
      {historyLoading && <p role="status">Loading saved review versions…</p>}
      {historyError && <p role="alert" style={{ color: "var(--error)", fontSize: 12 }}>{historyError} <button type="button" style={button} onClick={() => void loadHistory()} disabled={historyLoading}>Retry history</button></p>}
      {!historyLoading && !historyError && history.length === 0 && <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>No earlier reviews are saved for this care detail.</p>}
      {history.map((item) => <article key={item.id} style={{ borderTop: "1px solid var(--border)", padding: "9px 0", fontSize: 12 }}>
        <strong>Version {item.claim_version}: {simpleReviewStatus(item.status)}</strong>
        <div>{new Date(item.created_at).toLocaleString()} · Reviewed by a caregiver</div>
        <p>{item.rationale}</p>
        <ul>{item.evidence_links.map((link, i) => <li key={i}>
          {simpleReviewStatus(link.relationship)} · source information
          {link.source_passage ? <blockquote style={{ margin: "5px 0", paddingLeft: 8, borderLeft: "2px solid var(--border)" }}>{link.source_passage}</blockquote> : null}
          {link.scope_note ? <div>Scope: {link.scope_note}</div> : null}
        </li>)}</ul>
        {item.supersedes_assessment_id && <small>Replaces an earlier review</small>}
        {item.superseded_by_claim_id && <small>Replaced by newer care information</small>}
      </article>)}
    </>}
  </section>;
}
