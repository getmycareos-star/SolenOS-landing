"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Handshake,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { ensureAnonymousSession, getJSON } from "@/api/client";
import { caregiverFieldLabel, caregiverInformationAreaLabel, caregiverSafeAssistantText, caregiverSafeErrorMessage, caregiverStatusLabel } from "@/lib/caregiver-language";
import { RecordState } from "@/components/ui/RecordState";

type HistorySourceKind = "care-event" | "document" | "appointment" | "handoff-in" | "handoff-out" | "lcr-revision" | "decision" | "outcome" | "follow-up";
type HistoryLoadStatus = "loading" | "complete" | "partial" | "failed" | "empty" | "stale";
type HistoryStatusCategory = "daily-care" | "document" | "appointment" | "handoff" | "decision" | "outcome" | "follow-up";
const HISTORY_STATUS_CATEGORIES: HistoryStatusCategory[] = [
  "daily-care", "document", "appointment", "handoff", "decision", "outcome", "follow-up",
];

function historyLoadStatusLabel(status: HistoryLoadStatus): string {
  switch (status) {
    case "loading": return "Loading";
    case "complete": return "Up to date";
    case "partial": return "Some entries may be missing";
    case "failed": return "Could not load";
    case "empty": return "No entries yet";
    case "stale": return "May be out of date";
  }
}

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
type FilterKey = "all" | HistoryCategory;

type FollowUpHistoryItem = {
  id: string;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  owner_label?: string | null;
  deadline_at?: string | null;
  review_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  evidence?: Array<Record<string, unknown>> | null;
  response_evidence?: Array<Record<string, unknown>> | null;
  action_evidence?: Array<Record<string, unknown>> | null;
  outcome_evidence?: Array<Record<string, unknown>> | null;
};

type DetailField = { label: string; value: string };

async function loadAllHistoryPages<T extends { id: string }>(path: string): Promise<T[]> {
  const pageSize = 100;
  const maximumPages = 100;
  const records: T[] = [];
  const seenIds = new Set<string>();
  for (let page = 0; page < maximumPages; page += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const response = await getJSON(
      `${path}${separator}limit=${pageSize}&offset=${page * pageSize}`,
    );
    if (!Array.isArray(response)) {
      throw new Error("Saved care history returned an incomplete page.");
    }
    const rows = response as T[];
    if (rows.some((row) => !row || typeof row.id !== "string" || !row.id)) {
      throw new Error("Saved care history contained an incomplete record.");
    }
    for (const row of rows) {
      if (seenIds.has(row.id)) {
        throw new Error("Saved care history changed while it was loading. Refresh to try again.");
      }
      seenIds.add(row.id);
      records.push(row);
    }
    if (rows.length < pageSize) return records;
  }
  throw new Error("Saved care history exceeded the available page limit. The list was not presented as complete.");
}

async function loadAllFollowUpHistoryPages(): Promise<{ items: FollowUpHistoryItem[]; count: number }> {
  const pageSize = 100;
  const maximumPages = 100;
  const records: FollowUpHistoryItem[] = [];
  const seenIds = new Set<string>();
  let expectedCount: number | null = null;
  for (let page = 0; page < maximumPages; page += 1) {
    const response = await getJSON(`/open-loops?limit=${pageSize}&offset=${page * pageSize}`) as {
      items?: unknown;
      count?: unknown;
    };
    if (!Array.isArray(response.items) || typeof response.count !== "number" ||
      !Number.isInteger(response.count) || response.count < 0) {
      throw new Error("Saved follow-ups returned an incomplete page.");
    }
    if (expectedCount === null) expectedCount = response.count;
    else if (response.count !== expectedCount) {
      throw new Error("Saved follow-up history changed while it was loading. Refresh to try again.");
    }
    const rows = response.items as FollowUpHistoryItem[];
    if (rows.some((row) => !row || typeof row.id !== "string" || !row.id)) {
      throw new Error("Saved follow-ups contained an incomplete record.");
    }
    for (const row of rows) {
      if (seenIds.has(row.id)) {
        throw new Error("Saved follow-ups changed while they were loading. Refresh to try again.");
      }
      seenIds.add(row.id);
      records.push(row);
    }
    if (records.length >= expectedCount) return { items: records, count: expectedCount };
    if (rows.length === 0) {
      throw new Error("Saved follow-up history could not be fully retrieved.");
    }
  }
  throw new Error("Saved follow-up history exceeded the available page limit. The list was not presented as complete.");
}

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
  source_record_ids?: string[] | null;
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

function collapseDuplicateDailyCaptureWrappers(events: CareEvent[]): CareEvent[] {
  const wrapperTypes = new Set(["structured_daily_capture", "daily_care_entry"]);
  const groups = new Map<string, CareEvent[]>();
  const result: CareEvent[] = [];

  for (const event of events) {
    const eventType = event.event_type.trim().toLowerCase();
    const evidenceIds = [...new Set((event.evidence_ids ?? []).filter(Boolean))].sort();
    if (!wrapperTypes.has(eventType) || evidenceIds.length === 0) {
      result.push(event);
      continue;
    }
    const key = JSON.stringify(evidenceIds);
    const group = groups.get(key) ?? [];
    group.push(event);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    const types = new Set(group.map((event) => event.event_type.trim().toLowerCase()));
    if (group.length < 2 || ![...wrapperTypes].every((type) => types.has(type))) {
      result.push(...group);
      continue;
    }

    const ordered = [...group].sort((left, right) => {
      const descriptionDifference = (right.description?.trim().length ?? 0) - (left.description?.trim().length ?? 0);
      if (descriptionDifference !== 0) return descriptionDifference;
      return Number(right.event_type === "structured_daily_capture") - Number(left.event_type === "structured_daily_capture");
    });
    const primary = ordered[0];
    const genericTitle = /^(structured daily capture|daily care entry|daily care update)$/i;
    const specificTitle = group.find((event) => !genericTitle.test(event.title.trim()))?.title;
    const description = ordered.find((event) => event.description?.trim())?.description ?? null;
    result.push({
      ...primary,
      title: specificTitle || "Daily care update",
      event_type: "daily_care_entry",
      description,
      source_record_ids: group.map((event) => event.id),
      evidence_ids: [...new Set(group.flatMap((event) => event.evidence_ids ?? []))],
    });
  }

  return result;
}

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

function isRequiredHandoffConsentDenial(
  result: PromiseSettledResult<unknown>,
): boolean {
  return result.status === "rejected" &&
    result.reason instanceof Error &&
    result.reason.message.trim() === "Required consent is missing or revoked";
}

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
  { id: "daily-care", label: "Daily Care" },
  { id: "document", label: "Documents" },
  { id: "appointment", label: "Appointments" },
  { id: "handoff", label: "Handoffs" },
  { id: "decision", label: "Decisions" },
  { id: "outcome", label: "Outcomes" },
  { id: "follow-up", label: "Follow-ups" },
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
  if (category === "lcr-update") return "Care Record update";
  return "Care update";
}

function parseDescription(description?: string | null): string {
  if (!description?.trim()) return "";
  const fallback = "Saved care information";
  const safeText = (value: unknown): string => {
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return "";
  };
  const readableLabel = (value: unknown): string => {
    const raw = safeText(value);
    if (!raw) return "";
    return caregiverFieldLabel(raw) || caregiverStatusLabel(raw) || caregiverInformationAreaLabel(raw) || caregiverSafeAssistantText(raw) || "";
  };
  try {
    const parsed: unknown = JSON.parse(description);
    if (typeof parsed === "string") return parsed.trim() || fallback;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fallback;

    const record = parsed as Record<string, unknown>;
    const capture = record.original_capture && typeof record.original_capture === "object" && !Array.isArray(record.original_capture)
      ? record.original_capture as Record<string, unknown>
      : record;
    const quick = capture.quick_check_in && typeof capture.quick_check_in === "object" && !Array.isArray(capture.quick_check_in)
      ? capture.quick_check_in as Record<string, unknown>
      : null;
    const labels: Record<string, string> = {
      same_as_usual: "About the same as usual",
      change: "Something changed",
      concern: "A concern was reported",
      care_completed: "Care was reported as completed",
      uncertain: "The caregiver was unsure",
    };
    const lines: string[] = [];
    if (quick) {
      lines.push(labels[String(quick.kind)] || "Caregiver check-in recorded");
      const areas = Array.isArray(quick.selected_areas)
        ? quick.selected_areas.filter((area): area is string => typeof area === "string")
            .map((area) => readableLabel(area)).filter(Boolean)
        : [];
      if (areas.length) lines.push("Areas mentioned: " + areas.join(", "));
    }

    if (Array.isArray(capture.medications)) {
      for (const raw of capture.medications) {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
        const medicine = raw as Record<string, unknown>;
        const name = safeText(medicine.medication_name) || "Medicine";
        const details = [
          safeText(medicine.dose) ? "Dose recorded: " + safeText(medicine.dose) : "",
          safeText(medicine.status) ? "Status: " + readableLabel(medicine.status) : "",
          safeText(medicine.note),
        ].filter(Boolean);
        lines.push(details.length ? name + " — " + details.join("; ") : name);
      }
    }

    const vitalLabels: Record<string, string> = {
      bp_systolic: "Blood pressure (top number)",
      bp_diastolic: "Blood pressure (bottom number)",
      heart_rate: "Heart rate",
      temperature: "Temperature",
      oxygen_saturation: "Oxygen level",
      weight: "Weight",
    };
    if (Array.isArray(capture.vitals)) {
      for (const raw of capture.vitals) {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
        const vital = raw as Record<string, unknown>;
        const kind = safeText(vital.vital_type);
        const label = vitalLabels[kind] || readableLabel(kind) || "Measurement";
        const value = safeText(vital.value);
        const unit = safeText(vital.unit);
        const note = safeText(vital.note);
        const measurement = [value, unit].filter(Boolean).join(" ");
        if (measurement || note) lines.push([label + (measurement ? ": " + measurement : ""), note].filter(Boolean).join(" — "));
      }
    }

    if (Array.isArray(capture.scales)) {
      for (const raw of capture.scales) {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
        const scale = raw as Record<string, unknown>;
        const label = readableLabel(scale.axis) || "Rating";
        const score = safeText(scale.score);
        const note = safeText(scale.note);
        if (score || note) lines.push([label + (score ? ": " + score : ""), note].filter(Boolean).join(" — "));
      }
    }

    for (const key of ["notes", "original_notes", "text", "description", "observation", "summary"]) {
      const value = capture[key];
      const safe = safeText(value);
      if (safe && !lines.includes(safe)) lines.push(safe);
    }
    if (lines.length) {
      const hasStructuredValues = ["medications", "vitals", "scales"].some((key) =>
        Array.isArray(capture[key]) && (capture[key] as unknown[]).length > 0
      );
      if (hasStructuredValues) {
        lines.push("Measurements and ratings are shown as entered; they have not been independently checked.");
      }
      return lines.join("\n");
    }
    return fallback;
  } catch {
    // Malformed serialized data is not shown as caregiver text.
    return /^[\\s]*[\\[{]/.test(description) ? fallback : description.trim();
  }
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
      { label: "Status", value: caregiverStatusLabel(status) || "Not available" },
      
      { label: "Date added", value: uploadedAt ? formatDateTime(uploadedAt) : "Not recorded" },
      
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
  add("Healthcare professional", payload.clinician);
  add("Specialty", payload.specialty);
  add("Location", payload.location);
  if (Array.isArray(payload.topConcerns)) {
    const concerns = payload.topConcerns.map(asText).filter(Boolean);
    if (concerns.length) lines.push("Caregiver's priority concerns:\n- " + concerns.join("\n- "));
  }
  add("Changes recorded by caregiver", payload.changes);
  add("Symptoms recorded by caregiver", payload.symptoms);
  add("Caregiver report", payload.caregiverReport);
  add("What the caregiver says the healthcare professional said (not confirmed by the professional)", payload.clinicianFindings);
  add("Decisions recorded", payload.decisions);
  add("Instructions recorded", payload.instructions);
  add("Unanswered questions", payload.unanswered);
  if (Array.isArray(payload.followUps)) {
    const followUps = payload.followUps
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        const followUp = item as Record<string, unknown>;
        return [asText(followUp.action), asText(followUp.owner), asText(followUp.due), followUp.status ? (caregiverStatusLabel(asText(followUp.status)) || "Status not available") : ""].filter(Boolean).join(" · ");
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
  const title = purpose || (clinician ? "Appointment with " + clinician : "Appointment notes");

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
      { label: "Healthcare professional", value: clinician },
      { label: "Area of care", value: specialty },
      { label: "Location", value: location },
      { label: "Review status", value: caregiverStatusLabel(asText(payload.reviewStatus) || status) || "Not available" },
      
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
  return Object.keys(snapshot).length ? "Earlier care details are saved." : "No earlier care details were recorded.";
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
  const rawChangeKind = asText(item.change_kind).toLowerCase();
  const changeKind = rawChangeKind === "deleted" ? "Removed"
    : rawChangeKind === "created" || rawChangeKind === "added" ? "Added"
      : rawChangeKind === "corrected" ? "Corrected"
        : rawChangeKind === "withdrawn" ? "Withdrawn"
          : rawChangeKind === "restored" ? "Restored"
            : rawChangeKind === "updated" || rawChangeKind === "modified" ? "Updated"
              : "Changed";
  const targetType = caregiverFieldLabel(asText(item.target_type))
    || caregiverInformationAreaLabel(asText(item.target_type))
    || "care information";
  const changedAt = item.changed_at || null;
  const changedFieldLabels = changedFields
    .map((field) => caregiverFieldLabel(field) || caregiverInformationAreaLabel(field))
    .filter((field): field is string => Boolean(field));
  const description = rawChangeKind === "deleted"
    ? "This Care Record item was removed. Its earlier saved details remain in the care history."
    : changedFieldLabels.length
      ? "Care information was " + changeKind.toLowerCase() + ". Updated details: " + changedFieldLabels.join(", ") + "."
      : "Care information was " + changeKind.toLowerCase() + ".";
  return {
    id: "lcr-revision:" + item.id,
    event_type: "lcr_revision",
    status: changeKind,
    occurred_at: null,
    recorded_at: changedAt,
    display_date: changedAt,
    display_date_label: "Care Record updated", 
    title: "Care Record · " + targetType,
    description,
    evidence_ids: item.evidence_ids ?? [],
    time_provenance: "This date shows when the saved information was changed, not when the care event happened.",
    tags: ["care record", "update"],
    source_kind: "lcr-revision",
    source_details: detailFields([
      
      
      { label: "Change kind", value: changeKind },
      
      
      
      { label: "Previous saved details", value: snapshotText(item.before_state) },
      { label: "Updated saved details", value: snapshotText(item.after_state) },
    ]),
  };
}

function mapDecision(item: CareDecision): HistoryRecord {
  const createdAt = item.created_at || null;
  const decidedAt = item.decided_at || createdAt;
  const title = asText(item.title) || asText(item.decision_text).slice(0, 120) || "Care decision";
  const context = typeof item.context === "string"
    ? parseDescription(item.context)
    : item.context && typeof item.context === "object"
      ? ["summary", "notes", "reason", "details", "description"]
          .map((key) => asText((item.context as Record<string, unknown>)[key]))
          .filter(Boolean)
          .join("\\n") || "Additional care context is saved."
      : "";
  return {
    id: "decision:" + item.id,
    event_type: "decision",
    status: caregiverStatusLabel(item.decision_status) || "Not available",
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
      { label: "Status", value: caregiverStatusLabel(item.decision_status) || "Not available" },
      { label: "When the decision was made", value: item.decided_at ? formatDateTime(item.decided_at) : "Not recorded" },
      { label: "When it was saved", value: createdAt ? formatDateTime(createdAt) : "Not recorded" },
      
      
    ]),
  };
}

function mapFollowUp(item: FollowUpHistoryItem): HistoryRecord {
  const evidenceIds = [...new Set([
    ...(item.evidence ?? []),
    ...(item.response_evidence ?? []),
    ...(item.action_evidence ?? []),
    ...(item.outcome_evidence ?? []),
  ].map((entry) => asText(entry.evidence_id)).filter(Boolean))];
  const createdAt = item.created_at || null;
  const status = asText(item.status) || "unknown";
  const title = asText(item.title) || "Care follow-up";
  const description = asText(item.description);
  return {
    id: "follow-up:" + item.id,
    event_type: "follow_up",
    status,
    occurred_at: null,
    recorded_at: createdAt,
    updated_at: item.updated_at || null,
    display_date: createdAt,
    display_date_label: "Follow-up recorded",
    title,
    description: description || undefined,
    evidence_ids: evidenceIds,
    tags: ["follow-up"],
    source_kind: "follow-up",
    source_details: detailFields([
      { label: "Status", value: caregiverStatusLabel(status) || "Not available" },
      { label: "Priority", value: caregiverStatusLabel(asText(item.priority)) || "Not available" },
      { label: "Assigned to", value: asText(item.owner_label) },
      { label: "Due date", value: item.deadline_at ? formatDateTime(item.deadline_at) : "Not recorded" },
      { label: "Review date", value: item.review_at ? formatDateTime(item.review_at) : "Not recorded" },
      { label: "When it was saved", value: createdAt ? formatDateTime(createdAt) : "Not recorded" },
    ]),
  };
}

function mapOutcome(item: CareOutcome): HistoryRecord {
  const createdAt = item.created_at || null;
  const actionType = caregiverStatusLabel(asText(item.action_type)) || "Care update";
  const status = caregiverStatusLabel(item.outcome_status) || "Not available";
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
    title: "What happened after a care update · " + actionType,
    description: description || "Status: " + (caregiverStatusLabel(status) || "Not available") + ".",
    evidence_ids: item.evidence_ids ?? [],
    created_by_caregiver_id: item.created_by_caregiver_id || null,
    tags: ["outcome", actionType],
    source_kind: "outcome",
    source_details: detailFields([
      
      
      { label: "Status", value: caregiverStatusLabel(status) || "Not available" },
      { label: "When it was saved", value: createdAt ? formatDateTime(createdAt) : "Not recorded" },
      
      
    ]),
  };
}

function mapIncomingHandoff(item: HandoffInboxItem): HistoryRecord {
  const sender = asText(item.from_caregiver_name) || "Linked caregiver";
  const createdAt = item.created_at || null;
  return {
    id: "handoff-in:" + item.id,
    event_type: "handoff",
    status: caregiverStatusLabel(item.status) || "Not available",
    occurred_at: createdAt,
    recorded_at: createdAt,
    display_date: createdAt,
    display_date_label: "Received",
    title: "Handoff from " + sender,
    description: item.has_summary
      ? "A caregiver shared this summary. The details have not been confirmed by a healthcare professional."
      : "No summary was attached to the handoff.",
    tags: ["handoff", "incoming"],
    source_kind: "handoff-in",
    source_details: detailFields([
      { label: "Direction", value: "Incoming" },
      { label: "From", value: sender },
      { label: "Relationship", value: asText(item.from_caregiver_relationship) },
      { label: "Scope", value: item.scope?.join(", ") || "" },
      { label: "Status", value: caregiverStatusLabel(item.status) || "Not available" },
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
    status: caregiverStatusLabel(item.status) || "Not available",
    occurred_at: createdAt,
    recorded_at: createdAt,
    display_date: createdAt,
    display_date_label: "Shared",
    title: "Outgoing care handoff" + recipientLabel,
    description: item.has_summary
      ? "A caregiver-reviewed summary was attached to this handoff. Sharing did not change the Care Record."
      : "No summary was attached to the handoff.",
    tags: ["handoff", "outgoing"],
    source_kind: "handoff-out",
    source_details: detailFields([
      { label: "Direction", value: "Outgoing" },
      { label: "Recipients", value: recipients.join(", ") },
      { label: "Scope", value: item.scope?.join(", ") || "" },
      { label: "Status", value: caregiverStatusLabel(item.status) || "Not available" },
      { label: "Shared", value: createdAt ? formatDateTime(createdAt) : "Not recorded" },
      { label: "Access expires", value: item.expires_at ? formatDateTime(item.expires_at) : "Not recorded" },
      { label: "Summary attached", value: item.has_summary ? "Yes" : "No" },
      { label: "Expiry state", value: item.is_expired ? "Expired" : "" },
    ]),
  };
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
  const open = true;
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const recordsRef = useRef<HistoryRecord[]>([]);
  const loadSequenceRef = useRef(0);
  const loadedPersonIdRef = useRef<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceWarnings, setSourceWarnings] = useState<string[]>([]);
  const [sourceStatuses, setSourceStatuses] = useState<Record<HistoryStatusCategory, HistoryLoadStatus>>({
    "daily-care": "loading",
    document: "loading",
    appointment: "loading",
    handoff: "loading",
    decision: "loading",
    outcome: "loading",
    "follow-up": "loading",
  });
  const [handoffConsentRequired, setHandoffConsentRequired] = useState(false);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const loadHistory = useCallback(async (manual = false) => {
    const requestSequence = ++loadSequenceRef.current;
    const isCurrentRequest = () => loadSequenceRef.current === requestSequence;
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError(null);
    setSourceWarnings([]);
    setSourceStatuses({
      "daily-care": "loading",
      document: "loading",
      appointment: "loading",
      handoff: "loading",
      decision: "loading",
      outcome: "loading",
      "follow-up": "loading",
    });
    setHandoffConsentRequired(false);
    let requestPersonId: string | null = null;

    try {
      const session = await ensureAnonymousSession();
      if (!isCurrentRequest()) return;
      if (!session.person?.id || !session.access_token) {
        throw new Error("A valid SolenOS care session is required to load this history.");
      }
      requestPersonId = session.person.id;
      if (loadedPersonIdRef.current && loadedPersonIdRef.current !== requestPersonId) {
        recordsRef.current = [];
        setRecords([]);
        setSelectedId(null);
      }
      loadedPersonIdRef.current = requestPersonId;

      const personPath = encodeURIComponent(session.person.id);
      let canUseHandoffs = false;
      let handoffConsentCheckFailed = false;
      try {
        const consent = await getJSON("/consent") as { verified?: boolean; required?: boolean };
        canUseHandoffs = consent.verified === true && consent.required === false;
        setHandoffConsentRequired(!canUseHandoffs);
      } catch {
        handoffConsentCheckFailed = true;
        setHandoffConsentRequired(false);
      }
      if (!isCurrentRequest()) return;
      const results = await Promise.allSettled([
        getJSON("/events/" + personPath),
        getJSON("/evidence/" + personPath),
        getJSON("/appointment-workspaces"),
        canUseHandoffs ? getJSON("/handoffs/inbox") : Promise.resolve({ items: [] as HandoffInboxItem[] }),
        canUseHandoffs ? getJSON("/handoffs/outbox") : Promise.resolve({ items: [] as HandoffOutboxItem[] }),
        getJSON("/care-continuity/revisions/" + personPath),
        loadAllHistoryPages<CareDecision>("/care-continuity/decisions"),
        loadAllHistoryPages<CareOutcome>("/care-continuity/outcomes/" + personPath),
        loadAllFollowUpHistoryPages(),
      ]);
      if (!isCurrentRequest()) return;

      const nextRecords: HistoryRecord[] = [];
      const warnings: string[] = [];
      if (handoffConsentCheckFailed) {
        warnings.push("Handoff availability could not be verified because sharing consent could not be checked.");
      }
      const consentRequiredForHandoffs =
        !handoffConsentCheckFailed &&
        (!canUseHandoffs ||
          isRequiredHandoffConsentDenial(results[3]) ||
          isRequiredHandoffConsentDenial(results[4]));
      setHandoffConsentRequired(consentRequiredForHandoffs);
      let availableSources = 0;

      const eventResult = results[0];
      let eventReadProblem = eventResult.status === "rejected";
      const eventPayload = eventResult.status === "fulfilled" ? eventResult.value : null;
      const eventItems = Array.isArray(eventPayload)
        ? eventPayload
        : eventPayload && typeof eventPayload === "object" && Array.isArray((eventPayload as { items?: unknown }).items)
          ? (eventPayload as { items: unknown[] }).items
          : eventPayload && typeof eventPayload === "object" && Array.isArray((eventPayload as { events?: unknown }).events)
            ? (eventPayload as { events: unknown[] }).events
            : eventPayload && typeof eventPayload === "object" && Array.isArray((eventPayload as { data?: unknown }).data)
              ? (eventPayload as { data: unknown[] }).data
              : null;
      if (eventResult.status === "fulfilled" && eventItems) {
        availableSources += 1;
        const validEvents = collapseDuplicateDailyCaptureWrappers((eventItems as CareEvent[]).filter((item) =>
          Boolean(item && typeof item.id === "string" && item.person_id === session.person.id &&
            typeof item.event_type === "string" && typeof item.title === "string")
        ));
        nextRecords.push(...validEvents.map((event) => ({ ...event, source_kind: "care-event" as const })));
      } else {
        eventReadProblem = true;
      }
      if (eventItems && eventItems.length > 0 && nextRecords.filter((record) => record.source_kind === "care-event").length === 0) {
        eventReadProblem = true;
      }

      // The LCR projection reads the same persisted care-event source through
      // its own authenticated route. Use it as a bounded fallback when the
      // dedicated event-history route fails or returns no event rows.
      {
        let projectionResult: PromiseSettledResult<unknown> = {
          status: "rejected",
          reason: new Error("Full-history fallback was not requested"),
        };
        if (eventReadProblem || eventItems?.length === 0) {
          try {
            projectionResult = {
              status: "fulfilled",
              value: await getJSON("/care-continuity/context?limit_per_source=50&include_all_history=true"),
            };
            if (!isCurrentRequest()) return;
          } catch (cause) {
            projectionResult = { status: "rejected", reason: cause };
          }
        }
        const historyContext = projectionResult.status === "fulfilled" && projectionResult.value &&
          typeof projectionResult.value === "object"
          ? projectionResult.value as {
            sources?: {
              events?: {
                items?: unknown;
                status?: string;
                candidate_count?: number;
                candidate_scan_complete?: boolean;
                has_more?: boolean;
                next_offset?: number | null;
              };
            };
          }
          : null;
        let eventSource = historyContext?.sources?.events ?? null;
        const fallbackEvents: Array<Record<string, unknown>> = [];
        const appendFallbackEvents = (items: unknown) => {
          if (!Array.isArray(items)) return;
          for (const item of items) {
            if (item && typeof item === "object" &&
              typeof (item as Record<string, unknown>).id === "string" &&
              typeof (item as Record<string, unknown>).title === "string") {
              fallbackEvents.push(item as Record<string, unknown>);
            }
          }
        };
        appendFallbackEvents(eventSource?.items);

        // The dedicated event route normally returns the full timeline. If it
        // fails, recover the complete persisted event source through the LCR's
        // explicit per-source pagination instead of a recent-only projection.
        let fallbackPageReadFailed = false;
        let fallbackPagesFetched = 1;
        while (eventSource?.has_more === true &&
          typeof eventSource.next_offset === "number" &&
          fallbackPagesFetched < 100) {
          const offsets = encodeURIComponent(JSON.stringify({ events: eventSource.next_offset }));
          try {
            const page = await getJSON(
              "/care-continuity/context?limit_per_source=50&include_all_history=true&source_offsets_json=" + offsets,
            ) as {
              sources?: {
                events?: {
                  items?: unknown;
                  status?: string;
                  candidate_count?: number;
                  candidate_scan_complete?: boolean;
                  has_more?: boolean;
                  next_offset?: number | null;
                };
              };
            };
            if (!isCurrentRequest()) return;
            eventSource = page?.sources?.events ?? null;
            appendFallbackEvents(eventSource?.items);
            fallbackPagesFetched += 1;
          } catch {
            fallbackPageReadFailed = true;
            break;
          }
        }

        const existingEventIds = new Set(nextRecords.filter((record) => record.source_kind === "care-event").map((record) => record.id));
        for (const item of fallbackEvents) {
          const id = item.id as string;
          if (existingEventIds.has(id)) continue;
          nextRecords.push({
            id,
            person_id: session.person.id,
            event_type: typeof item.event_type === "string" ? item.event_type : "daily_care",
            status: typeof item.status === "string" ? item.status : "recorded",
            occurred_at: typeof item.occurred_at === "string" ? item.occurred_at : null,
            occurred_at_timezone: typeof item.occurred_at_timezone === "string" ? item.occurred_at_timezone : null,
            recorded_at: typeof item.recorded_at === "string" ? item.recorded_at : null,
            updated_at: typeof item.updated_at === "string" ? item.updated_at : null,
            title: item.title as string,
            description: typeof item.description === "string" ? item.description : null,
            evidence_ids: Array.isArray(item.evidence_ids) ? item.evidence_ids.filter((value): value is string => typeof value === "string") : [],
            source_record_ids: Array.isArray(item.source_record_ids) ? item.source_record_ids.filter((value): value is string => typeof value === "string") : [],
            time_provenance: typeof item.time_provenance === "string" ? item.time_provenance : null,
            tags: Array.isArray(item.tags) ? item.tags.filter((value): value is string => typeof value === "string") : ["daily-care", "lcr-history-fallback"],
            source_kind: "care-event",
          });
          existingEventIds.add(id);
        }
        if (fallbackEvents.length > 0 && !(eventResult.status === "fulfilled" && eventItems)) {
          availableSources += 1;
        }
        const eventCoverageStatus = String(eventSource?.status || "").toLowerCase();
        const eventSourceVerifiedEmpty = (
          ["available", "empty", "complete"].includes(eventCoverageStatus) &&
          eventSource?.candidate_scan_complete === true &&
          Number(eventSource?.candidate_count ?? -1) === 0
        );
        const fallbackHistoryIncomplete = Boolean(
          fallbackPageReadFailed ||
          eventSource?.has_more === true ||
          eventSource?.candidate_scan_complete !== true ||
          fallbackEvents.length < Number(eventSource?.candidate_count ?? fallbackEvents.length)
        );
        if ((eventReadProblem || eventItems?.length === 0) && fallbackEvents.length > 0) {
          warnings.push("The main history view was unavailable or incomplete; saved care events were recovered from the saved care record.");
        }
        if (fallbackEvents.length > 0 && fallbackHistoryIncomplete) {
          warnings.push("Only part of the saved event history could be recovered. More records may be available; refresh to try again.");
        } else if (
          fallbackEvents.length === 0 &&
          !eventSourceVerifiedEmpty &&
          (eventReadProblem || eventItems?.length === 0 || projectionResult.status === "rejected")
        ) {
          warnings.push("Event history could not be verified from either read path. A zero count is not confirmation that the care record is empty.");
        }
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
        if (!isCurrentRequest()) return;
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
        canUseHandoffs &&
        inboxResult.status === "fulfilled" &&
        inboxResult.value &&
        typeof inboxResult.value === "object" &&
        Array.isArray((inboxResult.value as { items?: unknown }).items)
      ) {
        availableSources += 1;
        const inbox = (inboxResult.value as { items: HandoffInboxItem[] }).items
          .filter((item) => item && typeof item.id === "string");
        nextRecords.push(...inbox.map(mapIncomingHandoff));
      } else if (canUseHandoffs && !isRequiredHandoffConsentDenial(inboxResult)) {
        warnings.push("Incoming handoff history could not be loaded.");
      }

      const outboxResult = results[4];
      if (
        canUseHandoffs &&
        outboxResult.status === "fulfilled" &&
        outboxResult.value &&
        typeof outboxResult.value === "object" &&
        Array.isArray((outboxResult.value as { items?: unknown }).items)
      ) {
        availableSources += 1;
        const outbox = (outboxResult.value as { items: HandoffOutboxItem[] }).items
          .filter((item) => item && typeof item.id === "string");
        nextRecords.push(...outbox.map(mapOutgoingHandoff));
      } else if (canUseHandoffs && !isRequiredHandoffConsentDenial(outboxResult)) {
        warnings.push("Outgoing handoff history could not be loaded.");
      }

      const revisionResult = results[5];
      if (revisionResult.status === "fulfilled" && Array.isArray(revisionResult.value)) {
        // Internal audit reads are not a caregiver-history source and must not make an otherwise failed history load look successful.
        const revisions = (revisionResult.value as CareStateRevision[]).filter((item) => item && typeof item.id === "string" && shouldShowLcrRevision(item));
        nextRecords.push(...revisions.map(mapLcrRevision));
      }

      const decisionResult = results[6];
      if (decisionResult.status === "fulfilled" && Array.isArray(decisionResult.value)) {
        availableSources += 1;
        const decisions = (decisionResult.value as CareDecision[]).filter((item) => item && typeof item.id === "string");
        nextRecords.push(...decisions.map(mapDecision));
        if (decisions.length < (decisionResult.value as unknown[]).length) {
          warnings.push("Some care decision records were incomplete and could not be shown.");
        }
        if (decisions.length >= 100) {
          warnings.push("At least 100 care decisions were returned. Older decisions may be missing from this view.");
        }
      } else {
        warnings.push("Recorded care decisions could not be loaded.");
      }

      const outcomeResult = results[7];
      if (outcomeResult.status === "fulfilled" && Array.isArray(outcomeResult.value)) {
        availableSources += 1;
        const outcomes = (outcomeResult.value as CareOutcome[]).filter((item) => item && typeof item.id === "string");
        nextRecords.push(...outcomes.map(mapOutcome));
        if (outcomes.length < (outcomeResult.value as unknown[]).length) {
          warnings.push("Some decision and action outcome records were incomplete and could not be shown.");
        }
        if (outcomes.length >= 100) {
          warnings.push("At least 100 decision and action outcomes were returned. Older outcomes may be missing from this view.");
        }
      } else {
        warnings.push("Recorded decision and action outcomes could not be loaded.");
      }

      const followUpResult = results[8];
      const followUpPayload = followUpResult.status === "fulfilled" && followUpResult.value &&
        typeof followUpResult.value === "object"
        ? followUpResult.value as { items?: unknown; count?: number; limit?: number; offset?: number }
        : null;
      if (followUpPayload && Array.isArray(followUpPayload.items)) {
        availableSources += 1;
        const followUps = (followUpPayload.items as FollowUpHistoryItem[])
          .filter((item) => item && typeof item.id === "string");
        nextRecords.push(...followUps.map(mapFollowUp));
        if (typeof followUpPayload.count === "number" && followUpPayload.count > followUps.length) {
          warnings.push("Only the latest saved follow-ups are shown here. Open Follow-ups to review the full list.");
        }
      } else {
        warnings.push("Saved follow-ups could not be loaded.");
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

      // Internal persistence revisions remain in the backend audit history, not the caregiver timeline.
      if (!isCurrentRequest()) return;
      const freshRecords = nextRecords.filter((record) => record.source_kind !== "lcr-revision");
      const previousRecords = recordsRef.current.filter((record) => record.person_id === session.person.id);
      const categoryHasRecords = (items: HistoryRecord[], category: HistoryStatusCategory) =>
        items.some((record) => categoryFor(record) === category);
      const warningMatches = (category: HistoryStatusCategory) => {
        const allWarnings = warnings.join(" ").toLowerCase();
        if (category === "daily-care") return /event history|saved care events|event history could not be verified/.test(allWarnings);
        if (category === "document") return /saved documents/.test(allWarnings);
        if (category === "appointment") return /appointment/.test(allWarnings);
        if (category === "handoff") return /handoff/.test(allWarnings);
        if (category === "decision") return /care decision/.test(allWarnings);
        if (category === "outcome") return /outcome/.test(allWarnings);
        return /follow-ups/.test(allWarnings);
      };
      const nextStatuses = Object.fromEntries(HISTORY_STATUS_CATEGORIES.map((category) => {
        if (warningMatches(category)) {
          if (categoryHasRecords(freshRecords, category)) return [category, "partial"];
          if (category !== "handoff" || !consentRequiredForHandoffs) {
            if (categoryHasRecords(previousRecords, category)) return [category, "stale"];
          }
          return [category, "failed"];
        }
        if (category === "handoff" && consentRequiredForHandoffs) return [category, "partial"];
        return [category, categoryHasRecords(freshRecords, category) ? "complete" : "empty"];
      })) as Record<HistoryStatusCategory, HistoryLoadStatus>;
      const retainedRecords = previousRecords.filter((record) => {
        const category = categoryFor(record);
        if (category === "handoff" && consentRequiredForHandoffs) return false;
        const status = nextStatuses[category as HistoryStatusCategory];
        return status === "stale" || status === "partial";
      });
      const mergedRecordsById = new Map<string, HistoryRecord>();
      for (const record of [...retainedRecords, ...freshRecords]) {
        mergedRecordsById.set(record.source_kind + ":" + record.id, record);
      }
      const caregiverRecords = [...mergedRecordsById.values()];
      recordsRef.current = caregiverRecords;
      setRecords(caregiverRecords);
      setSourceStatuses(nextStatuses);
      setSourceWarnings(warnings);
      setLoadedAt(new Date().toISOString());
    } catch (cause) {
      if (!isCurrentRequest()) return;
      setSourceStatuses((current) => Object.fromEntries(HISTORY_STATUS_CATEGORIES.map((category) => [
        category,
        current[category] === "loading"
          ? recordsRef.current.some((record) => categoryFor(record) === category)
            ? "stale"
            : "failed"
          : current[category] === "empty" || current[category] === "complete" || current[category] === "partial"
            ? "stale"
            : current[category],
      ])) as Record<HistoryStatusCategory, HistoryLoadStatus>);
      const message = cause instanceof Error ? cause.message : "";
      const accessDenied = /401|403|unauthori[sz]ed|forbidden|access denied|not authenticated|not authorized|session.*required|authentication/i.test(message);
      if (!requestPersonId || accessDenied || (loadedPersonIdRef.current && loadedPersonIdRef.current !== requestPersonId)) {
        recordsRef.current = [];
        setRecords([]);
        setSourceStatuses(Object.fromEntries(
          HISTORY_STATUS_CATEGORIES.map((category) => [category, "failed"]),
        ) as Record<HistoryStatusCategory, HistoryLoadStatus>);
        setSelectedId(null);
        loadedPersonIdRef.current = null;
      }
      setError(accessDenied
        ? "You may not have access to this care history. Check your account and try again."
        : "We couldn’t load care history. Please try again.");
    } finally {
      if (isCurrentRequest()) {
        setLoading(false);
        setRefreshing(false);
        setHasLoaded(true);
      }
    }
  }, []);

  useEffect(() => {
    if (open && !hasLoaded && !loading) void loadHistory();
  }, [open, hasLoaded, loading, loadHistory]);

  useEffect(() => {
    const refreshAfterCareRecordWrite = () => {
      void loadHistory(true);
    };
    const resetAfterSessionChange = () => {
      if (open) {
        void loadHistory(true);
        return;
      }
      recordsRef.current = [];
      setRecords([]);
      setSelectedId(null);
      loadedPersonIdRef.current = null;
      setHasLoaded(false);
    };
    window.addEventListener("careRecordUpdated", refreshAfterCareRecordWrite);
    window.addEventListener("personIdChanged", resetAfterSessionChange);
    return () => {
      window.removeEventListener("careRecordUpdated", refreshAfterCareRecordWrite);
      window.removeEventListener("personIdChanged", resetAfterSessionChange);
    };
  }, [loadHistory, open]);



  const visibleRecords = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return records.filter((record) => {
      if (!eventMatchesFilter(record, filter)) return false;
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
  }, [records, filter, query]);

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

  const closeDrawer = () => setSelectedId(null);

  const selectedDescriptionHeading = selectedRecord?.source_kind === "document"
    ? "Text read from the document"
    : selectedRecord?.source_kind === "appointment"
      ? "Saved appointment information"
      : selectedRecord?.source_kind === "lcr-revision"
        ? "Care Record update"
        : selectedRecord?.source_kind === "decision"
          ? "Decision recorded"
          : selectedRecord?.source_kind === "outcome"
            ? "Outcome recorded"
            : selectedRecord?.source_kind === "follow-up"
              ? "Saved follow-up"
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
                  <strong>{selectedRecord ? "Care record" : "All saved records"}</strong>
                  <span>{selectedRecord ? "What was saved and where it came from" : "Original reports, documents and care events in date order"}</span>
                </div>

              </div>
            </header>

            {selectedRecord ? (
              <div className="history-detail-scroll">
                <div className="history-detail-category">
                  <span className="history-category-icon"><CategoryIcon category={categoryFor(selectedRecord)} /></span>
                  {categoryLabel(categoryFor(selectedRecord), selectedRecord.event_type)}
                </div>
                <h2 className="history-detail-title">{selectedRecord.title || "Care update"}</h2>
                <p className="history-detail-date">
                  {selectedRecord.display_date_label ? selectedRecord.display_date_label + " · " : ""}
                  {formatRecordDate(selectedRecord)}
                </p>

                <section className="history-detail-section">
                  <h3>{selectedDescriptionHeading}</h3>
                  <p className="history-original-text">{parseDescription(selectedRecord.description) || (
                    selectedRecord.source_kind === "document"
                      ? "No text was saved from this document. You can still open the original file."
                      : "No additional text was saved with this record."
                  )}</p>
                  {selectedRecord.source_kind === "document" && (
                    <p className="history-detail-hint">The text SolenOS read may be incomplete or incorrect. Check the original document.</p>
                  )}
                  {selectedRecord.source_kind === "handoff-in" && (
                    <p className="history-detail-hint">This summary was shared by a caregiver. That does not mean the details have been confirmed by anyone else.</p>
                  )}
                  {selectedRecord.source_kind === "appointment" && (
                    <p className="history-detail-hint">Caregiver reports and notes about what a healthcare professional said are kept separate. Saving this page does not automatically add them to your Care Record.</p>
                  )}
                </section>

                <section className="history-detail-section">
                  <h3>More details</h3>
                  <dl className="history-detail-list">
                    {selectedRecord.source_kind === "care-event" ? (
                      <>
                        <dt>When it happened</dt><dd>{formatDateTime(selectedRecord.occurred_at)}{selectedRecord.occurred_at_timezone ? " (" + selectedRecord.occurred_at_timezone + ")" : ""}</dd>
                        <dt>When it was saved</dt><dd>{formatDateTime(selectedRecord.recorded_at)}</dd>
                        <dt>Status</dt><dd>{caregiverStatusLabel(selectedRecord.status) || "Not available"}</dd>
                        <dt>Who shared it</dt><dd>{selectedRecord.created_by_caregiver_id ? "Caregiver" : "Not recorded"}</dd>
                        
                        <dt>Related notes or documents</dt><dd>{selectedRecord.evidence_ids?.length ? `${selectedRecord.evidence_ids.length} related ${selectedRecord.evidence_ids.length === 1 ? "note or document" : "notes or documents"}` : "No related notes or documents attached"}</dd>
                        <dt>Labels</dt><dd>{selectedRecord.tags?.length ? selectedRecord.tags.map((tag) => caregiverStatusLabel(tag) || caregiverInformationAreaLabel(tag) || (tag.includes("_") ? null : caregiverSafeAssistantText(tag))).filter(Boolean).join(", ") || "No labels available" : "No labels recorded"}</dd>
                        <dt>Last updated</dt><dd>{formatDateTime(selectedRecord.updated_at)}</dd>
                      </>
                    ) : (
                      <>
                        <dt>Where it came from</dt><dd>{selectedRecord.source_kind === "document" ? "Saved document" : selectedRecord.source_kind === "appointment" ? "Appointment notes" : selectedRecord.source_kind === "handoff-in" ? "Received from another caregiver" : selectedRecord.source_kind === "handoff-out" ? "Shared with another caregiver" : selectedRecord.source_kind === "lcr-revision" ? "Care Record update" : selectedRecord.source_kind === "decision" ? "Care decision" : selectedRecord.source_kind === "follow-up" ? "Saved follow-up" : selectedRecord.source_kind === "outcome" ? "What happened after a care decision" : "Saved care information"}</dd>
                        <dt>When it was saved</dt><dd>{formatDateTime(selectedRecord.recorded_at)}</dd>
                        <dt>Status</dt><dd>{caregiverStatusLabel(selectedRecord.status) || "Not available"}</dd>
                        {selectedRecord.evidence_ids?.length ? <><dt>Related notes or documents</dt><dd>{selectedRecord.evidence_ids.length} related {selectedRecord.evidence_ids.length === 1 ? "note or document" : "notes or documents"}</dd></> : null}
                        {(selectedRecord.source_details ?? []).map((field) => (
                          <ReactDetailField key={field.label} field={field} />
                        ))}
                      </>
                    )}
                  </dl>
                  {selectedRecord.significance_verdict && (
                    <p className="history-detail-significance"><strong>Why this may matter:</strong> {caregiverStatusLabel(selectedRecord.significance_verdict) || "No further explanation is available."}</p>
                  )}
                </section>

                <section className="history-integrity-note">
                  <ShieldCheck size={16} aria-hidden />
                  <span>Original information is shown separately from details about when it was saved. Related events are not assumed to have the same cause.</span>
                </section>

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

                  <div className="history-source-info" role="status" aria-label="Care history source status">
                    <strong>Care history sources</strong>
                    <ul>
                      {HISTORY_STATUS_CATEGORIES.map((category) => (
                        <li key={category}>
                          {categoryLabel(category)}: {historyLoadStatusLabel(sourceStatuses[category])}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {handoffConsentRequired && !loading && (
                    <div className="history-source-info" role="status">
                      <strong>Care handoffs are hidden for now</strong>
                      <span>Sent and received care summaries will appear after you update the sharing permission in Care Handoffs.</span>
                    </div>
                  )}

                  {sourceWarnings.length > 0 && !loading && records.length > 0 && (
                    <div className="history-source-warning" role="status">
                      <strong>Some care history could not be loaded</strong>
                      <span>The entries that loaded are still shown. Some others may be missing. Review the affected sections below.</span>
                      <ul aria-label="Care history sections that could not be loaded">
                        {sourceWarnings.map((warning, index) => <li key={index}>{warning}</li>)}
                      </ul>
                    </div>
                  )}

                  {sourceWarnings.length > 0 && !loading && records.length === 0 && (
                    <div className="history-source-warning" role="status">
                      <strong>What could not be loaded</strong>
                      <ul aria-label="Care history sections that could not be fully loaded">
                        {sourceWarnings.map((warning, index) => <li key={index}>{warning}</li>)}
                      </ul>
                    </div>
                  )}

                  {error && records.length > 0 && <RecordState kind="error" title="Some care history could not be refreshed" description="Your previously loaded records are still shown. Please try again." onAction={() => void loadHistory(true)} />}
                  {loading ? (
                    <RecordState kind="loading" title="Loading saved care history" />
                  ) : error && records.length === 0 ? (
                    <RecordState kind={/may not have access|401|403|unauthori[sz]ed|forbidden/i.test(error) ? "forbidden" : "error"} title="History could not be loaded" description={caregiverSafeErrorMessage()} onAction={() => void loadHistory(true)} />
                  ) : visibleRecords.length === 0 ? (
                    records.length > 0 ? (
                      <RecordState kind="no-results" title="No matching records" description="Try a different search or filter." actionLabel="Clear search and filters" onAction={() => { setQuery(""); setFilter("all"); }} />
                    ) : sourceWarnings.length > 0 ? (
                      <RecordState kind="incomplete" title="Your care history is incomplete" description="Some saved care information could not be loaded. Refresh before relying on this view." onAction={() => void loadHistory(true)} />
                    ) : (
                      <RecordState kind="first-empty" title="No saved care history yet" description="Care updates, documents and other saved information will appear here when they are added." />
                    )
                  ) : (
                    <div className="history-groups">
                      {groupedRecords.map((group) => (
                        <section key={group.label} className="history-date-group">
                          <h3>{group.label}</h3>
                          <div className="history-event-list">
                            {group.records.map((record) => {
                              const category = categoryFor(record);
                              const title = record.title || "Care update";
                              const description = parseDescription(record.description);
                              const distinctDescription = description?.trim() !== title.trim() ? description : null;
                              return (
                                <article key={record.id} className="history-event-card">
                                  <button
                                    type="button"
                                    className="history-event-open"
                                    onClick={() => setSelectedId(record.id)}
                                    aria-label={"Open record: " + (record.title || "Care update")}
                                  >
                                    <span className="history-event-topline">
                                      <span className="history-category-icon"><CategoryIcon category={category} /></span>
                                      <span className="history-event-category">{categoryLabel(category, record.event_type)}</span>
                                      <span className="history-event-time">{formatRecordDate(record)}</span>
                                    </span>
                                    <strong>{title}</strong>
                                    {distinctDescription && <span className="history-event-description">{distinctDescription}</span>}
                                    {(record.follow_up_candidate || record.attention_candidate) && (
                                      <span className="history-event-flag">Flagged for follow-up</span>
                                    )}
                                  </button>
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
                  <span>History brings together saved care updates, documents, appointments, handoffs, Care Record changes, decisions and outcomes where available. It shows both when something happened and when it was saved{loadedAt ? " · Last checked " + formatDateTime(loadedAt) : ""}.</span>
                </footer>
              </>
            )}

      </aside>
    </>
  );
}

function ReactDetailField({ field }: { field: DetailField }) {
  if (/\b(?:id|identifier|version|evidence|source type|scope|action type|file type)\b/i.test(field.label)) return null;
  const rawValue = field.value.trim();
  const value = caregiverStatusLabel(rawValue) ?? caregiverInformationAreaLabel(rawValue) ?? rawValue;
  if (!value) return null;
  return <><dt>{field.label}</dt><dd>{value}</dd></>;
}

