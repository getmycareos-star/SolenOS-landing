/**
 * Care Reality Engine Foundation — process all phases into one enrichment layer.
 * Wired from situation-entry. Does not replace ACS/SRE — strengthens them.
 */

import { resolveIdentityAttribution } from "./identity-attribution";
import {
  syncBaselineFromIntelligenceFacts,
  getBaselineProfile,
  type BaselineProfile,
} from "./baseline-profile";
import {
  emptyCoreBundle,
  type CareRealityCoreBundle,
  type CareRealityEvent,
  type CareRealityObservation,
} from "./core-objects";
import {
  detectChangesFromComparison,
  type ChangeDetectionResult,
} from "./change-detection";
import { preserveBehavioralObservation } from "./behavioral-observation";
import { adaptForCaregiverCapacity, type CapacityAdaptation } from "./capacity-adaptation";
import { detectCareTransitions, type CareTransitionDetection } from "./care-transition";
import {
  applySafetyBoundaryToOutput,
  type SafetyBoundaryResult,
} from "./safety-boundary";
import {
  validateCaregiverOrientation,
  type OrientationValidation,
} from "./orientation-validation";
import { CARE_REALITY_ENGINE_PHASES } from "./phases";
import type { SolenOSResponse } from "../response-validator";
import { deriveExplicitUnknowns } from "../unknowns-engine";
import { extractCareRealityFromText } from "../care-reality-extraction";

export type CareRealityEngineFoundationResult = {
  phases_completed: readonly string[];
  identity: ReturnType<typeof resolveIdentityAttribution>;
  baseline_profile: BaselineProfile | null;
  core: CareRealityCoreBundle;
  changes: ChangeDetectionResult;
  capacity: CapacityAdaptation;
  transitions: CareTransitionDetection[];
  safety: SafetyBoundaryResult | null;
  orientation: OrientationValidation;
  /** Soft invite when kinship used without display name — never invent identity. */
  recipient_clarification_invite: string | null;
};

export type ProcessCareRealityEngineInput = {
  care_recipient_id: string;
  contributor_id: string;
  raw_input: string;
  document_texts?: string[];
  event_ids?: string[];
  what_is_happening?: string | null;
  what_changed?: string | string[] | null;
  what_matters_now?: string | null;
  what_is_uncertain?: string[];
  what_to_ask_next?: string | string[] | null;
  what_can_wait?: string | null;
  baseline_facts?: Array<{
    domain: string;
    label: string;
    source_event_ids?: string[];
    confidence?: "low" | "medium" | "high";
  }>;
  baseline_deviations?: Array<{
    observation: string;
    compared_to_baseline?: string;
    deviation_type?: string;
    source_event_id?: string;
  }>;
  conflict_note?: string | null;
  final_output?: SolenOSResponse | null;
  risk_level?: "low" | "medium" | "high" | null;
  as_of?: string;
};

export function processCareRealityEngineFoundation(
  input: ProcessCareRealityEngineInput,
): CareRealityEngineFoundationResult {
  const now = input.as_of ?? new Date().toISOString();
  const combinedText = [input.raw_input, ...(input.document_texts ?? [])]
    .filter(Boolean)
    .join("\n");

  // Phase 1 — Identity
  const identity = resolveIdentityAttribution({
    careRecipientId: input.care_recipient_id,
    contributorId: input.contributor_id,
    rawText: combinedText,
    nowIso: now,
  });

  // Phase 2 — Baseline
  if (input.baseline_facts?.length) {
    syncBaselineFromIntelligenceFacts({
      careRecipientId: input.care_recipient_id,
      facts: input.baseline_facts,
      nowIso: now,
    });
  }
  const baseline_profile = getBaselineProfile(input.care_recipient_id);

  // Phase 3 — Core objects (from this turn's understanding + extraction)
  const core = emptyCoreBundle();
  const eventIds = input.event_ids ?? [];
  if (input.raw_input.trim() || (input.document_texts?.length ?? 0) > 0) {
    const evt: CareRealityEvent = {
      id: eventIds[0] ?? `cre_${Date.now()}`,
      type: "care_reality_update",
      date: now,
      description: (input.what_is_happening ?? input.raw_input).trim().slice(0, 500),
      source: (input.document_texts?.length ?? 0) > 0 ? "document+text" : "text",
      related_situation_id: null,
      contributor_id: input.contributor_id,
    };
    core.events.push(evt);

    const obs = preserveBehavioralObservation({
      id: `obs_${evt.id}`,
      rawDescription: input.raw_input.trim() || evt.description,
      contributorId: input.contributor_id,
      date: now,
      source: "caregiver",
    });
    if (obs) {
      const careObs: CareRealityObservation = {
        id: obs.id,
        description: obs.description,
        contributor_id: obs.contributor_id,
        date: obs.date,
        confidence: "medium",
        source: obs.source,
        related_situation_id: null,
      };
      core.observations.push(careObs);
    }

    // Enrich with extraction — Action ≠ Outcome; Decision keeps why/unknown why
    const extracted = extractCareRealityFromText({
      rawText: combinedText,
      contributorId: input.contributor_id,
      source: "caregiver",
    });
    for (const d of extracted.decisions.slice(0, 5)) {
      core.decisions.push({
        id: d.id,
        decision: d.description,
        date: now,
        participants: d.who,
        reason: d.why,
        evidence: d.evidence_texts,
        alternatives: d.alternatives,
        outcome: d.outcome,
        status: d.reason_unknown ? "unknown" : "active",
      });
    }
    for (const a of extracted.actions.slice(0, 5)) {
      core.actions.push({
        id: a.id,
        description: a.description,
        who: a.who,
        date: now,
        source: a.source,
        contributor_id: input.contributor_id,
        related_situation_id: null,
        related_decision_id: a.related_decision_id,
      });
    }
    for (const o of extracted.outcomes.slice(0, 5)) {
      core.outcomes.push({
        id: o.id,
        result: o.description,
        date: now,
        evidence: o.evidence_texts,
        related_decision_id:
          o.related_type === "decision" ? o.related_id : null,
        related_situation_id: null,
      });
    }
    for (const e of extracted.events.slice(0, 5)) {
      if (core.events.some((x) => x.description === e.description)) continue;
      core.events.push({
        id: e.id,
        type: "extracted_event",
        date: now,
        description: e.description,
        source: "text",
        related_situation_id: null,
        contributor_id: input.contributor_id,
      });
    }
  }

  // Unknowns — never invent answers; preserve gaps
  try {
    const derived = deriveExplicitUnknowns({
      known: [input.what_is_happening ?? ""].filter(Boolean),
      inferred: [],
      event_texts: [combinedText].filter(Boolean),
      unresolved_clarifications: input.what_is_uncertain ?? [],
      related_care_event_ids: eventIds,
    });
    for (const u of derived.explicit_unknowns.slice(0, 5)) {
      core.unknowns.push({
        id: u.unknown_id,
        question: u.clarification_question || u.missing_information,
        why_it_matters: u.why_it_matters || u.reason_it_matters,
        related_situation_id: null,
      });
    }
  } catch {
    /* profile-driven unknowns are optional enrichment */
  }
  if (core.unknowns.length === 0) {
    for (const q of input.what_is_uncertain ?? []) {
      if (!q.trim()) continue;
      core.unknowns.push({
        id: `unk_${core.unknowns.length}`,
        question: q.trim(),
        why_it_matters: "Reduces uncertainty in the care reality.",
        related_situation_id: null,
      });
    }
  }

  // Phase 6 — Change detection
  const whatChangedList = Array.isArray(input.what_changed)
    ? input.what_changed
    : input.what_changed
      ? [input.what_changed]
      : [];
  const changes = detectChangesFromComparison({
    priorSummaries: baseline_profile?.entries.map((e) => e.summary) ?? [],
    currentSummaries: [
      input.what_is_happening ?? "",
      ...whatChangedList,
    ].filter(Boolean),
    deviations: input.baseline_deviations,
    conflictNote: input.conflict_note,
    evidenceIds: eventIds,
  });

  // Phase 9 — Capacity
  const capacity = adaptForCaregiverCapacity(combinedText);

  // Phase 10 — Transitions
  const transitions = detectCareTransitions(combinedText);

  // Phase 11 — Safety
  let safety: SafetyBoundaryResult | null = null;
  if (input.final_output) {
    safety = applySafetyBoundaryToOutput(input.final_output, input.risk_level);
  }

  // Phase 13 — Orientation validation
  const orientation = validateCaregiverOrientation({
    what_is_happening: input.what_is_happening,
    what_changed: whatChangedList[0] ?? null,
    what_matters_now: input.what_matters_now,
    what_remains_uncertain: input.what_is_uncertain,
    what_to_ask_next: input.what_to_ask_next,
    what_can_wait: input.what_can_wait,
  });

  const recipient_clarification_invite = identity.needs_recipient_clarification
    ? "What name should we use for the person receiving care?"
    : null;

  return {
    phases_completed: [...CARE_REALITY_ENGINE_PHASES],
    identity,
    baseline_profile,
    core,
    changes,
    capacity,
    transitions,
    safety,
    orientation,
    recipient_clarification_invite,
  };
}
