/**
 * Clinical profile → caregiver influence (ADR-005 · CLINICAL_PROFILE.md).
 *
 * Dementia (MVP default) shapes which gaps matter via Unknowns profile triggers.
 * Caregiver copy stays Response Contract gather-family language — never disease FAQ,
 * diagnosis, or clinical reason_it_matters jargon.
 */

import {
  deriveExplicitUnknowns,
  type ExplicitUnknown,
  type UnknownPriority,
} from "../unknowns-engine";
import { isCaregiverFacingAsk } from "../progressive-understanding";

/** Keep aligned with DEFAULT_CLINICAL_PROFILE_ID — avoid circular import with index.ts. */
const MVP_PROFILE_FALLBACK = "dementia";

const PRIORITY_RANK: Record<UnknownPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * Map fired profile *categories* → Response Contract gather asks.
 * Categories come from the clinical unknowns profile; wording stays person/journey.
 * Never mention dementia / Alzheimer / progression / diagnosis.
 */
const CATEGORY_GATHER_ASK: Record<string, string> = {
  nutrition: "Has eating looked different from what was usual?",
  hydration: "What else have you noticed alongside this?",
  medication:
    "Has something changed with care recently — medication, illness, or a hospital visit?",
  medications:
    "Has something changed with care recently — medication, illness, or a hospital visit?",
  sleep: "Has overnight rest looked different from what was usual?",
  wandering: "When did this start, and has it happened more than once?",
  falls: "What else do you know about what happened around this?",
  behavior: "What else have you noticed alongside this?",
  perception:
    "Has something changed with care recently — medication, illness, or a hospital visit?",
  continence: "Is this new compared with what was usual, and when did it start?",
  mobility: "Has walking or getting around looked different from what was usual?",
  cognition: "When did you first notice this relative to other recent changes?",
  function: "Has daily help looked different from what was usual?",
  caregiver_load: "Has something changed with care recently?",
  clinical_events:
    "Has something changed with care recently — medication, illness, or a hospital visit?",
  appointments: "What else have you noticed alongside this?",
};

const DISEASE_OR_DIAGNOSIS =
  /\b(?:dementia|alzheimer|diagnosis|diagnosed|progression|prognosis|disease)\b/i;

function gatherAskForUnknown(u: ExplicitUnknown): string | null {
  const mapped = CATEGORY_GATHER_ASK[u.category]?.trim();
  if (!mapped || DISEASE_OR_DIAGNOSIS.test(mapped)) return null;
  if (!isCaregiverFacingAsk(mapped)) return null;
  return mapped;
}

/**
 * Profile-triggered caregiver asks (max 1–2). Includes medium when higher slots empty
 * so eat/sleep entry captures still surface dementia-profile nutrition/sleep gaps.
 */
export function caregiverAsksFromClinicalProfile(params: {
  eventTexts: readonly string[];
  clinicalProfileId?: string | null;
  known?: readonly string[];
  maxAsks?: number;
}): { asks: string[]; openCategories: string[] } {
  const maxAsks = Math.min(2, Math.max(1, params.maxAsks ?? 2));
  const profileId =
    params.clinicalProfileId?.trim() || MVP_PROFILE_FALLBACK;
  const texts = params.eventTexts.map((t) => t.trim()).filter((t) => t.length >= 4);
  if (texts.length === 0) return { asks: [], openCategories: [] };

  const { explicit_unknowns } = deriveExplicitUnknowns({
    event_texts: texts,
    clinical_profile_id: profileId,
    known: [...(params.known ?? [])],
    inferred: [],
    unresolved_clarifications: [],
  });

  const unresolved = explicit_unknowns
    .filter((u) => u.status === "unresolved" && u.priority !== "low")
    .slice()
    .sort(
      (a, b) =>
        (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9),
    );

  const openCategories = [...new Set(unresolved.map((u) => u.category))];
  const asks: string[] = [];
  const seen = new Set<string>();

  for (const u of unresolved) {
    if (asks.length >= maxAsks) break;
    const ask = gatherAskForUnknown(u);
    if (!ask) continue;
    const key = ask.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    asks.push(ask);
  }

  return { asks: asks.slice(0, maxAsks), openCategories };
}

/**
 * Soft What-matters hint when nutrition/sleep (or safety) profile gaps are open.
 * Person language only — never disease tips.
 */
export function caregiverMattersHintFromClinicalProfile(params: {
  openCategories: readonly string[];
  heldFocus?: string | null;
  latestRawText?: string | null;
}): string | null {
  const cats = new Set(params.openCategories.map((c) => c.toLowerCase()));
  const blob = `${params.heldFocus ?? ""} ${params.latestRawText ?? ""}`.toLowerCase();
  const nutrition = cats.has("nutrition") || /\b(?:eat|appetite|meal|food)\b/i.test(blob);
  const sleep = cats.has("sleep") || /\b(?:sleep|overnight|waking)\b/i.test(blob);
  const visit =
    cats.has("clinical_events") ||
    /\b(?:doctor|hospital|clinic|visit|appoint)\b/i.test(blob);

  if (nutrition && sleep) {
    return visit
      ? "Most important next: how eating and overnight rest sit after the care visit — without deciding everything tonight."
      : "Most important next: how eating and overnight rest sit with what was usual — without deciding everything tonight.";
  }
  if (nutrition) {
    return "Most important next: how eating sits with what was usual — without deciding everything tonight.";
  }
  if (sleep) {
    return "Most important next: how overnight rest sits with what was usual — without deciding everything tonight.";
  }
  if (cats.has("wandering") || cats.has("falls")) {
    return "Most important next: what is known about safety around this, and what is still unclear — without deciding everything tonight.";
  }
  return null;
}

/** True when caregiver copy invents diagnosis / disease FAQ (must stay false). */
export function caregiverCopyHasClinicalDiagnosisTheater(blob: string): boolean {
  return (
    DISEASE_OR_DIAGNOSIS.test(blob) &&
    /\b(?:this (?:is|means)|likely|probably|common in|typical for|patients with|diagnos)/i.test(
      blob,
    )
  );
}
