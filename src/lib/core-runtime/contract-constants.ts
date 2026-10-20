/**
 * SolenOS Core Runtime — orchestration of caregiving reality under uncertainty.
 * Owns Situation as the canonical runtime entity; separates truth layers.
 */

export const CORE_RUNTIME_IDENTITY =
  "a deterministic state-driven caregiving intelligence runtime — lifecycle state machines, uncertainty tracking, and explainable decision execution";

export const CORE_RUNTIME_ONE_LINE_TRUTH =
  "No Situation = no system state. Timeline = WHAT; Decision History = WHY; Missing Info = unknown; Assumptions = believed; Situations = active lifecycle.";

export const CORE_RUNTIME_PIPELINE_STAGES = [
  "input",
  "context",
  "situation_resolver",
  "missing_info",
  "assumptions",
  "memory",
  "emotional",
  "conflict",
  "priority",
  "decision",
  "resolution",
  "decision_history_writer",
  "timeline_writer",
  "system_health_monitor",
  "output",
] as const;

export const CORE_RUNTIME_TRUTH_LAYERS = {
  what: "Timeline — factual event log",
  why: "Decision History — explanation of chosen action",
  unknown: "Missing Information Queue — knowledge gaps",
  believed: "Assumption Registry — temporary beliefs (active|validated≈confirmed)",
  active: "Situation — canonical operational unit (active|resolved|archived)",
} as const;

export const CORE_RUNTIME_FORBIDDEN = [
  "UI-only chat / dashboard / analytics as runtime truth",
  "merging Timeline WHAT with Decision History WHY",
  "resurrecting ARCHIVED situations",
  "high-confidence irreversible decisions while HIGH missing info is open",
  "using Reasoning Snapshots as ranking inputs",
  "using System Health as primary reasoning (monitoring + optional soft autonomy gate only)",
] as const;

/** Documented architecture gaps / reconciliations (do not break existing gates). */
export const CORE_RUNTIME_GAPS = [
  "System Health: monitoring-first; existing soft autonomy gate on Degraded/Unreliable remains in safety/governance — optional soft constraint, not primary reasoning.",
  "UI Situation statuses blocked|waiting are facets of canonical active — Resolution uses ACTIVE|RESOLVED|ARCHIVED.",
  "Assumption status validated maps to external spec synonym confirmed.",
] as const;

/** Canonical runtime Situation status (lowercase) — maps to Resolution ACTIVE|RESOLVED|ARCHIVED. */
export const CANONICAL_SITUATION_STATUSES = [
  "active",
  "resolved",
  "archived",
] as const;

export const CANONICAL_PRIORITIES = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
] as const;
