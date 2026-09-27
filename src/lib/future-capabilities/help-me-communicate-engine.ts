import {
  processCareCommunication,
  type CareCommunicationInput,
  type CareCommunicationResult
} from "./care-communication-support-engine";
import {
  COMMUNICATION_DRAFT_TYPES,
  type CommunicationOutputSection
} from "./care-communication-support";
import { processCareRealityProfile, type CareRealityProfileResult } from "../care-reality-profile-engine";
import type { CanonicalCareEvent } from "../situation-entry/types";

export type HelpMeCommunicateInput = {
  care_recipient_id: string;
  target_audience: "sibling" | "family_group" | "doctor" | "care_transition" | "parent";
  raw_context?: string;
  all_events: CanonicalCareEvent[];
  events_created: CanonicalCareEvent[];
  what_changed?: string[];
  what_is_happening?: string;
  what_is_uncertain?: string[];
  baseline?: any;
  care_reality_profile?: any;
  as_of?: string;
};

export type HelpMeCommunicateResult = {
  active: boolean;
  identity: string;
  audience: string;
  situation_summary: string;
  evidence: Array<{ claim: string; source_type: string; event_ids: string[] }>;
  preparation: string[];
  draft?: string;
  draft_type?: string;
  uncertainties: string[];
  rules_upheld: string[];
};

function buildDraftForAudience(
  input: HelpMeCommunicateInput,
  communication_result: CareCommunicationResult,
  audience: string
): string {
  const { sections, evidence } = communication_result;
  const summary = sections[COMMUNICATION_OUTPUT_SECTIONS.current_situation_summary] || "";
  const prep = sections[COMMUNICATION_OUTPUT_SECTIONS.conversation_preparation] || [];
  
  let draft = `Communication for ${audience}\n`;
  draft += `Care Recipient: ${input.care_recipient_id}\n`;
  draft += `Date: ${input.as_of || new Date().toISOString().split("T")[0]}\n\n`;
  
  draft += `Situation Summary:\n${summary}\n\n`;
  
  draft += `Key Points to Share:\n`;
  for (const point of prep) {
    draft += `- ${point}\n`;
  }
  
  draft += `\nSupporting Evidence:\n`;
  for (const e of evidence) {
    draft += `- ${e.claim} (source: ${e.source_type}${e.event_ids.length ? `, events: ${e.event_ids.join(", ")}` : ""})\n`;
  }
  
  if (input.raw_context) {
    draft += `\nAdditional Context Provided:\n${input.raw_context}\n`;
  }
  
  draft += `\n---\nThis communication structures observed facts for discussion. `;
  draft += `It does not take sides in disagreements, make medical recommendations, or persuade decisions. `;
  draft += `All claims are grounded in documented care events.`;
  
  return draft;
}

function validateCommunicationDraft(
  draft: string,
  audience: string
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  const lowerDraft = draft.toLowerCase();
  
  const persuasiveLanguage = [
    "you should", "you must", "you need to", "we have to", "we must",
    "the right thing", "best option", "recommend", "strongly suggest",
    "convince", "persuade", "prove", "wrong", "right"
  ];
  
  for (const phrase of persuasiveLanguage) {
    if (lowerDraft.includes(phrase)) {
      issues.push(`Potentially persuasive language detected: "${phrase}"`);
    }
  }
  
  const sidesLanguage = [
    "side with", "agree with", "disagree with", "takes side", "whose fault",
    "blame", "responsible for", "should have", "failed to"
  ];
  
  for (const phrase of sidesLanguage) {
    if (lowerDraft.includes(phrase)) {
      issues.push(`Potentially takes sides language detected: "${phrase}"`);
    }
  }
  
  const medicalDecisions = [
    "diagnosis", "treatment plan", "medication", "surgery", "procedure",
    "doctor should", "medical advice", "prescribe", "clinical decision"
  ];
  
  for (const phrase of medicalDecisions) {
    if (lowerDraft.includes(phrase) && !lowerDraft.includes("documented") && !lowerDraft.includes("observed")) {
      issues.push(`Potential medical decision language detected: "${phrase}"`);
    }
  }
  
  if (!lowerDraft.includes("evidence") && !lowerDraft.includes("source") && !lowerDraft.includes("event")) {
    issues.push("Draft may not be sufficiently evidence-grounded");
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

export function processHelpMeCommunicate(input: HelpMeCommunicateInput): HelpMeCommunicateResult {
  const careCommunicationInput: CareCommunicationInput = {
    care_recipient_id: input.care_recipient_id,
    raw_input: input.raw_context,
    all_events: input.all_events,
    events_created: input.events_created,
    what_changed: input.what_changed,
    what_is_happening: input.what_is_happening,
    what_needs_attention: [],
    what_is_uncertain: input.what_is_uncertain,
    baseline: input.baseline,
    care_reality_profile: input.care_reality_profile,
    as_of: input.as_of
  };
  
  const communicationResult = processCareCommunication(careCommunicationInput);
  
  const draftType = COMMUNICATION_DRAFT_TYPES[0];
  const draft = buildDraftForAudience(input, communicationResult, input.target_audience);
  
  const validation = validateCommunicationDraft(draft, input.target_audience);
  
  if (!validation.valid) {
    console.warn(`Draft validation issues for ${input.target_audience}:`, validation.issues);
  }
  
  return {
    active: true,
    identity: "help-me-communicate",
    audience: input.target_audience,
    situation_summary: communicationResult.sections[COMMUNICATION_OUTPUT_SECTIONS.current_situation_summary] || "",
    evidence: communicationResult.evidence,
    preparation: communicationResult.sections[COMMUNICATION_OUTPUT_SECTIONS.conversation_preparation] || [],
    draft,
    draft_type: draftType,
    uncertainties: communicationResult.uncertainties,
    rules_upheld: communicationResult.rules_upheld
  };
}

export {
  buildDraftForAudience,
  validateCommunicationDraft
};