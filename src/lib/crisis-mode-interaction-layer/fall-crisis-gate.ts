/**
 * Fall → crisis only with immediacy or severity.
 * Bare "fall" / past fall + care already sought = continuity capture, not crisis mode.
 */

import {
  isImmediateDangerLanguage,
  isRetrospectiveCareReport,
} from "../mvp-input-architecture";

const FALL_MENTION = /\b(fell|fall|fallen|falling)\b/i;

/** Severity markers that make a fall report crisis-worthy. */
export const FALL_CRISIS_SEVERITY_PATTERNS = [
  /\bhit (?:her|his|their|the) head\b/i,
  /\bhead (?:injury|trauma)\b/i,
  /\bbleed(?:ing|s)?\b/i,
  /\bunconscious\b/i,
  /\bpassed out\b/i,
  /\bcan(?:not|'t) get up\b/i,
  /\bstill on the (?:floor|ground)\b/i,
  /\b(?:broke|broken|fracture)\b/i,
  /\bwon'?t wake\b/i,
  /\bnot responding\b/i,
] as const;

/** Immediacy markers — happening now / just happened. */
export const FALL_CRISIS_IMMEDIACY_PATTERNS = [
  /\bjust fell\b/i,
  /\bfell (?:just )?now\b/i,
  /\bright now\b/i,
  /\bmoments? ago\b/i,
  /\ba few (?:seconds|minutes) ago\b/i,
  /\bstill on the (?:floor|ground)\b/i,
  /\bcurrently (?:on|lying) (?:the )?(?:floor|ground)\b/i,
  /\bneed(?:s)? help (?:getting )?up\b/i,
] as const;

export function mentionsFall(text: string): boolean {
  return FALL_MENTION.test(text);
}

export function hasFallCrisisSeverity(text: string): boolean {
  return FALL_CRISIS_SEVERITY_PATTERNS.some((p) => p.test(text));
}

export function hasFallCrisisImmediacy(text: string): boolean {
  return FALL_CRISIS_IMMEDIACY_PATTERNS.some((p) => p.test(text));
}

/**
 * True only when fall + (immediacy OR severity), and not a retrospective
 * continuity report unless explicit immediate-danger language is present.
 */
export function isAcuteCrisisFall(text: string): boolean {
  if (!mentionsFall(text)) return false;
  if (isRetrospectiveCareReport(text) && !isImmediateDangerLanguage(text)) {
    return false;
  }
  return hasFallCrisisSeverity(text) || hasFallCrisisImmediacy(text);
}
