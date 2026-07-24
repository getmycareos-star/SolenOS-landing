import type { ClarityEnvelope, ClarityRiskLevel } from "./types";
import type { PrioritizationOutput } from "@/lib/prioritization-engine";

/** Loose analyze payload — accepts raw JSON without false structural rejects. */
export type AnalyzeLike = Record<string, unknown> & {
  what_is_happening?: unknown;
  what_matters_now?: unknown;
  what_to_ask_next?: unknown;
  risk_level?: unknown;
  what_can_wait?: unknown;
  follow_up_items?: unknown;
  watch_for?: unknown;
  case_memory_layer?: { snapshot?: { follow_up_items?: unknown } };
  prioritization_engine_layer?: { output?: PrioritizationOutput };
  situation_risk_register_layer?: {
    risks?: Array<{ title?: string; description?: string; watchHint?: string }>;
  };
  crisis_prevention_layer?: {
    risks?: Array<{ explanation?: string }>;
  };
  missing_information_queue_layer?: { needsNext?: string[] };
};

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function normalizeRisk(value: unknown): ClarityRiskLevel {
  const raw = typeof value === "string" ? value.toLowerCase() : "";
  if (raw === "critical" || raw === "high" || raw === "medium" || raw === "low") {
    return raw;
  }
  return "medium";
}

/**
 * Derive watch_for when backend omits it — from risk register, crisis warnings,
 * and risk-adjacent ask-next cues. Never invents clinical alarms.
 */
export function deriveWatchFor(payload: AnalyzeLike): string[] {
  const explicit = asStringArray(payload.watch_for);
  if (explicit.length > 0) return explicit;

  const fromRiskRegister =
    payload.situation_risk_register_layer?.risks
      ?.map((r) => r.watchHint || r.title || r.description)
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0) ?? [];

  const fromCrisis =
    payload.crisis_prevention_layer?.risks
      ?.map((r) => r.explanation)
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0) ?? [];

  const combined = [...fromRiskRegister, ...fromCrisis].slice(0, 5);
  if (combined.length > 0) return combined;

  const risk = normalizeRisk(payload.risk_level);
  if (risk === "high" || risk === "critical") {
    const ask = asString(payload.what_to_ask_next);
    if (ask) return [`Monitor whether this stays stable: ${ask}`];
  }

  return [];
}

export function normalizeClarityEnvelope(payload: AnalyzeLike): ClarityEnvelope {
  const followFromCase = asStringArray(payload.case_memory_layer?.snapshot?.follow_up_items);
  const followExplicit = asStringArray(payload.follow_up_items);
  const followFromMissing = payload.missing_information_queue_layer?.needsNext ?? [];

  const follow_up_items =
    followExplicit.length > 0
      ? followExplicit
      : followFromCase.length > 0
        ? followFromCase
        : followFromMissing;

  return {
    what_is_happening: asString(payload.what_is_happening, "A caregiving moment is in progress."),
    what_matters_now: asString(payload.what_matters_now, "Clarify the next concrete step."),
    what_to_ask_next: asString(
      payload.what_to_ask_next,
      "What changed that should be held in the Living Care Record?",
    ),
    risk_level: normalizeRisk(payload.risk_level),
    what_can_wait: asString(payload.what_can_wait, "Non-urgent administrative follow-through."),
    follow_up_items,
    watch_for: deriveWatchFor(payload),
    prioritization: payload.prioritization_engine_layer?.output ?? null,
  };
}

/** Extract reflective carrying concerns from envelope + document names — not advice. */
export function buildCarryingReflection(
  envelope: ClarityEnvelope,
  documentNames: string[],
): {
  concerns: string[];
  appointments: string[];
  emotionalWorries: string[];
  documents: string[];
} {
  const concerns: string[] = [];
  if (envelope.what_is_happening) concerns.push(envelope.what_is_happening);

  const appointments = envelope.follow_up_items.filter((item) =>
    /\b(appoint|visit|call|doctor|clinic|schedule|meeting)\b/i.test(item),
  );

  const emotionalWorries: string[] = [];
  if (/\b(worries|afraid|scared|overwhelmed|anxious|guilt|alone|tired)\b/i.test(envelope.what_is_happening)) {
    emotionalWorries.push("Strain is part of what was shared.");
  }
  if (envelope.risk_level === "high" || envelope.risk_level === "critical") {
    emotionalWorries.push("Heightened pressure is acknowledged — not judged.");
  }

  return {
    concerns,
    appointments,
    emotionalWorries,
    documents: documentNames,
  };
}
