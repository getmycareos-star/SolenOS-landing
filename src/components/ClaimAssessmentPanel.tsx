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
  created_at: string;
};
type DraftLink = {
  evidence_id: string;
  relationship: "supports" | "partial_support" | "scope_limited" | "contradicts" | "neutral";
  source_passage: string;
  scope_note: string;
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
        throw new Error("Evidence records were not valid for the authenticated care record");
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
      setError("Claims and evidence could not be loaded from this care record. No empty record set is assumed; retry when connected.");
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
      setHistoryError("Assessment history is unavailable. A failed request is not an empty history.");
    } finally {
      setHistoryLoading(false);
    }
  }, [personId, selectedClaimId]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  function updateLink(index: number, patch: Partial<DraftLink>) {
    setLinks((current) => current.map((link, i) => i === index ? { ...link, ...patch } : link));
  }

  async function submit() {
    if (!selectedClaim || rationale.trim().length < 3) {
      setError("Select a claim and provide an assessment rationale.");
      return;
    }
    if (status === "superseded" && (!supersededByClaimId || supersededByClaimId === selectedClaim.id)) {
      setError("Select a different claim in this same care record as the supersession target.");
      return;
    }
    const completeLinks = links.filter((link) => link.evidence_id.trim());
    if (completeLinks.length !== links.length) {
      setError("Each evidence-link row must select an evidence record or be removed.");
      return;
    }
    if (new Set(completeLinks.map((link) => link.evidence_id)).size !== completeLinks.length) {
      setError("Select each evidence record only once per assessment.");
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
      setNotice("Claim assessment saved as a new version. SolenOS does not infer truth from repeated statements or this status alone.");
      await loadHistory();
    } catch {
      setError("Assessment persistence was not confirmed. Check the required status-to-evidence relationships, exact source passages, and connection; no successful save is assumed.");
    } finally {
      setSaving(false);
    }
  }

  return <section style={panel} aria-label="Evidence-grounded claim assessments">
    <h3 style={{ fontSize: 15, marginTop: 0 }}>Claim evidence and assessment history</h3>
    <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
      Assess a specific claim against linked evidence. Support and contradiction passages must exactly match the saved source text. Assessments are append-only versions; they do not overwrite the original report or independently prove a clinical fact.
    </p>
    {loading && <p role="status">Loading persisted claims and evidence…</p>}
    {error && <p role="alert" style={{ color: "var(--error)", fontSize: 12 }}>{error} <button type="button" style={button} onClick={() => void loadRecords()} disabled={loading}>Retry load</button></p>}
    {!loading && !error && claims.length === 0 && <p>No claims were returned for this care record.</p>}
    {!loading && !error && claims.length > 0 && <>
      <label style={{ display: "block", fontSize: 12, marginBottom: 9 }}>Claim
        <select style={field} value={selectedClaimId} onChange={(event) => setSelectedClaimId(event.target.value)}>
          {claims.map((claim) => <option key={claim.id} value={claim.id}>{claim.field}: {claim.asserted_value.slice(0, 120)}</option>)}
        </select>
      </label>
      {selectedClaim && <div style={{ fontSize: 12, padding: 10, border: "1px solid var(--border)", borderRadius: 7, marginBottom: 10 }}>
        <div><strong>Reported claim:</strong> {selectedClaim.asserted_value}</div>
        <div><strong>Reporter/source label:</strong> {selectedClaim.source_label || "Not recorded"}</div>
        <div><strong>Current assertion status:</strong> {selectedClaim.assertion_status.replaceAll("_", " ")}</div>
        <div><strong>Linked evidence IDs:</strong> {selectedClaim.evidence_ids?.length ? selectedClaim.evidence_ids.join(", ") : "None recorded"}</div>
      </div>}
      <label style={{ display: "block", fontSize: 12, marginBottom: 9 }}>Explicit assessment status
        <select style={field} value={status} onChange={(event) => setStatus(event.target.value as (typeof statuses)[number])}>
          {statuses.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
        </select>
      </label>
      {status === "superseded" && <label style={{ display: "block", fontSize: 12, marginBottom: 9 }}>Superseded by claim
        <select style={field} value={supersededByClaimId} onChange={(event) => setSupersededByClaimId(event.target.value)}>
          <option value="">Select the replacement claim</option>
          {claims.filter((claim) => claim.id !== selectedClaimId).map((claim) =>
            <option key={claim.id} value={claim.id}>{claim.field}: {claim.asserted_value.slice(0, 120)}</option>
          )}
        </select>
      </label>}
      <div style={{ display: "grid", gap: 10 }}>
        {links.map((link, index) => <fieldset key={index} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10, minWidth: 0 }}>
          <legend style={{ fontSize: 12 }}>Evidence link {index + 1}</legend>
          <label style={{ display: "block", fontSize: 12, marginBottom: 8 }}>Evidence record
            <select style={field} value={link.evidence_id} onChange={(event) => updateLink(index, { evidence_id: event.target.value })}>
              <option value="">Select evidence (required for this link)</option>
              {evidence.map((item) => <option key={item.id} value={item.id}>{item.type} · {item.id}</option>)}
            </select>
          </label>
          <label style={{ display: "block", fontSize: 12, marginBottom: 8 }}>Relationship to this claim
            <select style={field} value={link.relationship} onChange={(event) => updateLink(index, { relationship: event.target.value as DraftLink["relationship"] })}>
              {relationships.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
            </select>
          </label>
          <label style={{ display: "block", fontSize: 12, marginBottom: 8 }}>Exact source passage
            <textarea style={{ ...field, minHeight: 68 }} value={link.source_passage} onChange={(event) => updateLink(index, { source_passage: event.target.value })} placeholder="Copy the exact passage from the selected evidence record. Do not paraphrase." />
          </label>
          <label style={{ display: "block", fontSize: 12 }}>Scope limitation (optional)
            <input style={field} value={link.scope_note} onChange={(event) => updateLink(index, { scope_note: event.target.value })} placeholder="What this passage does or does not establish" />
          </label>
          {links.length > 1 && <button type="button" style={{ ...button, marginTop: 8 }} onClick={() => setLinks((current) => current.filter((_, i) => i !== index))}>Remove link</button>}
        </fieldset>)}
      </div>
      <button type="button" style={{ ...button, marginTop: 9 }} onClick={() => setLinks((current) => [...current, emptyLink()])} disabled={links.length >= 10}>Add evidence link</button>
      <label style={{ display: "block", fontSize: 12, marginTop: 9 }}>Assessment rationale
        <textarea style={{ ...field, minHeight: 75 }} value={rationale} onChange={(event) => setRationale(event.target.value)} placeholder="Explain the scope of the assessment, the evidence considered, and what remains uncertain." />
      </label>
      <button type="button" style={{ ...button, marginTop: 9 }} onClick={() => void submit()} disabled={saving || historyLoading}>{saving ? "Saving…" : "Save claim assessment"}</button>
      {notice && <p role="status" style={{ fontSize: 12 }}>{notice}</p>}
      <h4 style={{ fontSize: 13, marginBottom: 5 }}>Assessment history</h4>
      {historyLoading && <p role="status">Loading saved assessment versions…</p>}
      {historyError && <p role="alert" style={{ color: "var(--error)", fontSize: 12 }}>{historyError} <button type="button" style={button} onClick={() => void loadHistory()} disabled={historyLoading}>Retry history</button></p>}
      {!historyLoading && !historyError && history.length === 0 && <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>No saved assessment versions were returned.</p>}
      {history.map((item) => <article key={item.id} style={{ borderTop: "1px solid var(--border)", padding: "9px 0", fontSize: 12 }}>
        <strong>Version {item.claim_version}: {item.status.replaceAll("_", " ")}</strong>
        <div>{new Date(item.created_at).toLocaleString()} · {item.policy_version} · reviewer {item.reviewed_by_caregiver_id}</div>
        <p>{item.rationale}</p>
        <ul>{item.evidence_links.map((link, i) => <li key={i}>
          {link.relationship.replaceAll("_", " ")} · evidence {link.evidence_id}
          {link.source_passage ? <blockquote style={{ margin: "5px 0", paddingLeft: 8, borderLeft: "2px solid var(--border)" }}>{link.source_passage}</blockquote> : null}
          {link.scope_note ? <div>Scope: {link.scope_note}</div> : null}
        </li>)}</ul>
        {item.supersedes_assessment_id && <small>Supersedes assessment {item.supersedes_assessment_id}</small>}
        {item.superseded_by_claim_id && <small>Superseded by claim {item.superseded_by_claim_id}</small>}
      </article>)}
    </>}
  </section>;
}
