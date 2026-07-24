/**
 * Living Care Record regression guards — used by verify scripts so happy-path
 * ACS/LCR checks cannot greenlight a caregiver dump regression.
 */

import {
  CAREGIVER_RESPONSE_BANNED_TOKENS,
  caregiverLineContainsBannedToken,
} from "../situation-entry/caregiver-facing-uncertainty";
import { LIVING_CARE_RECORD_FORBIDDEN_UI_TERMS } from "./contract-constants";

/** Schema / engine tokens banned on continuity_home and other caregiver DTOs. */
export const CONTINUITY_HOME_BANNED_SCHEMA_TOKENS = [
  ...CAREGIVER_RESPONSE_BANNED_TOKENS,
  ...LIVING_CARE_RECORD_FORBIDDEN_UI_TERMS,
  "extracted_type",
  "document_fact",
  "behavioral_change",
  " — entity",
  "— entity",
  "careevent",
  "care event id",
  "parser_output",
  "confidence%",
  "confidence %",
  "why this was concluded",
  "reasoning_chain",
  "system_layers",
  "runtime arbitration",
  "prioritization_engine",
] as const;

export function collectCaregiverDtoStrings(value: unknown, out: string[] = []): string[] {
  if (value == null) return out;
  if (typeof value === "string") {
    out.push(value);
    return out;
  }
  if (typeof value === "number" || typeof value === "boolean") return out;
  if (Array.isArray(value)) {
    for (const item of value) collectCaregiverDtoStrings(item, out);
    return out;
  }
  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      // Skip opaque ids / timestamps — still scan string labels under those keys.
      if (key === "id" || key === "event_ids" || key.endsWith("_id") || key === "timestamp") {
        if (typeof child === "string" && !/^[a-z0-9_:-]+$/i.test(child)) {
          out.push(child);
        } else if (Array.isArray(child)) {
          for (const item of child) {
            if (typeof item === "string" && !/^[a-z0-9_:-]+$/i.test(item)) out.push(item);
          }
        }
        continue;
      }
      collectCaregiverDtoStrings(child, out);
    }
  }
  return out;
}

export function findBannedTokenInText(
  text: string,
  tokens: readonly string[] = CONTINUITY_HOME_BANNED_SCHEMA_TOKENS,
): string | null {
  const lower = text.toLowerCase();
  for (const token of tokens) {
    if (lower.includes(token.toLowerCase())) return token;
  }
  if (/%\s*$/.test(text.trim()) || /\b\d{1,3}\s*%/.test(text)) {
    if (/confidence|certainty|score|risk/i.test(text)) return "percent confidence/score";
  }
  return null;
}

export function assertCaregiverDtoSanitized(
  value: unknown,
  label: string,
  tokens: readonly string[] = CONTINUITY_HOME_BANNED_SCHEMA_TOKENS,
): void {
  const strings = collectCaregiverDtoStrings(value);
  for (const line of strings) {
    const hit = findBannedTokenInText(line, tokens);
    if (hit) {
      throw new Error(`${label} must not contain banned token "${hit}" (in: ${line.slice(0, 120)})`);
    }
    if (caregiverLineContainsBannedToken(line)) {
      throw new Error(`${label} failed caregiverLineContainsBannedToken (in: ${line.slice(0, 120)})`);
    }
    if (/^(entity|time|severity|consequence)$/i.test(line.trim())) {
      throw new Error(`${label} must not expose bare schema field "${line.trim()}"`);
    }
  }
}

export function assertContinuityHomeSanitized(home: unknown, label = "continuity_home"): void {
  if (home == null) throw new Error(`${label} must be present for sanitizer check`);
  assertCaregiverDtoSanitized(home, label);
  const recent =
    typeof home === "object" && home !== null && "recent_events" in home
      ? (home as { recent_events?: Array<{ label?: string }> }).recent_events ?? []
      : [];
  for (const event of recent) {
    const labelText = event.label ?? "";
    if (/ — /.test(labelText) && /\b(incident|observation|document_fact|entity)\b/i.test(labelText)) {
      throw new Error(`${label} recent event labels must not be schema type — entity`);
    }
  }
}

/** Crisis false-positive fixtures — ordinary continuity must stay calm. */
export const CRISIS_FALSE_POSITIVE_FIXTURES = [
  {
    id: "retrospective_fall_urgent_care",
    raw_input: "Mom fell yesterday. We went to urgent care.",
    note: "past fall + care already sought",
  },
  {
    id: "bare_past_fall",
    raw_input: "She had a fall last week at home.",
    note: "bare past fall",
  },
  {
    id: "soft_help_organize",
    raw_input: "I need help organizing her medication list for the appointment.",
    note: "soft help without acute danger",
  },
  {
    id: "urgent_paperwork",
    raw_input: "This is urgent for tomorrow's appointment paperwork.",
    note: "urgent without acute medical danger",
  },
  {
    id: "worried_is_this_serious",
    raw_input: "I'm worried — is this serious?",
    note: "worry language alone",
  },
  {
    id: "bare_fell_word",
    raw_input: "Mom fell.",
    note: "bare fell without immediacy/severity",
  },
  {
    id: "soft_emotional",
    raw_input: "She's frustrated and sad today.",
    note: "soft emotional observation",
  },
] as const;
