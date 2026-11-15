/**
 * Progressive Understanding projection for the persisted Living Care Record.
 *
 * This is a presentation adapter, not another change detector. The backend
 * Change Detector and Delta Engine own classifications; this module turns
 * their persisted, source-linked result into caregiver-facing understanding.
 * It is stateless so the same understanding can be reconstructed after restart.
 */
import {
  caregiverSafeAssistantText,
  caregiverSafeChangeText,
  caregiverStatusLabel,
} from "../caregiver-language";
import type { ProgressiveUnderstandingEffect } from "./contract-constants";

export type PersistedDeltaSourceReference = {
  record_type?: string;
  record_id?: string;
  label?: string;
  source_excerpt?: string;
};

export type PersistedDeltaChange = {
  domain?: string;
  name?: string;
  change_type?: string;
  classification?: string;
  previous?: unknown;
  current?: unknown;
  certainty?: string;
  evidence_supported?: boolean;
  claim_supported?: boolean | null;
  source_record_refs?: PersistedDeltaSourceReference[];
  comparison_basis?: string;
  historical_only?: boolean;
  attention_candidate?: boolean;
  follow_up_candidate?: boolean;
};

export type PersistedDeltaRun = {
  id: string;
  source_freshness?: { status?: string };
  delta?: {
    caregiver_summary?: string | null;
    computed_changes?: PersistedDeltaChange[];
    contradictions?: Array<{
      topic?: string;
      reports?: string[];
      source_record_refs?: PersistedDeltaSourceReference[];
      source_reference_status?: string;
    }>;
    clinical_gaps?: Array<{ subject?: string; description?: string }>;
    follow_ups?: Array<{ question?: string; status?: string }>;
    history_coverage?: { complete?: boolean };
  } | null;
};

export type PersistedProgressiveUnderstandingProjection = {
  source_run_id: string;
  freshness: "current" | "stale" | "unknown";
  synthesis: string | null;
  what_changed_in_understanding: string | null;
  what_matters_now: string | null;
  known_unknowns: string[];
  open_questions: string[];
  what_will_be_remembered: string[];
  effect: ProgressiveUnderstandingEffect;
  trajectory_by_domain: Record<string, "worsening" | "improving" | "stable" | "unknown">;
  supported_change_count: number;
  uncertain_change_count: number;
  evidence_reference_count: number;
};

function safeValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const raw =
    typeof value === "string" || typeof value === "number" || typeof value === "boolean"
      ? String(value)
      : JSON.stringify(value);
  return caregiverSafeAssistantText(raw || "") || "";
}

/** Same fail-closed rule used by the care-history UI. */
export function isPersistedDeltaChangeSupported(change: PersistedDeltaChange): boolean {
  return (
    change.certainty === "supported" &&
    change.evidence_supported === true &&
    change.claim_supported !== false &&
    change.historical_only !== true &&
    Array.isArray(change.source_record_refs) &&
    change.source_record_refs.length > 0
  );
}

function changeName(change: PersistedDeltaChange): string {
  return caregiverSafeChangeText(change.name || change.domain) || "Care information";
}

function changeSentence(change: PersistedDeltaChange): string {
  const name = changeName(change);
  const label = caregiverStatusLabel(change.change_type || change.classification) || "Updated";
  const previous = safeValue(change.previous);
  const current = safeValue(change.current);
  const comparison = [
    previous ? `Earlier: ${previous}.` : "",
    current ? `Latest report: ${current}.` : "",
  ].filter(Boolean);
  return `${name}: ${label}.${comparison.length ? ` ${comparison.join(" ")}` : ""}`;
}

function trajectoryFor(classifications: string[]): "worsening" | "improving" | "stable" | "unknown" {
  if (classifications.includes("worsened")) return "worsening";
  if (classifications.includes("improved")) return "improving";
  if (
    classifications.length > 0 &&
    classifications.every((value) => value === "persistent" || value === "unchanged")
  ) {
    return "stable";
  }
  return "unknown";
}

function effectFor(classifications: string[]): ProgressiveUnderstandingEffect {
  if (classifications.includes("new")) return "introduces_new_dimension";
  if (classifications.includes("resolved")) return "answers_uncertainty";
  if (classifications.some((value) => value === "improved" || value === "worsened")) {
    return "changes_what_matters";
  }
  if (classifications.some((value) => value === "recurring" || value === "persistent")) {
    return "strengthens_pattern";
  }
  return "continues_gathering";
}

/**
 * Rebuild caregiver-facing understanding from one persisted Delta run.
 * Stale or unverifiable runs never produce current change claims.
 */
export function projectPersistedDeltaUnderstanding(
  run: PersistedDeltaRun,
): PersistedProgressiveUnderstandingProjection {
  const status = run.source_freshness?.status;
  const freshness: PersistedProgressiveUnderstandingProjection["freshness"] =
    status === "current" ? "current" : status === "stale" ? "stale" : "unknown";

  if (freshness !== "current") {
    return {
      source_run_id: run.id,
      freshness,
      synthesis:
        freshness === "stale"
          ? "The care record has changed since this comparison. Refresh it before relying on these findings."
          : "SolenOS could not verify that this comparison is current.",
      what_changed_in_understanding: null,
      what_matters_now: null,
      known_unknowns: [
        freshness === "stale"
          ? "This comparison may no longer reflect the latest saved care information."
          : "The current status of this comparison could not be verified.",
      ],
      open_questions: [],
      what_will_be_remembered: [],
      effect: "continues_gathering",
      trajectory_by_domain: {},
      supported_change_count: 0,
      uncertain_change_count: 0,
      evidence_reference_count: 0,
    };
  }

  const delta = run.delta || {};
  const changes = delta.computed_changes || [];
  const supported = changes.filter(isPersistedDeltaChangeSupported);
  const uncertain = changes.filter((change) => !isPersistedDeltaChangeSupported(change));
  const classifications = supported.map((change) =>
    String(change.classification || "").toLowerCase(),
  );

  let whatChanged: string;
  if (supported.length) {
    whatChanged = supported.slice(0, 4).map(changeSentence).join(" ");
  } else if (uncertain.length) {
    whatChanged =
      "The latest care update is saved, but the earlier record does not yet support a clear comparison.";
  } else if (delta.history_coverage?.complete === true) {
    whatChanged = "The saved records do not establish a change for this update.";
  } else {
    whatChanged = "There is not enough earlier saved information to confirm what changed.";
  }

  const attentionNames = supported
    .filter((change) => change.attention_candidate || change.follow_up_candidate)
    .map(changeName);
  const whatMattersNow = attentionNames.length
    ? `These saved changes may need follow-up: ${[...new Set(attentionNames)].join(", ")}.`
    : null;

  const knownUnknowns = uncertain.map(
    (change) =>
      `There is not enough saved information to confirm a change in ${changeName(change)}.`,
  );
  for (const contradiction of delta.contradictions || []) {
    const topic = caregiverSafeChangeText(contradiction.topic) || "this care information";
    knownUnknowns.push(`Reports differ about ${topic}; both reports remain in the care record.`);
  }
  if (delta.history_coverage?.complete === false) {
    knownUnknowns.push(
      "Some earlier information is missing, so this comparison may be incomplete.",
    );
  }

  const openQuestions = [
    ...(delta.follow_ups || []).map((item) => caregiverSafeAssistantText(item.question || "")),
    ...(delta.clinical_gaps || []).map((item) =>
      caregiverSafeAssistantText(item.description || ""),
    ),
  ].filter((value): value is string => Boolean(value));

  const trajectoryGroups = new Map<string, string[]>();
  for (const change of supported) {
    const domain = caregiverSafeChangeText(change.domain) || "care";
    const values = trajectoryGroups.get(domain) || [];
    values.push(String(change.classification || "").toLowerCase());
    trajectoryGroups.set(domain, values);
  }
  const trajectoryByDomain: PersistedProgressiveUnderstandingProjection["trajectory_by_domain"] =
    Object.fromEntries(
      [...trajectoryGroups.entries()].map(([domain, values]) => [
        domain,
        trajectoryFor(values),
      ]),
    );

  const evidenceIds = new Set<string>();
  for (const change of supported) {
    for (const reference of change.source_record_refs || []) {
      if (reference.record_id) evidenceIds.add(reference.record_id);
    }
  }

  const synthesis =
    caregiverSafeAssistantText(delta.caregiver_summary || "") || whatChanged;

  return {
    source_run_id: run.id,
    freshness,
    synthesis,
    what_changed_in_understanding: whatChanged,
    what_matters_now: whatMattersNow,
    known_unknowns: [...new Set(knownUnknowns)],
    open_questions: [...new Set(openQuestions)],
    what_will_be_remembered: [...new Set(supported.map(changeName))],
    effect: effectFor(classifications),
    trajectory_by_domain: trajectoryByDomain,
    supported_change_count: supported.length,
    uncertain_change_count: uncertain.length,
    evidence_reference_count: evidenceIds.size,
  };
}
