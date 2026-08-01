/**
 * Dementia Wedge Integration — connects Dementia Moment Detection,
 * Change Report Engine, and Care Brief Generator into the SolenOS pipeline.
 *
 * This module sits between the intelligence layer and the response composer.
 * It detects moments, builds reports, and enriches the final output with
 * dementia-specific context.
 */

import { detectDementiaMoments, mapExistingEvaluationToMoment } from "../dementia-moments";
import type { DementiaMomentResult } from "../dementia-moments/types";
import { buildChangeReport, formatClinicianBrief } from "../change-report";
import type { ChangeReport, ClinicianBrief } from "../change-report";
import { buildCareBrief, buildCareBriefForScenario } from "../care-brief";
import type { CareBrief, CareBriefScenario } from "../care-brief/types";
import type { CareRealityState } from "../care-reality-state/types";
import type { CareRealityMemoryObject } from "../care-reality-intelligence/care-reality-memory";
import type { BaselineComparisonResult } from "../care-reality-intelligence/baseline-comparison-engine";
import type { FinalOutputContract } from "../final-output-contract/types";

// ─── Types ──────────────────────────────────────────────────────────────

/**
 * Complete dementia wedge result that can be attached to a pipeline response.
 */
export type DementiaWedgeResult = {
  /** Detected dementia moments from the input */
  moments: DementiaMomentResult;
  /** Change report built from input + existing care state */
  change_report: ChangeReport | null;
  /** Clinician brief formatted from change report */
  clinician_brief: ClinicianBrief | null;
  /** Care brief for knowledge transfer / handoff */
  care_brief: CareBrief | null;
};

/**
 * Input context needed by the dementia wedge integration.
 */
export type DementiaWedgeInput = {
  /** Raw caregiver input */
  raw_input: string;
  /** Current Care Reality State */
  crs: CareRealityState | null;
  /** Care reality memory objects */
  memory_objects: CareRealityMemoryObject[];
  /** Baseline comparison result (if available) */
  baseline: BaselineComparisonResult | null;
  /** Subject label for the care recipient */
  care_recipient_label: string | null;
  /** Care recipient durable id */
  care_recipient_id: string;
  /** Recent changes detected by the pipeline */
  what_changed?: string[];
  /** Current open uncertainties from pipeline */
  open_uncertainties?: string[];
  /** Whether to force generating a change report */
  force_report?: boolean;
};

// ─── Main integration function ──────────────────────────────────────────

/**
 * Process caregiver input through the full Dementia Wedge stack:
 * 1. Detect dementia moments
 * 2. Build change report (when change detected)
 * 3. Format clinician brief (when appointment detected)
 * 4. Build care brief (when new caregiver detected)
 */
export function processDementiaWedge(input: DementiaWedgeInput): DementiaWedgeResult {
  const rawInput = input.raw_input.trim();

  // 1. Detect dementia moments
  const moments = detectDementiaMoments(rawInput);

  // 2. Build change report when moments indicate change OR when enough info exists
  let changeReport: ChangeReport | null = null;
  if (moments.should_generate_report || input.force_report) {
    changeReport = buildChangeReport({
      raw_input: rawInput,
      crs: input.crs,
      memory_objects: input.memory_objects,
      baseline: input.baseline,
      care_recipient_label: input.care_recipient_label,
      care_recipient_id: input.care_recipient_id,
    });
  }

  // 3. Format clinician brief when doctor appointment detected
  let clinicianBrief: ClinicianBrief | null = null;
  if (moments.primary?.moment === "doctor_appointment" && changeReport) {
    clinicianBrief = formatClinicianBrief(changeReport);
  }

  // 4. Build care brief for knowledge transfer
  let careBrief: CareBrief | null = null;
  const primaryMoment = moments.primary?.moment;

  if (primaryMoment === "new_caregiver" || primaryMoment === "hospital_discharge") {
    const scenario: CareBriefScenario =
      primaryMoment === "new_caregiver" ? "new_caregiver" : "hospital_discharge";

    careBrief = buildCareBriefForScenario({
      care_recipient_label: input.care_recipient_label,
      recent_changes: input.what_changed ?? (changeReport?.what_changed ?? []),
      baseline_info: changeReport?.prior_baseline ?? [],
      history_items: changeReport?.related_history ?? [],
      open_uncertainties: input.open_uncertainties ?? changeReport?.open_uncertainties ?? [],
      what_matters_now: changeReport?.what_to_watch_for ?? [],
      what_can_wait: [],
      routines_preferences: [],
      medical_context: changeReport?.possible_context
        .filter((c) => /medical|medication/i.test(c.related_to))
        .map((c) => c.related_to) ?? [],
      safety_info: changeReport?.decision_context ?? [],
      questions_for_clinician: changeReport?.questions_for_clinician ?? [],
      what_to_watch: changeReport?.what_to_watch_for ?? [],
      for_caregivers: changeReport?.information_for_caregivers,
      source_report: changeReport,
    }, scenario);
  }

  return {
    moments,
    change_report: changeReport,
    clinician_brief: clinicianBrief,
    care_brief: careBrief,
  };
}

// ─── Final Output Enrichment ────────────────────────────────────────────

/**
 * Enrich a FinalOutputContract with dementia wedge context.
 *
 * Adds change report awareness to what_is_happening and what_matters_now.
 */
export function enrichFinalOutputWithDementiaContext(
  output: FinalOutputContract,
  wedgeResult: DementiaWedgeResult,
): FinalOutputContract {
  if (!wedgeResult.moments.has_moment) return output;

  const report = wedgeResult.change_report;
  const primary = wedgeResult.moments.primary;

  if (!report || !primary) return output;

  // Enrich what_is_happening with change report context
  let enrichedHappening = output.what_is_happening;
  if (primary.moment === "new_behavior_change" && report.what_changed.length > 0) {
    const changes = report.what_changed.slice(0, 2).join("; ");
    if (!enrichedHappening.toLowerCase().includes(changes.toLowerCase().slice(0, 30))) {
      enrichedHappening = `${changes}. ${enrichedHappening}`;
    }
  }

  // Enrich what_matters_now with recurrence awareness
  let enrichedMatters = output.what_matters_now;
  if (report.is_recurring_pattern && !enrichedMatters.toLowerCase().includes("recurring") && !enrichedMatters.toLowerCase().includes("pattern")) {
    const recurrenceNote = `This pattern has occurred before (${report.recurrence_count}×) — context is available in the care record.`;
    enrichedMatters = enrichedMatters
      ? `${recurrenceNote} ${enrichedMatters}`
      : recurrenceNote;
  }

  return {
    ...output,
    what_is_happening: enrichedHappening,
    what_matters_now: enrichedMatters,
  };
}

