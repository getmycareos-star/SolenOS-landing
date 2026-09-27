import {
  CARE_COMMUNICATION_SUPPORT_IDENTITY,
  CARE_COMMUNICATION_SUPPORT_PRINCIPLE,
  COMMUNICATION_OUTPUT_SECTIONS,
  COMMUNICATION_DRAFT_TYPES,
  COMMUNICATION_GROUNDING_SOURCES,
  COMMUNICATION_BOUNDARIES,
  type CareCommunicationBrief,
  type CommunicationOutputSection
} from "./care-communication-support";
import { buildEvidenceObject, buildEvidencedConclusion, type EvidenceObject } from "../evidence-preservation";
import { processCareRealityIntelligence, type CareRealityIntelligenceResult } from "../care-reality-intelligence";
import type { CanonicalCareEvent } from "../situation-entry/types";

export type CareCommunicationInput = {
  care_recipient_id: string;
  raw_input?: string;
  all_events: CanonicalCareEvent[];
  events_created: CanonicalCareEvent[];
  what_changed?: string[];
  what_is_happening?: string;
  what_needs_attention?: string[];
  what_is_uncertain?: string[];
  baseline?: any;
  care_reality_profile?: any;
  care_state?: any;
  continuity_properties?: any;
  as_of?: string;
};

export type CareCommunicationResult = {
  active: boolean;
  identity: string;
  sections: Record<CommunicationOutputSection, any>;
  evidence: Array<{ claim: string; source_type: string; event_ids: string[] }>;
  uncertainties: string[];
  rules_upheld: string[];
};

function buildCurrentSituationSummary(input: CareCommunicationInput): string {
  const parts: string[] = [];
  
  if (input.what_is_happening) {
    parts.push(input.what_is_happening);
  }
  
  if (input.what_changed && input.what_changed.length > 0) {
    parts.push(`Changes noted: ${input.what_changed.join("; ")}`);
  }
  
  if (input.what_needs_attention && input.what_needs_attention.length > 0) {
    parts.push(`Needs attention: ${input.what_needs_attention.join("; ")}`);
  }
  
  return parts.join(" | ") || "No significant changes to report.";
}

function buildEvidenceFromCareReality(input: CareCommunicationInput): CareCommunicationResult["evidence"] {
  const evidence: CareCommunicationResult["evidence"] = [];
  
  if (input.events_created && input.events_created.length > 0) {
    for (const event of input.events_created) {
      evidence.push({
        claim: `New event recorded: ${event.type} - ${event.summary || event.detail?.substring(0, 100)}`,
        source_type: "care_event",
        event_ids: [event.id]
      });
    }
  }
  
  if (input.what_changed && input.what_changed.length > 0) {
    const changedEventIds = input.all_events
      .filter(e => input.what_changed?.some(c => e.summary?.includes(c) || e.detail?.includes(c)))
      .map(e => e.id);
    
    if (changedEventIds.length > 0) {
      evidence.push({
        claim: `Changes observed in: ${input.what_changed.join(", ")}`,
        source_type: "care_event",
        event_ids: changedEventIds
      });
    }
  }
  
  if (input.care_reality_profile) {
    evidence.push({
      claim: "Care reality profile provides context for current situation",
      source_type: "care_reality_profile",
      event_ids: []
    });
  }
  
  if (input.baseline) {
    evidence.push({
      claim: "Baseline data available for comparison",
      source_type: "baseline",
      event_ids: []
    });
  }
  
  return evidence;
}

function buildConversationPreparation(input: CareCommunicationInput): string[] {
  const bullets: string[] = [];
  
  if (input.what_is_happening) {
    bullets.push(`Current situation: ${input.what_is_happening}`);
  }
  
  if (input.what_changed && input.what_changed.length > 0) {
    bullets.push(`Key changes to discuss: ${input.what_changed.join(", ")}`);
  }
  
  if (input.what_needs_attention && input.what_needs_attention.length > 0) {
    bullets.push(`Items needing attention: ${input.what_needs_attention.join(", ")}`);
  }
  
  if (input.what_is_uncertain && input.what_is_uncertain.length > 0) {
    bullets.push(`Uncertainties to clarify: ${input.what_is_uncertain.join(", ")}`);
  }
  
  bullets.push("Bring documented observations, not assumptions");
  bullets.push("Focus on what was observed, not interpretations");
  
  return bullets.slice(0, 5);
}

function buildCommunicationDrafts(
  input: CareCommunicationInput,
  draft_type: string
): string {
  const summary = buildCurrentSituationSummary(input);
  const evidence = buildEvidenceFromCareReality(input);
  const prep = buildConversationPreparation(input);
  
  let draft = `Care Communication Draft (${draft_type})\n`;
  draft += `Recipient: ${input.care_recipient_id}\n`;
  draft += `Date: ${input.as_of || new Date().toISOString().split("T")[0]}\n\n`;
  draft += `Situation Summary:\n${summary}\n\n`;
  draft += `Evidence Grounding:\n`;
  
  for (const e of evidence) {
    draft += `- ${e.claim} (source: ${e.source_type}${e.event_ids.length ? `, events: ${e.event_ids.join(", ")}` : ""})\n`;
  }
  
  draft += `\nConversation Preparation:\n`;
  for (const p of prep) {
    draft += `- ${p}\n`;
  }
  
  draft += `\n---\nThis draft structures discussion based on documented observations. `;
  draft += `It does not take sides, make medical recommendations, or persuade decisions.`;
  
  return draft;
}

export function processCareCommunication(input: CareCommunicationInput): CareCommunicationResult {
  const careRealityResult = processCareRealityIntelligence({
    care_recipient_id: input.care_recipient_id,
    all_events: input.all_events,
    events_created: input.events_created,
    what_changed: input.what_changed,
    what_is_happening: input.what_is_happening,
    what_needs_attention: input.what_needs_attention,
    what_is_uncertain: input.what_is_uncertain,
    baseline: input.baseline,
    care_reality_profile: input.care_reality_profile,
    care_state: input.care_state,
    continuity_properties: input.continuity_properties,
    as_of: input.as_of
  });
  
  const current_situation_summary = buildCurrentSituationSummary(input);
  const evidence_from_care_reality = buildEvidenceFromCareReality(input);
  const conversation_preparation = buildConversationPreparation(input);
  
  const communication_drafts: Record<string, string> = {};
  for (const draftType of COMMUNICATION_DRAFT_TYPES) {
    communication_drafts[draftType] = buildCommunicationDrafts(input, draftType);
  }
  
  const sections: Record<CommunicationOutputSection, any> = {
    [COMMUNICATION_OUTPUT_SECTIONS.current_situation_summary]: current_situation_summary,
    [COMMUNICATION_OUTPUT_SECTIONS.evidence_from_care_reality]: evidence_from_care_reality,
    [COMMUNICATION_OUTPUT_SECTIONS.conversation_preparation]: conversation_preparation,
    [COMMUNICATION_OUTPUT_SECTIONS.communication_drafts]: communication_drafts
  };
  
  const uncertainties = input.what_is_uncertain || [];
  if (careRealityResult.uncertainties) {
    uncertainties.push(...careRealityResult.uncertainties);
  }
  
  const rules_upheld = [
    ...COMMUNICATION_BOUNDARIES.must,
    ...COMMUNICATION_BOUNDARIES.must_not
  ];
  
  return {
    active: true,
    identity: CARE_COMMUNICATION_SUPPORT_IDENTITY,
    sections,
    evidence: evidence_from_care_reality,
    uncertainties: [...new Set(uncertainties)],
    rules_upheld
  };
}

export {
  buildCurrentSituationSummary,
  buildEvidenceFromCareReality,
  buildConversationPreparation,
  buildCommunicationDrafts
};