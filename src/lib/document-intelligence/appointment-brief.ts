export type AppointmentBriefEvidence = {
  id: string
  type: string
  source_text: string
  uploaded_at: string
  source_type?: string | null
  extra_metadata?: {
    extraction_source?: string
    extraction_warnings?: string[]
    ocr_confidence?: number | null
    metadata_unreadable?: boolean
  } | null
}

export type AppointmentBriefItem = {
  id: string
  recorded_at: string
  source_label: string
  excerpt: string
  review_warnings: string[]
}

export type AppointmentBrief = {
  recorded_period: { from: string; to: string }
  documented_sources: AppointmentBriefItem[]
  caregiver_observations: AppointmentBriefItem[]
  other_records: AppointmentBriefItem[]
  system_interpretations: string[]
  unknowns_to_verify: string[]
  questions_for_care_team: string[]
  disclaimer: string
}

function dateLabel(value: string): string {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : "Date not recorded"
}

function excerpt(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim()
  return normalized.length > 320 ? normalized.slice(0, 317) + "…" : normalized
}

/**
 * Compose an appointment-preparation brief from persisted evidence only.
 * This function does not infer diagnoses, reconcile contradictory instructions,
 * or turn extracted text into a verified clinical fact.
 */
export function buildAppointmentBrief(
  evidence: readonly AppointmentBriefEvidence[],
): AppointmentBrief | null {
  const records = evidence
    .filter((item) => typeof item.source_text === "string" && item.source_text.trim().length > 0)
    .map((item) => ({ ...item, parsedTimestamp: Date.parse(item.uploaded_at) }))
    .sort((a, b) => {
      const aTime = Number.isFinite(a.parsedTimestamp) ? a.parsedTimestamp : Number.MAX_SAFE_INTEGER
      const bTime = Number.isFinite(b.parsedTimestamp) ? b.parsedTimestamp : Number.MAX_SAFE_INTEGER
      return aTime - bTime || a.id.localeCompare(b.id)
    })
  if (records.length === 0) return null

  const makeItem = (item: typeof records[number]): AppointmentBriefItem => ({
    id: item.id,
    recorded_at: dateLabel(item.uploaded_at),
    source_label: item.source_type || (item.type === "document" ? "document source" : item.type === "note" ? "recorded note" : item.type),
    excerpt: excerpt(item.source_text),
    review_warnings: [
      ...(item.extra_metadata?.extraction_warnings ?? []),
      ...(item.extra_metadata?.metadata_unreadable ? ["Document provenance metadata could not be read."] : []),
      ...(item.type === "document" && item.extra_metadata?.ocr_confidence != null && item.extra_metadata.ocr_confidence < 0.65
        && !(item.extra_metadata.extraction_warnings ?? []).some((warning) => /confidence/i.test(warning))
        ? ["OCR confidence is low; compare the extracted text with the original."]
        : []),
    ],
  })

  const documentedSources = records
    .filter((item) => item.type === "document" || item.source_type === "document")
    .map(makeItem)
  const caregiverObservations = records
    .filter((item) => item.source_type === "caregiver_observation")
    .map(makeItem)
  const otherRecords = records
    .filter((item) => item.type !== "document" && item.source_type !== "document" && item.source_type !== "caregiver_observation")
    .map(makeItem)

  const unknowns = new Set<string>()
  if (documentedSources.length > 0) {
    unknowns.add("An upload timestamp is not necessarily the date the care event occurred; verify event dates against each original document.")
    if (documentedSources.some((item) => item.review_warnings.length > 0)) {
      unknowns.add("Some extracted document details need verification against the original source.")
    }
    if (documentedSources.length > 1) {
      unknowns.add("The system has not established whether newer documents supersede earlier instructions or whether the documents conflict.")
    }
  }
  if (records.some((item) => !Number.isFinite(item.parsedTimestamp))) {
    unknowns.add("One or more records have no valid recorded timestamp.")
  }

  const allText = records.map((item) => item.source_text).join("\n")
  const questions = [
    "For each important item, when did it happen, how often has it happened, and what changed from the person's usual baseline?",
  ]
  if (documentedSources.length > 0) {
    questions.push("Which document or instruction is current and authoritative, and does it replace any earlier plan?")
  }
  if (/\b(?:medication|medicine|dose|dosage|prescription|tablet|capsule)\b/i.test(allText)) {
    questions.push("Can the current medication list, dose, timing, and any conflicting instructions be reconciled with the prescriber or pharmacist?")
  }
  if (/\b(?:follow.?up|recheck|appointment|referral|test result|lab result)\b/i.test(allText)) {
    questions.push("What follow-up is needed, by when, and which person on the care team is responsible for it?")
  }
  if (unknowns.size > 0) {
    questions.push("Which uncertain or unreadable details should be checked against the original document or with its issuing provider?")
  }

  const validDates = records.map((item) => item.parsedTimestamp).filter(Number.isFinite)
  return {
    recorded_period: {
      from: validDates.length ? new Date(Math.min(...validDates)).toISOString().slice(0, 10) : "Date not recorded",
      to: validDates.length ? new Date(Math.max(...validDates)).toISOString().slice(0, 10) : "Date not recorded",
    },
    documented_sources: documentedSources,
    caregiver_observations: caregiverObservations,
    other_records: otherRecords,
    system_interpretations: [],
    unknowns_to_verify: [...unknowns],
    questions_for_care_team: questions,
    disclaimer: "Preparation aid only. Source text is not independently verified, missing information is not evidence that something did not happen, and this brief does not diagnose or authorize treatment.",
  }
}
