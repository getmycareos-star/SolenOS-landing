"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { CheckCircle2, Clock3, Inbox, RefreshCw, Share2 } from "lucide-react";
import { ensureAnonymousSession, getJSON, postJSON, putJSON } from "@/api/client";
import Link from "next/link";
import { caregiverReadableCaptureText, caregiverSafeAssistantText, caregiverSafeGeneratedText, caregiverStatusLabel } from "@/lib/caregiver-language";
import { RecordState } from "@/components/ui/RecordState";

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
  appointment_id?: string | null;
  selected_appointment?: { id: string; title: string; scheduled_at: string | null; provider?: string | null; healthcare_org?: string | null; status?: string | null } | null;
  source_of_truth?: "living_care_record" | string;
  source_snapshot_id?: string;
  source_snapshot_sha256?: string;
  snapshot_at?: string;
  generation_status?: string;
  validation_status?: string;
  review_status?: string;
  revision_number?: number;
  source_freshness?: { status: string; stale_source_count?: number; unknown_source_count?: number };
  generation?: { status: string; provider?: string | null; model?: string | null; interpretation_limit?: string | null; sources_considered?: number; sources_available?: number; sections: Array<{ section: string; text: string; summary?: string; supporting_quote?: string; source_ref: string; epistemic_status?: string; record_status?: string; event_at?: string | null; recorded_at?: string | null; stale_warning?: boolean; semantic_entailment_status?: string }> };
  caregiver_notes?: Array<{ text: string; attribution: string }>;
  audience?: "family" | "professional";
  prepared_at: string;
  window: { days: number; from: string; to: string };
  sections: Array<{ title: string; items: DraftItem[] }>;
  template_sections?: Array<{ title: string; coverage_status: string; required_fields: string[]; coverage_note: string }>;
  source_statuses: Record<string, { status: string; reason?: string; label?: string; count: number; returned_count?: number; has_more?: boolean; retrieval_complete?: boolean }>;
  retrieval_complete?: boolean;
  partial_sources?: Array<{ source: string; returned_count: number }>;
  source_references: Array<{ source_id: string; source_table: string }>;
  evidence_lineage?: {
    status: string;
    evidence_ids_considered: string[];
    groups: Array<{ lineage_id: string; evidence_ids: string[]; origin_group_keys: string[]; source_independence_status: string; interpretation_limit: string }>;
    interpretation_limit: string;
  };
  limitations: Array<{ source: string; status: string; reason?: string }>;
  claim_provenance?: {
    version?: string;
    coverage?: string;
    unmatched_statement_count?: number;
    interpretation_limit?: string;
    claims: Array<{
      claim_id: string;
      text: string;
      supporting_quote: string;
      support_status: string;
      validation_basis: string;
      semantic_entailment_status: string;
      source_references: Array<{
        source_ref: string;
        label: string;
        record_type?: string | null;
        reporter_label?: string | null;
        occurred_at?: string | null;
        recorded_at?: string | null;
        epistemic_state?: string | null;
        epistemic_status?: string | null;
        assertion_status?: string | null;
        record_status?: string | null;
        source_state_label?: string | null;
        related_evidence?: Array<{ source_type?: string; type?: string; original_author?: string | null; reported_by_label?: string | null }>;
      }>;
    }>;
  };
  warning: string;
};
type Recipient = { caregiver_id: string; name: string; relationship: string; can_receive_handoff: boolean };
type AppointmentOption = { id: string; title: string; scheduled_at: string | null; provider?: string | null; healthcare_org?: string | null; status?: string | null };
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
    generation?: { sections?: Array<{ section: string; text: string; summary?: string; supporting_quote?: string; source_ref: string }> };
    caregiver_notes?: Array<{ text: string; attribution: string }>;
  };
  source_snapshot?: { source_records?: unknown[] };
};
type Snapshot = {
  purpose?: string;
  audience?: string;
  window?: { days: number; from: string; to: string };
  sections?: Record<string, string>;
  source_coverage?: Record<string, { status: string; reason?: string; label?: string; count: number; has_more?: boolean; retrieval_complete?: boolean }>;
  retrieval_complete?: boolean;
  partial_sources?: Array<{ source: string; returned_count: number }>;
  limitations?: Array<{ source: string; status: string; reason?: string; returned_count?: number }>;
  source_references?: Array<{ source_ref: string; epistemic_status: string; record_status: string; event_at?: string | null; recorded_at?: string | null; stale_warning: boolean; document_id?: string | null; original_source_reference?: string | null; page_references?: unknown }>;
  content_sha256?: string;
  source_id_validation?: string;
};
export type CareHandoffSharingProps = {
  draft: DraftPayload | null;
  audience: "family" | "professional" | null;
  purpose: "today" | "appointment" | "overview" | null;
  onResumeDraft?: (draft: DraftPayload) => void;
};

export function caregiverVisibleBriefingSections(draft: CareHandoffSharingProps["draft"]) {
  const sections = draft?.generation?.sections ?? [];
  if (draft?.audience !== "professional" || draft?.purpose !== "professional_appointment") return sections;
  const sourceTables = new Map(
    draft.source_references.map((source) => [
      source.source_table + ":" + source.source_id,
      source.source_table,
    ]),
  );
  return sections.filter((item) => sourceTables.get(item.source_ref) !== "caregiver_profiles");
}

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
  return "Care summary";
}

function readableStatus(value: string): string {
  return caregiverStatusLabel(value) ?? "Not available";
}

function readableScope(value: string): string {
  if (value === "lcr_summary") return "Care record and Daily Care";
  if (value === "documents") return "Uploaded documents";
  if (value === "appointments") return "Appointments";
  if (value === "open_loops") return "Follow-ups and questions";
  return "Other care information";
}

function readableEvidenceType(value?: string | null): string {
  const key = (value || "").trim().toLowerCase();
  if (key.includes("document")) return "Document";
  if (key.includes("appointment")) return "Appointment";
  if (key.includes("daily") || key.includes("event")) return "Care update";
  if (key.includes("assertion") || key.includes("report")) return "Caregiver report";
  if (key.includes("decision")) return "Care decision";
  if (key.includes("action") || key.includes("follow")) return "Follow-up";
  return "Related care information";
}

function readableSection(value: string): string {
  const labels: Record<string, string> = {
    care_facts: "Saved care information", care_assertions: "Caregiver reports", care_events: "Care updates",
    care_decisions: "Care decisions", decision_outcomes: "What happened next", care_transitions: "Care changes",
    care_timeline_entries: "Care history", daily_care: "Daily Care", documents: "Documents",
    appointments: "Appointments", actions: "Follow-up actions", care_action_outcomes: "Follow-up outcomes",
    medications: "Medication reports", allergies: "Allergy information",
    evidence_review_records: "Reviews of notes and documents", evidence_claim_assessments: "Reviews of care details",
    evidence_freshness_assessments: "Checks on how recent information is", evidence_completeness_assessments: "Checks on what information is included",
    open_questions: "Questions that still need answers", information_gaps: "Information still needed",
    uncertainty_assessments: "Information that needs checking", medications_and_allergies: "Medications and allergies",
  };
  return labels[value] ?? "Care information";
}

function claimSourceFor(draft: DraftPayload, item: { source_ref: string }, index: number) {
  const claim = draft.claim_provenance?.claims?.[index];
  return claim?.source_references?.find(source => source.source_ref === item.source_ref) ?? null;
}

function scopeForSourceType(sourceType: string): string {
  if (sourceType.startsWith("document_") || sourceType === "uploaded_document") return "documents";
  if (sourceType === "appointment") return "appointments";
  if (["care_action", "care_action_outcome", "open_question", "information_gap"].includes(sourceType)) return "open_loops";
  return "lcr_summary";
}

function requiredHandoffScopes(draft: DraftPayload, generationSections = caregiverVisibleBriefingSections(draft)): string[] {
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

function buildShareText(draft: DraftPayload, audience: "family" | "professional", purpose: string, scopes: string[] = requiredHandoffScopes(draft), caregiverNote = "", generationSections = caregiverVisibleBriefingSections(draft)) {
  const lines = [
    audience === "family" ? "SolenOS Family Care Summary — Care Record" : "SolenOS Care Summary for Healthcare Professionals — Care Record",
    "Purpose: " + handoffPurposeLabel(purpose),
    "Prepared at: " + formatDate(draft.prepared_at),
    "Period covered: " + draft.window.days + " days (" + draft.window.from + " to " + draft.window.to + ")",
    ...(draft.selected_appointment ? [
      "Appointment: " + draft.selected_appointment.title,
      "Scheduled for: " + formatDate(draft.selected_appointment.scheduled_at),
      ...(draft.selected_appointment.provider ? ["Provider: " + draft.selected_appointment.provider] : []),
    ] : []),
    "",
    "Important: Information that has not been checked, was not accepted, or may be out of date is labelled. This summary is not a medical opinion.",
    ...(draft.generation?.sources_available && draft.generation.sources_considered !== undefined && draft.generation.sources_available > draft.generation.sources_considered ? ["This summary includes " + draft.generation.sources_considered + " of " + draft.generation.sources_available + " available care notes and updates. It is not the full Care Record."] : []),
    caregiverSafeGeneratedText(draft.warning) ?? "Some information may be incomplete. Review the details before sharing.",
    ...(draft.template_sections ?? []).filter(item => /medication/i.test(item.title)).map(item => caregiverSafeGeneratedText(item.coverage_note) || "Some medicine details could not be checked."),
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
    const sectionHeader = "\n## " + readableSection(item.section);
    if (lines.join("\n").length + sectionHeader.length > 16500) { truncated = true; break; }
    lines.push(sectionHeader);
    const itemText = [
      "- " + ((draft.generation?.status === "source_only_fallback" ? caregiverReadableCaptureText(item.summary || item.text) ?? caregiverSafeAssistantText(item.summary || item.text) : caregiverSafeGeneratedText(item.summary || item.text)) ?? "Some details are not available in this preview."),
      ...(item.supporting_quote ? ["Source wording: " + (caregiverReadableCaptureText(item.supporting_quote) ?? "Source wording is unavailable in this preview.")] : []),
      "How it was reported: " + readableStatus(item.epistemic_status || "not_recorded"),
      "Review: " + readableStatus(item.record_status || "not_recorded"),
      "Please check: " + (item.semantic_entailment_status === "source_text_only_no_paraphrase"
        ? "This uses the exact words from the saved note. They have not been rewritten."
        : "Please check that this summary means the same thing as the saved note."),
      "When it happened: " + formatDate(item.event_at),
      "When it was saved: " + formatDate(item.recorded_at),
      "Date note: " + (item.stale_warning ? "This information may be old. Check it before relying on it." : "No warning that this information is old."),
      "Related care detail: " + displayedSourceNumber,
      ...(scopeForSourceType(sourceTypes.get(item.source_ref) ?? "care_fact") === "documents" ? [
        "Document: saved",
        "Pages in the document: " + (Array.isArray(sourceDetails.get(item.source_ref)?.page_references) ? (sourceDetails.get(item.source_ref)?.page_references as unknown[]).map(value => String(value)).join(", ") : "not recorded"),
      ] : []),
    ].join("\n");
    if (lines.join("\n").length + itemText.length > 16500) { truncated = true; break; }
    lines.push(itemText);
  }
  for (const note of draft.caregiver_notes ?? []) {
    const line = "\nCaregiver note (not confirmed by a healthcare professional): " + note.text;
    if (lines.join("\n").length + line.length > 16500) { truncated = true; break; }
    lines.push(line);
  }
  if (caregiverNote.trim()) {
    const line = "\nCaregiver note (not confirmed by a healthcare professional): " + caregiverNote.trim();
    if (lines.join("\n").length + line.length > 16500) truncated = true;
    else lines.push(line);
  }
  if (draft.retrieval_complete === false) {
    lines.push("\n## Important: some saved information could not be included");
    for (const partial of draft.partial_sources ?? []) {
      lines.push("- " + readableSection(partial.source) + ": at least " + partial.returned_count + " saved details were included; more may be available.");
    }
    lines.push("This summary does not include everything in your Care Record. Open the Care Record and check the notes and documents before sharing.");
  }
  lines.push("\n## What information was available");
  for (const [name, value] of Object.entries(draft.source_statuses)) {
    const line = "- " + (caregiverSafeGeneratedText(value.label) || readableSection(name)) + ": " + readableStatus(value.status) + (caregiverSafeGeneratedText(value.reason) ? " (" + caregiverSafeGeneratedText(value.reason) + ")" : "") + "; " + value.count + (value.count === 1 ? " saved detail" : " saved details");
    if (lines.join("\n").length + line.length > 17500) { truncated = true; break; }
    lines.push(line);
  }
  for (const limitation of draft.limitations) {
    if (limitation.status !== "partial" && !includedSourceKeys.has(limitation.source)) continue;
    const line = "- " + readableSection(limitation.source) + ": " + readableStatus(limitation.status) + (caregiverSafeGeneratedText(limitation.reason) ? " (" + caregiverSafeGeneratedText(limitation.reason) + ")" : "");
    if (lines.join("\n").length + line.length > 17500) { truncated = true; break; }
    lines.push(line);
  }
  if (truncated) lines.push("\nThis preview is shortened. The saved summary keeps all the information you chose to share.");
  return { text: lines.join("\n").slice(0, 18000) };
}

export function CareHandoffSharing({ draft, audience, purpose, onResumeDraft }: CareHandoffSharingProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [preparePurpose, setPreparePurpose] = useState<HandoffDraftPurpose>("family_transition");
  const [prepareAudience, setPrepareAudience] = useState<"family" | "professional">("family");
  const [prepareWindowDays, setPrepareWindowDays] = useState("30");
  const [appointmentOptions, setAppointmentOptions] = useState<AppointmentOption[]>([]);
  const [prepareAppointmentId, setPrepareAppointmentId] = useState("");
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
  const [draftsError, setDraftsError] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [expiryDays, setExpiryDays] = useState("7");
  const [summaryText, setSummaryText] = useState("");
  const [caregiverNote, setCaregiverNote] = useState("");
  const [selectedScope, setSelectedScope] = useState<string[]>([]);
  const [editedSections, setEditedSections] = useState<NonNullable<DraftPayload["generation"]>["sections"]>([]);
  const [revisionHistory, setRevisionHistory] = useState<DraftRevision[]>([]);
  const loadedPersonIdRef = useRef<string | null>(null);
  const [sourceFreshness, setSourceFreshness] = useState<{ status: string; stale_source_count?: number; unknown_source_count?: number } | null>(null);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [reviewedSourceRefs, setReviewedSourceRefs] = useState<string[]>([]);
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
    setDraftsError(false);
    let requestPersonId: string | null = null;
    try {
      const session = await ensureAnonymousSession();
      requestPersonId = session.person?.id ?? null;
      if (!requestPersonId) throw new Error("A valid Care Record session is required.");
      if (loadedPersonIdRef.current && loadedPersonIdRef.current !== requestPersonId) {
        setDirectory([]);
        setInbox([]);
        setOutbox([]);
        setSavedDrafts([]);
        setAppointmentOptions([]);
        setPrepareAppointmentId("");
        setSelectedRecipients([]);
        setSelectedScope([]);
      }
      loadedPersonIdRef.current = requestPersonId;
      // Handoff inbox and recipient discovery require the caregiver's persisted
      // privacy/multi-caregiver acknowledgements. Read that state first so a
      // normal first-use session does not generate avoidable 403 responses.
      const consent = await getJSON("/consent") as { verified?: boolean; required?: boolean };
      const canUseHandoffs = consent.verified === true && consent.required === false;
      setConsentRequired(!canUseHandoffs);
      const [directoryResult, inboxResult, outboxResult, draftsResult, appointmentsResult] = await Promise.allSettled([
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
        getJSON("/handoff-drafts/appointments") as Promise<{ items?: AppointmentOption[] }>,
      ]);
      if (directoryResult.status === "fulfilled" && Array.isArray(directoryResult.value.items)) setDirectory(directoryResult.value.items);
      else setDirectoryError(true);
      if (inboxResult.status === "fulfilled" && Array.isArray(inboxResult.value.items)) setInbox(inboxResult.value.items);
      else setHistoryError(true);
      if (outboxResult.status === "fulfilled" && Array.isArray(outboxResult.value.items)) setOutbox(outboxResult.value.items);
      else setHistoryError(true);
      if (draftsResult.status === "fulfilled" && Array.isArray(draftsResult.value.items)) setSavedDrafts(draftsResult.value.items);
      else setDraftsError(true);
      if (appointmentsResult.status === "fulfilled" && Array.isArray(appointmentsResult.value.items)) {
        setAppointmentOptions(appointmentsResult.value.items);
      } else {
        setAppointmentOptions([]);
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      const accessDenied = /401|403|unauthori[sz]ed|forbidden|access denied|not authenticated|not authorized|session.*required|authentication/i.test(message);
      if (!requestPersonId || accessDenied || (loadedPersonIdRef.current && loadedPersonIdRef.current !== requestPersonId)) {
        setDirectory([]);
        setInbox([]);
        setOutbox([]);
        setSavedDrafts([]);
        setSelectedRecipients([]);
        setSelectedScope([]);
        loadedPersonIdRef.current = null;
      }
      setDirectoryError(true);
      setHistoryError(true);
      setDraftsError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    setSelectedScope([]);
  }, [draft?.draft_id]);

  useEffect(() => {
    setCaregiverNote("");
    setEditedSections(draft?.generation?.sections ?? []);
    setReviewedSourceRefs([]);
    setReviewConfirmed(false);
  }, [draft?.draft_id]);

  useEffect(() => {
    // Any content edit invalidates every prior source acknowledgement, even
    // when the source IDs stay the same. A caregiver must re-check the revised
    // wording, dates and uncertainty labels before sharing.
    setReviewedSourceRefs([]);
    setReviewConfirmed(false);
  }, [editedSections]);

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
    if (preparePurpose === "professional_appointment" && !prepareAppointmentId) {
      setPrepareError("Choose the saved appointment this briefing is for.");
      return;
    }
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
      // postJSON performs the authoritative session check/refresh itself.
      // Avoid a second, independent bootstrap wait that can leave the UI
      // stuck before the request is ever sent.
      const prepared = await postJSON("/handoff-drafts/prepare", {
        purpose: preparePurpose,
        audience: prepareAudience,
        window_days: Number(prepareWindowDays),
        appointment_id: preparePurpose === "professional_appointment" ? prepareAppointmentId : null,
      }, { "X-Request-ID": requestId }) as DraftPayload;
      if (!prepared?.draft_id || !Array.isArray(prepared.sections)) {
        throw new Error("The saved summary could not be confirmed.");
      }
      setSavedDrafts(current => [
        prepared,
        ...current.filter(item => item.draft_id !== prepared.draft_id),
      ].slice(0, 10));
      prepareRequestId.current = null;
      setPrepareNotice(
        ["generated", "source_only_fallback"].includes(prepared.generation_status ?? "") && prepared.validation_status === "exact_quote_reference_validation_passed"
          ? "Draft saved for your review. Nothing has been shared or added to the Care Record."
          : "Draft saved with source availability and limitations. Review the available records; no information has been shared or added to the Care Record."
      );
      onResumeDraft?.(prepared);
    } catch {
      // Retain the same request ID. If the server saved the draft but the
      // response was interrupted, retrying retrieves that same persisted draft.
      setPrepareError("The care summary could not be prepared. Check your connection and try again. Your Care Record has not changed.");
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
        caregiver_notes: caregiverNote.trim()
          ? [{ text: caregiverNote.trim(), attribution: "caregiver_authored_unverified" }]
          : [],
      };
      await putJSON("/handoff-drafts/" + encodeURIComponent(draft.draft_id), { content });
      const saved = await getJSON("/handoff-drafts/" + encodeURIComponent(draft.draft_id)) as {
        revision_history?: Array<{ revision_number: number; change_type: string; created_at: string | null }>;
        source_freshness?: { status: string; stale_source_count?: number; unknown_source_count?: number };
      };
      setRevisionHistory(saved.revision_history ?? []);
      setSourceFreshness(saved.source_freshness ?? null);
      setReviewConfirmed(false);
      setNotice("Your changes were saved. They have not been approved or shared.");
      await load();
    } catch (saveError) {
      setError("Your changes could not be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function shareReviewedFamilyHandoff() {
    if (sourceFreshness?.status !== "current") {
      setError("This summary may be out of date or could not be checked. Prepare a new draft before sharing.");
      return;
    }
    if (!draft || audience !== "family") {
      setError("SolenOS cannot yet confirm that a recipient is a healthcare professional, so professional sharing is not available.");
      return;
    }
    if (!["generated", "source_only_fallback"].includes(draft.generation_status ?? "") || draft.validation_status !== "exact_quote_reference_validation_passed") {
      setError("This summary is not ready to share yet.");
      return;
    }
    const expectedSourceRefs = [...new Set(editedSections.map(item => item.source_ref))];
    if (!reviewConfirmed || expectedSourceRefs.length === 0 || expectedSourceRefs.some(ref => !reviewedSourceRefs.includes(ref)) || !summaryText.trim() || editedSections.length === 0 || selectedRecipients.length === 0 || selectedScope.length === 0) {
      setError("Check the full summary and choose at least one caregiver before sharing.");
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
        reviewed_source_refs: expectedSourceRefs.filter(ref => reviewedSourceRefs.includes(ref)),
        semantic_review_acknowledged: true,
      }) as {
        care_continuity_execution?: { stages?: Record<string, string> } | null;
      };
      const sourceStages = approval?.care_continuity_execution?.stages;
      if (sourceStages && (
        sourceStages.handoff_draft !== "verified" ||
        sourceStages.handoff_draft_revision !== "verified" ||
        sourceStages.reconciliation !== "not_applicable_read_only_output"
      )) {
        throw new Error("SolenOS could not check the saved summary. Sharing was stopped.");
      }
      const created = await postJSON("/handoffs", {
        person_id: session.person.id,
        draft_id: draft.draft_id,
        recipient_caregiver_ids: selectedRecipients,
        scope: [...selectedScope].sort(),
        expires_at: expiresAt,
      }, { "X-Request-ID": requestId }) as { id: string };
      if (!created?.id) throw new Error("SolenOS could not confirm that the summary was shared.");
      setNotice("Your summary was shared with the selected caregivers. SolenOS checked the saved care information; sharing did not change your Care Record. Access ends " + formatDate(expiresAt) + ".");
      setReviewConfirmed(false);
      setSelectedRecipients([]);
      setCaregiverNote("");
      shareRequestId.current = null;
      shareExpiry.current = null;
      await load();
    } catch (shareError) {
      setError("Your summary could not be shared. Refresh the list to check before trying again.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(item: OutboxItem) {
    if (!window.confirm("Stop sharing this summary? The recipients will no longer be able to open it.")) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await postJSON("/handoffs/" + encodeURIComponent(item.id) + "/revoke", {});
      setNotice("Sharing has stopped. This cannot take back information already seen or saved by a recipient.");
      await load();
    } catch {
      setError("SolenOS could not stop sharing this summary. Refresh the list to check its status.");
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
      setError("SolenOS could not save your response. Refresh the list to check whether it was received.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="companion-handoff-sharing" style={{ marginTop: 14, display: "grid", gap: 12, minWidth: 0, width: "100%" }}>
      <section style={{ ...panel, marginTop: 0 }} aria-labelledby="prepare-handoff-heading">
        <h4 id="prepare-handoff-heading" style={{ marginTop: 0 }}>Prepare a care summary to share</h4>
        <p style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))", lineHeight: 1.55, color: "#667267" }}>
          SolenOS gathers the saved care information for the selected handoff. Review the draft before sharing. Missing or uncertain information stays clearly identified.
        </p>
        <form onSubmit={event => { event.preventDefault(); void prepareHandoffDraft(); }} style={{ display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 5, fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>
            Who is this summary for?
            <select value={prepareAudience} onChange={event => {
              const next = event.target.value as "family" | "professional";
              setPrepareAudience(next);
              prepareRequestId.current = null;
              setPrepareError("");
              if (next === "professional" && preparePurpose === "family_transition") {
                setPreparePurpose("professional_appointment");
              }
              if (next === "family" && preparePurpose === "professional_appointment") {
                setPreparePurpose("family_transition");
                setPrepareAppointmentId("");
              }
            }} style={field} disabled={preparing}>
              <option value="family">Family caregiver</option>
              <option value="professional">Healthcare professional — private review only</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 5, fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>
            Why are you sharing it?
            <select value={preparePurpose} onChange={event => {
              const next = event.target.value as HandoffDraftPurpose;
              setPreparePurpose(next);
              prepareRequestId.current = null;
              setPrepareError("");
              if (next !== "professional_appointment") setPrepareAppointmentId("");
            }} style={field} disabled={preparing}>
              {prepareAudience === "family" ? (
                <>
                  <option value="family_transition">Taking over today</option>
                  <option value="professional_appointment">Preparing for an appointment</option>
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
          {preparePurpose === "professional_appointment" && (
            <label style={{ display: "grid", gap: 5, fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>
              Which saved appointment is this briefing for?
              <select value={prepareAppointmentId} onChange={event => {
                setPrepareAppointmentId(event.target.value);
                prepareRequestId.current = null;
                setPrepareError("");
              }} style={field} disabled={preparing || appointmentOptions.length === 0}>
                <option value="">Choose an appointment</option>
                {appointmentOptions.map(item => (
                  <option key={item.id} value={item.id}>
                    {(item.title || "Appointment") + " · " + formatDate(item.scheduled_at) + (item.provider ? " · " + item.provider : "")}
                  </option>
                ))}
              </select>
              {appointmentOptions.length === 0 && <span style={{ color: "#667267" }}>No saved appointments are available. Add the appointment to this Care Record before preparing its briefing.</span>}
            </label>
          )}
          <label style={{ display: "grid", gap: 5, fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>
            How much care history should be included?
            <select value={prepareWindowDays} onChange={event => {
              setPrepareWindowDays(event.target.value);
              prepareRequestId.current = null;
              setPrepareError("");
            }} style={field} disabled={preparing}>
              <option value="7">Past 7 days</option>
              <option value="14">Past 14 days</option>
              <option value="30">Past 30 days</option>
              <option value="60">Past 60 days</option>
              <option value="90">Past 90 days</option>
            </select>
          </label>
          {prepareAudience === "professional" && <p style={{ margin: 0, fontSize: "calc(12px * var(--solenos-text-scale, 1))", lineHeight: 1.5 }}>We have not confirmed this person's identity or professional role. You can review this draft privately, but you cannot share it with a healthcare professional yet.</p>}
          {prepareError && <p role="alert" style={{ margin: 0, color: "#8d2d2d", fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>{prepareError}</p>}
          {prepareNotice && <p role="status" style={{ margin: 0, color: "#356441", fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>{prepareNotice}</p>}
          <button
            type="button"
            style={button}
            disabled={preparing || loading || (preparePurpose === "professional_appointment" && (!prepareAppointmentId || appointmentOptions.length === 0))}
            onClick={() => void prepareHandoffDraft()}
          >
            {preparing ? "Preparing your summary…" : "Prepare summary to share"}
          </button>
        </form>
      </section>

      {savedDrafts.length > 0 && (
        <section style={{ ...panel, marginTop: 0 }} aria-label="Saved summaries">
          <h4 style={{ marginTop: 0 }}>Saved summaries</h4>
          <p style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))", color: "#667267" }}>Only summaries you prepared for this Care Record are listed.</p>
          {savedDrafts.map(saved => (
            <div key={saved.draft_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, borderTop: "1px solid #e5ebe4", padding: "9px 0" }}>
              <div>
                <strong>{handoffPurposeLabel(saved.purpose)}</strong>
                <div style={{ fontSize: "calc(11px * var(--solenos-text-scale, 1))", color: "#667267" }}>{saved.review_status ? readableStatus(saved.review_status) : "Needs your review"} · Updated {formatDate(saved.updated_at ?? saved.prepared_at)}</div>
              </div>
              <button type="button" style={quietButton} disabled={busy || !onResumeDraft} onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const full = await getJSON("/handoff-drafts/" + encodeURIComponent(saved.draft_id)) as DraftPayload;
                  onResumeDraft?.(full);
                } catch (resumeError) {
                  setError("The saved summary could not be opened. Please refresh and try again.");
                } finally {
                  setBusy(false);
                }
              }}>Resume draft</button>
            </div>
          ))}
        </section>
      )}
      {loading && savedDrafts.length === 0 && !draftsError && <RecordState kind="loading" title="Loading saved summaries" />}
      {draftsError && savedDrafts.length === 0 && !loading && <RecordState kind="error" title="Saved summaries could not be loaded" description="Your saved summaries may be incomplete. Please try again." onAction={() => void load()} />}
      {draftsError && savedDrafts.length > 0 && <RecordState kind="error" title="Saved summaries could not be refreshed" description="Previously loaded summaries are still shown. Please try again." onAction={() => void load()} />}
      {savedDrafts.length === 0 && !loading && !draftsError && (
        <section style={{ ...panel, marginTop: 0 }} aria-label="Saved summaries">
          <h4 style={{ marginTop: 0 }}>Saved summaries</h4>
          <p style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: "#667267", marginBottom: 0 }}>
            No summaries have been saved for this Care Record yet. Use the form above to prepare one from saved information.
          </p>
        </section>
      )}

      {draft && (
        <section role="status" aria-label="Care information included and missing" style={{ ...panel, marginTop: 0, background: "#fbf8ef", borderColor: "#d8c9a5" }}>
          {draft.selected_appointment && <p style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))", lineHeight: 1.5, margin: "6px 0" }}><b>Appointment:</b> {draft.selected_appointment.title} · {formatDate(draft.selected_appointment.scheduled_at)}{draft.selected_appointment.provider ? " · " + draft.selected_appointment.provider : ""}</p>}
          <strong style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))" }}>Check what information is missing</strong>
          {draft.retrieval_complete === false && <p style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))", lineHeight: 1.5, margin: "6px 0" }}>This summary does not include everything saved in your Care Record. Check the missing items before relying on or sharing it.</p>}
          {draft.partial_sources?.map(item => <p key={item.source} style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))", lineHeight: 1.45, margin: "4px 0" }}>{readableSection(item.source)}: at least {item.returned_count} saved details were included. There may be more.</p>)}
          {draft.template_sections?.filter(item => /medication/i.test(item.title)).map(item => <p key={item.title} style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))", lineHeight: 1.45, margin: "4px 0" }}>{caregiverSafeGeneratedText(item.coverage_note) || "Some medicine details could not be checked."}</p>)}
          {draft.limitations?.map((item, index) => <p key={item.source + index} style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))", lineHeight: 1.45, margin: "4px 0" }}>
            {item.source === "allergies"
              ? "Allergy information could not be checked from a connected source. This does not mean there are no allergies."
              : `${readableSection(item.source)}: this information could not be fully checked (${readableStatus(item.status)}).`}
          </p>)}
        </section>
      )}
      {draft && audience === "professional" && (
        <>
          <div style={{ ...panel, marginTop: 0, background: "#f7f8f4" }}>
            <strong>Healthcare professional briefing — private review only</strong>
            <p style={{ marginBottom: 0, fontSize: "calc(13px * var(--solenos-text-scale, 1))", lineHeight: 1.55 }}>This briefing is prepared from the saved Care Record. SolenOS cannot yet confirm a professional recipient's identity and role, so professional sharing is not available from this screen.</p>
            {draft.generation?.interpretation_limit && <p style={{ margin: "8px 0 0", fontSize: "calc(12px * var(--solenos-text-scale, 1))", lineHeight: 1.5 }}>{caregiverSafeGeneratedText(draft.generation.interpretation_limit) ?? "Check each summary detail against the saved note or document."}</p>}
            {typeof draft.generation?.sources_available === "number" && typeof draft.generation?.sources_considered === "number" && draft.generation.sources_available > draft.generation.sources_considered && <p style={{ margin: "8px 0 0", fontSize: "calc(12px * var(--solenos-text-scale, 1))", lineHeight: 1.5 }}>This summary includes {draft.generation.sources_considered} of {draft.generation.sources_available} available care notes and updates. It does not replace the full Care Record.</p>}
          </div>
          <section style={{ ...panel, marginTop: 0 }} aria-label="Professional briefing review">
            <h4 style={{ marginTop: 0 }}>Professional briefing</h4>
            {(caregiverVisibleBriefingSections(draft)).map((item, index) => (
              <article key={item.source_ref + index} style={{ borderTop: "1px solid #e5ebe4", padding: "10px 0" }}>
                <strong style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))" }}>{readableSection(item.section)}</strong>
                <p style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))", lineHeight: 1.5, margin: "6px 0" }}>{(draft.generation?.status === "source_only_fallback" ? caregiverReadableCaptureText(item.summary || item.text) ?? caregiverSafeAssistantText(item.summary || item.text) : caregiverSafeGeneratedText(item.summary || item.text)) ?? "Some details could not be shown."}</p>
                {item.supporting_quote && <p style={{ fontSize: "calc(11px * var(--solenos-text-scale, 1))", lineHeight: 1.45, color: "#667267", margin: "4px 0" }}>Original wording from the saved note or document: {caregiverReadableCaptureText(item.supporting_quote) ?? "Original wording is not available."}</p>}
                <p style={{ fontSize: "calc(11px * var(--solenos-text-scale, 1))", lineHeight: 1.45, margin: "4px 0", color: "#765b2b" }}>{item.semantic_entailment_status === "source_text_only_no_paraphrase" ? "This uses the exact words saved in your Care Record. They have not been rewritten." : "The original wording matches, but please check that the summary says the same thing before sharing."}</p>
                <small style={{ color: "#667267" }}>{readableStatus(item.epistemic_status ?? "not_recorded")} · {readableStatus(item.record_status ?? "not_recorded")} · happened {formatDate(item.event_at)} · saved {formatDate(item.recorded_at)}</small>
                {claimSourceFor(draft, item, index)?.reporter_label && <p style={{ fontSize: "calc(11px * var(--solenos-text-scale, 1))", color: "#667267", margin: "4px 0" }}>Reported by: {claimSourceFor(draft, item, index)?.reporter_label}</p>}
                {claimSourceFor(draft, item, index)?.source_state_label && <p style={{ fontSize: "calc(11px * var(--solenos-text-scale, 1))", color: "#765b2b", margin: "4px 0" }}>{caregiverSafeGeneratedText(claimSourceFor(draft, item, index)?.source_state_label) || "Status not available."}</p>}
                {(claimSourceFor(draft, item, index)?.related_evidence?.length ?? 0) > 0 && <p style={{ fontSize: "calc(11px * var(--solenos-text-scale, 1))", color: "#667267", margin: "4px 0" }}>Related notes and documents: {claimSourceFor(draft, item, index)?.related_evidence?.map(source => readableEvidenceType(source.type || source.source_type)).join(", ")}</p>}
              </article>
            ))}
            {draft.generation?.status === "source_only_fallback" && <p style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))", lineHeight: 1.5 }}>SolenOS could not prepare a summary. This draft uses the saved words without rewriting them. Check each detail and its date before using it.</p>}
            {draft.generation?.status !== "generated" && draft.generation?.status !== "source_only_fallback" && <p style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>We couldn’t prepare this summary. You can still review the saved care information and decide what to share.</p>}
          </section>
        </>
      )}

      {draft && audience === "family" && (
        <section style={panel} aria-labelledby="family-share-heading">
          <h4 id="family-share-heading" style={{ margin: "0 0 8px", fontSize: "calc(15px * var(--solenos-text-scale, 1))" }}>Review and share with family</h4>
          <p style={{ marginTop: 0, fontSize: "calc(12px * var(--solenos-text-scale, 1))", lineHeight: 1.55 }}>Only caregivers who can access this Care Record are listed. You must review the summary before sharing. The link expires automatically, you can stop sharing it, and it does not change your Care Record.</p>
          {draft.generation?.status === "source_only_fallback" && <p role="status" style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))", lineHeight: 1.5, padding: 10, borderRadius: 8, background: "#f5f6f1" }}>SolenOS could not prepare a summary. This draft uses the saved words without rewriting them. Check each detail and its date before sharing.</p>}
          {consentRequired && <p role="status" style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))", lineHeight: 1.5, padding: 10, borderRadius: 8, background: "#f5f6f1" }}>
            You cannot receive or share care summaries until you save the required privacy and shared-care choices for this Care Record. Review them in <Link href="/workspace/settings" style={{ textDecoration: "underline" }}>Settings → Privacy</Link>, then refresh this panel. Your care record remains available.
          </p>}
          {draft.evidence_lineage && <details style={{ border: "1px solid #dce7dc", borderRadius: 9, padding: 10, marginBottom: 12 }} aria-label="Where the information came from">
            <summary style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))", fontWeight: 650, cursor: "pointer" }}>Where the information came from</summary>
            {draft.evidence_lineage.groups.length ? draft.evidence_lineage.groups.map((group, index) => <div key={group.lineage_id} style={{ borderTop: "1px solid #e5ebe4", marginTop: 7, paddingTop: 7, fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>
              <b>How these reports are connected: {readableStatus(group.source_independence_status)}</b>
              <p style={{ margin: "3px 0", color: "#667267" }}>{caregiverSafeGeneratedText(group.interpretation_limit) ?? "The relationship between these reports is not fully known."}</p>
            </div>) : <p style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))", marginBottom: 0 }}>We could not check whether some information came from the same original. Do not assume similar reports are separate.</p>}
            <p style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))", marginBottom: 0, color: "#667267" }}>{caregiverSafeGeneratedText(draft.evidence_lineage.interpretation_limit) ?? "A connection between reports does not prove they are true or came from different people."}</p>
          </details>}
          {directoryError && <RecordState kind="error" title="Recipient access could not be checked" description="Refresh before sharing this summary." onAction={() => void load()} />}
          {!consentRequired && !directoryError && !loading && eligibleRecipients.length === 0 && <p>No caregiver on this Care Record can receive the summary right now. SolenOS will not share it outside this Care Record.</p>}
          {eligibleRecipients.map(recipient => (
            <label key={recipient.caregiver_id} style={{ display: "flex", alignItems: "flex-start", gap: 9, margin: "10px 0", lineHeight: 1.4 }}>
              <input type="checkbox" checked={selectedRecipients.includes(recipient.caregiver_id)} disabled={busy} onChange={event => {
                setSelectedRecipients(current => event.target.checked ? [...current, recipient.caregiver_id] : current.filter(id => id !== recipient.caregiver_id));
                setReviewConfirmed(false);
                shareRequestId.current = null;
                shareExpiry.current = null;
              }} />
              <span><strong>{recipient.name}</strong><br /><small>{recipient.relationship || "Linked caregiver"} · can receive shared care information</small></span>
            </label>
          ))}
          {ineligibleRecipients.map(recipient => <p key={recipient.caregiver_id} style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))", color: "#6b746c" }}>{recipient.name} — cannot receive this summary until the required permission is saved.</p>)}
          <label htmlFor="companion-handoff-expiry" style={{ display: "block", fontWeight: 650, margin: "12px 0 6px", fontSize: "calc(13px * var(--solenos-text-scale, 1))" }}>How long the link works</label>
          <select id="companion-handoff-expiry" value={expiryDays} onChange={event => { setExpiryDays(event.target.value); setReviewConfirmed(false); shareRequestId.current = null; shareExpiry.current = null; }} style={{ ...field, maxWidth: 240 }}>
            <option value="1">24 hours</option><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option>
          </select>
          <label htmlFor="companion-handoff-share-text" style={{ display: "block", fontWeight: 650, margin: "12px 0 6px", fontSize: "calc(13px * var(--solenos-text-scale, 1))" }}>Full summary</label>
          <div style={{ margin: "12px 0" }}>
            <strong style={{ display: "block", fontSize: "calc(13px * var(--solenos-text-scale, 1))", marginBottom: 8 }}>Check what will be shared</strong>
            <p style={{ fontSize: "calc(11px * var(--solenos-text-scale, 1))", color: "#667267", margin: "0 0 8px" }}>Each detail stays linked to the information it came from. Remove anything you do not want to share. If something is old or needs correcting, explain it in your note below. Your note will be clearly marked as yours, not as something confirmed by a healthcare professional. Update the Care Record separately when needed.</p>
            {editedSections.map((item, index) => (
              <div key={item.source_ref + index} style={{ border: "1px solid #e2e9e1", borderRadius: 8, padding: 10, marginBottom: 9 }}>
                <strong style={{ display: "block", fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>{readableSection(item.section)}</strong>
                <small style={{ display: "block", color: "#667267", margin: "3px 0 6px" }}>Care detail {index + 1} · {readableStatus(item.epistemic_status ?? "not_recorded")} · {readableStatus(item.record_status ?? "not_recorded")} · happened {formatDate(item.event_at)} · saved {formatDate(item.recorded_at)}</small>
                {claimSourceFor(draft, item, index)?.reporter_label && <small style={{ display: "block", color: "#667267", margin: "3px 0" }}>Reported by: {claimSourceFor(draft, item, index)?.reporter_label}</small>}
                {claimSourceFor(draft, item, index)?.source_state_label && <small style={{ display: "block", color: "#765b2b", margin: "3px 0" }}>{caregiverSafeGeneratedText(claimSourceFor(draft, item, index)?.source_state_label) || "Status not available."}</small>}
                <p style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))", lineHeight: 1.5, margin: "6px 0 10px", overflowWrap: "anywhere" }}>{(draft.generation?.status === "source_only_fallback" ? caregiverReadableCaptureText(item.summary || item.text) ?? caregiverSafeAssistantText(item.summary || item.text) : caregiverSafeGeneratedText(item.summary || item.text)) ?? "Some details could not be shown in this preview."}</p>
                {item.supporting_quote && <p style={{ fontSize: "calc(11px * var(--solenos-text-scale, 1))", lineHeight: 1.45, margin: "0 0 6px", color: "#667267" }}>From the saved record: {caregiverReadableCaptureText(item.supporting_quote) ?? "Source wording is unavailable."}</p>}
                <p style={{ fontSize: "calc(11px * var(--solenos-text-scale, 1))", lineHeight: 1.45, margin: "0 0 10px", color: "#765b2b" }}>{item.semantic_entailment_status === "source_text_only_no_paraphrase" ? "This uses the exact words from the saved note. They have not been rewritten." : "Needs your review: the source wording is matched, but the summary has not been independently checked for meaning."}</p>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: "calc(11px * var(--solenos-text-scale, 1))", lineHeight: 1.45, margin: "0 0 9px" }}>
                  <input type="checkbox" checked={reviewedSourceRefs.includes(item.source_ref)} disabled={busy} onChange={event => {
                    setReviewedSourceRefs(current => event.target.checked
                      ? [...new Set([...current, item.source_ref])]
                      : current.filter(ref => ref !== item.source_ref));
                    setReviewConfirmed(false);
                    shareRequestId.current = null;
                    shareExpiry.current = null;
                  }} />
                  <span>I checked this summary item against the saved wording, dates and what is known or still uncertain.</span>
                </label>
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
          <p style={{ fontSize: "calc(11px * var(--solenos-text-scale, 1))", lineHeight: 1.5, color: "#667267" }}>Each detail stays connected to the information it came from. The summary shows when something happened and when it was saved.</p>
          <p style={{ fontSize: "calc(11px * var(--solenos-text-scale, 1))", lineHeight: 1.5, color: "#667267" }}>Saved versions: {revisionHistory.length || 1} · Last check: {sourceFreshness ? readableStatus(sourceFreshness.status) : "Checking"}</p>
          {revisionHistory.length > 0 && <details style={{ marginBottom: 10 }}><summary style={{ cursor: "pointer", fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>Previous saved versions</summary>{revisionHistory.map(item => (
              <details key={item.revision_number} style={{ margin: "6px 0" }}>
                <summary style={{ cursor: "pointer", fontSize: "calc(11px * var(--solenos-text-scale, 1))" }}>Updated {formatDate(item.created_at)} · {readableStatus(item.change_type)}</summary>
                {item.content?.generation?.sections?.map((section, index) => <p key={section.source_ref + index} style={{ fontSize: "calc(11px * var(--solenos-text-scale, 1))", margin: "5px 0" }}><strong>{readableSection(section.section)}:</strong> {caregiverSafeGeneratedText(section.text) ?? "Some details are not available in this version."} <small>(Related note or document {index + 1})</small></p>)}
                {item.content?.caregiver_notes?.map((note, index) => <p key={index} style={{ fontSize: "calc(11px * var(--solenos-text-scale, 1))" }}>Caregiver note: {caregiverSafeAssistantText(note.text) ?? "No further note was recorded."}</p>)}
                <p style={{ fontSize: "calc(10px * var(--solenos-text-scale, 1))", color: "#667267" }}>Related notes and documents in this version: {item.source_snapshot?.source_records?.length ?? "Not recorded"}</p>
              </details>
            ))}</details>}
          {sourceFreshness && sourceFreshness.status !== "current" && <p role="alert" style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))", color: "#8d2d2d" }}>Some information in this draft may be out of date ({readableStatus(sourceFreshness.status)}). Prepare a new draft before sharing.</p>}
          <div style={{ margin: "12px 0" }}>
            <strong style={{ display: "block", fontSize: "calc(13px * var(--solenos-text-scale, 1))", marginBottom: 6 }}>What to share</strong>
            <p style={{ fontSize: "calc(11px * var(--solenos-text-scale, 1))", color: "#667267", margin: "0 0 8px" }}>Choose what the recipient can see. Anything you leave unchecked will not be shared.</p>
            {requiredHandoffScopes(draft, editedSections).map(scope => (
              <label key={scope} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "calc(12px * var(--solenos-text-scale, 1))", margin: "6px 0" }}>
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
          <label htmlFor="companion-handoff-caregiver-note" style={{ display: "block", fontWeight: 650, margin: "12px 0 6px", fontSize: "calc(13px * var(--solenos-text-scale, 1))" }}>Add a note (optional)</label>
          <textarea id="companion-handoff-caregiver-note" value={caregiverNote} onChange={event => { setCaregiverNote(event.target.value); setReviewConfirmed(false); shareRequestId.current = null; shareExpiry.current = null; }} rows={3} maxLength={2000} placeholder="Add context in your own words. It will be shown as your note, not a confirmed medical fact." style={{ ...field, resize: "vertical", lineHeight: 1.5 }} />
          <button type="button" style={quietButton} disabled={busy || sourceFreshness?.status === "stale" || editedSections.length === 0} onClick={() => void saveDraftRevision()}>Save draft changes</button>
          <section aria-label="Check sharing details" style={{ border: "1px solid #cbd8cb", borderRadius: 10, padding: 12, margin: "14px 0", background: "#f7faf6" }}>
            <strong style={{ display: "block", fontSize: "calc(13px * var(--solenos-text-scale, 1))", marginBottom: 7 }}>Check what will be shared</strong>
            <p style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))", margin: "4px 0" }}><b>Purpose:</b> {purpose === "today" ? "Taking over today" : purpose === "appointment" ? "Doctor’s appointment" : "Full care overview"}</p>
            <p style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))", margin: "4px 0" }}><b>Who will receive it:</b> {eligibleRecipients.filter(item => selectedRecipients.includes(item.caregiver_id)).map(item => item.name).join(", ") || "No recipient selected"}</p>
            <p style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))", margin: "4px 0" }}><b>What will be shared:</b> {selectedScope.map(readableScope).join(", ") || "No information category selected"}</p>
            <p style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))", margin: "4px 0" }}><b>Link expires:</b> {expiryDays === "1" ? "In 24 hours" : "In " + expiryDays + " days"} after sharing</p>
            <p style={{ fontSize: "calc(11px * var(--solenos-text-scale, 1))", color: "#667267", margin: "8px 0 0" }}>Only the people you choose can open this summary. Sharing does not change your Care Record. If you stop sharing later, they may still have information they already saw or saved.</p>
          </section>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 9, margin: "12px 0", lineHeight: 1.5, fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>
            <input type="checkbox" checked={reviewConfirmed} disabled={busy} onChange={event => setReviewConfirmed(event.target.checked)} />
            <span>I checked each detail against the saved note or document, including its date and what is still unclear.</span>
          </label>
          <button type="button" style={button} disabled={busy || loading || consentRequired || directoryError || !["generated", "source_only_fallback"].includes(draft.generation_status ?? "") || draft.validation_status !== "exact_quote_reference_validation_passed" || sourceFreshness?.status !== "current" || !reviewConfirmed || editedSections.length === 0 || [...new Set(editedSections.map(item => item.source_ref))].some(ref => !reviewedSourceRefs.includes(ref)) || selectedRecipients.length === 0 || selectedScope.length === 0 || !summaryText.trim()} onClick={() => void shareReviewedFamilyHandoff()}>
            <Share2 size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />{busy ? "Sharing…" : "Share with selected caregivers"}
          </button>
        </section>
      )}

      <section style={{ ...panel, marginTop: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Inbox size={17} /><strong>Shared with you and shared by you</strong></div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" style={quietButton} onClick={() => void load()} disabled={loading || busy}><RefreshCw size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />Refresh</button>
            <button type="button" style={quietButton} onClick={() => setShowHistory(value => !value)}>{showHistory ? "Hide sharing history" : "View sharing history"}</button>
          </div>
        </div>
        {error && <p role="alert" style={{ color: "#8d2d2d", fontSize: "calc(12px * var(--solenos-text-scale, 1))", lineHeight: 1.5 }}>{error}</p>}
        {notice && <p role="status" style={{ color: "#356441", fontSize: "calc(12px * var(--solenos-text-scale, 1))", lineHeight: 1.5 }}>{notice}</p>}
        {showHistory && (
          <div style={{ marginTop: 12 }}>
            {consentRequired && <p role="status">Summaries shared with you or by you are hidden until you save the required privacy and shared-care choices. <Link href="/workspace/settings" style={{ textDecoration: "underline" }}>Review Settings → Privacy</Link>.</p>}
            {historyError && (inbox.length > 0 || outbox.length > 0) && <RecordState kind="error" title="Some sharing history could not be loaded" description="Previously loaded sharing records are still shown. Refresh to check for updates." onAction={() => void load()} />}
            {loading && inbox.length === 0 && outbox.length === 0 ? <RecordState kind="loading" title="Loading sharing history" /> : historyError && inbox.length === 0 && outbox.length === 0 ? <RecordState kind="error" title="Sharing history could not be loaded" description="Please refresh to try again." onAction={() => void load()} /> : !consentRequired && !historyError && !loading && inbox.length === 0 && outbox.length === 0 ? <RecordState kind="first-empty" title="No handoffs recorded yet" description="Summaries shared with you or by you will appear here." /> : null}
            <h5 style={{ margin: "12px 0 6px" }}>Shared with you</h5>
            {inbox.map(item => (
              <article key={item.id} style={{ borderTop: "1px solid #e5ebe4", padding: "10px 0" }}>
                <strong>{item.from_caregiver_name || "Linked caregiver"}</strong>
                <p style={{ margin: "4px 0", fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>Status: {readableStatus(item.status)} · Expires: {formatDate(item.expires_at)}</p>
                <p style={{ margin: "4px 0 8px", fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>Information shared: {item.scope.map(readableScope).join(", ")} · {item.has_summary ? "Summary attached" : "No summary attached"}</p>
                <button type="button" style={button} disabled={busy || !item.has_summary} onClick={() => void reviewIncoming(item)}>Open shared summary</button>
              </article>
            ))}
            {activeInbox && activeSnapshot && (
              <article style={{ ...panel, margin: "12px 0" }}>
                <h5 style={{ marginTop: 0 }}>Open shared summary</h5>
                <p style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))", lineHeight: 1.5 }}>From {activeInbox.from_caregiver_name || "a linked caregiver"}. Another caregiver shared this summary. A healthcare professional has not confirmed every detail.</p>
                {Object.entries(activeSnapshot.sections ?? {}).map(([name, value]) => (
                  <div key={name} style={{ marginBottom: 10 }}>
                    <strong style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>{readableSection(name)}</strong>
                    <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", font: "inherit", fontSize: "calc(12px * var(--solenos-text-scale, 1))", lineHeight: 1.5 }}>{caregiverSafeGeneratedText(String(value ?? "")) ?? "Some details are not available in this summary."}</pre>
                  </div>
                ))}
                
                {activeSnapshot.purpose && <p style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>Purpose: {handoffPurposeLabel(activeSnapshot.purpose)} · Shared with: {activeSnapshot.audience === "family" ? "Family caregiver" : activeSnapshot.audience === "professional" ? "Healthcare professional" : "Not recorded"} · Period covered: {activeSnapshot.window?.days ?? "Not recorded"} days</p>}
                {activeSnapshot.retrieval_complete === false && <section role="status" style={{ margin: "10px 0", padding: 10, border: "1px solid #d8c9a5", borderRadius: 8, background: "#fbf8ef" }}>
                  <strong style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>Some care history is missing from this summary</strong>
                  <p style={{ fontSize: "calc(11px * var(--solenos-text-scale, 1))", margin: "5px 0" }}>This summary does not include everything in your Care Record. Check the full Care Record before relying on it.</p>
                  {(activeSnapshot.partial_sources ?? []).map(item => <p key={item.source} style={{ fontSize: "calc(11px * var(--solenos-text-scale, 1))", margin: "3px 0" }}>{readableSection(item.source)}: at least {item.returned_count} saved details were included; more may be available.</p>)}
                </section>}
                {activeSnapshot.source_coverage && <section style={{ margin: "10px 0" }}><strong style={{ fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>What is included and what is missing</strong>{Object.entries(activeSnapshot.source_coverage).map(([key, value]) => <p key={key} style={{ fontSize: "calc(11px * var(--solenos-text-scale, 1))", margin: "4px 0" }}>{caregiverSafeGeneratedText(value.label) || readableSection(key)}: {readableStatus(value.status)}{caregiverSafeGeneratedText(value.reason) ? " — " + caregiverSafeGeneratedText(value.reason) : ""} · {value.count} {value.count === 1 ? "saved detail" : "saved details"}</p>)}</section>}
                {activeSnapshot.limitations?.map((item, index) => <p key={item.source + index} style={{ fontSize: "calc(11px * var(--solenos-text-scale, 1))", color: "#667267" }}>Not included — {readableSection(item.source)}: {readableStatus(item.status)}{caregiverSafeGeneratedText(item.reason) ? " (" + caregiverSafeGeneratedText(item.reason) + ")" : ""}</p>)}
                {activeSnapshot.source_references?.map((item, index) => <p key={item.source_ref + index} style={{ fontSize: "calc(10px * var(--solenos-text-scale, 1))", overflowWrap: "anywhere" }}>Care detail {index + 1} · {readableStatus(item.epistemic_status)} · {readableStatus(item.record_status)} · happened {formatDate(item.event_at)} · saved {formatDate(item.recorded_at)}{item.stale_warning ? " · older information — check before relying on it" : ""}{item.original_source_reference ? " · document source" : ""}{Array.isArray(item.page_references) && item.page_references.length ? " · pages " + item.page_references.map(value => String(value)).join(", ") : ""}</p>)}
                <p style={{ fontSize: "calc(11px * var(--solenos-text-scale, 1))" }}>Care Record check: This information is for this person. It does not confirm that every detail is accurate.</p>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: "calc(12px * var(--solenos-text-scale, 1))", lineHeight: 1.5, margin: "10px 0" }}>
                  <input type="checkbox" checked={incomingReviewConfirmed} onChange={event => setIncomingReviewConfirmed(event.target.checked)} />
                  <span>I have checked this summary. That does not mean a healthcare professional confirmed every detail or that every follow-up is complete.</span>
                </label>
                <button type="button" style={button} disabled={busy || !incomingReviewConfirmed} onClick={() => void acceptIncoming()}><CheckCircle2 size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />Confirm you received this summary</button>
                <button type="button" style={quietButton} onClick={() => { setActiveInbox(null); setActiveSnapshot(null); setIncomingReviewConfirmed(false); }}>Close review</button>
              </article>
            )}
            <h5 style={{ margin: "14px 0 6px" }}>Shared by you</h5>
            {outbox.map(item => (
              <article key={item.id} style={{ borderTop: "1px solid #e5ebe4", padding: "10px 0" }}>
                <strong>{item.recipients?.map(recipient => recipient.name || "Caregiver").join(", ") || "Care summary"}</strong>
                <p style={{ margin: "4px 0", fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>Status: {readableStatus(item.status)}{item.is_expired ? " · Expired" : ""} · Expires: {formatDate(item.expires_at)}</p>
                <p style={{ margin: "4px 0 8px", fontSize: "calc(12px * var(--solenos-text-scale, 1))" }}>Information shared: {item.scope.map(readableScope).join(", ")} · {item.has_summary ? "Summary attached" : "No summary attached"}</p>
                {item.recipients?.map(recipient => <p key={recipient.caregiver_id} style={{ margin: "3px 0", fontSize: "calc(11px * var(--solenos-text-scale, 1))", color: "#667267" }}>{recipient.name || "Recipient"}: {recipient.status ? readableStatus(recipient.status) : "We couldn't confirm whether they received it."}</p>)}
                {item.status !== "revoked" && !item.is_expired && <button type="button" style={quietButton} disabled={busy} onClick={() => void revoke(item)}>Remove access</button>}
              </article>
            ))}
          </div>
        )}
        <p style={{ marginBottom: 0, fontSize: "calc(11px * var(--solenos-text-scale, 1))", color: "#667267", lineHeight: 1.5 }}><Clock3 size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />Sharing does not mean the recipient has opened the summary. You will see separately when they confirm receipt. Stopping sharing prevents future access, but cannot take back information already seen or saved.</p>
      </section>
    </div>
  );
}
