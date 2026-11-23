"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { ensureAnonymousSession, getJSON, postJSON } from "@/api/client";
import { caregiverInformationLabel, caregiverSafeGeneratedText, caregiverStatusLabel } from "@/lib/caregiver-language";

type Claim = {
  id: string;
  person_id: string;
  asserted_value: string;
  field: string;
  source_label: string;
  epistemic_state: string;
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
  changed_observation_ids: string[];
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
    supported: "Matches the saved note or document",
    partially_supported: "Some details are supported",
    contradicted: "Does not match other information",
    unverified: "Not confirmed",
    uncertain: "Still unclear",
    conflicting: "Reports do not match",
    missing_evidence: "No note or document is linked",
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
    source_observation_added_or_corrected_after_assessment: "A note or document was added or corrected after this review",
    prerequisite_claim_source_or_assessment_changed: "A related care detail or note changed after this review",
    current: "Current",
    outdated: "May be out of date",
    unchanged: "No change found",
  } as Record<string, string>)[value] ?? caregiverStatusLabel(value) ?? "Not available";
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
        throw new Error("Choose a note or documents were not valid for the authenticated care record");
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
      setError("Care details and related notes could not be loaded. This does not mean your Care Record is empty. Try again when you are connected.");
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
        !Array.isArray(result.changed_observation_ids) ||
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
          setDependencyError("Another care details could not be loaded. This does not mean there are no related details.");
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
      setDependencyError("Choose a different care detail and explain how the two details are related.");
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
    } catch {
      setDependencyError("We couldn't confirm that this connection was saved. Check your connection and refresh before trying again.");
      setDependencySaving(false);
      return;
    }

    // The backend confirmed the write. A later refresh failure must not undo
    // the receipt or suggest that the caregiver's action was lost.
    setDependencyRationale("");
    setDependencyNotice("The connection was saved. This records how the details are related; it does not prove that either detail is true.");
    try {
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
      setDependencyError("The connection was saved, but related care details could not be refreshed. Reload this section before making another change.");
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
      setError("Choose another care detail to show that this one has been replaced.");
      return;
    }
    const completeLinks = links.filter((link) => link.evidence_id.trim());
    if (completeLinks.length !== links.length) {
      setError("Choose a note or document for each row, or remove the row.");
      return;
    }
    if (new Set(completeLinks.map((link) => link.evidence_id)).size !== completeLinks.length) {
      setError("Use each note or document only once in this review.");
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
      setNotice("Your review was saved. Repeated reports or this review do not prove that something is true.");
      await loadHistory();
    } catch {
      setError("We could not confirm that your review was saved. Check the selected notes or documents and the exact words you copied, then try again.");
    } finally {
      setSaving(false);
    }
  }

  return <section style={panel} aria-label="Review saved care information">
    <h3 style={{ fontSize: "calc(15px * var(--solenos-text-scale, 1))", marginTop: 0 }}>Check the information behind a care detail</h3>
    <p style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>
      Compare a care detail with the saved notes or documents. Any quoted words must match the original exactly. Your review is saved, and the original report is kept. A review does not prove a medical fact.
    </p>
    {loading && <p role="status">Loading saved care details and related notes…</p>}
    {error && <p role="alert" style={{ color: "var(--error)", fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>{error} <button type="button" style={button} onClick={() => void loadRecords()} disabled={loading}>Try again</button></p>}
    {!loading && !error && claims.length === 0 && <p>There are no care details to review yet.</p>}
    {!loading && !error && claims.length > 0 && <>
      <label style={{ display: "block", fontSize: "calc(12px * var(--solenos-text-scale, 1))", marginBottom: 9 }}>Care detail
        <select style={field} value={selectedClaimId} onChange={(event) => setSelectedClaimId(event.target.value)}>
          {claims.map((claim) => <option key={claim.id} value={claim.id}>{simpleReviewStatus(claim.field)}: {claim.asserted_value.slice(0, 120)}</option>)}
        </select>
      </label>
      {selectedClaim && <div style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))", padding: 10, border: "1px solid var(--border)", borderRadius: 7, marginBottom: 10 }}>
        <div><strong>What was reported:</strong> {selectedClaim.asserted_value}</div>
        <div><strong>Who reported it:</strong> {caregiverSafeGeneratedText(selectedClaim.source_label) || "Not recorded"}</div>
        <div><strong>What we know:</strong> {caregiverInformationLabel(selectedClaim.epistemic_state || "reported") || "Not yet confirmed"}</div>
        <div><strong>Review:</strong> {simpleReviewStatus(selectedClaim.assertion_status)}</div>
        <div><strong>Related notes and documents:</strong> {selectedClaim.evidence_ids?.length ?? 0}</div>
      </div>}
      <fieldset style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginBottom: 12, minWidth: 0 }}>
        <legend style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>How this care detail is connected to others</legend>
        <p style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>Show how this care detail is connected to another. These connections help organize information; they do not prove it is true.</p>
        {dependencyLoading && <p role="status">Loading related care details…</p>}
        {dependencyError && <p role="alert" style={{ color: "var(--error)", fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>{dependencyError}</p>}
        {dependencyNotice && <p role="status" style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>{dependencyNotice}</p>}
        {!dependencyLoading && !dependencyError && dependencies.length === 0 &&
          <p style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>No other care details are connected to this one yet.</p>}
        {dependencies.length > 0 && <ul style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))", paddingLeft: 18 }}>
          {dependencies.map((edge) => <li key={edge.id}>
            {edge.claim_id === selectedClaimId ? "This detail depends on" : "This detail is needed by"}{" "}
            <strong>{claims.find((claim) => claim.id === (edge.claim_id === selectedClaimId ? edge.depends_on_claim_id : edge.claim_id))?.asserted_value || "Care detail not in this list"}</strong>
            {" · "}{simpleReviewStatus(edge.dependency_type)} · {caregiverSafeGeneratedText(edge.rationale) || "No further explanation is available."}
          </li>)}
        </ul>}
        <label style={{ display: "block", fontSize: "calc(12px * var(--solenos-text-scale, 1))", marginBottom: 8 }}>Another care detail
          <select style={field} value={dependencyTargetId} onChange={(event) => setDependencyTargetId(event.target.value)}>
            <option value="">Select a different care detail</option>
            {claims.filter((claim) => claim.id !== selectedClaimId).map((claim) =>
              <option key={claim.id} value={claim.id}>{simpleReviewStatus(claim.field)}: {claim.asserted_value.slice(0, 100)}</option>)}
          </select>
        </label>
        <label style={{ display: "block", fontSize: "calc(12px * var(--solenos-text-scale, 1))", marginBottom: 8 }}>How they are related
          <select style={field} value={dependencyType} onChange={(event) => setDependencyType(event.target.value)}>
            {["derived_from", "requires", "supports", "qualifies", "supersedes"].map((value) =>
              <option key={value} value={value}>{simpleReviewStatus(value)}</option>)}
          </select>
        </label>
        <label style={{ display: "block", fontSize: "calc(12px * var(--solenos-text-scale, 1))", marginBottom: 8 }}>Why are these details related?
          <textarea style={{ ...field, minHeight: 60 }} value={dependencyRationale} onChange={(event) => setDependencyRationale(event.target.value)} />
        </label>
        <button type="button" style={button} onClick={() => void submitDependency()} disabled={dependencySaving || dependencyLoading}>
          {dependencySaving ? "Saving connection…" : "Connect these details"}
        </button>
      </fieldset>
      <label style={{ display: "block", fontSize: "calc(12px * var(--solenos-text-scale, 1))", marginBottom: 9 }}>What did you find?
        <select style={field} value={status} onChange={(event) => setStatus(event.target.value as (typeof statuses)[number])}>
          {statuses.map((value) => <option key={value} value={value}>{simpleReviewStatus(value)}</option>)}
        </select>
      </label>
      {status === "superseded" && <label style={{ display: "block", fontSize: "calc(12px * var(--solenos-text-scale, 1))", marginBottom: 9 }}>Replaced by
        <select style={field} value={supersededByClaimId} onChange={(event) => setSupersededByClaimId(event.target.value)}>
          <option value="">Choose the care detail that replaces this one</option>
          {claims.filter((claim) => claim.id !== selectedClaimId).map((claim) =>
            <option key={claim.id} value={claim.id}>{simpleReviewStatus(claim.field)}: {claim.asserted_value.slice(0, 120)}</option>
          )}
        </select>
      </label>}
      <div style={{ display: "grid", gap: 10 }}>
        {links.map((link, index) => <fieldset key={index} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10, minWidth: 0 }}>
          <legend style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>Note or document {index + 1}</legend>
          <label style={{ display: "block", fontSize: "calc(12px * var(--solenos-text-scale, 1))", marginBottom: 8 }}>Choose a note or document
            <select style={field} value={link.evidence_id} onChange={(event) => updateLink(index, { evidence_id: event.target.value })}>
              <option value="">Choose a note or document</option>
              {evidence.map((item) => <option key={item.id} value={item.id}>{simpleReviewStatus(item.type)}</option>)}
            </select>
          </label>
          <label style={{ display: "block", fontSize: "calc(12px * var(--solenos-text-scale, 1))", marginBottom: 8 }}>How this note or document relates to this care detail
            <select style={field} value={link.relationship} onChange={(event) => updateLink(index, { relationship: event.target.value as DraftLink["relationship"] })}>
              {relationships.map((value) => <option key={value} value={value}>{simpleReviewStatus(value)}</option>)}
            </select>
          </label>
          <label style={{ display: "block", fontSize: "calc(12px * var(--solenos-text-scale, 1))", marginBottom: 8 }}>Exact words from the note or document
            <textarea style={{ ...field, minHeight: 68 }} value={link.source_passage} onChange={(event) => updateLink(index, { source_passage: event.target.value })} placeholder="Enter the exact words from the selected note or document. Do not rewrite them." />
          </label>
          <label style={{ display: "block", fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>What this note or document does not tell us (optional)
            <input style={field} value={link.scope_note} onChange={(event) => updateLink(index, { scope_note: event.target.value })} placeholder="What this note or document does or does not tell us" />
          </label>
          {links.length > 1 && <button type="button" style={{ ...button, marginTop: 8 }} onClick={() => setLinks((current) => current.filter((_, i) => i !== index))}>Remove note or document</button>}
        </fieldset>)}
      </div>
      <button type="button" style={{ ...button, marginTop: 9 }} onClick={() => setLinks((current) => [...current, emptyLink()])} disabled={links.length >= 10}>Add another note or document</button>
      <label style={{ display: "block", fontSize: "calc(12px * var(--solenos-text-scale, 1))", marginTop: 9 }}>Why are you reviewing this information?
        <textarea style={{ ...field, minHeight: 75 }} value={rationale} onChange={(event) => setRationale(event.target.value)} placeholder="Explain what information you checked and what is still unclear." />
      </label>
      <button type="button" style={{ ...button, marginTop: 9 }} onClick={() => void submit()} disabled={saving || historyLoading}>{saving ? "Saving…" : "Save review"}</button>
      {notice && <p role="status" style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>{notice}</p>}
      <section aria-label="Check for new information" style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginTop: 12 }}>
        <h4 style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))", marginTop: 0, marginBottom: 5 }}>Check whether anything new changes this review</h4>
        <p style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>We look for new or missing notes or documents, changes to related care details, and reports that do not match. This cannot prove that the information is true or complete.</p>
        {impactLoading && <p role="status">Checking whether new information affects this review…</p>}
        {impactError && <p role="alert" style={{ color: "var(--error)", fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>{impactError} <button type="button" style={button} onClick={() => void loadAssessmentImpact()} disabled={impactLoading}>Retry check</button></p>}
        {!impactLoading && !impactError && assessmentImpact && <>
          <strong>{assessmentImpact.review_required ? "This information needs another review" : "No new information was found that requires another review"}</strong>
          <div style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))", marginTop: 5 }}>Check result: {simpleReviewStatus(assessmentImpact.status)}</div>
          {assessmentImpact.reasons.length > 0
            ? <ul>{assessmentImpact.reasons.map((reason) => <li key={reason}>{simpleReviewStatus(reason)}</li>)}</ul>
            : <p style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>We found no new information that calls for another review in the items we checked. This does not mean the review is complete or correct.</p>}
          {assessmentImpact.missing_evidence_ids.length > 0 && <p>Notes or documents that could not be found: {assessmentImpact.missing_evidence_ids.length}</p>}
          {assessmentImpact.unassessed_claim_evidence_ids.length > 0 && <p>Notes or documents not included in the latest review: {assessmentImpact.unassessed_claim_evidence_ids.length}</p>}
          {assessmentImpact.changed_observation_ids && assessmentImpact.changed_observation_ids.length > 0 && <p>Details added or corrected since this review: {assessmentImpact.changed_observation_ids.length}</p>}
          {assessmentImpact.changed_prerequisite_claim_ids.length > 0 && <p>Other care details that need another review: {assessmentImpact.changed_prerequisite_claim_ids.length}</p>}
          {assessmentImpact.unresolved_conflicts?.map((item) => <div key={item.conflict_id} style={{ borderTop: "1px solid var(--border)", paddingTop: 5, marginTop: 5 }}><strong>Reports that do not match · {simpleReviewStatus(item.field)}</strong><div>{caregiverSafeGeneratedText(item.description) || "The saved reports do not match."}</div><small>{simpleReviewStatus(item.resolution_status)}</small></div>)}
          <p style={{ fontSize: "calc(11px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>{caregiverSafeGeneratedText(assessmentImpact.interpretation_limit) || "This check may not include every relevant detail."}</p>
        </>}
      </section>
      <h4 style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))", marginBottom: 5 }}>Past reviews</h4>
      {historyLoading && <p role="status">Loading earlier reviews…</p>}
      {historyError && <p role="alert" style={{ color: "var(--error)", fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>{historyError} <button type="button" style={button} onClick={() => void loadHistory()} disabled={historyLoading}>Retry history</button></p>}
      {!historyLoading && !historyError && history.length === 0 && <p style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>No earlier reviews are saved for this care detail.</p>}
      {history.map((item) => <article key={item.id} style={{ borderTop: "1px solid var(--border)", padding: "9px 0", fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>
        <strong>Earlier review: {simpleReviewStatus(item.status)}</strong>
        <div>{new Date(item.created_at).toLocaleString()} · Reviewed by a caregiver</div>
        <p>{caregiverSafeAssistantText(item.rationale) || "No further explanation is available."}</p>
        <ul>{item.evidence_links.map((link, i) => <li key={i}>
          {simpleReviewStatus(link.relationship)} · note or document
          {link.source_passage ? <blockquote style={{ margin: "5px 0", paddingLeft: 8, borderLeft: "2px solid var(--border)" }}>{link.source_passage}</blockquote> : null}
          {link.scope_note ? <div>What this does and does not show: {link.scope_note}</div> : null}
        </li>)}</ul>
        {item.supersedes_assessment_id && <small>Replaces an earlier review</small>}
        {item.superseded_by_claim_id && <small>Replaced by newer care information</small>}
      </article>)}
    </>}
  </section>;
}
