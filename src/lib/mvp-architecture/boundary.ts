/**
 * Executable MVP architecture boundary — caregiver product vs ops analyze path.
 *
 * Caregiver MVP entry is POST /api/situation (Living Care Record).
 * /api/analyze remains an ops/engine transformation path — hard-gated for caregivers.
 */

import {
  CANONICAL_ARCHITECTURE_FLOW,
  CANONICAL_VALIDATION_PIPELINE,
} from "../canonical-architecture";

/** Caregiver Living Care Record path — constitution product surface. */
export const CAREGIVER_MVP_API_ROUTES = ["/api/situation"] as const;

/**
 * Legacy analyze-surface allowlist used by verify-mvp-architecture (ops compression path).
 * Not the caregiver product entry.
 */
export const MVP_ALLOWED_API_ROUTES = [
  "/api/extract",
  "/api/share-intake",
  "/api/situation",
  "/api/analyze",
  "/api/track",
  // Caregiver feedback about the response they just received. Both are called
  // from the mounted workspace, so a response the caregiver can correct is
  // part of the caregiver surface, not an extension of it.
  "/api/feedback",
  "/api/research-feedback",
  // The language the caregiver reads and speaks. Storing it is part of being
  // able to talk to them at all, not an extension of the surface.
  "/api/user/language",
  // Care Attention Layer - helps caregivers determine what deserves their attention
  "/api/care-attention",
  // Open Loop Management - tracks unresolved items requiring attention
  "/api/open-loops",
  "/api/open-loops/[id]",
  // Care Events - individual observations/actions that inform care understanding
  "/api/care-events/[id]",
  // Attention Summary - provides summary of attention items for dashboards and notifications
  "/api/attention-summary",
] as const;

export const MVP_ALLOWED_FRONTEND_PAGES = [
  "src/app/page.tsx",
  "src/app/about/page.tsx",
  "src/app/capabilities/page.tsx",
  "src/app/contact/page.tsx",
  "src/app/early-access/page.tsx",
  "src/app/help/page.tsx",
  "src/app/how-it-works/page.tsx",
  "src/app/metrics/page.tsx",
  "src/app/mission/page.tsx",
  "src/app/ops/page.tsx",
  "src/app/ops/clarity/page.tsx",
  "src/app/ops/devtools/page.tsx",
  "src/app/our-story/page.tsx",
  "src/app/privacy/page.tsx",
  "src/app/settings/page.tsx",
  "src/app/share/page.tsx",
  "src/app/start/page.tsx",
  "src/app/support/page.tsx",
  "src/app/terms/page.tsx",
  "src/app/welcome/page.tsx",
  "src/app/why-solenos/page.tsx",
  "src/app/workspace/layout.tsx",
  "src/app/workspace/page.tsx",
  "src/app/workspace/documents/page.tsx",
  "src/app/workspace/settings/page.tsx",
  "src/app/workspace/timeline/page.tsx",
  // Care Attention Layer UI
  "src/app/care-attention/page.tsx",
] as const;

export const MVP_ALLOWED_FRONTEND_SHELL = [
  "src/app/layout.tsx",
  "src/app/globals.css",
  "src/app/icon.tsx",
  "src/app/opengraph-image.tsx",
  "src/app/global-error.tsx",
] as const;

export const MVP_LLM = "gemini-1.5-pro" as const;

export const MVP_MAX_LLM_CALLS = 3;

export const MVP_MAX_RETRIES = 2;

export const MVP_LATENCY_BUDGET_MS = 10_000;

export const MVP_GEMINI_KEY_ROUTE = "src/app/api/analyze/route.ts";

export const MVP_LAYERS = [
  "input",
  "transformation",
  "structural_validation",
  "cognitive_validation",
] as const;

export const MVP_FORBIDDEN_IN_ANALYZE = [
  "store",
  "executeTurn",
  "runPipeline",
  "AgentExecutor",
  "redis",
  "queue",
  "orchestr",
  "createSession",
  "session_id",
  "onboarding",
  "prisma",
  "drizzle",
  "personalization",
  "care_journey",
] as const;

/** Telemetry drift — forbidden product surfaces even with Postgres enabled. */
export const MVP_TELEMETRY_FORBIDDEN_SURFACE = [
  "dashboard",
  "history",
  "timeline",
  "user_profile",
  "patient",
  "crm",
  "care_journey",
  "personalization",
  "onboarding",
  "session_state",
] as const;

/** Episodic product — forbidden retention/engagement surface in MVP UI/API. */
export const MVP_EPISODIC_FORBIDDEN_SURFACE = [
  "dashboard",
  "onboarding",
  "gamification",
  "habit",
  "retention",
  "notification",
  "workflow",
  "task-manager",
  "multi-session",
] as const;

export const MVP_VALID_CHANGE_AXES = [
  "speed",
  "stability",
  "cost_efficiency",
  "simplicity",
] as const;

/** Runtime validation stages — maps to CANONICAL_VALIDATION_PIPELINE. */
export const MVP_VALIDATION_PIPELINE = CANONICAL_VALIDATION_PIPELINE;

/** Full linear architecture — no branching. */
export const MVP_FLOW = CANONICAL_ARCHITECTURE_FLOW;