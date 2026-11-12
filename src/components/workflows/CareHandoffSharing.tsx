"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { CheckCircle2, Clock3, Inbox, RefreshCw, Share2 } from "lucide-react";
import { ensureAnonymousSession, getBlob, getJSON, postJSON, putJSON } from "@/api/client";
import Link from "next/link";

type HandoffDraftPurpose = "family_transition" | "return_to_care" | "professional_appointment" | "hospital_discharge" | "period_summary";

type DraftItem = {
  source_type: string;
  source_table: string;
  source_id: string;
  event_at?: string | null;
  recorded_at: string | null;
  due_at?: string | null;
  details?: Record<string, unknown>;
  epistemic_status: string;
  record_status?: string;
  text: string;
  stale_warning?: boolean;
  evidence_ids?: string[];
  evidence_sources?: Array<{
    evidence_id: string; type: string; evidence_kind?: string | null; epistemic_status: string;
    source_type?: string | null; original_author?: string | null; reported_by_label?: string | null;
    occurred_at?: string | null; original_source_reference?: string | null; parent_evidence_id?: string | null;
  }>;
  evidence_reference_status?: string;
};
type DraftPayload = {
  draft_id: string;
  purpose: string;
  generation_status?: string;
  validation_status?: string;
  review_status?: string;
  revision_number?: number;
  generation?: { status: string; provider?: string | null; model?: string | null; sections: Array<{ section: string; text: string; source_ref: string; epistemic_status?: string; record_status?: string; event_at?: string | null; recorded_at?: string | null; stale_warning?: boolean }> };
  caregiver_notes?: Array<{ text: string; attribution: string }>;
  audience?: "family" | "professional";
  prepared_at: string;
  window: { days: number; from: string; to: string };
  sections: Array<{ title: string; items: DraftItem[] }>;
  template_sections?: Array<{ title: string; coverage_status: string; required_fields: string[]; coverage_note: string }>;
  source_statuses: Record<string, { status: string; reason?: string; label?: string; count: number }>;
  source_references: Array<{ source_id: string; source_table: string }>;
  evidence_lineage?: {
    status: string;
    evidence_ids_considered: string[];
    groups: Array<{ lineage_id: string; evidence_ids: string[]; origin_group_keys: string[]; source_independence_status: string; interpretation_limit: string }>;
    interpretation_limit: string;
  };
  limitations: Array<{ source: string; status: string; reason?: string }>;
  warning: string;
};
type Recipient = { caregiver_id: string; name: string; relationship: string; can_receive_handoff: boolean };
type InboxItem = {
  id: string; from_caregiver_id: string; from_caregiver_name: string;
  from_caregiver_relationship?: string | null; scope: string[]; status: string;
  created_at: string | null; expires_at: string | null; has_summary: boolean;
};
type OutboxItem = {
  id: string; status: string; scope: string[]; created_at: string | null;
  expires_at: string | null; has_summary: boolean; is_expired?: boolean;
  recipients?: Array<{ caregiver_id: string; name?: string; status?: string }>;
};
type DraftRevision = {
  revision_number: number;
  change_type: string;
  created_at: string | null;
  content?: {
    generation?: { sections?: Array<{ section: string; text: string; source_ref: string }> };
    caregiver_notes?: Array<{ text: string; attribution: string }>;
  };
  source_snapshot?: { source_records?: unknown[] };
};
type Snapshot = {
  purpose?: string;
  audience?: string;
  window?: { days: number; from: string; to: string };
  sections?: Record<string, string>;
  source_coverage?: Record<string, { status: string; reason?: string; label?: string; count: number }>;
  limitations?: Array<{ source: string; status: string; reason?: string }>;
  source_references?: Array<{ source_ref: string; epistemic_status: string; record_status: string; event_at?: string | null; recorded_at?: string | null; stale_warning: boolean; document_id?: string | null; original_source_reference?: string | null; page_references?: unknown }>;
  content_sha256?: string;
  source_id_validation?: string;
};
type Props = {
  draft: DraftPayload | null;
  audience: "family" | "professional" | null;
  purpose: "today" | "appointment" | "overview" | null;
  onResumeDraft?: (draft: DraftPayload) => void;
};

const panel: CSSProperties = { marginTop: 12, padding: 14, border: "1px solid #dce7dc", borderRadius: 12, background: "#fff" };
const button: CSSProperties = { border: "1px solid #cbd8cb", borderRadius: 9, padding: "9px 12px", background: "#dce9dc", color: "#172117", fontWeight: 650, cursor: "pointer" };
const quietButton: CSSProperties = { ...button, background: "transparent", fontWeight: 550 };
const field: CSSProperties = { width: "100%", border: "1px solid #cbd8cb", borderRadius: 9, padding: 10, color: "#172117", background: "#fff" };

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleString();
}

function handoffPurposeLabel(value: string): string {
  if (value === "family_transition" || value === "return_to_care") return "Taking over today";
  if (value === "professional_appointment") return "Doctor’s appointment";
  if (value === "period_summary") return "Full care overview";
  if (value === "hospital_discharge") return "Hospital discharge";
  return value.replaceAll("_", " ");
}

function readableStatus(value: string): string {
  return value.replaceAll("_", " ").replace(/^./, character => character.toUpperCase());
}

function readableScope(value: string): string {
  if (value === "lcr_summary") return "Care record and Daily Care";
  if (value === "documents") return "Uploaded documents";
  if (value === "appointments") return "Appointments";
  if (value === "open_loops") return "Open care actions and questions";
  return readableStatus(value);
}

function scopeForSourceType(sourceType: string): string {
  if (sourceType.startsWith("document_") || sourceType === "uploaded_document") return "documents";
  if (sourceType === "appointment") return "appointments";
  if (["care_action", "care_action_outcome", "open_question", "information_gap"].includes(sourceType)) return "open_loops";
  return "lcr_summary";
}

function requiredHandoffScopes(draft: DraftPayload, generationSections = draft.generation?.sections ?? []): string[] {
  const sourceTypes = new Map<string, string>();
  for (const section of draft.sections) {
    for (const item of section.items) sourceTypes.set(item.source_table + ":" + item.source_id, item.source_type);
  }
  return [...new Set(generationSections.map(item => scopeForSourceType(sourceTypes.get(item.source_ref) ?? "care_fact")))];
}

function sourceKeysForScope(scope: string): Set<string> {
  if (scope === "documents") return new Set(["documents"]);
  if (scope === "appointments") return new Set(["appointments"]);
  if (scope === "open_loops") return new Set(["actions", "care_action_outcomes", "open_questions", "information_gaps", "uncertainty_assessments"]);
  return new Set(["care_facts", "care_assertions", "care_events", "care_decisions", "decision_outcomes", "care_transitions", "care_timeline_entries", "daily_care"]);
}

function buildShareText(draft: DraftPayload, audience: "family" | "professional", purpose: string, scopes: string[] = requiredHandoffScopes(draft), caregiverNote = "", generationSections = draft.generation?.sections ?? []) {
  const lines = [
    audience === "family" ? "SolenOS Family Care Handoff — Living Care Record · Family Edition" : "SolenOS Professional Care Handoff — Living Care Record · Professional Edition",
    "Purpose: " + purpose,
    "Prepared at: " + formatDate(draft.prepared_at),
    "Source window: " + draft.window.days + " days (" + draft.window.from + " to " + draft.window.to + ")",
    "",
    "IMPORTANT: Caregiver-reported, unreviewed, rejected, and historical information retains its status. This is not a clinical judgment.",
    draft.warning,
    "",
  ];
  let truncated = false;
  const includedSourceKeys = new Set(scopes.flatMap(scope => [...sourceKeysForScope(scope)]));
  const sourceTypes = new Map<string, string>();
  const sourceDetails = new Map<string, Record<string, unknown>>();
  for (const group of draft.sections) for (const source of group.items) {
    const ref = source.source_table + ":" + source.source_id;
    sourceTypes.set(ref, source.source_type);
    sourceDetails.set(ref, source.details ?? {});
  }
  const generated = generationSections;
  let displayedSourceNumber = 0;
  for (const item of generated) {
    if (!scopes.includes(scopeForSourceType(sourceTypes.get(item.source_ref) ?? "care_fact"))) continue;
    displayedSourceNumber += 1;
    const sectionHeader = "\n## " + item.section;
    if (lines.join("\n").length + sectionHeader.length > 16500) { truncated = true; break; }
    lines.push(sectionHeader);
    const itemText = [
      "- " + item.text,
      "Information status: " + readableStatus(item.epistemic_status || "not_recorded"),
      "Record status: " + readableStatus(item.record_status || "not_recorded"),
      "Event time: " + formatDate(item.event_at),
      "Recorded time: " + formatDate(item.recorded_at),
      "Historical status: " + (item.stale_warning ? "historical or stale; re-check before relying on it" : "not flagged stale"),
      "Source: record " + displayedSourceNumber,
      ...(scopeForSourceType(sourceTypes.get(item.source_ref) ?? "care_fact") === "documents" ? [
        "Original document reference: " + String(sourceDetails.get(item.source_ref)?.original_source_reference ?? "not recorded"),
        "Page references: " + (Array.isArray(sourceDetails.get(item.source_ref)?.page_references) ? (sourceDetails.get(item.source_ref)?.page_references as unknown[]).map(value => String(value)).join(", ") : "not recorded"),
      ] : []),
    ].join("\n");
    if (lines.join("\n").length + itemText.length > 16500) { truncated = true; break; }
    lines.push(itemText);
  }
  for (const note of draft.caregiver_notes ?? []) {
    const line = "\nCaregiver-added note (not independently verified): " + note.text;
    if (lines.join("\n").length + line.length > 16500) { truncated = true; break; }
    lines.push(line);
  }
  if (caregiverNote.trim()) {
    const line = "\nCaregiver-added note (not independently verified): " + caregiverNote.trim();
    if (lines.join("\n").length + line.length > 16500) truncated = true;
    else lines.push(line);
  }
  lines.push("\n## Source coverage");
  for (const [name, value] of Object.entries(draft.source_statuses)) {
    const line = "- " + (value.label || readableStatus(name)) + ": " + readableStatus(value.status) + (value.reason ? " (" + value.reason + ")" : "") + "; " + value.count + " record(s)";
    if (lines.join("\n").length + line.length > 17500) { truncated = true; break; }
    lines.push(line);
  }
  for (const limitation of draft.limitations) {
    if (!includedSourceKeys.has(limitation.source)) continue;
    const line = "- " + readableStatus(limitation.source) + ": " + readableStatus(limitation.status) + (limitation.reason ? " (" + limitation.reason + ")" : "");
    if (lines.join("\n").length + line.length > 17500) { truncated = true; break; }
    lines.push(line);
  }
  if (truncated) lines.push("\nPreview truncated. The persisted draft retains the complete validated source snapshot.");
  return { text: lines.join("\n").slice(0, 18000) };
}

export function CareHandoffSharing({ draft, audience, purpose, onResumeDraft }: Props) {
  const [showHistory, setShowHistory] = useState(false);
  const [preparePurpose, setPreparePurpose] = useState<HandoffDraftPurpose>("family_transition");
  const [prepareAudience, setPrepareAudience] = useState<"family" | "professional">("family");
  const [prepareWindowDays, setPrepareWindowDays] = useState("30");
  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState("");
  const [prepareNotice, setPrepareNotice] = useState("");
  const prepareRequestId = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [directory, setDirectory] = useState<Recipient[]>([]);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [savedDrafts, setSavedDrafts] = useState<Array<DraftPayload & { updated_at?: string }>>([]);
  const [directoryError, setDirectoryError] = useState(false);
  const [consentRequired, setConsentRequired] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [expiryDays, setExpiryDays] = useState("7");
  const [summaryText, setSummaryText] = useState("");
  const [caregiverNote, setCaregiverNote] = useState("");
  const [selectedScope, setSelectedScope] = useState<string[]>([]);
  const [editedSections, setEditedSections] = useState<NonNullable<DraftPayload["generation"]>["sections"]>([]);
  const [revisionHistory, setRevisionHistory] = useState<DraftRevision[]>([]);
  const [sourceFreshness, setSourceFreshness] = useState<{ status: string; stale_source_count?: number; unknown_source_count?: number } | null>(null);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [professionalReviewConfirmed, setProfessionalReviewConfirmed] = useState(false);
  const [activeInbox, setActiveInbox] = useState<InboxItem | null>(null);
  const [activeSnapshot, setActiveSnapshot] = useState<Snapshot | null>(null);
  const [incomingReviewConfirmed, setIncomingReviewConfirmed] = useState(false);
  const shareRequestId = useRef<string | null>(null);
  const shareExpiry = useRef<string | null>(null);

  const eligibleRecipients = useMemo(() => directory.filter(item => item.can_receive_handoff), [directory]);
  const ineligibleRecipients = useMemo(() => directory.filter(item => !item.can_receive_handoff), [directory]);

  const load = useCallback(async () => {
    setLoading(true);
    setDirectoryError(false);
    setHistoryError(false);
    try {
      await ensureAnonymousSession();
      // Handoff inbox and recipient discovery require the caregiver's persisted
      // privacy/multi-caregiver acknowledgements. Read that state first so a
      // normal first-use session does not generate avoidable 403 responses.
      const consent = await getJSON("/consent") as { verified?: boolean; required?: boolean };
      const canUseHandoffs = consent.verified === true && consent.required === false;
      setConsentRequired(!canUseHandoffs);
      const [directoryResult, inboxResult, outboxResult, draftsResult] = await Promise.allSettled([
        canUseHandoffs
          ? getJSON("/handoffs/directory/recipients") as Promise<{ items?: Recipient[] }>
          : Promise.resolve({ items: [] as Recipient[] }),
        canUseHandoffs
          ? getJSON("/handoffs/inbox") as Promise<{ items?: InboxItem[] }>
          : Promise.resolve({ items: [] as InboxItem[] }),
        canUseHandoffs
          ? getJSON("/handoffs/outbox") as Promise<{ items?: OutboxItem[] }>
          : Promise.resolve({ items: [] as OutboxItem[] }),
        getJSON("/handoff-drafts?limit=10") as Promise<{ items?: Array<DraftPayload & { updated_at?: string }> }>,
      ]);
      if (directoryResult.status === "fulfilled") setDirectory(directoryResult.value.items ?? []);
      else setDirectoryError(true);
      if (inboxResult.status === "fulfilled") setInbox(inboxResult.value.items ?? []);
      else setHistoryError(true);
      if (outboxResult.status === "fulfilled") setOutbox(outboxResult.value.items ?? []);
      else setHistoryError(true);
      if (draftsResult.status === "fulfilled") setSavedDrafts(draftsResult.value.items ?? []);
      else setHistoryError(true);
    } catch {
      setDirectoryError(true);
      setHistoryError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    setSelectedScope(draft ? requiredHandoffScopes(draft) : []);
  }, [draft?.draft_id]);

  useEffect(() => {
    setCaregiverNote("");
    setEditedSections(draft?.generation?.sections ?? []);
  }, [draft?.draft_id]);

  useEffect(() => {
    if (!draft || !audience || !purpose) {
      setSummaryText("");
      setReviewConfirmed(false);
      return;
    }
    const prepared = buildShareText(draft, audience, purpose === "today" ? "Taking over today" : purpose === "appointment" ? "Doctor's appointment" : "Full care overview", selectedScope, caregiverNote, editedSections);
    setSummaryText(prepared.text);
    setReviewConfirmed(false);
  }, [draft, audience, purpose, selectedScope, caregiverNote, editedSections]);

  useEffect(() => {
    if (!draft?.draft_id) {
      setRevisionHistory([]);
      setSourceFreshness(null);
      return;
    }
    let active = true;
    void ensureAnonymousSession().then(() => getJSON("/handoff-drafts/" + encodeURIComponent(draft.draft_id))).then((saved) => {
      if (!active) return;
      const record = saved as {
        revision_history?: DraftRevision[];
        source_freshness?: { status: string; stale_source_count?: number; unknown_source_count?: number };
        caregiver_notes?: Array<{ text: string; attribution: string }>;
      };
      setRevisionHistory(record.revision_history ?? []);
      setSourceFreshness(record.source_freshness ?? null);
      const note = record.caregiver_notes?.find(item => item.attribution === "caregiver_authored_unverified")?.text;
      if (note) setCaregiverNote(note);
    }).catch(() => {
      if (active) setSourceFreshness({ status: "unknown" });
    });
    return () => { active = false; };
  }, [draft?.draft_id]);

  async function prepareHandoffDraft() {
    if (preparing) return;
    setPreparing(true);
    setPrepareError("");
    setPrepareNotice("");
    const requestId = prepareRequestId.current ?? (
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : "handoff-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2)
    );
    prepareRequestId.current = requestId;
    try {
      await ensureAnonymousSession();
      const prepared = await postJSON("/handoff-drafts/prepare", {
        purpose: preparePurpose,
        audience: prepareAudience,
        window_days: Number(prepareWindowDays),
      }, { "X-Request-ID": requestId }) as DraftPayload;
      if (!prepared?.draft_id || !Array.isArray(prepared.sections)) {
        throw new Error("The server did not return a persisted handoff draft.");
      }
      setSavedDrafts(current => [
        prepared,
        ...current.filter(item => item.draft_id !== prepared.draft_id),
      ].slice(0, 10));
      prepareRequestId.current = null;
      setPrepareNotice(
        prepared.generation_status === "generated" && prepared.validation_status === "validated"
          ? "Draft saved for your review. Nothing has been shared or added to the Living Care Record."
          : "Draft saved with source availability and limitations. Review the available records; no information has been shared or added to the Living Care Record."
      );
      onResumeDraft?.(prepared);
    } catch {
      // Retain the same request ID. If the server saved the draft but the
      // response was interrupted, retrying retrieves that same persisted draft.
      setPrepareError("The handoff draft could not be prepared. Check your connection and retry. No care-record changes are made by this step.");
    } finally {
      setPreparing(false);
    }
  }

  async function saveDraftRevision() {
    if (!draft?.draft_id) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await ensureAnonymousSession();
      const content = {
        template_sections: draft.template_sections ?? [],
        sections: draft.sections,
        generation: draft.generation ? { ...draft.generation, sections: editedSections } : draft.generation,
        caregiver_notes: caregiverNote.trim() ? [caregiverNote.trim()] : [],
      };
      await putJSON("/handoff-drafts/" + encodeURIComponent(draft.draft_id), { content });
      const saved = await getJSON("/handoff-drafts/" + encodeURIComponent(draft.draft_id)) as {
        revision_history?: Array<{ revision_number: number; change_type: string; created_at: string | null }>;
        source_freshness?: { status: string; stale_source_count?: number; unknown_source_count?: number };
      };
      setRevisionHistory(saved.revision_history ?? []);
      setSourceFreshness(saved.source_freshness ?? null);
      setReviewConfirmed(false);
      setNotice("Draft revision saved. It has not been approved or shared.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The draft revision could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function shareReviewedFamilyHandoff() {
    if (!draft || audience !== "family") {
      setError("Professional sharing is unavailable until SolenOS can verify professional identity and role authorization.");
      return;
    }
    if (draft.generation_status !== "generated" || draft.validation_status !== "exact_quote_reference_validation_passed") {
      setError("This draft has no validated care summary. It cannot be shared.");
      return;
    }
    if (!reviewConfirmed || !summaryText.trim() || editedSections.length === 0 || selectedRecipients.length === 0 || selectedScope.length === 0) {
      setError("Review the complete generated handoff and select at least one eligible linked caregiver before sharing.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const session = await ensureAnonymousSession();
      const requestId = shareRequestId.current ?? (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : "handoff-" + Date.now());
      shareRequestId.current = requestId;
      const expiresAt = shareExpiry.current ?? new Date(Date.now() + Number(expiryDays) * 24 * 60 * 60 * 1000).toISOString();
      shareExpiry.current = expiresAt;
      const content = {
        template_sections: draft.template_sections ?? [],
        sections: draft.sections,
        generation: draft.generation ? { ...draft.generation, sections: editedSections } : draft.generation,
        caregiver_notes: caregiverNote.trim() ? [caregiverNote.trim()] : [],
      };
      await putJSON("/handoff-drafts/" + encodeURIComponent(draft.draft_id), { content });
      const approval = await postJSON("/handoff-drafts/" + encodeURIComponent(draft.draft_id) + "/approve", {
        recipient_caregiver_ids: selectedRecipients,
        scope: [...selectedScope].sort(),
        expires_at: expiresAt,
      }) as {
        care_continuity_execution?: { stages?: Record<string, string> } | null;
      };
      const sourceStages = approval?.care_continuity_execution?.stages;
      if (sourceStages && (
        sourceStages.handoff_draft !== "verified" ||
        sourceStages.handoff_draft_revision !== "verified" ||
        sourceStages.reconciliation !== "not_applicable_read_only_output"
      )) {
        throw new Error("The approved handoff source snapshot could not be verified. Sharing was stopped.");
      }
      const created = await postJSON("/handoffs", {
        person_id: session.person.id,
        draft_id: draft.draft_id,
        recipient_caregiver_ids: selectedRecipients,
        scope: [...selectedScope].sort(),
        expires_at: expiresAt,
      }, { "X-Request-ID": requestId }) as { id: string };
      if (!created?.id) throw new Error("The backend did not confirm a handoff ID. No successful share is assumed.");
      setNotice("The approved, persisted handoff was shared with the selected linked caregiver(s). Its saved source snapshot was checked; sharing did not change the Living Care Record. Access expires " + formatDate(expiresAt) + ".");
      setReviewConfirmed(false);
      setSelectedRecipients([]);
      setCaregiverNote("");
      shareRequestId.current = null;
      shareExpiry.current = null;
      await load();
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : "The handoff could not be shared. No success is assumed.");
    } finally {
      setBusy(false);
    }
  }

  async function approveAndExportProfessionalSummary() {
    if (!draft?.draft_id || audience !== "professional" || !professionalReviewConfirmed) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await ensureAnonymousSession();
      const content = {
        template_sections: draft.template_sections ?? [],
        sections: draft.sections,
        generation: draft.generation ? { ...draft.generation, sections: editedSections } : draft.generation,
        caregiver_notes: caregiverNote.trim() ? [caregiverNote.trim()] : [],
      };
      await putJSON("/handoff-drafts/" + encodeURIComponent(draft.draft_id), { content });
      const saved = await getJSON("/handoff-drafts/" + encodeURIComponent(draft.draft_id)) as {
        revision_number?: number;
        source_freshness?: { status: string };
      };
      if (saved.source_freshness?.status !== "current") {
        throw new Error("Care information has changed or could not be checked. Prepare a fresh summary before exporting.");
      }
      await postJSON("/handoff-drafts/" + encodeURIComponent(draft.draft_id) + "/approve-export", { approved: true });
      const pdf = await getBlob("/handoff-drafts/" + encodeURIComponent(draft.draft_id) + "/export.pdf");
      const filename = "solenos-care-summary.pdf";
      const file = new File([pdf], filename, { type: "application/pdf" });
      if (typeof navigator !== "undefined" && typeof navigator.share === "function" &&
          typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "SolenOS care summary", text: "Caregiver-reviewed care summary." });
        setNotice("The approved PDF was prepared and shared using your device's share options. SolenOS did not send it to a recipient.");
      } else {
        const url = URL.createObjectURL(pdf);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        setNotice("The approved PDF was downloaded. You can attach it to a message or share it using your device.");
      }
      setProfessionalReviewConfirmed(false);
      await load();
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "The approved care summary could not be exported.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(item: OutboxItem) {
    if (!window.confirm("Revoke this handoff now? Recipients will lose future access to the shared summary.")) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await postJSON("/handoffs/" + encodeURIComponent(item.id) + "/revoke", {});
      setNotice("Handoff access was revoked. This cannot retract information already viewed or saved by a recipient.");
      await load();
    } catch {
      setError("The handoff could not be revoked. Refresh the outgoing list and verify its current status.");
    } finally {
      setBusy(false);
    }
  }

  async function reviewIncoming(item: InboxItem) {
    setBusy(true);
    setError("");
    setActiveInbox(item);
    setActiveSnapshot(null);
    setIncomingReviewConfirmed(false);
    try {
      const result = await getJSON("/handoffs/" + encodeURIComponent(item.id) + "/summary") as { summary?: Snapshot };
      setActiveSnapshot(result.summary ?? null);
    } catch {
      setError("The shared summary could not be opened. Access may have expired or been revoked.");
      setActiveInbox(null);
    } finally {
      setBusy(false);
    }
  }

  async function acceptIncoming() {
    if (!activeInbox || !activeSnapshot || !incomingReviewConfirmed) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (activeInbox.status !== "accepted") {
        await postJSON("/handoffs/" + encodeURIComponent(activeInbox.id) + "/accept", {});
      }
      await postJSON("/handoffs/" + encodeURIComponent(activeInbox.id) + "/acknowledge", {
        acknowledgement: "I reviewed the caregiver-provided care summary.",
      });
      setNotice("Receipt and review acknowledgment were recorded. This does not verify every statement or complete the listed actions.");
      setActiveInbox(null);
      setActiveSnapshot(null);
      setIncomingReviewConfirmed(false);
      await load();
    } catch {
      setError("Receipt or acceptance could not be recorded. Refresh the incoming list to verify the handoff status.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="companion-handoff-sharing" style={{ marginTop: 14, display: "grid", gap: 12, minWidth: 0, width: "100%" }}>
      <section style={{ ...panel, marginTop: 0 }} aria-labelledby="prepare-handoff-heading">
        <h4 id="prepare-handoff-heading" style={{ marginTop: 0 }}>Prepare a care handoff</h4>
        <p style={{ fontSize: 12, lineHeight: 1.55, color: "#667267" }}>
          SolenOS gathers the saved care information for the selected handoff. Review the draft before sharing. Missing or uncertain information stays clearly identified.
        </p>
        <form onSubmit={event => { event.preventDefault(); void prepareHandoffDraft(); }} style={{ display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 5, fontSize: 12 }}>
            Who is this handoff for?
            <select value={prepareAudience} onChange={event => {
              const next = event.target.value as "family" | "professional";
              setPrepareAudience(next);
              if (next === "professional" && preparePurpose === "family_transition") setPreparePurpose("professional_appointment");
              if (next === "family" && preparePurpose === "professional_appointment") setPreparePurpose("family_transition");
            }} style={field} disabled={preparing}>
              <option value="family">Family caregiver</option>
              <option value="professional">Healthcare professional — private review only</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 5, fontSize: 12 }}>
            What is the handoff for?
            <select value={preparePurpose} onChange={event => setPreparePurpose(event.target.value as HandoffDraftPurpose)} style={field} disabled={preparing}>
              {prepareAudience === "family" ? (
                <>
                  <option value="family_transition">Taking over today</option>
                  <option value="return_to_care">Returning to care</option>
                  <option value="hospital_discharge">Hospital discharge</option>
                  <option value="period_summary">Full care overview</option>
                </>
              ) : (
                <>
                  <option value="professional_appointment">Doctor’s appointment</option>
                  <option value="hospital_discharge">Hospital discharge</option>
                  <option value="period_summary">Full care overview</option>
                </>
              )}
            </select>
          </label>
          <label style={{ display: "grid", gap: 5, fontSize: 12 }}>
            How much care history should be included?
            <select value={prepareWindowDays} onChange={event => setPrepareWindowDays(event.target.value)} style={field} disabled={preparing}>
              <option value="7">Past 7 days</option>
              <option value="14">Past 14 days</option>
              <option value="30">Past 30 days</option>
              <option value="60">Past 60 days</option>
              <option value="90">Past 90 days</option>
            </select>
          </label>
          {prepareAudience === "professional" && <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5 }}>Professional identity and role cannot yet be verified. This draft can be reviewed privately but cannot be shared with a professional from SolenOS.</p>}
          {prepareError && <p role="alert" style={{ margin: 0, color: "#8d2d2d", fontSize: 12 }}>{prepareError}</p>}
          {prepareNotice && <p role="status" style={{ margin: 0, color: "#356441", fontSize: 12 }}>{prepareNotice}</p>}
          <button type="submit" style={button} disabled={preparing || loading}>
            {preparing ? "Preparing your handoff…" : "Prepare handoff for review"}
          </button>
        </form>
      </section>

      {savedDrafts.length > 0 && (
        <section style={{ ...panel, marginTop: 0 }} aria-label="Saved handoff drafts">
          <h4 style={{ marginTop: 0 }}>Saved handoff drafts</h4>
          <p style={{ fontSize: 12, color: "#667267" }}>Only drafts created by this caregiver for this care record are listed.</p>
          {savedDrafts.map(saved => (
            <div key={saved.draft_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, borderTop: "1px solid #e5ebe4", padding: "9px 0" }}>
              <div>
                <strong>{handoffPurposeLabel(saved.purpose)}</strong>
                <div style={{ fontSize: 11, color: "#667267" }}>{saved.review_status ? readableStatus(saved.review_status) : "Pending review"} · revision {saved.revision_number ?? 1} · {formatDate(saved.updated_at ?? saved.prepared_at)}</div>
              </div>
              <button type="button" style={quietButton} disabled={busy || !onResumeDraft} onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const full = await getJSON("/handoff-drafts/" + encodeURIComponent(saved.draft_id)) as DraftPayload;
                  onResumeDraft?.(full);
                } catch (resumeError) {
                  setError(resumeError instanceof Error ? resumeError.message : "Saved draft could not be retrieved.");
                } finally {
                  setBusy(false);
                }
              }}>Resume draft</button>
            </div>
          ))}
        </section>
      )}
      {savedDrafts.length === 0 && !loading && !historyError && (
        <section style={{ ...panel, marginTop: 0 }} aria-label="Saved handoff drafts">
          <h4 style={{ marginTop: 0 }}>Saved handoff drafts</h4>
          <p style={{ fontSize: 13, color: "#667267", marginBottom: 0 }}>
            No handoff drafts have been saved for this care record yet. Use the form above to prepare one from authorised saved records.
          </p>
        </section>
      )}

      {draft && audience === "professional" && (
        <section style={{ ...panel, marginTop: 0 }} aria-labelledby="professional-export-heading">
          <h4 id="professional-export-heading" style={{ margin: "0 0 8px", fontSize: 15 }}>Review and export care summary</h4>
          <p style={{ fontSize: 12, lineHeight: 1.55 }}>This summary is prepared from saved care records. Review each statement and its source status before approving the PDF. It is not a clinical assessment or an independently verified medication list.</p>
          {draft.generation?.sections?.map((item, index) => (
            <article key={item.source_ref + index} style={{ borderTop: "1px solid #e5ebe4", padding: "9px 0" }}>
              <strong style={{ fontSize: 12 }}>{item.section}</strong>
              <p style={{ fontSize: 13, lineHeight: 1.5, margin: "5px 0" }}>{item.text}</p>
              <small style={{ color: "#667267" }}>Information: {readableStatus(item.epistemic_status || "not recorded")} · Record: {readableStatus(item.record_status || "not recorded")} · Occurred: {formatDate(item.event_at)} · Recorded: {formatDate(item.recorded_at)}</small>
            </article>
          ))}
          <div style={{ margin: "10px 0" }}>
            <strong style={{ fontSize: 12 }}>Information availability</strong>
            {Object.entries(draft.source_statuses ?? {}).map(([key, value]) => (
              <p key={key} style={{ fontSize: 11, margin: "4px 0" }}>{value.label || readableStatus(key)}: {readableStatus(value.status)} · {value.count} record(s){value.reason ? " · " + readableStatus(value.reason) : ""}</p>
            ))}
          </div>
          {draft.limitations?.map((item, index) => <p key={item.source + index} style={{ fontSize: 11, color: "#667267" }}>Not available — {readableStatus(item.source)}: {readableStatus(item.status)}{item.reason ? " (" + readableStatus(item.reason) + ")" : ""}</p>)}
          <label htmlFor="professional-caregiver-note" style={{ display: "block", fontWeight: 650, margin: "12px 0 6px", fontSize: 13 }}>Caregiver note (optional)</label>
          <textarea id="professional-caregiver-note" value={caregiverNote} onChange={event => setProfessionalReviewConfirmed(false) || setCaregiverNote(event.target.value)} rows={3} maxLength={2000} placeholder="Add context in your own words. It will be labelled as a caregiver report." style={{ ...field, resize: "vertical", lineHeight: 1.5 }} />
          <button type="button" style={quietButton} disabled={busy || sourceFreshness?.status !== "current"} onClick={() => void saveDraftRevision()}>Save changes to summary</button>
          {sourceFreshness && sourceFreshness.status !== "current" && <p role="alert" style={{ fontSize: 12, color: "#8d2d2d" }}>The saved care information has changed or could not be checked. Prepare a fresh summary before approval.</p>}
          <label style={{ display: "flex", alignItems: "flex-start", gap: 9, margin: "12px 0", lineHeight: 1.5, fontSize: 12 }}>
            <input type="checkbox" checked={professionalReviewConfirmed} disabled={busy || sourceFreshness?.status !== "current"} onChange={event => setProfessionalReviewConfirmed(event.target.checked)} />
            <span>I reviewed this summary, its source labels and missing information. I approve this exact version for export and sharing outside SolenOS.</span>
          </label>
          <button type="button" style={button} disabled={busy || loading || sourceFreshness?.status !== "current" || !professionalReviewConfirmed} onClick={() => void approveAndExportProfessionalSummary()}>
            <Share2 size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />{busy ? "Preparing approved PDF…" : "Approve and export PDF"}
          </button>
          <p style={{ fontSize: 11, color: "#667267", lineHeight: 1.5 }}>SolenOS downloads the PDF or opens your device's share options when supported. It does not email the summary, create a professional account, or give anyone access to your SolenOS care record.</p>
        </section>
      )}

      {draft && audience === "family" && (
        <section style={panel} aria-labelledby="family-share-heading">
          <h4 id="family-share-heading" style={{ margin: "0 0 8px", fontSize: 15 }}>Review and share family handoff</h4>
          <p style={{ marginTop: 0, fontSize: 12, lineHeight: 1.55 }}>Only linked, eligible caregiver sessions are listed. Sharing requires explicit review, expires automatically, can be revoked, and does not update the LCR.</p>
          {consentRequired && <p role="status" style={{ fontSize: 12, lineHeight: 1.5, padding: 10, borderRadius: 8, background: "#f5f6f1" }}>
            Incoming handoffs and recipient sharing are unavailable until the required privacy and multi-caregiver acknowledgements are saved for this care record. Review them in <Link href="/workspace/settings" style={{ textDecoration: "underline" }}>Settings → Privacy</Link>, then refresh this panel. Your care record remains available.
          </p>}
          {draft.evidence_lineage && <details style={{ border: "1px solid #dce7dc", borderRadius: 9, padding: 10, marginBottom: 12 }} aria-label="How information was sourced">
            <summary style={{ fontSize: 12, fontWeight: 650, cursor: "pointer" }}>How the information was sourced</summary>
            {draft.evidence_lineage.groups.length ? draft.evidence_lineage.groups.map((group, index) => <div key={group.lineage_id} style={{ borderTop: "1px solid #e5ebe4", marginTop: 7, paddingTop: 7, fontSize: 12 }}>
              <b>Source group {index + 1}: {readableStatus(group.source_independence_status)}</b>
              <p style={{ margin: "3px 0", color: "#667267" }}>{group.interpretation_limit}</p>
            </div>) : <p style={{ fontSize: 12, marginBottom: 0 }}>The available records do not establish whether some information came from the same original source. Do not treat similar accounts as independent confirmation.</p>}
            <p style={{ fontSize: 12, marginBottom: 0, color: "#667267" }}>{draft.evidence_lineage.interpretation_limit}</p>
          </details>}
          {directoryError && <p role="alert">The recipient list could not be verified. Refresh before sharing.</p>}
          {!consentRequired && !directoryError && !loading && eligibleRecipients.length === 0 && <p>No linked caregiver is currently eligible to receive this handoff. SolenOS will not send it to an unlinked recipient.</p>}
          {eligibleRecipients.map(recipient => (
            <label key={recipient.caregiver_id} style={{ display: "flex", alignItems: "flex-start", gap: 9, margin: "10px 0", lineHeight: 1.4 }}>
              <input type="checkbox" checked={selectedRecipients.includes(recipient.caregiver_id)} disabled={busy} onChange={event => {
                setSelectedRecipients(current => event.target.checked ? [...current, recipient.caregiver_id] : current.filter(id => id !== recipient.caregiver_id));
                setReviewConfirmed(false);
                shareRequestId.current = null;
                shareExpiry.current = null;
              }} />
              <span><strong>{recipient.name}</strong><br /><small>{recipient.relationship || "Linked caregiver"} · eligible for handoff</small></span>
            </label>
          ))}
          {ineligibleRecipients.map(recipient => <p key={recipient.caregiver_id} style={{ fontSize: 12, color: "#6b746c" }}>{recipient.name} — not eligible until required consent is active.</p>)}
          <label htmlFor="companion-handoff-expiry" style={{ display: "block", fontWeight: 650, margin: "12px 0 6px", fontSize: 13 }}>Access expiry</label>
          <select id="companion-handoff-expiry" value={expiryDays} onChange={event => { setExpiryDays(event.target.value); setReviewConfirmed(false); shareRequestId.current = null; shareExpiry.current = null; }} style={{ ...field, maxWidth: 240 }}>
            <option value="1">24 hours</option><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option>
          </select>
          <label htmlFor="companion-handoff-share-text" style={{ display: "block", fontWeight: 650, margin: "12px 0 6px", fontSize: 13 }}>Complete summary to be shared</label>
          <div style={{ margin: "12px 0" }}>
            <strong style={{ display: "block", fontSize: 13, marginBottom: 8 }}>Review sourced statements</strong>
            <p style={{ fontSize: 11, color: "#667267", margin: "0 0 8px" }}>Sourced wording stays tied to the saved care record. Remove anything that should not be shared. If a statement is outdated or needs correcting, explain that in the caregiver note below; it will be clearly labelled as your report, not independently verified. Update the original care record separately when needed.</p>
            {editedSections.map((item, index) => (
              <div key={item.source_ref + index} style={{ border: "1px solid #e2e9e1", borderRadius: 8, padding: 10, marginBottom: 9 }}>
                <strong style={{ display: "block", fontSize: 12 }}>{item.section}</strong>
                <small style={{ display: "block", color: "#667267", margin: "3px 0 6px" }}>Source {index + 1} · {readableStatus(item.epistemic_status ?? "not recorded")} · {readableStatus(item.record_status ?? "not recorded")} · occurred {formatDate(item.event_at)} · recorded {formatDate(item.recorded_at)}</small>
                <p style={{ fontSize: 13, lineHeight: 1.5, margin: "6px 0 10px", overflowWrap: "anywhere" }}>{item.text}</p>
                <button type="button" style={quietButton} onClick={() => {
                  const remaining = editedSections.filter((_, sectionIndex) => sectionIndex !== index);
                  setEditedSections(remaining);
                  const remainingScopes = requiredHandoffScopes(draft, remaining);
                  setSelectedScope(scopes => scopes.filter(scope => remainingScopes.includes(scope)));
                  setReviewConfirmed(false);
                  shareRequestId.current = null;
                  shareExpiry.current = null;
                }}>Remove section from this draft</button>
              </div>
            ))}
          </div>
          <textarea id="companion-handoff-share-text" value={summaryText} readOnly rows={12} style={{ ...field, resize: "vertical", lineHeight: 1.5, background: "#f8faf7" }} />
          <p style={{ fontSize: 11, lineHeight: 1.5, color: "#667267" }}>This preview keeps each statement tied to its saved source, shows its information status, and separates when it happened from when it was recorded.</p>
          <p style={{ fontSize: 11, lineHeight: 1.5, color: "#667267" }}>Saved revision: {revisionHistory.length ? Math.max(...revisionHistory.map(item => item.revision_number)) : draft.revision_number ?? 1} · Source freshness: {sourceFreshness ? readableStatus(sourceFreshness.status) : "Checking"} · {revisionHistory.length} revision record(s)</p>
          {revisionHistory.length > 0 && <details style={{ marginBottom: 10 }}><summary style={{ cursor: "pointer", fontSize: 12 }}>Revision history</summary>{revisionHistory.map(item => (
              <details key={item.revision_number} style={{ margin: "6px 0" }}>
                <summary style={{ cursor: "pointer", fontSize: 11 }}>Revision {item.revision_number} · {readableStatus(item.change_type)} · {formatDate(item.created_at)}</summary>
                {item.content?.generation?.sections?.map((section, index) => <p key={section.source_ref + index} style={{ fontSize: 11, margin: "5px 0" }}><strong>{section.section}:</strong> {section.text} <small>(Source {index + 1})</small></p>)}
                {item.content?.caregiver_notes?.map((note, index) => <p key={index} style={{ fontSize: 11 }}>Caregiver note: {note.text}</p>)}
                <p style={{ fontSize: 10, color: "#667267" }}>Source records in this immutable snapshot: {item.source_snapshot?.source_records?.length ?? "not reported"}</p>
              </details>
            ))}</details>}
          {sourceFreshness && sourceFreshness.status !== "current" && <p role="alert" style={{ fontSize: 12, color: "#8d2d2d" }}>This draft is {sourceFreshness.status}. Prepare a fresh draft before approval or sharing.</p>}
          <div style={{ margin: "12px 0" }}>
            <strong style={{ display: "block", fontSize: 13, marginBottom: 6 }}>Sharing scope</strong>
            <p style={{ fontSize: 11, color: "#667267", margin: "0 0 8px" }}>Choose which source categories the recipient can receive. Unselected categories remain in the saved draft and are not attached to this handoff.</p>
            {requiredHandoffScopes(draft, editedSections).map(scope => (
              <label key={scope} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, margin: "6px 0" }}>
                <input type="checkbox" checked={selectedScope.includes(scope)} onChange={event => {
                  setSelectedScope(current => event.target.checked ? [...current, scope] : current.filter(value => value !== scope));
                  setReviewConfirmed(false);
                  shareRequestId.current = null;
                  shareExpiry.current = null;
                }} />
                {scope === "lcr_summary" ? "Care record and Daily Care" : scope === "documents" ? "Uploaded documents" : scope === "appointments" ? "Appointments" : "Open care actions and questions"}
              </label>
            ))}
          </div>
          <label htmlFor="companion-handoff-caregiver-note" style={{ display: "block", fontWeight: 650, margin: "12px 0 6px", fontSize: 13 }}>Additional caregiver note (optional)</label>
          <textarea id="companion-handoff-caregiver-note" value={caregiverNote} onChange={event => { setCaregiverNote(event.target.value); setReviewConfirmed(false); shareRequestId.current = null; shareExpiry.current = null; }} rows={3} maxLength={2000} placeholder="Add context in your own words. It will be labelled caregiver-authored and not independently verified." style={{ ...field, resize: "vertical", lineHeight: 1.5 }} />
          <button type="button" style={quietButton} disabled={busy || sourceFreshness?.status === "stale" || editedSections.length === 0} onClick={() => void saveDraftRevision()}>Save draft revision</button>
          <section aria-label="Confirm handoff details" style={{ border: "1px solid #cbd8cb", borderRadius: 10, padding: 12, margin: "14px 0", background: "#f7faf6" }}>
            <strong style={{ display: "block", fontSize: 13, marginBottom: 7 }}>Confirm exactly what will be shared</strong>
            <p style={{ fontSize: 12, margin: "4px 0" }}><b>Purpose:</b> {purpose === "today" ? "Taking over today" : purpose === "appointment" ? "Doctor’s appointment" : "Full care overview"}</p>
            <p style={{ fontSize: 12, margin: "4px 0" }}><b>Recipient(s):</b> {eligibleRecipients.filter(item => selectedRecipients.includes(item.caregiver_id)).map(item => item.name).join(", ") || "No recipient selected"}</p>
            <p style={{ fontSize: 12, margin: "4px 0" }}><b>Information included:</b> {selectedScope.map(readableScope).join(", ") || "No information category selected"}</p>
            <p style={{ fontSize: 12, margin: "4px 0" }}><b>Access ends:</b> {expiryDays === "1" ? "In 24 hours" : "In " + expiryDays + " days"} after sharing</p>
            <p style={{ fontSize: 11, color: "#667267", margin: "8px 0 0" }}>Only the selected recipient(s) can access this handoff. It does not change the Living Care Record. Revoking access later cannot retract information already viewed or saved.</p>
          </section>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 9, margin: "12px 0", lineHeight: 1.5, fontSize: 12 }}>
            <input type="checkbox" checked={reviewConfirmed} disabled={busy} onChange={event => setReviewConfirmed(event.target.checked)} />
            <span>I reviewed the entire summary against the available care information and approve sharing this snapshot with the selected linked caregiver(s).</span>
          </label>
          <button type="button" style={button} disabled={busy || loading || consentRequired || directoryError || draft.generation_status !== "generated" || draft.validation_status !== "exact_quote_reference_validation_passed" || sourceFreshness?.status !== "current" || !reviewConfirmed || editedSections.length === 0 || selectedRecipients.length === 0 || selectedScope.length === 0 || !summaryText.trim()} onClick={() => void shareReviewedFamilyHandoff()}>
            <Share2 size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />{busy ? "Sharing reviewed snapshot…" : "Share reviewed family handoff"}
          </button>
        </section>
      )}

      <section style={{ ...panel, marginTop: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Inbox size={17} /><strong>Incoming and outgoing handoffs</strong></div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" style={quietButton} onClick={() => void load()} disabled={loading || busy}><RefreshCw size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />Refresh</button>
            <button type="button" style={quietButton} onClick={() => setShowHistory(value => !value)}>{showHistory ? "Hide handoff history" : "Review handoff history"}</button>
          </div>
        </div>
        {error && <p role="alert" style={{ color: "#8d2d2d", fontSize: 12, lineHeight: 1.5 }}>{error}</p>}
        {notice && <p role="status" style={{ color: "#356441", fontSize: 12, lineHeight: 1.5 }}>{notice}</p>}
        {showHistory && (
          <div style={{ marginTop: 12 }}>
            {consentRequired && <p role="status">Incoming and outgoing handoffs are hidden until required privacy and multi-caregiver acknowledgements are saved. <Link href="/workspace/settings" style={{ textDecoration: "underline" }}>Review Settings → Privacy</Link>.</p>}
            {historyError && <p role="alert">Handoff history could not be loaded. Refresh and verify connectivity.</p>}
            {!historyError && !loading && inbox.length === 0 && outbox.length === 0 && <p>No incoming or outgoing handoffs are recorded for this session.</p>}
            <h5 style={{ margin: "12px 0 6px" }}>Incoming</h5>
            {inbox.map(item => (
              <article key={item.id} style={{ borderTop: "1px solid #e5ebe4", padding: "10px 0" }}>
                <strong>{item.from_caregiver_name || "Linked caregiver"}</strong>
                <p style={{ margin: "4px 0", fontSize: 12 }}>Status: {readableStatus(item.status)} · Expires: {formatDate(item.expires_at)}</p>
                <p style={{ margin: "4px 0 8px", fontSize: 12 }}>Information shared: {item.scope.map(readableScope).join(", ")} · {item.has_summary ? "Summary attached" : "No summary attached"}</p>
                <button type="button" style={button} disabled={busy || !item.has_summary} onClick={() => void reviewIncoming(item)}>Review incoming summary</button>
              </article>
            ))}
            {activeInbox && activeSnapshot && (
              <article style={{ ...panel, margin: "12px 0" }}>
                <h5 style={{ marginTop: 0 }}>Review incoming summary</h5>
                <p style={{ fontSize: 12, lineHeight: 1.5 }}>From {activeInbox.from_caregiver_name || "a linked caregiver"}. This is a caregiver-provided summary, not independent clinical verification.</p>
                {Object.entries(activeSnapshot.sections ?? {}).map(([name, value]) => (
                  <div key={name} style={{ marginBottom: 10 }}>
                    <strong style={{ fontSize: 12 }}>{name.replaceAll("_", " ")}</strong>
                    <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", font: "inherit", fontSize: 12, lineHeight: 1.5 }}>{String(value ?? "")}</pre>
                  </div>
                ))}
                
                {activeSnapshot.purpose && <p style={{ fontSize: 12 }}>Purpose: {handoffPurposeLabel(activeSnapshot.purpose)} · Shared with: {activeSnapshot.audience === "family" ? "Family caregiver" : activeSnapshot.audience === "professional" ? "Healthcare professional" : "Not recorded"} · Source period: {activeSnapshot.window?.days ?? "unknown"} days</p>}
                {activeSnapshot.source_coverage && <section style={{ margin: "10px 0" }}><strong style={{ fontSize: 12 }}>Information included and availability</strong>{Object.entries(activeSnapshot.source_coverage).map(([key, value]) => <p key={key} style={{ fontSize: 11, margin: "4px 0" }}>{value.label || readableScope(key)}: {readableStatus(value.status)}{value.reason ? " — " + value.reason : ""} · {value.count} record(s)</p>)}</section>}
                {activeSnapshot.limitations?.map((item, index) => <p key={item.source + index} style={{ fontSize: 11, color: "#667267" }}>Not available — {readableScope(item.source)}: {readableStatus(item.status)}{item.reason ? " (" + item.reason + ")" : ""}</p>)}
                {activeSnapshot.source_references?.map((item, index) => <p key={item.source_ref + index} style={{ fontSize: 10, overflowWrap: "anywhere" }}>Source {index + 1} · {readableStatus(item.epistemic_status)} · {readableStatus(item.record_status)} · occurred {formatDate(item.event_at)} · recorded {formatDate(item.recorded_at)}{item.stale_warning ? " · historical/stale" : ""}{item.original_source_reference ? " · document source" : ""}{Array.isArray(item.page_references) && item.page_references.length ? " · pages " + item.page_references.map(value => String(value)).join(", ") : ""}</p>)}
                <p style={{ fontSize: 11 }}>Record check: The shared records belong to this care recipient. This does not independently verify clinical accuracy.</p>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, lineHeight: 1.5, margin: "10px 0" }}>
                  <input type="checkbox" checked={incomingReviewConfirmed} onChange={event => setIncomingReviewConfirmed(event.target.checked)} />
                  <span>I reviewed this summary. This does not mean every statement is verified or every action is complete.</span>
                </label>
                <button type="button" style={button} disabled={busy || !incomingReviewConfirmed} onClick={() => void acceptIncoming()}><CheckCircle2 size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />Accept and record receipt</button>
                <button type="button" style={quietButton} onClick={() => { setActiveInbox(null); setActiveSnapshot(null); setIncomingReviewConfirmed(false); }}>Close review</button>
              </article>
            )}
            <h5 style={{ margin: "14px 0 6px" }}>Outgoing</h5>
            {outbox.map(item => (
              <article key={item.id} style={{ borderTop: "1px solid #e5ebe4", padding: "10px 0" }}>
                <strong>{item.recipients?.map(recipient => recipient.name || "Caregiver").join(", ") || "Caregiver handoff"}</strong>
                <p style={{ margin: "4px 0", fontSize: 12 }}>Status: {readableStatus(item.status)}{item.is_expired ? " · expired" : ""} · Expires: {formatDate(item.expires_at)}</p>
                <p style={{ margin: "4px 0 8px", fontSize: 12 }}>Information shared: {item.scope.map(readableScope).join(", ")} · {item.has_summary ? "Summary attached" : "No summary attached"}</p>
                {item.recipients?.map(recipient => <p key={recipient.caregiver_id} style={{ margin: "3px 0", fontSize: 11, color: "#667267" }}>{recipient.name || "Recipient"}: {recipient.status ? readableStatus(recipient.status) : "Receipt status unavailable"}</p>)}
                {item.status !== "revoked" && !item.is_expired && <button type="button" style={quietButton} disabled={busy} onClick={() => void revoke(item)}>Revoke access</button>}
              </article>
            ))}
          </div>
        )}
        <p style={{ marginBottom: 0, fontSize: 11, color: "#667267", lineHeight: 1.5 }}><Clock3 size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />Sending is not acceptance. Receipt is recorded separately. Revocation blocks future access but cannot retract information already viewed or saved.</p>
      </section>
    </div>
  );
}
