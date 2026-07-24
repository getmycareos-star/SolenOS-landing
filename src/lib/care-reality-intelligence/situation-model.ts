/**
 * Care Reality Situation Model — build before caregiver-facing language.
 * Change-from-baseline reasoning. Never keyword/symptom detection.
 *
 * SoT: docs/02-product/solenos-care-reality-situation-model.md
 * Pipeline: ingestion → extraction → prioritization → situation modeling → response
 */

import type { ActiveCareSituation } from "../active-care-situation/types";
import type { CareRealityState } from "../care-reality-state/types";
import type { CareRealityExtractionResult } from "../care-reality-extraction";
import { listDecisionMemory } from "../decision-memory";
import { observationCareFact } from "../care-epistemics";
import {
  attentionRankForExtractionCategory,
  CARE_REALITY_REASONING_STRUCTURE,
} from "./no-hardcode-contract";
import { classifyExtractionFragment } from "../care-reality-extraction/classify";
import {
  buildCareRecipientAnchor,
  type CareRecipientAnchor,
} from "./care-recipient-anchor";
import {
  orientationFromBaselineComparison,
  type BaselineComparisonResult,
} from "./baseline-comparison-engine";
import {
  orientationFromComparisonInitialMode,
  containsHallucinatedChangeLanguage,
} from "./initial-care-reality-assessment";
import {
  generateActiveSituation,
  orientationFromGeneratedSituation,
  type GeneratedActiveSituation,
} from "./situation-generator";

export const CARE_REALITY_SITUATION_MODEL_PURPOSE =
  "Construct Care Reality Model (baseline→change→events→decisions→unknowns) before generating caregiver language.";

/** Engine-only certainty band — never expose as % or score in caregiver UI. */
export type SituationModelConfidence = "low" | "medium" | "high";

export type CareRealitySituationModel = {
  person: string | null;
  baseline: string | null;
  observed_changes: string[];
  timeline: string[];
  events: string[];
  decisions: string[];
  outcomes: string[];
  unknowns: string[];
  /** Context only — family dynamics / contributor load — not primary situation. */
  context_only: string[];
  confidence: SituationModelConfidence;
  /** True when model has enough to orient (not empty storage). */
  can_orient: boolean;
  extraction: CareRealityExtractionResult | null;
  /** Architecture Correction #1 — always built first. */
  care_recipient_anchor: CareRecipientAnchor;
  /** Architecture Directive #2 — baseline → change comparison. */
  baseline_comparison: BaselineComparisonResult;
  /** Situation Generator — Active Situation understanding projection. */
  generated_situation: GeneratedActiveSituation;
};

/** Discourse: prior normal vs now — structural, not clinical keyword banks. */
function extractBaselineHint(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  // "used to X but now Y" / "normally … now" / "isn't like …"
  const usedTo = t.match(
    /\b(?:used to|normally|usually|always used to|before)\b[^.!?]{8,120}?\b(?:but now|now|anymore|these days)\b[^.!?]{0,80}/i,
  );
  if (usedTo) return usedTo[0]!.trim().slice(0, 200);
  const notLike = t.match(/\b(?:isn'?t|not) like (?:her|him|them|usual|before)[^.!?]{0,60}/i);
  if (notLike) return notLike[0]!.trim().slice(0, 160);
  return null;
}

function extractChangeHint(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  const nowPart = t.match(
    /\b(?:but now|now|these days|anymore)\b[^.!?]{8,140}/i,
  );
  if (nowPart) return nowPart[0]!.trim().slice(0, 200);
  return null;
}

function confidenceFromModel(m: Omit<CareRealitySituationModel, "confidence" | "can_orient" | "extraction"> & {
  extraction: CareRealityExtractionResult | null;
}): SituationModelConfidence {
  const evidence =
    m.observed_changes.length +
    m.events.length +
    m.decisions.length +
    (m.baseline ? 1 : 0);
  if (evidence >= 4 && m.unknowns.length <= 2) return "high";
  if (evidence >= 2 || m.baseline) return "medium";
  return "low";
}

/**
 * Build Care Reality Situation Model from held ACS + optional latest capture.
 * Separates primary care reality from family/load context.
 * Does not invent clinical labels from keyword lists.
 */
export function buildCareRealitySituationModel(params: {
  situation: ActiveCareSituation;
  latestRawText?: string;
  crs?: CareRealityState | null;
  baselineChangeNote?: string | null;
  careKey?: string;
}): CareRealitySituationModel {
  const { situation } = params;
  const latest = params.latestRawText?.trim() ?? "";
  const careKey = params.careKey ?? situation.care_recipient_id ?? situation.caregiver_id;

  // Architecture Correction #1 — Care Recipient Anchor first
  const care_recipient_anchor = buildCareRecipientAnchor({
    situation,
    latestRawText: latest,
    careKey,
  });

  const person = care_recipient_anchor.care_recipient;
  const extraction = care_recipient_anchor.extraction;

  // Situation Generator — Active Situation understanding (derived; not a second store)
  const generated_situation = generateActiveSituation({
    situation,
    latestRawText: latest,
    careKey,
    person,
    crs: params.crs ?? null,
  });

  // Architecture Directive #2 — Baseline Comparison (reuse generator's comparison)
  const baseline_comparison = generated_situation.baseline_comparison;

  const baselineFromText = latest ? extractBaselineHint(latest) : null;
  const baseline =
    baseline_comparison.known_baseline[0] ||
    params.baselineChangeNote?.trim() ||
    baselineFromText ||
    situation.familiarity_baseline?.[0]?.trim() ||
    params.crs?.current_understanding?.find((h) =>
      /\b(?:usual|normally|used to|before)\b/i.test(h),
    ) ||
    null;

  const observed_changes: string[] = [];
  // Prefer Situation Generator observed changes when rich; else baseline comparison path
  if (generated_situation.is_rich_situation) {
    for (const c of generated_situation.observed_changes) {
      observed_changes.push(c.endsWith(".") ? c : `${c}.`);
    }
  } else if (baseline_comparison.mode === "change_detection") {
    for (const c of baseline_comparison.meaningful_changes) {
      observed_changes.push(c.endsWith(".") ? c : `${c}.`);
    }
  } else {
    // Initial assessment: current concerns — not framed as prior→now changes
    for (const c of baseline_comparison.current_concerns) {
      observed_changes.push(c.endsWith(".") ? c : `${c}.`);
    }
  }
  const changeFromText = latest ? extractChangeHint(latest) : null;
  if (
    changeFromText &&
    observed_changes.length === 0 &&
    baseline_comparison.mode === "change_detection"
  ) {
    observed_changes.push(changeFromText);
  }

  if (extraction) {
    for (const o of extraction.observations) {
      const line = o.description.endsWith(".") ? o.description : `${o.description}.`;
      if (!observed_changes.some((x) => x.toLowerCase() === line.toLowerCase())) {
        observed_changes.push(line);
      }
    }
  }

  // Prefer anchor recipient changes (already demoted family/load)
  for (const c of care_recipient_anchor.recipient_changes) {
    if (!observed_changes.some((x) => x.toLowerCase() === c.toLowerCase())) {
      observed_changes.push(c);
    }
  }

  for (const o of [...situation.observations].reverse()) {
    const fact = observationCareFact({
      human_fact: o.human_fact,
      raw_text: o.raw_text,
    });
    if (!fact) continue;
    const cat = classifyExtractionFragment(fact);
    if (cat === "contributor_load" || cat === "disagreement_perspective") continue;
    if (attentionRankForExtractionCategory(cat) > 2) continue;
    const line = fact.endsWith(".") ? fact : `${fact}.`;
    if (!observed_changes.some((x) => x.toLowerCase().includes(fact.toLowerCase().slice(0, 40)))) {
      observed_changes.push(line);
    }
    if (observed_changes.length >= 6) break;
  }

  const events = [
    ...generated_situation.related_events,
    ...(extraction?.events ?? []).map((e) => e.description),
  ];
  const decisions = [
    ...generated_situation.related_decisions,
    ...(extraction?.decisions ?? []).map((d) => d.description),
  ];
  const outcomes = (extraction?.outcomes ?? []).map((o) => o.description);

  const careKeyForDecisions = careKey;
  for (const d of listDecisionMemory(careKeyForDecisions).slice(-4)) {
    if (d.what && !decisions.some((x) => x.includes(d.what.slice(0, 40)))) {
      decisions.push(d.what);
    }
    if (d.outcome && !outcomes.some((x) => x.includes(d.outcome!.slice(0, 40)))) {
      outcomes.push(d.outcome);
    }
  }

  const unknowns: string[] = [];
  // Prefer situation-generator unknowns when rich
  for (const u of generated_situation.unknowns) {
    unknowns.push(u);
  }
  // Prefer baseline-comparison unknowns (timing / co-occurrence / prior context)
  for (const u of baseline_comparison.unknowns) {
    if (!unknowns.some((x) => x.toLowerCase() === u.toLowerCase())) unknowns.push(u);
  }
  if (extraction) {
    for (const u of extraction.unknowns) {
      if (u.status === "open" && !unknowns.some((x) => x.toLowerCase() === u.question.toLowerCase())) {
        unknowns.push(u.question);
      }
    }
  }
  for (const q of situation.open_questions ?? []) {
    if (!unknowns.some((x) => x.toLowerCase() === q.toLowerCase())) {
      unknowns.push(q);
    }
  }
  // Structural unknowns when baseline change without cause/timing
  if (baseline && observed_changes.length > 0 && unknowns.length === 0) {
    if (!unknowns.some((u) => /when|start|began/i.test(u))) {
      unknowns.push("When this change started is not held yet.");
    }
    if (!unknowns.some((u) => /cause|why|reason/i.test(u))) {
      unknowns.push("What may explain this change is still unclear.");
    }
  }

  const context_only: string[] = [
    ...care_recipient_anchor.contributor_context,
    ...generated_situation.family_context,
    ...baseline_comparison.related_context,
  ];
  if (extraction) {
    for (const n of extraction.non_care_facts) {
      if (!context_only.some((c) => c.includes(n.text.slice(0, 40)))) {
        context_only.push(n.text);
      }
    }
  }

  const timeline: string[] = [];
  if (baseline) timeline.push(`Before: ${baseline.replace(/\.$/, "")}.`);
  for (const c of observed_changes.slice(0, 3)) {
    timeline.push(`Now: ${c.replace(/\.$/, "")}.`);
  }
  for (const e of events.slice(0, 2)) {
    timeline.push(`Event: ${e.replace(/\.$/, "")}.`);
  }

  const draft = {
    person,
    baseline: baseline ? baseline.replace(/\.$/, "") : null,
    observed_changes: observed_changes.slice(0, 6),
    timeline: timeline.slice(0, 8),
    events: events.slice(0, 4),
    decisions: decisions.slice(0, 4),
    outcomes: outcomes.slice(0, 4),
    unknowns: unknowns.slice(0, 4),
    context_only: context_only.slice(0, 4),
    extraction,
    care_recipient_anchor,
    baseline_comparison,
    generated_situation,
  };

  const confidence = confidenceFromModel(draft);
  const can_orient =
    Boolean(draft.baseline) ||
    draft.observed_changes.length > 0 ||
    draft.events.length > 0 ||
    draft.decisions.length > 0 ||
    (params.crs?.current_understanding?.length ?? 0) > 0;

  return {
    ...draft,
    confidence,
    can_orient,
  };
}

/**
 * Orientation lines from the model — never keyword dumps or task lists.
 * Max one high-value ask.
 */
export function orientationFromSituationModel(model: CareRealitySituationModel): {
  current_understanding: string | null;
  what_changed: string | null;
  still_unclear: string[];
  one_thing_to_add: string | null;
  connected_note: string | null;
} {
  if (!model.can_orient) {
    return {
      current_understanding: null,
      what_changed: null,
      still_unclear: [],
      one_thing_to_add: null,
      connected_note: null,
    };
  }

  // Situation Generator — rich multi-facet situations orient as understanding, not fact lists
  if (
    model.generated_situation?.is_rich_situation &&
    model.generated_situation.can_orient &&
    !model.care_recipient_anchor.needs_identity_ask
  ) {
    const fromSit = orientationFromGeneratedSituation(model.generated_situation);
    return {
      current_understanding: fromSit.current_understanding,
      what_changed: fromSit.what_changed,
      still_unclear: fromSit.still_unclear,
      one_thing_to_add: fromSit.one_thing_to_add,
      connected_note: fromSit.connected_note,
    };
  }

  // Architecture 2B — Initial Assessment only when no comparable prior.
  // Never overwrite returning turns (ACS/CRS memory or has_comparable_prior) with Initial Assessment copy.
  if (
    model.baseline_comparison?.mode === "initial_assessment" &&
    !model.baseline_comparison.has_comparable_prior
  ) {
    const fromInitial = orientationFromComparisonInitialMode(model.baseline_comparison);
    return {
      current_understanding: fromInitial.current_understanding,
      what_changed: fromInitial.what_changed,
      still_unclear: fromInitial.still_unclear,
      one_thing_to_add: model.care_recipient_anchor.needs_identity_ask
        ? model.care_recipient_anchor.identity_ask
        : fromInitial.one_thing_to_add,
      connected_note: null,
    };
  }

  // Architecture Directive #2 — prefer baseline comparison orientation when change is held
  if (
    model.baseline_comparison?.has_meaningful_change &&
    !model.care_recipient_anchor.needs_identity_ask
  ) {
    const fromBaseline = orientationFromBaselineComparison(model.baseline_comparison);
    const one_thing_to_add =
      fromBaseline.still_unclear[0] ?? model.unknowns[0] ?? null;
    return {
      current_understanding: fromBaseline.current_understanding,
      what_changed: fromBaseline.what_changed,
      still_unclear: fromBaseline.still_unclear,
      one_thing_to_add,
      connected_note: null,
    };
  }

  // Unknown recipient: never guess a name — still orient on held changes with neutral language.
  // Soft identity ask takes priority as the one high-value ask (Locked A).
  const who =
    model.person && !model.care_recipient_anchor.needs_identity_ask
      ? model.person
      : "they";
  let current_understanding: string | null = null;
  // Never use “recent changes / different from usual” without comparable prior
  if (
    model.baseline &&
    model.observed_changes[0] &&
    model.baseline_comparison?.has_comparable_prior
  ) {
    current_understanding = `What used to be part of ${who === "they" ? "their" : `${who}'s`} usual pattern appears different now — ${model.observed_changes[0].replace(/\.$/, "")}.`;
  } else if (model.observed_changes[0]) {
    current_understanding =
      who !== "they"
        ? `Current care concerns for ${who} are held — ${model.observed_changes
            .slice(0, 2)
            .map((c) => c.replace(/\.$/, ""))
            .join("; ")}.`
        : model.observed_changes.slice(0, 2).join(" ");
  } else if (model.events[0]) {
    current_understanding = `A care journey moment${who !== "they" ? ` for ${who}` : ""} is held: ${model.events[0].replace(/\.$/, "")}.`;
  } else if (model.decisions[0]) {
    current_understanding = `A care choice${who !== "they" ? ` about ${who}` : ""} is held: ${model.decisions[0].replace(/\.$/, "")}.`;
  }

  let what_changed: string | null = null;
  // "Compared with what was usual before" only when a real usual/baseline pattern is held —
  // not merely when ACS prior observations exist (returning memory without usual discourse).
  if (
    model.baseline &&
    model.observed_changes.length > 0 &&
    model.baseline_comparison?.has_baseline
  ) {
    what_changed = `Compared with what was usual before, ${model.observed_changes[0].replace(/\.$/, "").toLowerCase()}.`;
  } else if (
    model.observed_changes.length > 0 &&
    model.baseline_comparison?.has_comparable_prior
  ) {
    what_changed = model.observed_changes[0]!;
  } else if (model.outcomes[0]) {
    what_changed = model.outcomes[0]!;
  }

  const still_unclear = model.care_recipient_anchor.needs_identity_ask
    ? []
    : model.unknowns.slice(0, 2);
  const one_thing_to_add = model.care_recipient_anchor.needs_identity_ask
    ? model.care_recipient_anchor.identity_ask
    : (model.unknowns[0] ?? null);

  return {
    current_understanding,
    what_changed,
    still_unclear,
    one_thing_to_add,
    connected_note: null,
  };
}

export { CARE_REALITY_REASONING_STRUCTURE, containsHallucinatedChangeLanguage };
