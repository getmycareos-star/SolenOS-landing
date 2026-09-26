/**
 * Extraction normalization + merge — small models are never a hard failure.
 *
 * Two jobs:
 * 1. Salvage: repair partial / aliased / fenced / stringified model JSON instead of
 *    discarding the whole extraction.
 * 2. Merge: the rule floor and the LLM output combine into one extraction, so a
 *    single missing field or a dead model degrades coverage instead of emptying it.
 */

import { extractWithRules } from "./rule-extractor";
import { EXTRACTION_SCHEMA_VERSION } from "./types";
import type {
  ExtractionAppointment,
  ExtractionAttribution,
  ExtractionContradiction,
  ExtractionCoverage,
  ExtractionMedication,
  ExtractionMeasurement,
  ExtractionObservation,
  ExtractionQuestion,
  ExtractionTemporalFact,
  ExtractionUncertainty,
  SemanticExtraction,
} from "./types";

const ARRAY_ALIASES: Record<keyof Omit<SemanticExtraction, "schema_version" | "extraction_confidence" | "extraction_notes" | "source" | "degraded" | "coverage" | "caregiver_load_signals">, string[]> = {
  observations: ["observations", "symptoms", "symptom", "observation", "notes_observed"],
  measurements: ["measurements", "measurement", "values", "vitals", "numbers"],
  medications: ["medications", "medication", "meds", "meds_found", "medication_list"],
  temporal_facts: ["temporal_facts", "temporal", "timeline", "time_facts", "when_facts"],
  attributions: ["attributions", "attribution", "sources", "who_said_what"],
  contradictions: ["contradictions", "contradiction", "conflicts", "disagreements"],
  uncertainties: ["uncertainties", "uncertainty", "uncertains", "gaps"],
  questions: ["questions", "question", "asks", "caregiver_questions"],
  appointments: ["appointments", "appointment", "schedule", "visits"],
};

const WRAPPER_KEYS = ["extraction", "result", "data", "output", "payload", "response"];

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
}

function str(value: unknown): string | null {
  if (typeof value === "string") {
    const t = value.trim();
    return t.length ? t : null;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const m = value.match(/-?\d+(?:\.\d+)?/);
    if (m) {
      const n = Number(m[0]);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = str(obj[k]);
    if (v) return v;
  }
  return null;
}

function unwrap(data: unknown): Record<string, unknown> | null {
  let obj: unknown = data;
  for (let i = 0; i < 3; i += 1) {
    if (typeof obj === "string") {
      obj = salvageJson(obj);
      if (typeof obj !== "object" || obj === null) return null;
    }
    if (Array.isArray(obj)) {
      obj = obj[0];
      continue;
    }
    if (typeof obj !== "object" || obj === null) return null;
    const record = obj as Record<string, unknown>;
    if (WRAPPER_KEYS.some((k) => record[k] && typeof record[k] === "object") && !record.observations) {
      const wrapper = WRAPPER_KEYS.find((k) => record[k] && typeof record[k] === "object");
      if (wrapper) {
        obj = record[wrapper];
        continue;
      }
    }
    return record;
  }
  return typeof obj === "object" && obj !== null ? (obj as Record<string, unknown>) : null;
}

/** Recover JSON from fenced blocks, prose, or trailing-comma truncation. */
export function salvageJson(raw: string): unknown | null {
  if (!raw) return null;
  const attempts: string[] = [];
  const trimmed = raw.trim();
  attempts.push(trimmed);

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) attempts.push(fenced[1].trim());

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first > -1 && last > first) attempts.push(trimmed.slice(first, last + 1));

  for (const attempt of attempts) {
    for (const candidate of [attempt, attempt.replace(/,\s*([}\]])/g, "$1")]) {
      try {
        return JSON.parse(candidate);
      } catch {
        // keep trying
      }
    }
  }
  return null;
}

function normalizeObservation(item: unknown): ExtractionObservation | null {
  const obj = unwrap(item);
  if (!obj) return null;
  const description = pickString(obj, ["description", "text", "content", "summary", "observation", "value", "note"]);
  if (!description) return null;
  const rawType = pickString(obj, ["type", "kind", "category", "observation_type"])?.toLowerCase() ?? null;
  const type: ExtractionObservation["type"] =
    rawType === "symptom" ||
    rawType === "behavior" ||
    rawType === "functional_change" ||
    rawType === "cognitive_change" ||
    rawType === "mood_change"
      ? rawType
      : "other";
  const rawSeverity = pickString(obj, ["severity", "intensity", "level"])?.toLowerCase() ?? null;
  const severity: ExtractionObservation["severity"] =
    rawSeverity === "mild" || rawSeverity === "moderate" || rawSeverity === "severe" ? rawSeverity : null;
  const rawUncertainty = pickString(obj, ["uncertainty", "certainty", "epistemic_status"])?.toLowerCase() ?? null;
  const uncertainty: ExtractionObservation["uncertainty"] =
    rawUncertainty === "reported" || rawUncertainty === "observed" || rawUncertainty === "suspected" ? rawUncertainty : null;
  return {
    type,
    description,
    severity,
    source_person: pickString(obj, ["source_person", "person", "reporter", "source"]),
    source_role: (pickString(obj, ["source_role", "role", "person_role"]) as ExtractionObservation["source_role"]) ?? null,
    temporal_context: pickString(obj, ["temporal_context", "when", "time_context", "timing"]),
    uncertainty,
  };
}

function normalizeMeasurement(item: unknown): ExtractionMeasurement | null {
  const obj = unwrap(item);
  if (!obj) return null;
  const rawType = pickString(obj, ["type", "name", "metric", "kind", "measurement"]) ?? null;
  const value = obj.value ?? obj.amount ?? obj.reading ?? obj.result ?? null;
  if (!rawType && value === null) return null;
  const rawPrecision = pickString(obj, ["temporal_precision", "precision"])?.toLowerCase() ?? null;
  return {
    type: rawType ?? "unspecified",
    value: typeof value === "number" ? value : str(value) ?? "",
    unit: pickString(obj, ["unit", "units", "uom"]),
    systolic: num(obj.systolic),
    diastolic: num(obj.diastolic),
    time: pickString(obj, ["time", "time_of_day"]),
    date: pickString(obj, ["date", "day"]),
    temporal_precision:
      rawPrecision === "exact" || rawPrecision === "approximate" || rawPrecision === "relative" || rawPrecision === "uncertain"
        ? rawPrecision
        : "uncertain",
    source_person: pickString(obj, ["source_person", "person", "reporter", "source"]),
    uncertainty: pickString(obj, ["uncertainty", "certainty"]),
  };
}

function normalizeMedication(item: unknown): ExtractionMedication | null {
  const obj = unwrap(item);
  if (!obj) return null;
  const name = pickString(obj, ["name", "medication", "medication_name", "drug", "medicine"]);
  if (!name) return null;
  const rawAction = pickString(obj, ["reported_action", "action", "adherence", "status"])?.toLowerCase() ?? null;
  const reported_action: ExtractionMedication["reported_action"] =
    rawAction === "taken" ||
    rawAction === "not_taken" ||
    rawAction === "missed" ||
    rawAction === "uncertain" ||
    rawAction === "administered_by_others"
      ? rawAction
      : null;
  const rawStatus = pickString(obj, ["administration_status", "taken_status"])?.toLowerCase() ?? null;
  return {
    name,
    reported_action,
    administration_status:
      rawStatus === "taken" || rawStatus === "not_taken" || rawStatus === "uncertain" ? rawStatus : null,
    source_person: pickString(obj, ["source_person", "person", "reporter", "source"]),
    temporal_context: pickString(obj, ["temporal_context", "when", "time_context"]),
    uncertainty: pickString(obj, ["uncertainty", "certainty"]),
    note: pickString(obj, ["note", "dose", "details", "detail"]),
  };
}

function normalizeTemporalFact(item: unknown): ExtractionTemporalFact | null {
  const obj = unwrap(item);
  if (!obj) return null;
  const description = pickString(obj, ["description", "text", "fact", "content", "summary"]);
  if (!description) return null;
  const rawPrecision = pickString(obj, ["precision", "temporal_precision"])?.toLowerCase() ?? null;
  return {
    description,
    time_reference: pickString(obj, ["time_reference", "time", "when"]),
    date_reference: pickString(obj, ["date_reference", "date"]),
    precision:
      rawPrecision === "exact" || rawPrecision === "approximate" || rawPrecision === "relative" || rawPrecision === "uncertain"
        ? rawPrecision
        : null,
    ordering: pickString(obj, ["ordering", "order"]),
  };
}

function normalizeAttribution(item: unknown): ExtractionAttribution | null {
  const obj = unwrap(item);
  if (!obj) return null;
  const person = pickString(obj, ["person", "name", "source", "reporter", "who"]);
  const claim = pickString(obj, ["claim", "statement", "said", "content", "description"]);
  if (!person && !claim) return null;
  const rawRole = pickString(obj, ["role", "person_role"])?.toLowerCase() ?? null;
  const role: ExtractionAttribution["role"] =
    rawRole === "patient" || rawRole === "caregiver" || rawRole === "family" || rawRole === "clinician" || rawRole === "document"
      ? rawRole
      : "unknown";
  return { person: person ?? "Unknown", role, claim: claim ?? "", confidence: num(obj.confidence) };
}

function normalizeContradiction(item: unknown): ExtractionContradiction | null {
  const obj = unwrap(item);
  if (!obj) return null;
  const a = pickString(obj, ["claim_a", "claimA", "a", "first", "prior"]);
  const b = pickString(obj, ["claim_b", "claimB", "b", "second", "current"]);
  if (!a || !b) return null;
  return {
    claim_a: a,
    claim_b: b,
    claim_a_source: pickString(obj, ["claim_a_source", "a_source"]),
    claim_b_source: pickString(obj, ["claim_b_source", "b_source"]),
    evidence: pickString(obj, ["evidence", "text", "excerpt"]),
    unresolved: true,
  };
}

function normalizeUncertainty(item: unknown): ExtractionUncertainty | null {
  const obj = unwrap(item);
  if (!obj) return null;
  const description = pickString(obj, ["description", "text", "detail", "question", "content"]);
  if (!description) return null;
  return {
    field: pickString(obj, ["field", "topic", "category"]) ?? "interpretation",
    description,
    reason: pickString(obj, ["reason", "cause", "because"]),
  };
}

function normalizeQuestion(item: unknown): ExtractionQuestion | null {
  const obj = unwrap(item);
  if (!obj) return null;
  const question = pickString(obj, ["question", "text", "ask", "content"]);
  if (!question) return null;
  return { question, topic: pickString(obj, ["topic", "category", "subject"]) };
}

function normalizeAppointment(item: unknown): ExtractionAppointment | null {
  const obj = unwrap(item);
  if (!obj) return null;
  const clinician = pickString(obj, ["clinician", "doctor", "provider", "with"]);
  const date = pickString(obj, ["date", "day", "when"]);
  const time = pickString(obj, ["time"]);
  const type = pickString(obj, ["type", "kind", "purpose"]);
  if (!clinician && !date && !type) return null;
  const rawCertainty = pickString(obj, ["certainty", "status"])?.toLowerCase() ?? null;
  return {
    clinician,
    date,
    time,
    type,
    certainty:
      rawCertainty === "confirmed" || rawCertainty === "planned" || rawCertainty === "uncertain" || rawCertainty === "unknown"
        ? rawCertainty
        : "unknown",
    source_person: pickString(obj, ["source_person", "person", "reporter"]),
  };
}

type ArrayKey = keyof typeof ARRAY_ALIASES;

const NORMALIZERS: Record<ArrayKey, (item: unknown) => unknown> = {
  observations: normalizeObservation,
  measurements: normalizeMeasurement,
  medications: normalizeMedication,
  temporal_facts: normalizeTemporalFact,
  attributions: normalizeAttribution,
  contradictions: normalizeContradiction,
  uncertainties: normalizeUncertainty,
  questions: normalizeQuestion,
  appointments: normalizeAppointment,
};

/**
 * Coerce any partial / aliased model payload into a schema-valid extraction.
 * Returns `null` only when nothing structured can be recovered.
 */
export function normalizeExtraction(data: unknown): {
  extraction: SemanticExtraction | null;
  notes: string[];
} {
  const notes: string[] = [];
  const root = unwrap(data);
  if (!root) {
    return { extraction: null, notes: ["no_json_object_recovered"] };
  }

  if (root.schema_version !== EXTRACTION_SCHEMA_VERSION) {
    notes.push(`schema_version_repaired:${String(root.schema_version ?? "missing")}`);
  }

  const out: Record<ArrayKey, unknown[]> = {
    observations: [],
    measurements: [],
    medications: [],
    temporal_facts: [],
    attributions: [],
    contradictions: [],
    uncertainties: [],
    questions: [],
    appointments: [],
  };

  for (const key of Object.keys(ARRAY_ALIASES) as ArrayKey[]) {
    let rawItems: unknown[] | null = null;
    for (const alias of ARRAY_ALIASES[key]) {
      if (root[alias] !== undefined) {
        rawItems = asArray(root[alias]);
        if (alias !== key) notes.push(`aliased_field:${alias}->${key}`);
        break;
      }
    }
    if (!rawItems) continue;
    let dropped = 0;
    for (const item of rawItems) {
      const normalized = NORMALIZERS[key](item);
      if (normalized) out[key].push(normalized);
      else dropped += 1;
    }
    if (dropped > 0) notes.push(`dropped_unusable_items:${key}:${dropped}`);
  }

  const rawConfidence = num(root.extraction_confidence ?? root.confidence);
  const total =
    out.observations.length +
    out.measurements.length +
    out.medications.length +
    out.temporal_facts.length +
    out.questions.length +
    out.appointments.length;

  if (total === 0 && out.uncertainties.length === 0) {
    return { extraction: null, notes: [...notes, "no_structured_items_recovered"] };
  }

  const extraction: SemanticExtraction = {
    schema_version: EXTRACTION_SCHEMA_VERSION,
    observations: out.observations as ExtractionObservation[],
    measurements: out.measurements as ExtractionMeasurement[],
    medications: out.medications as ExtractionMedication[],
    temporal_facts: out.temporal_facts as ExtractionTemporalFact[],
    attributions: out.attributions as ExtractionAttribution[],
    contradictions: out.contradictions as ExtractionContradiction[],
    uncertainties: out.uncertainties as ExtractionUncertainty[],
    questions: out.questions as ExtractionQuestion[],
    appointments: out.appointments as ExtractionAppointment[],
    extraction_confidence:
      rawConfidence !== null ? Math.min(1, Math.max(0, rawConfidence)) : total >= 4 ? 0.7 : 0.55,
    extraction_notes: str(root.extraction_notes ?? root.notes) ?? null,
  };

  return { extraction, notes };
}

function keyFor(kind: ArrayKey, item: unknown): string {
  switch (kind) {
    case "measurements":
      return `${(item as ExtractionMeasurement).type}|${String((item as ExtractionMeasurement).value)}|${(item as ExtractionMeasurement).unit ?? ""}`;
    case "medications":
      return `${(item as ExtractionMedication).name.toLowerCase()}|${(item as ExtractionMedication).reported_action ?? ""}`;
    case "questions":
      return (item as ExtractionQuestion).question.toLowerCase().slice(0, 60);
    case "temporal_facts":
      return ((item as ExtractionTemporalFact).time_reference ?? (item as ExtractionTemporalFact).description).toLowerCase().slice(0, 60);
    case "appointments":
      return `${(item as ExtractionAppointment).date ?? ""}|${(item as ExtractionAppointment).time ?? ""}|${(item as ExtractionAppointment).type ?? ""}`;
    case "contradictions":
      return `${(item as ExtractionContradiction).claim_a}|${(item as ExtractionContradiction).claim_b}`.toLowerCase().slice(0, 80);
    case "uncertainties":
      return `${(item as ExtractionUncertainty).field}|${(item as ExtractionUncertainty).description}`.toLowerCase().slice(0, 60);
    case "attributions":
      return `${(item as ExtractionAttribution).person}|${(item as ExtractionAttribution).role}`;
    default:
      return ((item as ExtractionObservation).description ?? String(item)).toLowerCase().slice(0, 60);
  }
}

/** Compute field-level coverage for an extraction. */
export function extractionCoverage(extraction: SemanticExtraction): ExtractionCoverage {
  const load = extraction.caregiver_load_signals?.length ?? 0;
  return {
    observations: extraction.observations.length,
    measurements: extraction.measurements.length,
    medications: extraction.medications.length,
    temporal_facts: extraction.temporal_facts.length,
    questions: extraction.questions.length,
    appointments: extraction.appointments.length,
    uncertainties: extraction.uncertainties.length,
    contradictions: extraction.contradictions.length,
    attributions: extraction.attributions.length,
    caregiver_load_signals: load,
    has_structured_fact:
      extraction.observations.length +
        extraction.measurements.length +
        extraction.medications.length +
        extraction.temporal_facts.length +
        extraction.questions.length +
        extraction.appointments.length +
        load >
        0,
  };
}

/**
 * Merge LLM output with the rule floor.
 * LLM claims win where both found the same fact (richer phrasing);
 * rules fill every gap, so no field is ever emptied by a model failure.
 */
export function mergeExtractions(
  llm: SemanticExtraction | null,
  rules: SemanticExtraction,
): SemanticExtraction {
  if (!llm) {
    return { ...rules, coverage: extractionCoverage(rules), degraded: true, source: "rules" };
  }

  const merged: Record<ArrayKey, unknown[]> = {
    observations: [],
    measurements: [],
    medications: [],
    temporal_facts: [],
    attributions: [],
    contradictions: [],
    uncertainties: [],
    questions: [],
    appointments: [],
  };
  const seen: Record<ArrayKey, Set<string>> = {
    observations: new Set(),
    measurements: new Set(),
    medications: new Set(),
    temporal_facts: new Set(),
    attributions: new Set(),
    contradictions: new Set(),
    uncertainties: new Set(),
    questions: new Set(),
    appointments: new Set(),
  };

  const push = (kind: ArrayKey, item: unknown) => {
    const key = keyFor(kind, item);
    if (seen[kind].has(key)) return;
    seen[kind].add(key);
    merged[kind].push(item);
  };

  for (const kind of Object.keys(merged) as ArrayKey[]) {
    for (const item of (llm as unknown as Record<string, unknown[]>)[kind] ?? []) push(kind, item);
  }
  for (const kind of Object.keys(merged) as ArrayKey[]) {
    for (const item of (rules as unknown as Record<string, unknown[]>)[kind] ?? []) push(kind, item);
  }

  // Caregiver capacity signals: rule floor is the only reliable detector.
  const llmLoad = llm.caregiver_load_signals ?? [];
  const ruleLoad = rules.caregiver_load_signals ?? [];
  const loadKeys = new Set(llmLoad.map((l) => l.kind));
  const caregiver_load_signals = [...llmLoad, ...ruleLoad.filter((l) => !loadKeys.has(l.kind))];

  const base: SemanticExtraction = {
    schema_version: EXTRACTION_SCHEMA_VERSION,
    observations: merged.observations as ExtractionObservation[],
    measurements: merged.measurements as ExtractionMeasurement[],
    medications: merged.medications as ExtractionMedication[],
    temporal_facts: merged.temporal_facts as ExtractionTemporalFact[],
    attributions: merged.attributions as ExtractionAttribution[],
    contradictions: merged.contradictions as ExtractionContradiction[],
    uncertainties: merged.uncertainties as ExtractionUncertainty[],
    questions: merged.questions as ExtractionQuestion[],
    appointments: merged.appointments as ExtractionAppointment[],
    extraction_confidence: Math.max(llm.extraction_confidence ?? 0, rules.extraction_confidence ?? 0),
    extraction_notes: llm.extraction_notes ?? rules.extraction_notes ?? null,
    source: "llm+rules",
    degraded: false,
    caregiver_load_signals,
  };

  return { ...base, coverage: extractionCoverage(base) };
}

/** Convenience: rule-only extraction as an ExtractionResult. */
export function rulesOnlyResult(text: string, reason?: string | null): {
  extraction: SemanticExtraction;
  result: {
    success: true;
    extraction: SemanticExtraction;
    raw_response: string;
    parsed_content: null;
    duration_ms: number;
    model: string;
    provider: string;
    error: string | null;
    models_attempted: string[];
    repair_notes: string[];
    rule_floor_facts: number;
  };
} {
  const extraction = extractWithRules(text);
  const coverage = extractionCoverage(extraction);
  const facts =
    coverage.observations +
    coverage.measurements +
    coverage.medications +
    coverage.temporal_facts +
    coverage.questions +
    coverage.appointments +
    coverage.caregiver_load_signals;
  return {
    extraction,
    result: {
      success: true,
      extraction,
      raw_response: "",
      parsed_content: null,
      duration_ms: 0,
      model: "rule-extraction-floor",
      provider: "deterministic",
      error: reason ?? null,
      models_attempted: [],
      repair_notes: [],
      rule_floor_facts: facts,
    },
  };
}
