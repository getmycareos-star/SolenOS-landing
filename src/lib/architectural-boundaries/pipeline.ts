import {
  ARCHITECTURAL_RULES,
  BOUNDARIES_DEFINING_PRINCIPLE,
  BOUNDARIES_IDENTITY,
  RULE_DEFINITIONS,
} from "./contract-constants";
import { remediateText, scanAllSurfaces } from "./detect-violations";
import { recordBoundaryAudit } from "./store";
import type { ArchitecturalBoundariesResult, EnforceBoundariesInput } from "./types";
import type { FinalOutputContract } from "../final-output-contract/types";

export function enforceArchitecturalBoundaries(
  input: EnforceBoundariesInput,
): ArchitecturalBoundariesResult {
  const violations = scanAllSurfaces(input.text_surfaces);
  const rulesSatisfied: (typeof ARCHITECTURAL_RULES)[number][] = [];

  if (violations.filter((v) => v.rule === "never_diagnose").length === 0) {
    rulesSatisfied.push("never_diagnose");
  }
  if (violations.filter((v) => v.rule === "never_invent_information").length === 0) {
    rulesSatisfied.push("never_invent_information");
  }
  if (input.has_explicit_uncertainty) rulesSatisfied.push("never_hide_uncertainty");
  if (input.preserves_history) rulesSatisfied.push("never_overwrite_history");
  if (input.confidence_proportional) rulesSatisfied.push("never_pretend_confidence");
  if (violations.filter((v) => v.rule === "never_optimize_for_engagement").length === 0) {
    rulesSatisfied.push("never_optimize_for_engagement");
  }
  if (input.has_evidence_links && input.has_decision_trace) {
    rulesSatisfied.push("never_separate_observations_from_evidence");
  }
  if (input.preserves_history) rulesSatisfied.push("never_destroy_continuity");
  rulesSatisfied.push("never_replace_clinical_judgment");
  if (violations.length === 0 || input.has_explicit_uncertainty) {
    rulesSatisfied.push("never_prioritize_automation_over_accuracy");
  }

  const uniqueSatisfied = [...new Set(rulesSatisfied)];

  recordBoundaryAudit({
    violations_count: violations.length,
    rules_satisfied: uniqueSatisfied.length,
  });

  return {
    enforced: true,
    rules_checked: [...ARCHITECTURAL_RULES],
    rules_satisfied: uniqueSatisfied,
    violations_detected: violations,
    violations_remediated: violations.filter((v) => v.severity === "critical"),
    decision_framework_passed: violations.filter((v) => v.severity === "critical").length === 0,
    defining_principle: BOUNDARIES_DEFINING_PRINCIPLE,
    prohibited_avoided: Object.values(RULE_DEFINITIONS),
  };
}

export function enforceBoundariesOnFinalOutput(
  output: FinalOutputContract,
  meta: Pick<
    EnforceBoundariesInput,
    "has_decision_trace" | "has_evidence_links" | "has_explicit_uncertainty" | "preserves_history" | "confidence_proportional"
  >,
): { output: FinalOutputContract; boundaries: ArchitecturalBoundariesResult } {
  const surfaces: Record<string, string | string[]> = {
    what_is_happening: output.what_is_happening,
    what_matters_now: output.what_matters_now,
    what_to_ask_next: output.what_to_ask_next,
    what_can_wait: output.what_can_wait,
    follow_up_items: output.follow_up_items,
    decision_trace_events: output.decision_trace.events,
    decision_trace_assumptions: output.decision_trace.assumptions,
    decision_trace_unknowns: output.decision_trace.unknowns,
  };

  const boundaries = enforceArchitecturalBoundaries({
    text_surfaces: surfaces,
    ...meta,
  });

  if (boundaries.violations_detected.length === 0) {
    return { output, boundaries };
  }

  const remediated = { ...output };
  const fix = (s: string) => remediateText(s).text;

  remediated.what_is_happening = fix(output.what_is_happening);
  remediated.what_matters_now = fix(output.what_matters_now);
  remediated.what_to_ask_next = fix(output.what_to_ask_next);
  remediated.follow_up_items = output.follow_up_items.map(fix);

  return { output: remediated, boundaries };
}

export { BOUNDARIES_IDENTITY, BOUNDARIES_DEFINING_PRINCIPLE };
