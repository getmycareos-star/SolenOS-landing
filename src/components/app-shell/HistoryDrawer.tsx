"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  FileText,
  Handshake,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  X,
} from "lucide-react";
import { ensureAnonymousSession, getBlob, getJSON } from "@/api/client";

type HistorySourceKind = "care-event" | "document" | "appointment" | "handoff-in" | "handoff-out" | "lcr-revision" | "decision" | "outcome";
type HistoryCategory =
  | "daily-care"
  | "document"
  | "appointment"
  | "handoff"
  | "decision"
  | "outcome"
  | "follow-up"
  | "lcr-update"
  | "other";
type FilterKey = "all" | "pinned" | "archived" | HistoryCategory;
type RecordActionState = Record<string, { pinned?: boolean; archived?: boolean; followUp?: boolean }>;

type DetailField = { label: string; value: string };

type HistoryRecord = {
  id: string;
  person_id?: string;
  event_type: string;
  status: string;
  occurred_at?: string | null;
  occurred_at_timezone?: string | null;
  recorded_at?: string | null;
  updated_at?: string | null;
  title: string;
  description?: string | null;
  evidence_ids?: string[] | null;
  time_provenance?: string | null;
  tags?: string[] | null;
  created_by_caregiver_id?: string | null;
  significance_verdict?: string | null;
  attention_candidate?: boolean | null;
  follow_up_candidate?: boolean | null;
  source_kind: HistorySourceKind;
  source_details?: DetailField[];
  evidence_id?: string;
  original_filename?: string;
  mime_type?: string;
  display_date?: string | null;
  display_date_label?: string;
};

type CareEvent = Omit<HistoryRecord, "source_kind"> & {
  person_id: string;
  event_type: string;
  title: string;
};

type EvidenceRecord = {
  id: string;
  type?: string;
  source_text?: string | null;
  source_type?: string | null;
  evidence_status?: string | null;
  uploaded_at?: string | null;
  created_at?: string | null;
  extra_metadata?: string | Record<string, unknown> | null;
};

type AppointmentListItem = {
  id: string;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type AppointmentDetail = {
  id: string;
  version_number?: number;
  status?: string;
  created_at?: string | null;
  updated_at?: string | null;
  payload?: Record<string, unknown> | null;
};

type HandoffInboxItem = {
  id: string;
  from_caregiver_name?: string | null;
  from_caregiver_relationship?: string | null;
  scope?: string[];
  status?: string;
  created_at?: string | null;
  expires_at?: string | null;
  has_summary?: boolean;
};

type HandoffOutboxItem = {
  id: string;
  status?: string;
  scope?: string[];
  created_at?: string | null;
  expires_at?: string | null;
  has_summary?: boolean;
  is_expired?: boolean;
  recipients?: Array<{ caregiver_id: string; name?: string; status?: string }>;
};

type CareStateRevision = {
  id: string;
  target_type?: string;
  target_id?: string;
  revision_number?: number;
  change_kind?: string;
  before_state?: string | Record<string, unknown> | null;
  after_state?: string | Record<string, unknown> | null;
  evidence_ids?: string[] | null;
  changed_by_caregiver_id?: string | null;
  changed_at?: string | null;
};

type CareDecision = {
  id: string;
  title?: string | null;
  decision_text?: string | null;
  decision_status?: string | null;
  decided_at?: string | null;
  created_at?: string | null;
  created_by_caregiver_id?: string | null;
  evidence_ids?: string[] | null;
  context?: string | Record<string, unknown> | null;
};

type CareOutcome = {
  id: string;
  action_id?: string | null;
  action_type?: string | null;
  outcome_status?: string | null;
  notes?: string | null;
  correction_text?: string | null;
  evidence_ids?: string[] | null;
  created_by_caregiver_id?: string | null;
  created_at?: string | null;
};

const FILTERS: { id: FilterKey; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pinned", label: "Pinned" },
  { id: "archived", label: "Archived" },
  { id: "daily-care", label: "Daily Care" },
  { id: "document", label: "Documents" },
  { id: "appointment", label: "Appointments" },
  { id: "handoff", label: "Handoffs" },
  { id: "decision", label: "Decisions" },
  { id: "outcome", label: "Outcomes" },
  { id: "follow-up", label: "Follow-ups" },
  { id: "lcr-update", label: "Living Care Record" },
];

function safeDate(value?: string | null): Date | null {
  if (!value) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly ? value + "T12:00:00" : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function recordDate(record: HistoryRecord): Date | null {
  return safeDate(record.display_date) ?? safeDate(record.occurred_at) ?? safeDate(record.recorded_at);
}

function formatDateTime(value?: string | null): string {
  const date = safeDate(value);
  if (!date) return "Time not recorded";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDateOnly(value?: string | null): string {
  const date = safeDate(value);
  if (!date) return "Date not recorded";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(date);
}

function formatRecordDate(record: HistoryRecord): string {
  const value = record.display_date ?? record.occurred_at ?? record.recorded_at;
  if (!value) return "Date not recorded";
  if (record.display_date_label === "Appointment date") return formatDateOnly(value);
  return formatDateTime(value);
}

function formatDay(value?: string | null): string {
  const date = safeDate(value);
  if (!date) return "Date not recorded";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function categoryFor(record: HistoryRecord): HistoryCategory {
  if (record.source_kind === "lcr-revision") return "lcr-update";
  if (record.source_kind === "decision") return "decision";
  if (record.source_kind === "outcome") return "outcome";
  if (record.source_kind === "document") return "document";
  if (record.source_kind === "appointment") return "appointment";
  if (record.source_kind === "handoff-in" || record.source_kind === "handoff-out") return "handoff";

  const value = [
    record.event_type,
    record.title,
    ...(record.tags ?? []),
  ].join(" ").toLowerCase();

  if (/handoff|hand.?over|care transfer/.test(value)) return "handoff";
  if (/appointment|doctor visit|clinic visit|consultation/.test(value)) return "appointment";
  if (/decision|decided|choice/.test(value)) return "decision";
  if (/document|upload|file|discharge|letter|report|scan/.test(value)) return "document";
  if (/outcome|result|completed action/.test(value)) return "outcome";
  if (/observation|daily.?care|daily.?capture|symptom|behavio[u]?r|sleep|meal/.test(value)) return "daily-care";
  if (
    /follow.?up|open.?loop|pending|unresolved|question/.test(value) ||
    record.follow_up_candidate ||
    record.attention_candidate
  ) return "follow-up";
  return "other";
}

function categoryLabel(category: HistoryCategory, eventType?: string): string {
  if (category === "daily-care") return "Daily Care";
  if (category === "document") return "Document";
  if (category === "appointment") return "Appointment";
  if (category === "handoff") return "Handoff";
  if (category === "decision") return "Decision";
  if (category === "outcome") return "Outcome";
  if (category === "follow-up") return "Follow-up";
  if (category === "lcr-update") return "Living Care Record";
  return (eventType || "Care record").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function parseDescription(description?: string | null): string {
  if (!description?.trim()) return "";
  try {
    const parsed: unknown = JSON.parse(description);
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.entries(parsed as Record<string, unknown>)
        .filter(([, value]) => value !== null && value !== undefined && value !== "")
        .map(([key, value]) => {
          const label = key.replaceAll("_", " ");
          return label + ": " + (typeof value === "string" ? value : JSON.stringify(value));
        })
        .join("\n");
    }
  } catch {
    // Preserve original plain text.
  }
  return description;
}

function metadataOf(value: EvidenceRecord["extra_metadata"]): Record<string, unknown> {
  if (value && typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asTextList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function detailFields(fields: DetailField[]): DetailField[] {
  return fields.filter((field) => Boolean(field.value && field.value.trim()));
}

function mapDocument(item: EvidenceRecord): HistoryRecord {
  const metadata = metadataOf(item.extra_metadata);
  const filename = asText(metadata.filename) || "Untitled document";
  const mimeType = asText(metadata.mime_type) || "File type not recorded";
  const uploadedAt = item.uploaded_at || item.created_at || null;
  const status = item.evidence_status || "recorded";

  return {
    id: "document:" + item.id,
    evidence_id: item.id,
    original_filename: filename,
    mime_type: mimeType,
    event_type: "document",
    status,
    occurred_at: null,
    recorded_at: uploadedAt,
    display_date: uploadedAt,
    display_date_label: "Uploaded",
    title: filename,
    description: item.source_text || "",
    evidence_ids: [item.id],
    time_provenance: "Upload time is recorded; the original event time was not supplied by this document listing.",
    tags: ["document"],
    source_kind: "document",
    source_details: detailFields([
      { label: "File name", value: filename },
      { label: "File type", value: mimeType },
      { label: "Evidence status", value: status },
      { label: "Source type", value: item.source_type || "" },
      { label: "Upload time", value: uploadedAt ? formatDateTime(uploadedAt) : "Not recorded" },
      { label: "Evidence ID", value: item.id },
    ]),
  };
}

function appointmentDescription(payload: Record<string, unknown>): string {
  const lines: string[] = [];
  const add = (label: string, value: unknown) => {
    const text = asText(value);
    if (text) lines.push(label + ": " + text);
  };

  add("Visit purpose", payload.visitPurpose);
  add("Clinician", payload.clinician);
  add("Specialty", payload.specialty);
  add("Location", payload.location);
  if (Array.isArray(payload.topConcerns)) {
    const concerns = payload.topConcerns.map(asText).filter(Boolean);
    if (concerns.length) lines.push("Caregiver's priority concerns:\n- " + concerns.join("\n- "));
  }
  add("Changes recorded by caregiver", payload.changes);
  add("Symptoms recorded by caregiver", payload.symptoms);
  add("Caregiver report", payload.caregiverReport);
  add("Clinician statements recorded by caregiver (not independently verified)", payload.clinicianFindings);
  add("Decisions recorded", payload.decisions);
  add("Instructions recorded", payload.instructions);
  add("Unanswered questions", payload.unanswered);
  if (Array.isArray(payload.followUps)) {
    const followUps = payload.followUps
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        const followUp = item as Record<string, unknown>;
        return [asText(followUp.action), asText(followUp.owner), asText(followUp.due), asText(followUp.status)].filter(Boolean).join(" · ");
      })
      .filter(Boolean);
    if (followUps.length) lines.push("Follow-ups:\n- " + followUps.join("\n- "));
  }
  return lines.join("\n\n");
}

function mapAppointment(
  record: AppointmentDetail,
  listItem: AppointmentListItem,
): HistoryRecord {
  const payload = record.payload && typeof record.payload === "object" ? record.payload : {};
  const purpose = asText(payload.visitPurpose);
  const clinician = asText(payload.clinician);
  const specialty = asText(payload.specialty);
  const appointmentDate = asText(payload.visitDate);
  const location = asText(payload.location);
  const status = record.status || listItem.status || asText(payload.reviewStatus) || "not specified";
  const savedAt = record.updated_at || record.created_at || listItem.updated_at || listItem.created_at || null;
  const title = purpose || (clinician ? "Appointment with " + clinician : "Appointment workspace");

  return {
    id: "appointment:" + record.id,
    event_type: "appointment",
    status,
    occurred_at: null,
    recorded_at: savedAt,
    updated_at: record.updated_at || null,
    display_date: appointmentDate || savedAt,
    display_date_label: appointmentDate ? "Appointment date" : "Saved",
    title,
    description: appointmentDescription(payload),
    tags: ["appointment"],
    source_kind: "appointment",
    source_details: detailFields([
      { label: "Appointment date", value: appointmentDate || "Not recorded" },
      { label: "Clinician", value: clinician },
      { label: "Specialty", value: specialty },
      { label: "Location", value: location },
      { label: "Review status", value: asText(payload.reviewStatus) || status },
      { label: "Workspace version", value: typeof record.version_number === "number" ? String(record.version_number) : "Not returned" },
      { label: "Saved in SolenOS", value: savedAt ? formatDateTime(savedAt) : "Not recorded" },
    ]),
  };
}

function parseSnapshot(value: CareStateRevision["before_state"]): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function snapshotText(value: CareStateRevision["before_state"]): string {
  const snapshot = parseSnapshot(value);
  const text = JSON.stringify(snapshot, null, 2);
  return text === "{}" ? "No snapshot was recorded." : text.slice(0, 6000);
}

const REVISION_TYPES_ALREADY_SHOWN_BY_SOURCE = new Set([
  "persons",
  "caregivers",
  "evidence",
  "care_events",
  "appointments",
  "care_decisions",
]);

function shouldShowLcrRevision(item: CareStateRevision): boolean {
  const targetType = asText(item.target_type).toLowerCase();
  return Boolean(targetType) && !REVISION_TYPES_ALREADY_SHOWN_BY_SOURCE.has(targetType);
}

function mapLcrRevision(item: CareStateRevision): HistoryRecord {
  const before = parseSnapshot(item.before_state);
  const after = parseSnapshot(item.after_state);
  const changedFields = [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
  const changeKind = asText(item.change_kind) || "updated";
  const targetType = asText(item.target_type).replaceAll("_", " ") || "care record";
  const changedAt = item.changed_at || null;
  const description = changeKind === "deleted"
    ? "A deletion is recorded for this Living Care Record item. The prior state remains represented in this revision entry."
    : changedFields.length
      ? "Recorded " + changeKind + " revision. Changed fields: " + changedFields.join(", ") + "."
      : "Recorded " + changeKind + " revision for " + targetType + ".";
  return {
    id: "lcr-revision:" + item.id,
    event_type: "lcr_revision",
    status: changeKind,
    occurred_at: null,
    recorded_at: changedAt,
    display_date: changedAt,
    display_date_label: "LCR revision recorded",
    title: "Living Care Record · " + targetType,
    description,
    evidence_ids: item.evidence_ids ?? [],
    time_provenance: "Revision timestamp records when this state change was saved; it does not establish when the underlying care event occurred.",
    tags: ["living care record", "revision", changeKind],
    source_kind: "lcr-revision",
    source_details: detailFields([
      { label: "Target type", value: item.target_type || "Not recorded" },
      { label: "Target ID", value: item.target_id || "Not recorded" },
      { label: "Change kind", value: changeKind },
      { label: "Revision number", value: typeof item.revision_number === "number" ? String(item.revision_number) : "Not returned" },
      { label: "Changed by caregiver ID", value: item.changed_by_caregiver_id || "" },
      { label: "Evidence references", value: item.evidence_ids?.join(", ") || "None attached" },
      { label: "Previous recorded state", value: snapshotText(item.before_state) },
      { label: "Updated recorded state", value: snapshotText(item.after_state) },
    ]),
  };
}

function mapDecision(item: CareDecision): HistoryRecord {
  const createdAt = item.created_at || null;
  const decidedAt = item.decided_at || createdAt;
  const title = asText(item.title) || asText(item.decision_text).slice(0, 120) || "Care decision";
  const context = typeof item.context === "string"
    ? item.context
    : item.context && typeof item.context === "object"
      ? JSON.stringify(item.context, null, 2)
      : "";
  return {
    id: "decision:" + item.id,
    event_type: "decision",
    status: item.decision_status || "not specified",
    occurred_at: item.decided_at || null,
    recorded_at: createdAt,
    display_date: decidedAt,
    display_date_label: item.decided_at ? "Decision date" : "Recorded",
    title,
    description: [asText(item.decision_text), context].filter(Boolean).join("\n\n"),
    evidence_ids: item.evidence_ids ?? [],
    created_by_caregiver_id: item.created_by_caregiver_id || null,
    tags: ["decision"],
    source_kind: "decision",
    source_details: detailFields([
      { label: "Decision status", value: item.decision_status || "Not specified" },
      { label: "Decided at", value: item.decided_at ? formatDateTime(item.decided_at) : "Not recorded" },
      { label: "Recorded at", value: createdAt ? formatDateTime(createdAt) : "Not recorded" },
      { label: "Recorded by caregiver ID", value: item.created_by_caregiver_id || "" },
      { label: "Evidence references", value: item.evidence_ids?.join(", ") || "None attached" },
    ]),
  };
}

function mapOutcome(item: CareOutcome): HistoryRecord {
  const createdAt = item.created_at || null;
  const actionType = asText(item.action_type).replaceAll("_", " ") || "care action";
  const status = item.outcome_status || "not specified";
  const description = [asText(item.notes), asText(item.correction_text) ? "Correction recorded: " + asText(item.correction_text) : ""]
    .filter(Boolean).join("\n\n");
  return {
    id: "outcome:" + item.id,
    event_type: "outcome",
    status,
    occurred_at: createdAt,
    recorded_at: createdAt,
    display_date: createdAt,
    display_date_label: "Outcome recorded",
    title: "Outcome · " + actionType,
    description: description || "Outcome status recorded: " + status + ".",
    evidence_ids: item.evidence_ids ?? [],
    created_by_caregiver_id: item.created_by_caregiver_id || null,
    tags: ["outcome", actionType],
    source_kind: "outcome",
    source_details: detailFields([
      { label: "Action type", value: item.action_type || "Not recorded" },
      { label: "Action ID", value: item.action_id || "Not recorded" },
      { label: "Outcome status", value: status },
      { label: "Recorded at", value: createdAt ? formatDateTime(createdAt) : "Not recorded" },
      { label: "Recorded by caregiver ID", value: item.created_by_caregiver_id || "" },
      { label: "Evidence references", value: item.evidence_ids?.join(", ") || "None attached" },
    ]),
  };
}

function mapIncomingHandoff(item: HandoffInboxItem): HistoryRecord {
  const sender = asText(item.from_caregiver_name) || "Linked caregiver";
  const createdAt = item.created_at || null;
  return {
    id: "handoff-in:" + item.id,
    event_type: "handoff",
    status: item.status || "not specified",
    occurred_at: createdAt,
    recorded_at: createdAt,
    display_date: createdAt,
    display_date_label: "Received",
    title: "Handoff from " + sender,
    description: item.has_summary
      ? "A caregiver-provided summary is available for review. Its contents are not independently verified by the handoff record."
      : "The incoming handoff record does not report an attached summary.",
    tags: ["handoff", "incoming"],
    source_kind: "handoff-in",
    source_details: detailFields([
      { label: "Direction", value: "Incoming" },
      { label: "From", value: sender },
      { label: "Relationship", value: asText(item.from_caregiver_relationship) },
      { label: "Scope", value: item.scope?.join(", ") || "" },
      { label: "Status", value: item.status || "Not specified" },
      { label: "Received", value: createdAt ? formatDateTime(createdAt) : "Not recorded" },
      { label: "Access expires", value: item.expires_at ? formatDateTime(item.expires_at) : "Not recorded" },
      { label: "Summary attached", value: item.has_summary ? "Yes" : "No" },
    ]),
  };
}

function mapOutgoingHandoff(item: HandoffOutboxItem): HistoryRecord {
  const recipients = (item.recipients ?? []).map((recipient) => asText(recipient.name)).filter(Boolean);
  const createdAt = item.created_at || null;
  const recipientLabel = recipients.length ? " to " + recipients.join(", ") : "";
  return {
    id: "handoff-out:" + item.id,
    event_type: "handoff",
    status: item.status || "not specified",
    occurred_at: createdAt,
    recorded_at: createdAt,
    display_date: createdAt,
    display_date_label: "Shared",
    title: "Outgoing care handoff" + recipientLabel,
    description: item.has_summary
      ? "A caregiver-reviewed summary was attached to this handoff. Sharing did not change the Living Care Record."
      : "The outgoing handoff record does not report an attached summary.",
    tags: ["handoff", "outgoing"],
    source_kind: "handoff-out",
    source_details: detailFields([
      { label: "Direction", value: "Outgoing" },
      { label: "Recipients", value: recipients.join(", ") },
      { label: "Scope", value: item.scope?.join(", ") || "" },
      { label: "Status", value: item.status || "Not specified" },
      { label: "Shared", value: createdAt ? formatDateTime(createdAt) : "Not recorded" },
      { label: "Access expires", value: item.expires_at ? formatDateTime(item.expires_at) : "Not recorded" },
      { label: "Summary attached", value: item.has_summary ? "Yes" : "No" },
      { label: "Expiry state", value: item.is_expired ? "Expired" : "" },
    ]),
  };
}

function recordText(record: HistoryRecord, compact = false): string {
  const content = parseDescription(record.description);
  const safeContent = compact && content.length > 4000
    ? content.slice(0, 4000) + "\n[Content shortened for sharing. Open the original record for the full text.]"
    : content;
  const lines = [
    record.title,
    categoryLabel(categoryFor(record), record.event_type),
    "",
    record.source_kind === "care-event" ? "Original care event:" :
      record.source_kind === "document" ? "Document record and extracted text:" :
      record.source_kind === "appointment" ? "Saved appointment workspace:" :
      record.source_kind === "lcr-revision" ? "Living Care Record revision:" :
      record.source_kind === "decision" ? "Recorded care decision:" :
      record.source_kind === "outcome" ? "Recorded outcome:" : "Handoff record:",
    safeContent || "No additional text was saved with this record.",
    "",
    "Event time: " + formatDateTime(record.occurred_at),
    "Recorded in SolenOS: " + formatDateTime(record.recorded_at),
    "Status: " + (record.status || "Not specified"),
    "Time provenance: " + (record.time_provenance || "Not recorded"),
    "Evidence references: " + (record.evidence_ids?.length ? record.evidence_ids.join(", ") : "None attached"),
    ...(record.source_details ?? []).map((field) => field.label + ": " + field.value),
  ];
  return lines.join("\n");
}

function eventMatchesFilter(record: HistoryRecord, filter: FilterKey): boolean {
  if (filter === "all") return true;
  const category = categoryFor(record);
  if (filter === "follow-up") {
    return category === "follow-up" || Boolean(record.follow_up_candidate) || Boolean(record.attention_candidate);
  }
  return category === filter;
}

function CategoryIcon({ category }: { category: HistoryCategory }) {
  if (category === "document") return <FileText size={17} aria-hidden />;
  if (category === "appointment") return <CalendarDays size={17} aria-hidden />;
  if (category === "handoff") return <Handshake size={17} aria-hidden />;
  if (category === "decision" || category === "outcome") return <CheckCircle2 size={17} aria-hidden />;
  if (category === "follow-up") return <Clock3 size={17} aria-hidden />;
  return <Activity size={17} aria-hidden />;
}

export function HistoryDrawer() {
  const router = useRouter();
  const open = true;
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceWarnings, setSourceWarnings] = useState<string[]>([]);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const [recordActions, setRecordActions] = useState<RecordActionState>({});\n  const [recordActionsLoaded, setRecordActionsLoaded] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState<string | null>(null);

  const RECORD_ACTIONS_KEY = "solenos_history_record_actions_v1";
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RECORD_ACTIONS_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) setRecordActions(parsed as RecordActionState);
      }
    } catch {
      setActionMessage("Saved history preferences could not be read in this browser.");
    } finally {
      setRecordActionsLoaded(true);
    }
  }, []);
  useEffect(() => {
    if (!recordActionsLoaded) return;
    try {
      window.localStorage.setItem(RECORD_ACTIONS_KEY, JSON.stringify(recordActions));
    } catch {
      setActionMessage("History preferences could not be saved in this browser.");
    }
  }, [recordActions, recordActionsLoaded]);

  const updateRecordAction = (record: HistoryRecord, key: "pinned" | "archived" | "followUp", value: boolean) => {
    setRecordActions(current => ({
      ...current,
      [record.id]: { ...current[record.id], [key]: value },
    }));
    setMenuId(null);
    setConfirmArchive(null);
    const labels = { pinned: value ? "Added to pinned history." : "Removed from pinned history.", archived: value ? "Archived in this browser’s history." : "Restored to active history.", followUp: value ? "Marked for follow-up." : "Follow-up flag removed." };
    setActionMessage(labels[key]);
  };

  const loadHistory = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError(null);
    setSourceWarnings([]);

    try {
      const session = await ensureAnonymousSession();
      if (!session.person?.id || !session.access_token) {
        throw new Error("A valid SolenOS care session is required to load this history.");
      }

      const personPath = encodeURIComponent(session.person.id);
      const results = await Promise.allSettled([
        getJSON("/events/" + personPath),
        getJSON("/evidence/" + personPath),
        getJSON("/appointment-workspaces"),
        getJSON("/handoffs/inbox"),
        getJSON("/handoffs/outbox"),
        getJSON("/care-continuity/revisions/" + personPath),
        getJSON("/care-continuity/decisions?limit=100"),
        getJSON("/care-continuity/outcomes/" + personPath),
      ]);

      const nextRecords: HistoryRecord[] = [];
      const warnings: string[] = [];
      let availableSources = 0;

      const eventResult = results[0];
      if (eventResult.status === "fulfilled" && Array.isArray(eventResult.value)) {
        availableSources += 1;
        const validEvents = (eventResult.value as CareEvent[]).filter((item) =>
          Boolean(item && typeof item.id === "string" && typeof item.person_id === "string" &&
            typeof item.event_type === "string" && typeof item.title === "string")
        );
        nextRecords.push(...validEvents.map((event) => ({ ...event, source_kind: "care-event" as const })));
      } else {
        warnings.push("Daily care and care-event history could not be loaded.");
      }

      const evidenceResult = results[1];
      if (evidenceResult.status === "fulfilled" && Array.isArray(evidenceResult.value)) {
        availableSources += 1;
        const evidence = (evidenceResult.value as EvidenceRecord[]).filter(
          (item) => item && item.type === "document" && typeof item.id === "string"
        );
        nextRecords.push(...evidence.map(mapDocument));
      } else {
        warnings.push("Saved documents could not be loaded.");
      }

      const appointmentResult = results[2];
      if (
        appointmentResult.status === "fulfilled" &&
        appointmentResult.value &&
        typeof appointmentResult.value === "object" &&
        Array.isArray((appointmentResult.value as { items?: unknown }).items)
      ) {
        availableSources += 1;
        const items = (appointmentResult.value as { items: AppointmentListItem[] }).items
          .filter((item) => item && typeof item.id === "string");
        const appointmentDetails = await Promise.allSettled(
          items.map((item) => getJSON("/appointment-workspaces/" + encodeURIComponent(item.id)) as Promise<AppointmentDetail>)
        );
        appointmentDetails.forEach((detail, index) => {
          if (detail.status === "fulfilled" && detail.value && typeof detail.value.id === "string") {
            nextRecords.push(mapAppointment(detail.value, items[index]));
          } else {
            warnings.push("One or more appointment details could not be opened.");
          }
        });
      } else {
        warnings.push("Appointment history could not be loaded.");
      }

      const inboxResult = results[3];
      if (
        inboxResult.status === "fulfilled" &&
        inboxResult.value &&
        typeof inboxResult.value === "object" &&
        Array.isArray((inboxResult.value as { items?: unknown }).items)
      ) {
        availableSources += 1;
        const inbox = (inboxResult.value as { items: HandoffInboxItem[] }).items
          .filter((item) => item && typeof item.id === "string");
        nextRecords.push(...inbox.map(mapIncomingHandoff));
      } else {
        warnings.push("Incoming handoff history could not be loaded.");
      }

      const outboxResult = results[4];
      if (
        outboxResult.status === "fulfilled" &&
        outboxResult.value &&
        typeof outboxResult.value === "object" &&
        Array.isArray((outboxResult.value as { items?: unknown }).items)
      ) {
        availableSources += 1;
        const outbox = (outboxResult.value as { items: HandoffOutboxItem[] }).items
          .filter((item) => item && typeof item.id === "string");
        nextRecords.push(...outbox.map(mapOutgoingHandoff));
      } else {
        warnings.push("Outgoing handoff history could not be loaded.");
      }

      const revisionResult = results[5];
      if (revisionResult.status === "fulfilled" && Array.isArray(revisionResult.value)) {
        availableSources += 1;
        const revisions = (revisionResult.value as CareStateRevision[]).filter((item) => item && typeof item.id === "string" && shouldShowLcrRevision(item));
        nextRecords.push(...revisions.map(mapLcrRevision));
      } else {
        warnings.push("Living Care Record revision history could not be loaded.");
      }

      const decisionResult = results[6];
      if (decisionResult.status === "fulfilled" && Array.isArray(decisionResult.value)) {
        availableSources += 1;
        const decisions = (decisionResult.value as CareDecision[]).filter((item) => item && typeof item.id === "string");
        nextRecords.push(...decisions.map(mapDecision));
      } else {
        warnings.push("Recorded care decisions could not be loaded.");
      }

      const outcomeResult = results[7];
      if (outcomeResult.status === "fulfilled" && Array.isArray(outcomeResult.value)) {
        availableSources += 1;
        const outcomes = (outcomeResult.value as CareOutcome[]).filter((item) => item && typeof item.id === "string");
        nextRecords.push(...outcomes.map(mapOutcome));
      } else {
        warnings.push("Recorded decision and action outcomes could not be loaded.");
      }

      if (availableSources === 0) {
        throw new Error("None of the available care-history sources could be loaded. Check the connection and try again.");
      }

      nextRecords.sort((a, b) => {
        const aTime = recordDate(a)?.getTime() ?? Number.NEGATIVE_INFINITY;
        const bTime = recordDate(b)?.getTime() ?? Number.NEGATIVE_INFINITY;
        if (aTime !== bTime) return bTime - aTime;
        return (safeDate(b.recorded_at)?.getTime() ?? 0) - (safeDate(a.recorded_at)?.getTime() ?? 0);
      });

      setRecords(nextRecords);
      setSourceWarnings(warnings);
      setLoadedAt(new Date().toISOString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Care history could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setHasLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (open && !hasLoaded && !loading) void loadHistory();
  }, [open, hasLoaded, loading, loadHistory]);



  const visibleRecords = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return records.filter((record) => {
      const actions = recordActions[record.id];
      if (filter === "archived" ? !actions?.archived : actions?.archived) return false;
      if (filter === "pinned" && !actions?.pinned) return false;
      if (filter !== "pinned" && filter !== "archived" && !eventMatchesFilter(record, filter)) return false;
      if (!needle) return true;
      const haystack = [
        record.title,
        record.event_type,
        record.description ?? "",
        record.status,
        record.occurred_at ?? "",
        record.recorded_at ?? "",
        record.time_provenance ?? "",
        record.created_by_caregiver_id ?? "",
        ...(record.tags ?? []),
        ...(record.evidence_ids ?? []),
        ...(record.source_details ?? []).flatMap((field) => [field.label, field.value]),
      ].join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  }, [records, filter, query, recordActions]);

  const groupedRecords = useMemo(() => {
    const groups: { label: string; records: HistoryRecord[] }[] = [];
    for (const record of visibleRecords) {
      const label = formatDay(record.display_date || record.occurred_at || record.recorded_at);
      const last = groups[groups.length - 1];
      if (last?.label === label) last.records.push(record);
      else groups.push({ label, records: [record] });
    }
    return groups;
  }, [visibleRecords]);

  const selectedRecord = records.find((record) => record.id === selectedId) ?? null;

  const closeDrawer = () => {
    setSelectedId(null);
    setMenuId(null);
  };

  const copyRecord = async (record: HistoryRecord) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard access is unavailable.");
      await navigator.clipboard.writeText(recordText(record));
      setActionMessage("Record details copied.");
    } catch {
      setActionMessage("Copy is unavailable in this browser. Try Download record instead.");
    }
    setMenuId(null);
  };

  const downloadRecord = async (record: HistoryRecord) => {
    if (record.source_kind === "document" && record.evidence_id) {
      try {
        const blob = await getBlob("/upload/" + encodeURIComponent(record.evidence_id));
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = record.original_filename || "care-document";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        setActionMessage("Original document download started.");
      } catch {
        setActionMessage("The original document could not be retrieved. Its saved evidence record remains in history.");
      }
      setMenuId(null);
      return;
    }

    const blob = new Blob([recordText(record)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = (record.title || "care-record").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() + ".txt";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setActionMessage("Record download started.");
    setMenuId(null);
  };

  const shareRecord = async (record: HistoryRecord) => {
    const text = recordText(record, true);
    try {
      if (navigator.share) {
        await navigator.share({ title: record.title, text });
        setActionMessage("Share sheet opened.");
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setActionMessage("Sharing is unavailable here; record details copied instead.");
      } else {
        setActionMessage("Sharing is unavailable in this browser. Try Download record instead.");
      }
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) {
        setActionMessage("The record could not be shared from this browser.");
      }
    }
    setMenuId(null);
  };

  const selectedDescriptionHeading = selectedRecord?.source_kind === "document"
    ? "Extracted text"
    : selectedRecord?.source_kind === "appointment"
      ? "Saved appointment information"
      : selectedRecord?.source_kind === "lcr-revision"
        ? "Recorded LCR change"
        : selectedRecord?.source_kind === "decision"
          ? "Decision recorded"
          : selectedRecord?.source_kind === "outcome"
            ? "Outcome recorded"
            : selectedRecord?.source_kind === "handoff-in" || selectedRecord?.source_kind === "handoff-out"
              ? "Handoff information"
              : "Original record";

  return (
    <>
      <aside
            id="solenos-history-drawer"
            className={`history-drawer${selectedRecord ? " is-detail" : ""}`}
            aria-label="Care history"
          >
            <header className="history-drawer-header">
              <div className="history-drawer-title-row">
                {selectedRecord ? (
                  <button
                    type="button"
                    className="history-icon-button"
                    aria-label="Back to care history"
                    onClick={() => setSelectedId(null)}
                  >
                    <ArrowLeft size={19} aria-hidden />
                  </button>
                ) : (
                  <span className="history-drawer-mark"><ShieldCheck size={19} aria-hidden /></span>
                )}
                <div className="history-drawer-heading">
                  <strong>{selectedRecord ? "Care record" : "Care history"}</strong>
                  <span>{selectedRecord ? "Saved source information and record details" : "A chronological view across your saved care records"}</span>
                </div>

              </div>
              {!selectedRecord && (
                <button
                  type="button"
                  className="history-new-entry"
                  onClick={() => {
                    closeDrawer();
                    router.push("/workspace?compose=1");
                  }}
                >
                  <Plus size={17} aria-hidden />
                  New care entry
                </button>
              )}
            </header>

            {selectedRecord ? (
              <div className="history-detail-scroll">
                <div className="history-detail-category">
                  <span className="history-category-icon"><CategoryIcon category={categoryFor(selectedRecord)} /></span>
                  {categoryLabel(categoryFor(selectedRecord), selectedRecord.event_type)}
                </div>
                <h2 className="history-detail-title">{selectedRecord.title}</h2>
                <p className="history-detail-date">
                  {selectedRecord.display_date_label ? selectedRecord.display_date_label + " · " : ""}
                  {formatRecordDate(selectedRecord)}
                </p>

                <section className="history-detail-section">
                  <h3>{selectedDescriptionHeading}</h3>
                  <p className="history-original-text">{parseDescription(selectedRecord.description) || (
                    selectedRecord.source_kind === "document"
                      ? "No extracted text was saved. The original file can still be retrieved."
                      : "No additional text was saved with this record."
                  )}</p>
                  {selectedRecord.source_kind === "document" && (
                    <p className="history-detail-hint">Extracted text can be incomplete or incorrect. It is not a substitute for the original document.</p>
                  )}
                  {selectedRecord.source_kind === "handoff-in" && (
                    <p className="history-detail-hint">The handoff summary is caregiver-provided information. Its presence does not independently verify the statements it contains.</p>
                  )}
                  {selectedRecord.source_kind === "appointment" && (
                    <p className="history-detail-hint">Caregiver reports and caregiver-recorded clinician statements remain distinct. Saving this workspace does not reconcile its contents into LCR facts.</p>
                  )}
                </section>

                <section className="history-detail-section">
                  <h3>Record details</h3>
                  <dl className="history-detail-list">
                    {selectedRecord.source_kind === "care-event" ? (
                      <>
                        <dt>Event time</dt><dd>{formatDateTime(selectedRecord.occurred_at)}{selectedRecord.occurred_at_timezone ? " (" + selectedRecord.occurred_at_timezone + ")" : ""}</dd>
                        <dt>Recorded in SolenOS</dt><dd>{formatDateTime(selectedRecord.recorded_at)}</dd>
                        <dt>Record status</dt><dd>{selectedRecord.status || "Not specified"}</dd>
                        <dt>Source attribution</dt><dd>{selectedRecord.created_by_caregiver_id ? "Caregiver attribution recorded" : "Not recorded"}</dd>
                        <dt>Time provenance</dt><dd>{selectedRecord.time_provenance || "Not recorded"}</dd>
                        <dt>Evidence references</dt><dd>{selectedRecord.evidence_ids?.length ? selectedRecord.evidence_ids.join(", ") : "No evidence references attached"}</dd>
                        <dt>Tags</dt><dd>{selectedRecord.tags?.length ? selectedRecord.tags.join(", ") : "No tags recorded"}</dd>
                        <dt>Last updated</dt><dd>{formatDateTime(selectedRecord.updated_at)}</dd>
                      </>
                    ) : (
                      <>
                        <dt>Record source</dt><dd>{selectedRecord.source_kind === "document" ? "Saved document evidence" : selectedRecord.source_kind === "appointment" ? "Appointment workspace" : selectedRecord.source_kind === "handoff-in" ? "Incoming handoff" : selectedRecord.source_kind === "handoff-out" ? "Outgoing handoff" : selectedRecord.source_kind === "lcr-revision" ? "Immutable Living Care Record revision" : selectedRecord.source_kind === "decision" ? "Persisted care decision" : "Persisted action outcome"}</dd>
                        <dt>Recorded in SolenOS</dt><dd>{formatDateTime(selectedRecord.recorded_at)}</dd>
                        <dt>Record status</dt><dd>{selectedRecord.status || "Not specified"}</dd>
                        {selectedRecord.evidence_ids?.length ? <><dt>Evidence references</dt><dd>{selectedRecord.evidence_ids.join(", ")}</dd></> : null}
                        {(selectedRecord.source_details ?? []).map((field) => (
                          <ReactDetailField key={field.label} field={field} />
                        ))}
                      </>
                    )}
                  </dl>
                  {selectedRecord.significance_verdict && (
                    <p className="history-detail-significance"><strong>Recorded significance:</strong> {selectedRecord.significance_verdict}</p>
                  )}
                </section>

                <section className="history-integrity-note">
                  <ShieldCheck size={16} aria-hidden />
                  <span>Original information is shown separately from recorded metadata. A missing field is not treated as proof that something did not happen. Related events are not assumed to share a cause.</span>
                </section>

                <div className="history-detail-actions">
                  <button type="button" onClick={() => void shareRecord(selectedRecord)}><Share2 size={16} aria-hidden />Share details</button>
                  <button type="button" onClick={() => void copyRecord(selectedRecord)}><Copy size={16} aria-hidden />Copy</button>
                  <button type="button" onClick={() => void downloadRecord(selectedRecord)}><Download size={16} aria-hidden />{selectedRecord.source_kind === "document" ? "Download original" : "Download"}</button>
                </div>
              </div>
            ) : (
              <>
                <div className="history-search-wrap">
                  <Search size={17} aria-hidden />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search care history..."
                    aria-label="Search care history"
                    autoFocus
                  />
                  {query && (
                    <button type="button" aria-label="Clear search" onClick={() => setQuery("")}>
                      <X size={15} aria-hidden />
                    </button>
                  )}
                </div>

                <div className="history-filter-row" role="group" aria-label="Filter care history">
                  {FILTERS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={"history-filter-chip" + (filter === item.id ? " is-active" : "")}
                      aria-pressed={filter === item.id}
                      onClick={() => setFilter(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="history-list-scroll">
                  <div className="history-list-summary">
                    <strong>Recent records</strong>
                    <span>{loading ? "Loading…" : visibleRecords.length + (visibleRecords.length === 1 ? " record" : " records")}</span>
                    <button
                      type="button"
                      className="history-icon-button"
                      aria-label="Refresh care history"
                      disabled={loading || refreshing}
                      onClick={() => void loadHistory(true)}
                    >
                      <RefreshCw size={16} aria-hidden className={refreshing ? "history-spinning" : undefined} />
                    </button>
                  </div>

                  {sourceWarnings.length > 0 && !loading && (
                    <div className="history-source-warning" role="status">
                      <strong>Some history sources are unavailable</strong>
                      <ul>{sourceWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
                      <span>Records from available sources are still shown. An unavailable source is not treated as an empty history.</span>
                    </div>
                  )}

                  {loading ? (
                    <div className="history-state" role="status">
                      <span className="history-loading-dot" />
                      Loading saved care history…
                    </div>
                  ) : error ? (
                    <div className="history-error" role="alert">
                      <AlertCircle size={19} aria-hidden />
                      <div>
                        <strong>History could not be loaded</strong>
                        <p>{error}</p>
                        <button type="button" onClick={() => void loadHistory(true)} disabled={refreshing}>Try again</button>
                      </div>
                    </div>
                  ) : visibleRecords.length === 0 ? (
                    <div className="history-empty">
                      <HistoryEmptyIcon />
                      <strong>{records.length ? "No matching records" : "Your care history starts with saved records"}</strong>
                      <p>{records.length ? "Try a different search or filter. No records were changed." : "No saved care records were returned from the available sources. SolenOS will not create example history."}</p>
                      {(query || filter !== "all") && (
                        <button type="button" onClick={() => { setQuery(""); setFilter("all"); }}>Clear search and filters</button>
                      )}
                    </div>
                  ) : (
                    <div className="history-groups">
                      {groupedRecords.map((group) => (
                        <section key={group.label} className="history-date-group">
                          <h3>{group.label}</h3>
                          <div className="history-event-list">
                            {group.records.map((record) => {
                              const category = categoryFor(record);
                              const description = parseDescription(record.description);
                              const menuOpen = menuId === record.id;
                              return (
                                <article key={record.id} className="history-event-card">
                                  <button
                                    type="button"
                                    className="history-event-open"
                                    onClick={() => { setSelectedId(record.id); setMenuId(null); }}
                                    aria-label={"Open record: " + record.title}
                                  >
                                    <span className="history-event-topline">
                                      <span className="history-category-icon"><CategoryIcon category={category} /></span>
                                      <span className="history-event-category">{categoryLabel(category, record.event_type)}</span>
                                      <span className="history-event-time">{formatRecordDate(record)}</span>
                                    </span>
                                    <strong>{record.title}</strong>
                                    {description && <span className="history-event-description">{description}</span>}
                                    {(record.follow_up_candidate || record.attention_candidate || recordActions[record.id]?.followUp) && (
                                      <span className="history-event-flag">Flagged for follow-up</span>\n                                    {recordActions[record.id]?.pinned && <span className="history-event-flag">Pinned to Home</span>}
                                    )}
                                  </button>
                                  <div className="history-event-menu-wrap">
                                    <button
                                      type="button"
                                      className="history-icon-button history-event-menu-trigger"
                                      aria-label={"Actions for " + record.title}
                                      aria-haspopup="menu"
                                      aria-expanded={menuOpen}
                                      onClick={() => setMenuId(menuOpen ? null : record.id)}
                                    >
                                      <MoreHorizontal size={19} aria-hidden />
                                    </button>
                                    {menuOpen && (
                                      <div className="history-action-menu" role="menu" aria-label={"Actions for " + record.title}>
                                        <button type="button" role="menuitem" onClick={() => updateRecordAction(record, "pinned", !recordActions[record.id]?.pinned)}><CheckCircle2 size={16} aria-hidden />{recordActions[record.id]?.pinned ? "Remove from Home" : "Add to Home"}</button>
                                        <button type="button" role="menuitem" onClick={() => updateRecordAction(record, "followUp", !recordActions[record.id]?.followUp)}><Clock3 size={16} aria-hidden />{recordActions[record.id]?.followUp ? "Remove follow-up flag" : "Mark for follow-up"}</button>
                                        <button type="button" role="menuitem" onClick={() => void copyRecord(record)}><Copy size={16} aria-hidden />Copy</button>
                                        {record.source_kind === "document" && <button type="button" role="menuitem" onClick={() => void downloadRecord(record)}><Download size={16} aria-hidden />Download original</button>}
                                        <button type="button" role="menuitem" onClick={() => { setMenuId(null); setConfirmArchive(record.id); }}><Archive size={16} aria-hidden />{recordActions[record.id]?.archived ? "Restore" : "Archive"}</button>
                                      </div>
                                    )}
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        </section>
                      ))}
                    </div>
                  )}
                </div>

                <footer className="history-drawer-footer">
                  <ShieldCheck size={15} aria-hidden />
                  <span>History combines saved care events, documents, appointment workspaces, handoffs, Living Care Record revisions, decisions and outcomes where those sources are available. Event time and recording time remain distinct{loadedAt ? " · Updated " + formatDateTime(loadedAt) : ""}. Pin, archive and follow-up preferences are saved in this browser only.</span>
                </footer>
              </>
            )}

            {confirmArchive && (() => {
              const record = records.find(item => item.id === confirmArchive);
              if (!record) return null;
              const restoring = Boolean(recordActions[record.id]?.archived);
              return <div className="history-confirm-backdrop" role="presentation" onClick={() => setConfirmArchive(null)}>
                <section className="history-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="history-archive-title" onClick={event => event.stopPropagation()}>
                  <h3 id="history-archive-title">{restoring ? "Restore this record?" : "Archive this record?"}</h3>
                  <p>{restoring ? "This record will return to active history." : "This hides the item from active history in this browser. Its original saved record and Living Care Record references are not deleted or changed."}</p>
                  <div><button type="button" onClick={() => setConfirmArchive(null)}>Cancel</button><button type="button" onClick={() => updateRecordAction(record, "archived", !restoring)}>{restoring ? "Restore record" : "Archive record"}</button></div>
                </section>
              </div>;
            })()}
            {actionMessage && (
              <div className="history-action-status" role="status">
                <span>{actionMessage}</span>
                <button type="button" aria-label="Dismiss message" onClick={() => setActionMessage(null)}><X size={14} aria-hidden /></button>
              </div>
            )}
      </aside>
    </>
  );
}

function ReactDetailField({ field }: { field: DetailField }) {
  return <><dt>{field.label}</dt><dd>{field.value}</dd></>;
}

function HistoryEmptyIcon() {
  return <span className="history-empty-icon"><Clock3 size={27} aria-hidden /></span>;
}
