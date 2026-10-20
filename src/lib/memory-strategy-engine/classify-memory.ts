import {
  LONG_LIVED_PATTERNS,
  PERMANENT_PATTERNS,
  SESSION_PATTERNS,
  SHORT_LIVED_PATTERNS,
} from "./contract-constants";
import type { CanonicalCareEvent } from "../situation-entry/types";
import type { MemoryTier } from "./types";

export function classifyEventMemoryTier(event: CanonicalCareEvent): MemoryTier {
  const text = `${event.raw_input} ${event.extracted_type} ${event.attributes.source_situation_text ?? ""}`;

  if (event.status === "unparsed_raw") {
    return "session";
  }
  if (SESSION_PATTERNS.some((p) => p.test(text))) return "session";
  if (PERMANENT_PATTERNS.some((p) => p.test(text))) return "permanent";
  if (LONG_LIVED_PATTERNS.some((p) => p.test(text))) return "long_lived";
  if (SHORT_LIVED_PATTERNS.some((p) => p.test(text))) return "short_lived";
  if (event.extracted_type === "document_fact") return "long_lived";
  if (event.extracted_type === "incident" || event.extracted_type === "behavioral_change") {
    return "short_lived";
  }
  return "short_lived";
}

export function memoryLabel(event: CanonicalCareEvent): string {
  const snippet = event.attributes.source_situation_text;
  if (typeof snippet === "string" && snippet.length > 0) {
    return snippet.slice(0, 120);
  }
  return event.raw_input.slice(0, 120);
}

export function tierExpiryDays(tier: MemoryTier): number | null {
  if (tier === "permanent") return null;
  if (tier === "long_lived") return 180;
  if (tier === "short_lived") return 30;
  return 1;
}

export function whyRemembered(tier: MemoryTier, label: string): string {
  if (tier === "permanent") return `Foundation fact for care journey reasoning: ${label.slice(0, 60)}`;
  if (tier === "long_lived") return `Long-lived context — may change over weeks/months: ${label.slice(0, 60)}`;
  if (tier === "short_lived") return `Current care journey signal — relevance decays unless reinforced`;
  return `Session-only working context — not persisted unless promoted`;
}

export function whatWouldInvalidate(tier: MemoryTier): string {
  if (tier === "permanent") return "Explicit caregiver or document confirmation of change";
  if (tier === "long_lived") return "Observed change, contradiction, or prolonged silence without confirmation";
  if (tier === "short_lived") return "Recovery, resolution, or superseding CareEvent";
  return "End of session or successful promotion to higher tier";
}
