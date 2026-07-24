/**
 * Care Recipient Anchor — center of gravity for every interaction.
 * Processing order: recipient → changes → events → decisions → outcomes → unknowns → contributor context.
 *
 * SoT: docs/02-product/solenos-care-recipient-anchor.md
 * Identity naming Locked A: never silently write Mom/Dad into durable identity from notes.
 */

import type { ActiveCareSituation } from "../active-care-situation/types";
import { getCareRecipientDisplayName } from "../care-recipient-identity";
import {
  extractCareRealityFromText,
  type CareRealityExtractionResult,
} from "../care-reality-extraction";
import { classifyExtractionFragment } from "../care-reality-extraction/classify";
import { observationCareFact } from "../care-epistemics";
import { resolveCareRealityStoreKey } from "../multi-caregiver-context-model";

export const CARE_RECIPIENT_ANCHOR_PURPOSE =
  "Anchor every interaction on the person receiving care — contributors are context, never the subject.";

/** Non-negotiable processing order after the anchor is resolved. */
export const CARE_REALITY_PROCESSING_ORDER = [
  "care_recipient",
  "current_state_changes",
  "care_events",
  "care_decisions",
  "outcomes",
  "unknowns",
  "caregiver_context",
] as const;

export type CareRecipientAnchor = {
  /** Held display / ACS subject — null when unknown (do not guess). */
  care_recipient: string | null;
  /** True when we must ask who this is about. */
  needs_identity_ask: boolean;
  identity_ask: string;
  /** Contributor who provided this capture. */
  contributor_id: string;
  /** Recipient-centered changes (not family dispute). */
  recipient_changes: string[];
  /** Journey events about the recipient. */
  related_events: string[];
  /** Decisions about the recipient's care. */
  related_decisions: string[];
  /** Open unknowns about the recipient. */
  unknowns: string[];
  /** Family / load / disagreement — context only. */
  contributor_context: string[];
  /** Extraction used for this turn (if any). */
  extraction: CareRealityExtractionResult | null;
  /** Engine note: anchor is ready for situation modeling. */
  anchored: boolean;
};

const GENERIC_SUBJECTS = new Set([
  "they",
  "your loved one",
  "the patient",
  "the subject",
  "person",
  "",
]);

function isKnownRecipientLabel(label: string | null | undefined): boolean {
  if (!label) return false;
  return !GENERIC_SUBJECTS.has(label.trim().toLowerCase());
}

/**
 * Soft identity ask — Locked A natural language; never a form wall.
 */
export function composeCareRecipientIdentityAsk(): string {
  return "Who is this situation about?";
}

/**
 * Session-only kinship cue from capture text.
 * Never writes durable identity (Locked A) — orientation only so we do not ask
 * "Who is this situation about?" when the note already names Mom/Dad/etc.
 */
export function detectSessionKinshipCue(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  if (/\b(?:my\s+)?(?:mom|mum|mother)\b/i.test(t)) return "Mom";
  if (/\b(?:my\s+)?(?:dad|father)\b/i.test(t)) return "Dad";
  if (/\b(?:my\s+)?(?:grandma|grandmother)\b/i.test(t)) return "Grandma";
  if (/\b(?:my\s+)?(?:grandpa|grandfather)\b/i.test(t)) return "Grandpa";
  return null;
}

/**
 * Soft confirm when kinship is present but durable name has not been asked yet.
 * Prefer this over blank "Who is this?" when the note already anchors the person.
 */
export function composeSessionKinshipConfirmAsk(kinshipLabel: string): string {
  return `Is ${kinshipLabel} the name you use for the person this care story is about?`;
}

/**
 * Build Care Recipient Anchor before situation modeling or response language.
 * Does not write durable identity from note kinship terms (Locked A).
 */
export function buildCareRecipientAnchor(params: {
  situation: ActiveCareSituation;
  latestRawText?: string;
  careKey?: string;
}): CareRecipientAnchor {
  const { situation } = params;
  const rawKey =
    params.careKey ?? situation.care_recipient_id ?? situation.caregiver_id;
  const careKey = resolveCareRealityStoreKey(rawKey);
  // Lookup by minted Care Reality id and raw contributor id (identity may be set either way).
  const durable =
    getCareRecipientDisplayName(careKey) ??
    (rawKey !== careKey ? getCareRecipientDisplayName(rawKey) : null) ??
    (situation.caregiver_id &&
    situation.caregiver_id !== careKey &&
    situation.caregiver_id !== rawKey
      ? getCareRecipientDisplayName(situation.caregiver_id)
      : null);
  const fromAcs = situation.subject_label?.trim() ?? null;
  const latest = params.latestRawText?.trim() ?? "";
  const sessionKinship = detectSessionKinshipCue(latest);

  const care_recipient = isKnownRecipientLabel(durable)
    ? durable
    : isKnownRecipientLabel(fromAcs)
      ? fromAcs
      : sessionKinship;

  // Blank-slate ask only when no durable, ACS, or session kinship cue.
  const needs_identity_ask = !care_recipient;
  const identity_ask = needs_identity_ask
    ? composeCareRecipientIdentityAsk()
    : !isKnownRecipientLabel(durable) && sessionKinship
      ? composeSessionKinshipConfirmAsk(sessionKinship)
      : composeCareRecipientIdentityAsk();

  const extraction =
    latest.length >= 40
      ? extractCareRealityFromText({
          rawText: latest,
          contributorId: situation.caregiver_id,
        })
      : null;

  const recipient_changes: string[] = [];
  const related_events: string[] = [];
  const related_decisions: string[] = [];
  const unknowns: string[] = [];
  const contributor_context: string[] = [];

  if (extraction) {
    for (const o of extraction.observations) {
      recipient_changes.push(
        o.description.endsWith(".") ? o.description : `${o.description}.`,
      );
    }
    for (const e of extraction.events) {
      related_events.push(e.description);
    }
    for (const d of extraction.decisions) {
      related_decisions.push(d.description);
    }
    for (const u of extraction.unknowns) {
      if (u.status === "open") unknowns.push(u.question);
    }
    for (const n of extraction.non_care_facts) {
      contributor_context.push(n.text);
    }
  }

  // Held ACS observations — recipient-centered only
  for (const o of [...situation.observations].reverse()) {
    const fact = observationCareFact({
      human_fact: o.human_fact,
      raw_text: o.raw_text,
    });
    if (!fact) continue;
    const cat = classifyExtractionFragment(fact);
    if (cat === "contributor_load" || cat === "disagreement_perspective") {
      if (!contributor_context.some((c) => c.includes(fact.slice(0, 40)))) {
        contributor_context.push(fact);
      }
      continue;
    }
    if (cat === "observation" || cat === "event" || cat === "decision") {
      const line = fact.endsWith(".") ? fact : `${fact}.`;
      if (
        cat === "observation" &&
        !recipient_changes.some((x) => x.toLowerCase().includes(fact.toLowerCase().slice(0, 36)))
      ) {
        recipient_changes.push(line);
      }
    }
    if (recipient_changes.length >= 6) break;
  }

  return {
    care_recipient,
    needs_identity_ask,
    identity_ask,
    contributor_id: situation.caregiver_id,
    recipient_changes: recipient_changes.slice(0, 6),
    related_events: related_events.slice(0, 4),
    related_decisions: related_decisions.slice(0, 4),
    unknowns: unknowns.slice(0, 4),
    contributor_context: contributor_context.slice(0, 4),
    extraction,
    anchored: Boolean(care_recipient) || recipient_changes.length > 0 || related_events.length > 0,
  };
}

/**
 * Orientation centered on the care recipient — never takes sides in family disagreement.
 */
export function orientationFromCareRecipientAnchor(anchor: CareRecipientAnchor): {
  current_understanding: string | null;
  related_context: string | null;
  still_unclear: string[];
  identity_ask: string | null;
} {
  if (anchor.needs_identity_ask) {
    return {
      current_understanding: null,
      related_context: null,
      still_unclear: [],
      identity_ask: anchor.identity_ask,
    };
  }

  const who = anchor.care_recipient!;
  let current_understanding: string | null = null;
  if (anchor.recipient_changes.length > 0) {
    const bits = anchor.recipient_changes.slice(0, 2).map((c) => c.replace(/\.$/, ""));
    current_understanding = `Recent changes in ${who}'s care reality are held — ${bits.join("; ")}.`;
  } else if (anchor.related_events.length > 0) {
    current_understanding = `A care journey moment for ${who} is held: ${anchor.related_events[0]!.replace(/\.$/, "")}.`;
  } else if (anchor.related_decisions.length > 0) {
    current_understanding = `A care choice about ${who} is held: ${anchor.related_decisions[0]!.replace(/\.$/, "")}.`;
  }

  let related_context: string | null = null;
  if (anchor.contributor_context.length > 0) {
    related_context =
      "Different people may see the situation differently depending on how often they are present — held as context, not as the main concern.";
  }

  return {
    current_understanding,
    related_context,
    still_unclear: anchor.unknowns.slice(0, 2),
    identity_ask: null,
  };
}

/**
 * True when caregiver-facing text wrongly centers family disagreement over the recipient.
 */
export function centersContributorConflictOverRecipient(params: {
  blob: string;
  careRecipient: string | null;
  hasRecipientChanges: boolean;
}): boolean {
  if (!params.hasRecipientChanges) return false;
  const b = params.blob.toLowerCase();
  // Explicitly holding family as context is correct — not centering conflict
  if (
    /\b(?:held as context|not as the main (?:care )?situation|not as the main concern)\b/i.test(
      b,
    ) &&
    !/\bthe (?:main|biggest) (?:issue|problem|concern) is (?:your )?(?:brother|sister|family)\b/i.test(
      b,
    )
  ) {
    return false;
  }
  const conflictFocus =
    /\b(?:brother|sister|sibling)\b/i.test(b) &&
    /\b(?:worrying too much|overreact|doesn't understand|not understand|disagreement)\b/i.test(b);
  if (!conflictFocus) return false;
  const who = params.careRecipient?.toLowerCase();
  if (who && b.includes(who.toLowerCase())) {
    // Mentions recipient AND conflict — OK if recipient appears first or as subject
    const recipIdx = b.indexOf(who);
    const brotherIdx = b.search(/\bbrother|sister|sibling\b/);
    if (recipIdx >= 0 && (brotherIdx < 0 || recipIdx < brotherIdx)) return false;
  }
  return true;
}
