/**
 * SolenOS caregiver Cognitive Workspace — Living Care Record flow only.
 * REAL_MOMENT → CARRYING (LCR). Never CLARITY / engine dump states.
 */

import type { PrioritizationOutput } from "@/lib/prioritization-engine";

/** Caregiver-facing states only — Clarity/Continuity dump path quarantined under /ops. */
export const WORKSPACE_STATES = ["REAL_MOMENT", "CARRYING"] as const;

export type WorkspaceState = (typeof WORKSPACE_STATES)[number];

/** @deprecated Ops-only envelope — not used by caregiver CognitiveWorkspace. */
export type ClarityRiskLevel = "low" | "medium" | "high" | "critical";

/** @deprecated Ops Clarity dump — quarantined under components/ops-clarity. */
export type ClarityEnvelope = {
  what_is_happening: string;
  what_matters_now: string;
  what_to_ask_next: string;
  risk_level: ClarityRiskLevel;
  what_can_wait: string;
  follow_up_items: string[];
  watch_for: string[];
  prioritization: PrioritizationOutput | null;
};

export type AttachedDocument = {
  id: string;
  name: string;
  mimeType: string;
  /** Extracted text when OCR/Tika succeeded; empty if pending/failed. */
  extractedText: string;
  status: "pending" | "ready" | "failed";
  /** Human-readable note when extraction failed. */
  errorNote?: string;
  /** Input Entry Contract method — attribution only; never changes reasoning. */
  entryMethod?: import("@/lib/input-entry-contract").InputEntryMethod;
};

export type ThemeLayout = "black_input" | "white_input";
export type TypographyMode = "serif" | "sans";
export type TextScale = "standard" | "large" | "xl";

export type AccessibilityPrefs = {
  themeLayout: ThemeLayout;
  typography: TypographyMode;
  textScale: TextScale;
};

export const DEFAULT_ACCESSIBILITY: AccessibilityPrefs = {
  themeLayout: "black_input",
  typography: "serif",
  textScale: "standard",
};

export const ACCESSIBILITY_STORAGE_KEY = "solenos_mvp_a11y_prefs";

/** States that must never appear in caregiver CognitiveWorkspace. */
export const OPS_QUARANTINED_WORKSPACE_STATES = ["CLARITY", "CONTINUITY"] as const;
