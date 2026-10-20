/**
 * Share Care Summary — readiness, audience selection, content selection,
 * freshness, conflict detection, and summary generation.
 *
 * This module consumes the existing care-state data produced by the
 * canonical situation-entry pipeline. It does not fabricate information,
 * resolve contradictions silently, or expose internal reasoning.
 */

import type { SituationResponse } from "@/lib/situation-entry";

/* ------------------------------------------------------------------ */
/*  Audience                                                          */
/* ------------------------------------------------------------------ */

export type ShareAudience = "doctor" | "family" | "professional_caregiver" | "other";

export interface AudienceOption {
  id: ShareAudience;
  label: string;
  description: string;
}

export const AUDIENCE_OPTIONS: AudienceOption[] = [
  {
    id: "doctor",
    label: "Doctor / clinician",
    description: "Clinically useful, concise, with relevant evidence and open questions.",
  },
  {
    id: "family",
    label: "Family",
    description: "Understandable language, what changed, what family should know.",
  },
  {
    id: "professional_caregiver",
    label: "Professional caregiver",
    description: "Actionable continuity of care — routines, medications, safety, follow-ups.",
  },
  {
    id: "other",
    label: "Other",
    description: "Tailored to the recipient you specify.",
  },
];

/* ------------------------------------------------------------------ */
/*  Readiness                                                         */
/* ------------------------------------------------------------------ */

export type ReadinessState = "empty" | "limited" | "ready";

export interface ReadinessResult {
  state: ReadinessState;
  /** Human-readable explanation for the current state. */
  message: string;
  /** What information is actually available. */
  availableInfo: {
    hasObservations: boolean;
    hasChanges: boolean;
    hasEvents: boolean;
    hasDocuments: boolean;
    hasUncertainty: boolean;
    hasClarifications: boolean;
    hasPriorityDemands: boolean;
    observationCount: number;
    changeCount: number;
    eventCount: number;
    documentCount: number;
  };
}

export function assessReadiness(response: SituationResponse | null): ReadinessResult {
  if (!response) {
    return {
      state: "empty",
      message:
        "Nothing to share yet\nThere isn't enough care information in this record to create a useful summary yet.",
      availableInfo: {
        hasObservations: false,
        hasChanges: false,
        hasEvents: false,
        hasDocuments: false,
        hasUncertainty: false,
        hasClarifications: false,
        hasPriorityDemands: false,
        observationCount: 0,
        changeCount: 0,
        eventCount: 0,
        documentCount: 0,
      },
    };
  }

  const observations = response.active_care_situation?.observations ?? [];
  const changes = response.what_changed ?? [];
  const events = response.events_created ?? [];
  const documents = response.document_events_count ?? 0;
  const uncertainty = response.what_is_uncertain ?? [];
  const clarifications = response.what_needs_clarification ?? [];
  const priority = response.priority_layer?.top_events?.length ?? 0;

  const info = {
    hasObservations: observations.length > 0,
    hasChanges: changes.length > 0,
    hasEvents: events.length > 0,
    hasDocuments: documents > 0,
    hasUncertainty: uncertainty.length > 0,
    hasClarifications: clarifications.length > 0,
    hasPriorityDemands: priority > 0,
    observationCount: observations.length,
    changeCount: changes.length,
    eventCount: events.length,
    documentCount: documents,
  };

  const meaningfulPieces = [
    info.hasObservations,
    info.hasChanges,
    info.hasEvents,
    info.hasDocuments,
  ].filter(Boolean).length;

  if (meaningfulPieces === 0 && info.observationCount === 0) {
    return {
      state: "empty",
      message:
        "Nothing to share yet\nThere isn't enough care information in this record to create a useful summary yet.",
      availableInfo: info,
    };
  }

  if (meaningfulPieces <= 1 && info.observationCount < 2) {
    return {
      state: "limited",
      message:
        "This record has limited information\nWe can create a summary, but it may be incomplete because this care record contains limited information.",
      availableInfo: info,
    };
  }

  return {
    state: "ready",
    message: "This record has enough information to share.",
    availableInfo: info,
  };
}

/* ------------------------------------------------------------------ */
/*  Audience-specific information selection                            */
/* ------------------------------------------------------------------ */

export interface SelectedContent {
  currentSituation: string[];
  recentChanges: string[];
  medications: string[];
  conditions: string[];
  allergies: string[];
  observations: string[];
  evidence: string[];
  followUps: string[];
  questions: string[];
  unknowns: string[];
  timeline: string[];
}

export function selectContentForAudience(
  response: SituationResponse,
  audience: ShareAudience,
  otherRecipient?: string,
): SelectedContent {
  const observations = response.active_care_situation?.observations ?? [];
  const understood = response.what_i_understood ?? [];
  const changes = response.what_changed ?? [];
  const uncertainty = response.what_is_uncertain ?? [];
  const clarifications = response.what_needs_clarification ?? [];
  const tracked = response.what_will_be_tracked ?? [];
  const events = response.events_created ?? [];
  const priorityTop = response.priority_layer?.top_events ?? [];

  const extractMedications = (): string[] => {
    const meds: string[] = [];
    for (const ev of events) {
      const raw = (ev.raw_input ?? "").toLowerCase();
      if (raw.includes("medication") || raw.includes("medicine") || raw.includes("dose") || raw.includes("mg ")) {
        const snippet = ev.raw_input.trim();
        if (snippet) meds.push(snippet);
      }
    }
    for (const obs of observations) {
      const raw = (obs.raw_text ?? "").toLowerCase();
      if (raw.includes("medication") || raw.includes("medicine") || raw.includes("dose") || raw.includes("mg ")) {
        const snippet = obs.raw_text.trim();
        if (snippet) meds.push(snippet);
      }
    }
    return meds;
  };

  const extractConditions = (): string[] => {
    const conds: string[] = [];
    for (const ev of events) {
      const raw = (ev.raw_input ?? "").toLowerCase();
      if (
        raw.includes("diagnos") ||
        raw.includes("condition") ||
        raw.includes("dementia") ||
        raw.includes("alzheimer") ||
        raw.includes("diabetes") ||
        raw.includes("hypertension") ||
        raw.includes("arthritis")
      ) {
        const snippet = ev.raw_input.trim();
        if (snippet) conds.push(snippet);
      }
    }
    for (const obs of observations) {
      const raw = (obs.raw_text ?? "").toLowerCase();
      if (
        raw.includes("diagnos") ||
        raw.includes("condition") ||
        raw.includes("dementia") ||
        raw.includes("alzheimer")
      ) {
        const snippet = obs.raw_text.trim();
        if (snippet) conds.push(snippet);
      }
    }
    return conds;
  };

  const extractAllergies = (): string[] => {
    const allergies: string[] = [];
    for (const ev of events) {
      const raw = (ev.raw_input ?? "").toLowerCase();
      if (raw.includes("allerg")) {
        const snippet = ev.raw_input.trim();
        if (snippet) allergies.push(snippet);
      }
    }
    for (const obs of observations) {
      const raw = (obs.raw_text ?? "").toLowerCase();
      if (raw.includes("allerg")) {
        const snippet = obs.raw_text.trim();
        if (snippet) allergies.push(snippet);
      }
    }
    return allergies;
  };

  const meds = extractMedications();
  const conditions = extractConditions();
  const allergies = extractAllergies();

  const observationTexts = observations.map((o) => o.raw_text?.trim()).filter(Boolean) as string[];
  const understoodTexts = understood.map((u) => u.label).filter(Boolean);
  const changeTexts = changes.map((c) => c).filter(Boolean);
  const uncertaintyTexts = uncertainty.map((u) => u).filter(Boolean);
  const clarificationTexts = clarifications.map((c) => c).filter(Boolean);
  const trackedTexts = tracked.map((t) => typeof t === "string" ? t : String(t)).filter(Boolean);
  const eventTexts = events.map((e) => e.raw_input?.trim()).filter(Boolean) as string[];
  const priorityTexts = priorityTop.map((p) => p).filter(Boolean);

  const timeline = [
    ...eventTexts.slice(-10),
    ...changeTexts.slice(-5),
  ];

  if (audience === "doctor") {
    return {
      currentSituation: [
        ...observationTexts.slice(-3),
        ...understoodTexts.slice(-2),
      ],
      recentChanges: changeTexts.slice(-5),
      medications: meds,
      conditions: conditions,
      allergies: allergies.length > 0 ? allergies : ["No allergy information has been recorded."],
      observations: observationTexts.slice(-5),
      evidence: eventTexts.slice(-8),
      followUps: trackedTexts.slice(-5),
      questions: clarificationTexts.slice(-5),
      unknowns: uncertaintyTexts.slice(-5),
      timeline: timeline,
    };
  }

  if (audience === "family") {
    const plainLanguage = (items: string[]): string[] => {
      return items.map((item) => {
        const lower = item.toLowerCase();
        if (lower.includes("provisional")) return `[Still being confirmed] ${item}`;
        if (lower.includes("uncertain")) return `[Unclear] ${item}`;
        return item;
      });
    };
    return {
      currentSituation: plainLanguage([
        ...observationTexts.slice(-2),
        ...changeTexts.slice(-2),
      ]),
      recentChanges: plainLanguage(changeTexts.slice(-4)),
      medications: plainLanguage(meds),
      conditions: plainLanguage(conditions),
      allergies: allergies.length > 0 ? plainLanguage(allergies) : ["No allergy information has been recorded."],
      observations: plainLanguage(observationTexts.slice(-4)),
      evidence: plainLanguage(eventTexts.slice(-6)),
      followUps: plainLanguage(trackedTexts.slice(-4)),
      questions: plainLanguage(clarificationTexts.slice(-3)),
      unknowns: plainLanguage(uncertaintyTexts.slice(-3)),
      timeline: plainLanguage(timeline),
    };
  }

  if (audience === "professional_caregiver") {
    return {
      currentSituation: [
        ...observationTexts.slice(-3),
        ...priorityTexts.slice(-2),
      ],
      recentChanges: changeTexts.slice(-4),
      medications: meds,
      conditions: conditions,
      allergies: allergies.length > 0 ? allergies : ["No allergy information has been recorded."],
      observations: observationTexts.slice(-4),
      evidence: eventTexts.slice(-6),
      followUps: [
        ...trackedTexts.slice(-4),
        ...priorityTexts.slice(-2),
      ],
      questions: clarificationTexts.slice(-3),
      unknowns: uncertaintyTexts.slice(-3),
      timeline: timeline,
    };
  }

  // other — use recipient context if provided, otherwise generic
  const otherContext = otherRecipient ? `Prepared for: ${otherRecipient}` : "";
  return {
    currentSituation: [...observationTexts.slice(-3), otherContext].filter(Boolean),
    recentChanges: changeTexts.slice(-3),
    medications: meds,
    conditions: conditions,
    allergies: allergies.length > 0 ? allergies : ["No allergy information has been recorded."],
    observations: observationTexts.slice(-3),
    evidence: eventTexts.slice(-4),
    followUps: trackedTexts.slice(-3),
    questions: clarificationTexts.slice(-2),
    unknowns: uncertaintyTexts.slice(-2),
    timeline: timeline,
  };
}

/* ------------------------------------------------------------------ */
/*  Conflict detection                                                 */
/* ------------------------------------------------------------------ */

export interface DetectedConflict {
  type: "medication_dose" | "diagnosis_date" | "symptom_report" | "caregiver_report" | "outcome" | "general";
  description: string;
  sources: string[];
}

export function detectConflicts(response: SituationResponse): DetectedConflict[] {
  const conflicts: DetectedConflict[] = [];
  const events = response.events_created ?? [];

  const medDoses = new Map<string, string[]>();
  for (const ev of events) {
    const raw = ev.raw_input ?? "";
    const doseMatch = raw.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|units)/i);
    if (doseMatch) {
      const medName = raw.toLowerCase().split(doseMatch[0])[0].trim().slice(-30);
      const key = medName || "unknown_medication";
      const existing = medDoses.get(key) ?? [];
      existing.push(`${doseMatch[1]}${doseMatch[2]}`);
      medDoses.set(key, existing);
    }
  }

  for (const [med, doses] of medDoses) {
    const uniqueDoses = [...new Set(doses)];
    if (uniqueDoses.length > 1) {
      conflicts.push({
        type: "medication_dose",
        description: `Medication information is conflicting: different doses were found for ${med}: ${uniqueDoses.join(" and ")}. The current dose may need to be verified.`,
        sources: events.filter((e) => e.raw_input?.toLowerCase().includes(med.slice(-10))).map((e) => e.id),
      });
    }
  }

  return conflicts;
}

/* ------------------------------------------------------------------ */
/*  Freshness assessment                                               */
/* ------------------------------------------------------------------ */

export interface FreshnessResult {
  isStale: boolean;
  staleItems: string[];
  lastUpdated: string | null;
}

export function assessFreshness(response: SituationResponse): FreshnessResult {
  if (!response || !response.context) {
    return { isStale: false, staleItems: [], lastUpdated: null };
  }

  const updatedAt = response.context.updated_at;
  if (!updatedAt) {
    return { isStale: false, staleItems: [], lastUpdated: null };
  }

  const updated = new Date(updatedAt);
  const now = new Date();
  const daysSinceUpdate = (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24);

  const staleItems: string[] = [];
  if (daysSinceUpdate > 30) {
    staleItems.push(
      `Care information has not been updated in ${Math.round(daysSinceUpdate)} days. Some details may be out of date.`,
    );
  }

  for (const ev of response.events_created ?? []) {
    const evTime = new Date(ev.timestamp);
    const evAge = (now.getTime() - evTime.getTime()) / (1000 * 60 * 60 * 24);
    if (evAge > 90) {
      staleItems.push(`"${ev.raw_input?.slice(0, 60)}" was recorded ${Math.round(evAge)} days ago and may no longer reflect current status.`);
    }
  }

  return {
    isStale: staleItems.length > 0,
    staleItems: staleItems.slice(0, 5),
    lastUpdated: updatedAt,
  };
}

/* ------------------------------------------------------------------ */
/*  Summary generation                                                 */
/* ------------------------------------------------------------------ */

export interface GeneratedSummary {
  title: string;
  preparedFor: string;
  audience: ShareAudience;
  generatedAt: string;
  sections: {
    heading: string;
    items: string[];
  }[];
  includedCategories: string[];
  excludedCategories: string[];
  conflicts: DetectedConflict[];
  unknowns: string[];
  freshness: FreshnessResult;
  evidenceNote: string;
}

export function generateSummary(
  response: SituationResponse,
  audience: ShareAudience,
  otherRecipient?: string,
): GeneratedSummary {
  const content = selectContentForAudience(response, audience, otherRecipient);
  const conflicts = detectConflicts(response);
  const freshness = assessFreshness(response);
  const generatedAt = new Date().toISOString();

  const audienceLabel =
    audience === "doctor"
      ? "Doctor / clinician"
      : audience === "family"
        ? "Family"
        : audience === "professional_caregiver"
          ? "Professional caregiver"
          : otherRecipient || "Other";

  const sections: GeneratedSummary["sections"] = [];

  if (content.currentSituation.length > 0) {
    sections.push({ heading: "Current situation", items: content.currentSituation });
  }
  if (content.recentChanges.length > 0) {
    sections.push({ heading: "Recent changes", items: content.recentChanges });
  }
  if (content.medications.length > 0) {
    sections.push({ heading: "Medications", items: content.medications });
  }
  if (content.conditions.length > 0) {
    sections.push({ heading: "Relevant conditions", items: content.conditions });
  }
  if (content.allergies.length > 0) {
    sections.push({ heading: "Allergies", items: content.allergies });
  }
  if (content.observations.length > 0) {
    sections.push({ heading: "Recent observations", items: content.observations });
  }
  if (content.evidence.length > 0) {
    sections.push({ heading: "Relevant evidence", items: content.evidence });
  }
  if (content.followUps.length > 0) {
    sections.push({ heading: "Follow-ups and care tasks", items: content.followUps });
  }
  if (content.questions.length > 0) {
    sections.push({ heading: "Open questions", items: content.questions });
  }
  if (content.unknowns.length > 0) {
    sections.push({ heading: "Unknowns", items: content.unknowns });
  }
  if (content.timeline.length > 0) {
    sections.push({ heading: "Important timeline events", items: content.timeline });
  }

  const includedCategories = sections.map((s) => s.heading);

  const excludedCategories = [
    ...(content.medications.length === 0 ? ["Medications"] : []),
    ...(content.conditions.length === 0 ? ["Conditions"] : []),
    "Unrelated family notes",
    "Irrelevant historical information",
    "Internal SolenOS reasoning",
  ];

  return {
    title: "Care summary",
    preparedFor: audienceLabel,
    audience,
    generatedAt,
    sections,
    includedCategories,
    excludedCategories,
    conflicts,
    unknowns: content.unknowns,
    freshness,
    evidenceNote: "This summary is based on information recorded in the care record. Important claims are traceable to caregiver notes, documents, and observations.",
  };
}

/* ------------------------------------------------------------------ */
/*  Lightweight sharing history (localStorage)                         */
/* ------------------------------------------------------------------ */

const SHARE_HISTORY_KEY = "solenos_share_history";
const MAX_HISTORY_ENTRIES = 20;

export interface ShareHistoryEntry {
  date: string;
  audience: string;
  format: string;
  result: "shared" | "failed";
}

export function recordShareHistory(
  audience: string,
  format: string,
  result: "shared" | "failed",
): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(SHARE_HISTORY_KEY);
    const entries: ShareHistoryEntry[] = raw ? JSON.parse(raw) : [];
    entries.unshift({ date: new Date().toISOString(), audience, format, result });
    const trimmed = entries.slice(0, MAX_HISTORY_ENTRIES);
    window.localStorage.setItem(SHARE_HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore */
  }
}

export function loadShareHistory(): ShareHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SHARE_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearShareHistory(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SHARE_HISTORY_KEY);
  } catch {
    /* ignore */
  }
}
