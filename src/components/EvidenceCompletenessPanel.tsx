"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { ensureAnonymousSession, getJSON, postJSON } from "@/api/client";

type EvidenceItem = { id: string; person_id: string; type?: string; source_text?: string; evidence_kind?: string | null; epistemic_status?: string | null };
type Policy = { id: string; person_id: string; domain_key: string; purpose_key: string; policy_version: string; required_fields: string[]; rationale: string; immutable?: boolean };
type Assessment = { id: string; person_id: string; policy_id: string; policy_version: string; subject_type: string; subject_id: string; status: string; required_fields: string[]; satisfied_fields: string[]; missing_fields: string[]; field_evidence: Record<string, string[]>; evidence_ids: string[]; rationale: string; assessment_basis: string; semantic_sufficiency: string; assessed_at?: string | null; interpretation_limit: string };

const panel: CSSProperties = { border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginTop: 12, background: "var(--surface)", color: "var(--text)" };
const field: CSSProperties = { boxSizing: "border-box", width: "100%", padding: "9px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", marginTop: 5 };
const button: CSSProperties = { border: "1px solid var(--border)", borderRadius: 7, padding: "8px 11px", background: "var(--surface)", color: "var(--text)", cursor: "pointer" };

export default function EvidenceCompletenessPanel({ personId }: { personId?: string }) {
  const [scopeId, setScopeId] = useState("");
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState("");
  const [history, setHistory] = useState<Assessment[]>([]);
  const [domain, setDomain] = useState("");
  const [purpose, setPurpose] = useState("");
  const [version, setVersion] = useState("v1");
  const [requiredFieldsText, setRequiredFieldsText] = useState("");
  const [policyRationale, setPolicyRationale] = useState("");
  const [subjectType, setSubjectType] = useState("care_question");
  const [subjectId, setSubjectId] = useState("");
  const [assessmentRationale, setAssessmentRationale] = useState("");
  const [fieldEvidenceText, setFieldEvidenceText] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedPolicy = useMemo(() => policies.find((item) => item.id === selectedPolicyId), [policies, selectedPolicyId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const session = await ensureAnonymousSession();
      const actualPersonId = session.person?.id;
      if (!actualPersonId || (personId && actualPersonId !== personId)) throw new Error("Authenticated care-record scope did not match this view.");
      const [evidenceResult, policyResult] = await Promise.all([
        getJSON("/care-continuity/evidence?limit=100"),
        getJSON("/care-continuity/evidence-completeness/policies"),
      ]);
      if (!Array.isArray(evidenceResult) || evidenceResult.some((row) => row?.person_id !== actualPersonId || typeof row?.id !== "string")) {
        throw new Error("Evidence response failed care-record scope validation.");
      }
      if (!Array.isArray(policyResult?.items) || policyResult.items.some((row: Policy) => row?.person_id !== actualPersonId || typeof row?.id !== "string" || !Array.isArray(row?.required_fields))) {
        throw new Error("Completeness policy response failed care-record scope validation.");
      }
      setScopeId(actualPersonId);
      setEvidence(evidenceResult as EvidenceItem[]);
      setPolicies(policyResult.items as Policy[]);
      setSelectedPolicyId((current) => current && policyResult.items.some((item: Policy) => item.id === current) ? current : policyResult.items[0]?.id ?? "");
    } catch (cause) {
      setScopeId("");
      setEvidence([]);
      setPolicies([]);
      setSelectedPolicyId("");
      setError(cause instanceof Error ? cause.message : "Completeness data could not be loaded. No empty result is assumed.");
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => { void load(); }, [load]);

  const loadHistory = useCallback(async () => {
    if (!scopeId || !selectedPolicyId || !subjectType.trim() || !subjectId.trim()) {
      setHistory([]);
      return;
    }
    try {
      const result = await getJSON("/care-continuity/evidence-completeness/assessments/" + encodeURIComponent(subjectType.trim()) + "/" + encodeURIComponent(subjectId.trim())) as { items?: Assessment[] };
      if (!Array.isArray(result?.items) || result.items.some((row) => row.person_id !== scopeId || row.subject_type !== subjectType.trim() || row.subject_id !== subjectId.trim())) {
        throw new Error("Assessment history failed care-record scope validation.");
      }
      setHistory(result.items);
    } catch (cause) {
      setHistory([]);
      setError(cause instanceof Error ? cause.message : "Assessment history is unavailable; this is not an empty-history finding.");
    }
  }, [scopeId, selectedPolicyId, subjectType, subjectId]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  async function createPolicy() {
    setSaving(true); setError(""); setNotice("");
    try {
      const requiredFields = requiredFieldsText.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
      const payload = {
        domain_key: domain.trim().toLowerCase(),
        purpose_key: purpose.trim().toLowerCase(),
        policy_version: version.trim(),
        required_fields: requiredFields,
        rationale: policyRationale.trim(),
      };
      if (!payload.domain_key || !payload.purpose_key || !payload.policy_version || !payload.rationale || requiredFields.length === 0) {
        throw new Error("Provide domain, purpose, version, required fields, and rationale.");
      }
      const saved = await postJSON("/care-continuity/evidence-completeness/policies", payload) as Policy;
      if (!saved?.id || saved.person_id !== scopeId || saved.domain_key !== payload.domain_key || saved.purpose_key !== payload.purpose_key || saved.policy_version !== payload.policy_version) {
        throw new Error("The server response did not confirm the requested policy was persisted in this care record.");
      }
      setSelectedPolicyId(saved.id);
      setPolicyRationale("");
      setNotice("Purpose-specific policy persisted. Existing policy versions remain unchanged.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Policy persistence could not be confirmed.");
    } finally { setSaving(false); }
  }

  async function assess() {
    if (!selectedPolicy || !subjectId.trim() || !assessmentRationale.trim()) {
      setError("Select a policy and provide a subject ID and assessment rationale.");
      return;
    }
    setSaving(true); setError(""); setNotice("");
    try {
      const field_evidence: Record<string, string[]> = {};
      for (const fieldName of selectedPolicy.required_fields) {
        const ids = (fieldEvidenceText[fieldName] || "").split(",").map((value) => value.trim()).filter(Boolean);
        if (ids.length) field_evidence[fieldName] = [...new Set(ids)];
      }
      const saved = await postJSON("/care-continuity/evidence-completeness/assessments", {
        policy_id: selectedPolicy.id,
        subject_type: subjectType.trim().toLowerCase(),
        subject_id: subjectId.trim(),
        rationale: assessmentRationale.trim(),
        assessment_mode: "assessed",
        field_evidence,
      }) as Assessment;
      if (!saved?.id || saved.person_id !== scopeId || saved.policy_id !== selectedPolicy.id || saved.subject_id !== subjectId.trim()) {
        throw new Error("The server did not confirm persistence of the matching assessment.");
      }
      if (saved.semantic_sufficiency !== "not_automatically_verified") throw new Error("Unexpected semantic-sufficiency contract; assessment display was withheld.");
      setNotice("Assessment persisted. Linked-source coverage is recorded; semantic sufficiency and truth were not automatically verified.");
      await loadHistory();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Assessment persistence could not be confirmed.");
    } finally { setSaving(false); }
  }

  return (
    <section style={panel} aria-labelledby="evidence-completeness-heading">
      <h3 id="evidence-completeness-heading">Purpose-specific evidence completeness</h3>
      <p>Define what information a particular care task requires, then record which source evidence is linked to each field. A populated field is source-link coverage—not proof that its evidence is true or semantically sufficient.</p>
      {loading && <p role="status">Loading authorized evidence and completeness policies…</p>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {!loading && scopeId && (
        <>
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 12 }}>
            <h4>Create immutable policy version</h4>
            <label>Care domain<input style={field} value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="e.g. medication_history" /></label>
            <label>Purpose<input style={field} value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="e.g. appointment_preparation" /></label>
            <label>Version<input style={field} value={version} onChange={(event) => setVersion(event.target.value)} /></label>
            <label>Required fields (comma-separated identifiers)<input style={field} value={requiredFieldsText} onChange={(event) => setRequiredFieldsText(event.target.value)} placeholder="source, event_time, context" /></label>
            <label>Why these fields are required<textarea style={field} rows={2} value={policyRationale} onChange={(event) => setPolicyRationale(event.target.value)} /></label>
            <button type="button" style={button} disabled={saving} onClick={() => void createPolicy()}>{saving ? "Saving…" : "Save new policy version"}</button>
          </div>
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 12 }}>
            <h4>Assess source coverage for a specific subject</h4>
            <label>Policy<select style={field} value={selectedPolicyId} onChange={(event) => { setSelectedPolicyId(event.target.value); setFieldEvidenceText({}); }}><option value="">Choose a saved policy</option>{policies.map((item) => <option key={item.id} value={item.id}>{item.domain_key} · {item.purpose_key} · {item.policy_version}</option>)}</select></label>
            {selectedPolicy && <p>Required fields: {selectedPolicy.required_fields.join(", ")}. Policy rationale: {selectedPolicy.rationale}</p>}
            <label>Subject type<input style={field} value={subjectType} onChange={(event) => setSubjectType(event.target.value)} placeholder="care_question" /></label>
            <label>Subject ID<input style={field} value={subjectId} onChange={(event) => setSubjectId(event.target.value)} placeholder="Existing claim, question, decision, or task ID" /></label>
            {selectedPolicy?.required_fields.map((fieldName) => (
              <label key={fieldName}>{fieldName} — evidence IDs (comma-separated)<input style={field} value={fieldEvidenceText[fieldName] || ""} onChange={(event) => setFieldEvidenceText((current) => ({ ...current, [fieldName]: event.target.value }))} placeholder="Paste persisted evidence ID(s)" /></label>
            ))}
            {evidence.length > 0 && <details><summary>Inspect available evidence IDs ({evidence.length} records returned; list is bounded)</summary><ul>{evidence.map((item) => <li key={item.id}><code>{item.id}</code> · {item.evidence_kind || item.type || "type not recorded"} · {(item.source_text || "").slice(0, 180)}</li>)}</ul></details>}
            <label>Assessment rationale<textarea style={field} rows={2} value={assessmentRationale} onChange={(event) => setAssessmentRationale(event.target.value)} placeholder="Explain the scope and limits of this source-coverage assessment." /></label>
            <button type="button" style={button} disabled={saving || !selectedPolicy} onClick={() => void assess()}>{saving ? "Saving…" : "Persist completeness assessment"}</button>
          </div>
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 12 }}>
            <h4>Assessment history for this subject</h4>
            {!subjectId.trim() ? <p>Enter a subject ID to inspect persisted history.</p> : history.length === 0 ? <p>No assessment rows were returned for this subject, or history could not be loaded. Check any error above before interpreting this as no history.</p> : history.map((item) => (
              <article key={item.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginTop: 8 }}>
                <strong>{item.status.replaceAll("_", " ")}</strong> · policy {item.policy_version} · assessed {item.assessed_at || "time not recorded"}
                <p>Covered fields: {item.satisfied_fields.join(", ") || "none"}.</p>
                <p>Missing fields: {item.missing_fields.join(", ") || "none reported"}.</p>
                <p>{item.rationale}</p>
                <small>{item.interpretation_limit}</small>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
