/**
 * Continuity Detection — determines whether an incoming caregiver interaction
 * is a new user, a returning user, or a continuation of an existing care reality.
 *
 * This module answers the core product questions:
 * 1. Is this a new caregiver?
 * 2. Is this an existing caregiver returning?
 * 3. Who is the person being cared for?
 * 4. What previous care reality already exists?
 * 5. How does this new input change what we know?
 *
 * Flow:
 *   Incoming input + caregiver_id + care_recipient_id
 *     → loadCareContextForIdentity (from care-identity.ts)
 *     → detectContinuityType
 *     → compareInputToCareReality
 *     → ContinuityDecision
 */

import {
  type CareIdentityRecord,
  type ContinuityContext,
  type ContinuityType,
  getCareIdentity,
  listCareIdentitiesForCaregiver,
  loadCareContextForIdentity,
} from "./care-identity";
import { resolveCareRealityStoreKey } from "../multi-caregiver-context-model";
import { getCareRealityState } from "../care-reality-state";
import { listCareRealityMemory } from "../care-reality-intelligence/care-reality-memory";

// ─── Types ────────────────────────────────────────────────────────────────

/**
 * Describes how the new input relates to the existing Care Reality.
 */
export type InputRelation = {
  /** Whether the input is about the same care recipient. */
  same_recipient: boolean;
  /** Whether the input introduces new information vs continues existing. */
  is_new_information: boolean;
  /** Whether the input contains continuation signals (e.g., "still", "again", "worse"). */
  is_continuation: boolean;
  /** Whether the input describes a change from previous state. */
  describes_change: boolean;
  /** Whether the input contains a correction to prior understanding. */
  is_correction: boolean;
  /** Whether the input is purely emotional/load (no new care facts). */
  is_emotional_only: boolean;
  /** Whether the input is a question about care. */
  is_question: boolean;
};

export type CareRealityDiff = {
  /** Facts the new input confirms (already held). */
  confirmed: string[];
  /** Facts the new input adds (not previously held). */
  added: string[];
  /** Facts the new input contradicts or corrects. */
  contradicted: string[];
  /** Facts the new input changes (modifies prior understanding). */
  changed: string[];
  /** Open questions that remain after processing this input. */
  remaining_unknowns: string[];
  /** New questions raised by this input. */
  new_unknowns: string[];
};

export type ContinuityDecision = {
  continuity_type: ContinuityType;
  identity: CareIdentityRecord | null;
  input_relation: InputRelation;
  care_reality_diff: CareRealityDiff;
  can_orient: boolean;
  /** Context loaded from prior sessions (for returning users). */
  context: ContinuityContext;
  /** Whether the system should greet as new or acknowledge return. */
  should_acknowledge_return: boolean;
  /** Whether the system should set expectations for a new user. */
  should_orient_new_user: boolean;
};

// ─── Continuity Detection ────────────────────────────────────────────────

/**
 * Detect the relation between incoming raw text and existing Care Reality.
 */
export function detectInputRelation(params: {
  rawText: string;
  careRecipientId: string;
  context: ContinuityContext;
}): InputRelation {
  const text = params.rawText.toLowerCase().trim();
  const ctx = params.context;

  // Check if input is emotional/load only
  const isEmotionalOnly =
    /^(i feel|i'm (just )?(trying|drowning|exhausted|overwhelmed|burned out|worried|scared|nervous|tired)|i don'?t know how|everything is on me)/i.test(
      text,
    ) && !/\b(?:mom|dad|mother|father|she|he|they|her|him)\b/i.test(text);

  // Check if input is a question
  const isQuestion = /\?$/.test(text) || /^(what|when|where|why|how|who|is|are|can|should|would|could)/i.test(text) && !isEmotionalOnly;

  // Check for continuation signals
  const continuationSignals = [
    /\b(still|again|another|continues|ongoing|recurring|same|worse|better|more|less)\b/i.test(text),
    /\b(her|his|she|he|they)\b/i.test(text) && /\b(still|again|worse|better|same)\b/i.test(text),
    /\b(as usual|as before|like last|since the|from before)\b/i.test(text),
  ].filter(Boolean).length > 0;

  // Check for change signals
  const changeSignals = [
    /\b(changed|change|different|started|stopped|began|became|turned|got|become)\b/i.test(text),
    /\b(more|less|worse|better|increased|decreased|improved|declined)\b/i.test(text) &&
      /\b(than|since|after|from|now)\b/i.test(text),
    /\b(now|today|yesterday|last night|this morning|recently|lately)\b/i.test(text),
  ].filter(Boolean).length > 0;

  // Check for correction signals
  const isCorrection =
    /\b(actually|correction|i meant|not what i said|that'?s not right|wrong|mistake|correct(?:ion)?|update)\b/i.test(
      text,
    );

  // Check if same recipient (based on kinship cues or name)
  const sameRecipient =
    ctx.prior_events_exist &&
    (/\b(she|he|her|him|they)\b/i.test(text) ||
      (ctx.identity?.display_name &&
        new RegExp(ctx.identity.display_name, "i").test(text)) ||
      /\b(mom|dad|mother|father|grandma|grandpa)\b/i.test(text));

  // New information: doesn't match existing facts about this recipient
  const isNewInformation =
    !isEmotionalOnly &&
    !isQuestion &&
    !continuationSignals &&
    (changeSignals || ctx.prior_events_exist === false);

  return {
    same_recipient: sameRecipient,
    is_new_information: isNewInformation,
    is_continuation: continuationSignals,
    describes_change: changeSignals,
    is_correction: isCorrection,
    is_emotional_only: isEmotionalOnly,
    is_question: isQuestion,
  };
}

/**
 * Compare incoming input against the existing Care Reality state.
 * Structured diff: what is confirmed, added, contradicted, changed.
 */
export function compareInputToCareReality(params: {
  rawText: string;
  careRecipientId: string;
}): CareRealityDiff {
  const careRecipientId = resolveCareRealityStoreKey(params.careRecipientId);
  const crs = getCareRealityState(careRecipientId);
  const memoryObjects = listCareRealityMemory(careRecipientId);
  const text = params.rawText.toLowerCase();

  const confirmed: string[] = [];
  const added: string[] = [];
  const contradicted: string[] = [];
  const changed: string[] = [];
  const remaining_unknowns: string[] = [];
  const new_unknowns: string[] = [];

  // Extract domain signals from the current input
  const inputDomains: string[] = [];
  if (/\b(?:fall|fell|fallen|mobility|walk|unsteady|balance)\b/i.test(text))
    inputDomains.push("mobility");
  if (/\b(?:medication|medicine|dose|dosage|prescri)\b/i.test(text))
    inputDomains.push("medication");
  if (/\b(?:sleep|tired|fatigue|nap|rest)\b/i.test(text))
    inputDomains.push("sleep");
  if (/\b(?:eat|eating|appetite|food|meal|drink)\b/i.test(text))
    inputDomains.push("nutrition");
  if (/\b(?:confus|memory|forget|cognitive|dementia)\b/i.test(text))
    inputDomains.push("cognition");
  if (/\b(?:hospital|discharg|doctor|appointment|surgery)\b/i.test(text))
    inputDomains.push("medical");
  if (/\b(?:behavior|agitat|aggress|wander|mood)\b/i.test(text))
    inputDomains.push("behavior");

  // Compare with existing memory objects
  for (const obj of memoryObjects) {
    const objDomains = obj.reality_signature.filter((s) =>
      s.startsWith("domain:"),
    );
    const domainOverlap = inputDomains.some((d) =>
      objDomains.includes(`domain:${d}`),
    );

    if (!domainOverlap) continue;

    const description = obj.description.toLowerCase();

    // Check for contradiction
    if (
      /\b(?:no|not|never|wasn'?t|didn'?t|doesn'?t)\b/.test(text) &&
      description.includes(text.split(/\b(?:no|not|never)\b/).pop()?.trim() ?? "")
    ) {
      contradicted.push(obj.description);
      changed.push(obj.description);
      continue;
    }

    // Check for confirmation
    const sharedTokens = text
      .split(/\s+/)
      .filter((t) => t.length > 3)
      .filter((t) => description.includes(t));
    if (sharedTokens.length >= 2) {
      confirmed.push(obj.description);
    }
  }

  // Remaining unknowns from CRS
  const crsOpen = crs?.open_uncertainties ?? [];
  for (const u of crsOpen) {
    const uLower = u.toLowerCase();
    const resolved = text.includes(uLower.slice(0, 24));
    if (!resolved) {
      remaining_unknowns.push(u);
    }
  }

  // New unknowns from new input
  if (/\b(?:not sure|don'?t know|unclear|uncertain|whether|wonder(?:ing)?)\b/i.test(text)) {
    const questionMatch = text.match(
      /(?:whether|if|not sure|unclear|unknown)\s+(.+?)(?:[.?!]|$)/i,
    );
    if (questionMatch) {
      new_unknowns.push(questionMatch[1].trim());
    } else {
      new_unknowns.push("The caregiver expressed uncertainty about the current situation.");
    }
  }

  // If no existing memory, everything is new
  if (memoryObjects.length === 0 && params.rawText.trim().length >= 12) {
    added.push(params.rawText.trim().slice(0, 200));
  }

  return {
    confirmed: [...new Set(confirmed)].slice(0, 4),
    added: [...new Set(added)].slice(0, 4),
    contradicted: [...new Set(contradicted)].slice(0, 3),
    changed: [...new Set(changed)].slice(0, 3),
    remaining_unknowns: [...new Set(remaining_unknowns)].slice(0, 4),
    new_unknowns: [...new Set(new_unknowns)].slice(0, 3),
  };
}

/**
 * Build a complete ContinuityDecision for an incoming caregiver interaction.
 *
 * This is the primary entry point for the pipeline.
 * It answers all 5 core questions before any response is generated.
 */
export function detectContinuity(params: {
  caregiverId: string;
  careRecipientId: string;
  rawText?: string;
}): ContinuityDecision {
  const { caregiverId, careRecipientId } = params;
  const rawText = (params.rawText ?? "").trim();

  // Step 1: Load continuity context (identity, CRS, prior state)
  const context = loadCareContextForIdentity({
    caregiverId,
    careRecipientId,
  });

  // Step 2: Detect input relation to existing reality
  const inputRelation = rawText
    ? detectInputRelation({ rawText, careRecipientId, context })
    : {
        same_recipient: context.prior_events_exist,
        is_new_information: false,
        is_continuation: false,
        describes_change: false,
        is_correction: false,
        is_emotional_only: false,
        is_question: true,
      };

  // Step 3: Compare against existing Care Reality
  const careRealityDiff = rawText
    ? compareInputToCareReality({ rawText, careRecipientId })
    : {
        confirmed: [],
        added: [],
        contradicted: [],
        changed: [],
        remaining_unknowns: context.open_uncertainties,
        new_unknowns: [],
      };

  // Step 4: Determine if we can orient based on prior context
  const canOrient =
    context.prior_events_exist ||
    context.prior_observations_exist ||
    context.open_uncertainties.length > 0;

  // Step 5: Determine greeting/acknowledgment approach
  const shouldAcknowledgeReturn =
    context.continuity_type === "returning" ||
    context.continuity_type === "continuation";

  const shouldOrientNewUser =
    context.continuity_type === "new_caregiver" ||
    context.continuity_type === "new_care_recipient";

  return {
    continuity_type: context.continuity_type,
    identity: context.identity,
    input_relation: inputRelation,
    care_reality_diff: careRealityDiff,
    can_orient: canOrient,
    context,
    should_acknowledge_return: shouldAcknowledgeReturn,
    should_orient_new_user: shouldOrientNewUser,
  };
}

