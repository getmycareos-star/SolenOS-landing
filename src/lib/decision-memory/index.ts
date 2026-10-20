/**
 * Decision Memory — preserve what was chosen and why for care continuity.
 *
 * Value is not storing the decision alone — it is preserving why the decision
 * existed (context, evidence, alternatives, outcome, unknowns).
 *
 * Record questions answer from held evidence — never Clarity form / advice engine.
 * Decision preparation ≠ recommendation: orient caregivers; never choose for them.
 */

import {
  livingCareRecordDataDir,
  readDurableJson,
  sanitizeDurableCareKey,
  writeDurableJson,
  clearDurableDirectory,
} from "../living-care-record-persistence/fs-store";
import { resolveCareRealityStoreKey } from "../multi-caregiver-context-model";

export const DECISION_MEMORY_PURPOSE =
  "Preserve why care decisions existed — answer record questions from held evidence, never advice.";

export type DecisionMemoryStatus =
  | "CURRENT"
  | "HISTORICAL"
  | "SUPERSEDED"
  | "CANCELLED"
  | "RECONSIDERED"
  | "UNKNOWN";

export type DecisionMemoryEvidence = {
  source?: string;
  text: string;
  event_id?: string;
  /**
   * Provenance of this evidence — how it was obtained and when.
   */
  provenance?: {
    obtained_at: string;
    method: string; // e.g., "caregiver_report", "professional_assessment", "test_result"
    confidence?: number; // 0-1 confidence in this evidence
  };
};

export type DecisionMemoryEntry = {
   id: string;
   care_key: string; // For compatibility with the store
   care_record_id: string;
   /**
    * Type of decision — helps with filtering and organization.
    */
   decision_type:
     | "medication_started"
     | "medication_stopped"
     | "medication_changed"
     | "follow_up_strategy_selected"
     | "referral_decision"
     | "test_decision"
     | "monitoring_decision"
     | "care_setting_decision"
     | "responsibility_assignment"
     | "treatment_plan_decision"
     | "escalation_de_escalation"
     | "family_coordination"
     | "professional_recommendation_accepted"
     | "action_deferred"
     | "other";
   /**
    * What was decided — the actual choice made.
    */
   decision: string;
   /**
    * Detailed description of the decision, including specifics like dosage, frequency, etc.
    */
   decision_description: string;
   /**
    * When the decision was actually made (ISO string).
    * Distinct from when it was documented or recorded.
    */
   decision_date: string;
   /**
    * When the decision was documented/recorded in the system (ISO string).
    */
   recorded_date: string;
   /**
    * Who made the decision.
    */
   decision_maker: string;
   /**
    * Role of the decision-maker.
    */
   decision_maker_role:
     | "physician"
     | "specialist"
     | "nurse"
     | "pharmacist"
     | "care_coordinator"
     | "caregiver"
     | "family_member"
     | "patient"
     | "jointly_decided"
     | "organization_team"
     | "unknown";
   /**
    * Context surrounding the decision — what led to it.
    */
   decision_context: string;
   /**
    * Evidence that supported this decision.
    */
   supporting_evidence: DecisionMemoryEvidence[];
   /**
    * Caregiver concern that led to or influenced the decision, if documented.
    */
   caregiver_concern: string | null;
   /**
    * Alternatives that were considered and documented (not AI-generated).
    */
   alternatives: string[];
   /**
    * Expected outcome from this decision, if documented.
    */
   expected_outcome: string | null;
   /**
    * Intended follow-up from this decision.
    */
   follow_up: string | null;
   /**
    * Actual outcome that occurred (when known).
    */
   actual_outcome: string | null;
   /**
    * Comparison between expected and actual outcome.
    */
   outcome_comparison:
     | "achieved"
     | "partially_achieved"
     | "not_achieved"
     | "different_from_expected"
     | "pending"
     | "unknown"
     | "conflicting";
   /**
    * Date when follow-up was expected or occurred.
    */
   follow_up_date: string | null;
   /**
    * Links to related entities in the care graph.
    */
   related_appointment: string | null; // appointment ID
   related_professional_response: string | null; // professional response ID
   related_medication: string | null; // medication ID
   related_referral: string | null; // referral ID
   related_test: string | null; // test ID
   related_open_loop: string | null; // open loop ID
   /**
    * Supersession links — for tracking decision evolution.
    */
   supersedes: string | null; // ID of the decision this one supersedes
   superseded_by: string | null; // ID of the decision that superseded this one
   reconsidered_from: string | null; // ID of the decision this one reconsidered
   /**
    * Provenance and confidence information.
    */
   source_provenance: string; // e.g., "caregiver_report", "professional_document", "clinical_note"
   confidence: number; // 0-1 confidence in this decision record
   uncertainty: string | null; // description of any uncertainty, if known
   /**
    * Metadata
    */
   created_at: string;
   updated_at: string;
   version: number; // for tracking evolution of this decision record
   content_tokens: string[]; // For text search and overlap calculations
   outcome_event_ids: string[]; // IDs of events that document the outcome
   /**
    * Permissions and access control.
    */
   access_scope: string; // e.g., "patient_only", "caregiver_team", "professional_team", "shared"
   /**
    * Status of the decision - helps determine if it's current or historical
    */
   status: DecisionMemoryStatus;
};

type Store = {
  care_key: string;
  entries: DecisionMemoryEntry[];
  updated_at: string;
};

/** Loose legacy shape before schema expansion. */
type LegacyEntry = Partial<DecisionMemoryEntry> & {
  id?: string;
  care_key?: string;
  decision?: string;
  reason?: string | null;
  evidence_texts?: string[];
  recorded_at?: string;
  content_tokens?: string[];
};

const memory = new Map<string, Store>();

const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "have",
  "has",
  "was",
  "were",
  "are",
  "her",
  "his",
  "she",
  "him",
  "they",
  "them",
  "their",
  "mom",
  "dad",
  "why",
  "taking",
  "take",
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

function pathFor(careKey: string): string {
  return livingCareRecordDataDir(
    "decision-memory",
    `${sanitizeDurableCareKey(careKey)}.json`,
  );
}

function migrateEntry(raw: LegacyEntry, careKey: string): DecisionMemoryEntry | null {
  const what = raw.decision?.trim() ?? "";
  if (!what) return null;
  
  // Use recorded_at for both decision_date and recorded_date if not specified
  const recordedAt = raw.recorded_at ?? new Date().toISOString();
  const decisionDate = recordedAt; // Legacy doesn't have separate decision date
  
  const evidence: DecisionMemoryEvidence[] =
    (raw.evidence_texts ?? []).map((text) => ({
      text,
      provenance: {
        obtained_at: new Date().toISOString(),
        method: "unknown",
        confidence: 0.5,
      },
    }));

  // Extract decision type from text if possible
  const decisionType = inferDecisionType(what);
  
  // Extract decision maker info if possible - Legacy doesn't have this info
  const { decisionMaker, decisionMakerRole } = inferDecisionMaker([], what);
  
  // Extract caregiver concern if possible - Legacy doesn't have this
  const caregiverConcern = null;
  
  // Extract alternatives - Legacy doesn't have this
  const alternatives = [];
  
  // Extract expected outcome and follow-up if possible - Legacy doesn't have this
  const { expectedOutcome, followUp } = { expectedOutcome: null, followUp: null };
  
  // Extract outcome comparison if outcome is present - Legacy doesn't have explicit outcome
  const outcomeComparison = "unknown";

  return {
    id: raw.id ?? `dm_${Date.now().toString(36)}`,
    care_key: raw.care_key ?? careKey,
    care_record_id: raw.care_key ?? careKey, // For compatibility with canonical model
    decision_type: decisionType,
    decision: what,
    decision_description: what.length > 200 ? `${what.slice(0, 197)}...` : what,
    decision_date: decisionDate,
    recorded_date: recordedAt,
    decision_maker: decisionMaker,
    decision_maker_role: decisionMakerRole,
    decision_context: raw.reason ?? "", // Use reason as context if available
    supporting_evidence: evidence,
    caregiver_concern: caregiverConcern,
    alternatives,
    expected_outcome: expectedOutcome,
    follow_up: followUp,
    actual_outcome: null, // Legacy doesn't have outcome info
    outcome_comparison: outcomeComparison,
    follow_up_date: null,
    related_appointment: null,
    related_professional_response: null,
    related_medication: null,
    related_referral: null,
    related_test: null,
    related_open_loop: null,
    supersedes: null,
    superseded_by: null,
    reconsidered_from: null,
    source_provenance: "unknown",
    confidence: 0.5, // Lower confidence for migrated legacy data
    uncertainty: raw.reason ? null : "Reason for decision is unknown",
    created_at: recordedAt,
    updated_at: recordedAt,
    version: 1,
    access_scope: "shared",
    content_tokens: tokens(what), // Initialize content tokens from the decision text
    outcome_event_ids: [], // Legacy doesn't have outcome event IDs
    status: inferStatus(what),
  };
}

function inferDecisionType(text: string): DecisionMemoryEntry["decision_type"] {
  const lowerText = text.toLowerCase();
  
  if (/\b(start|begin|initiate).*\b(med|medication|drug|prescription)\b/.test(lowerText)) {
    return "medication_started";
  }
  if (/\b(stop|discontinue|cease).*\b(med|medication|drug|prescription)\b/.test(lowerText)) {
    return "medication_stopped";
  }
  if (/\b(change|adjust|modify|alter).*\b(med|medication|drug|prescription|dose|dosage)\b/.test(lowerText)) {
    return "medication_changed";
  }
  if (/\b(follow.?up|monitor|check|track|watch)\b/.test(lowerText)) {
    return "follow_up_strategy_selected";
  }
  if (/\b(refer|referral|consult|see.*doctor|specialist)\b/.test(lowerText)) {
    return "referral_decision";
  }
  if (/\b(test|screen|scan|lab|biopsy|x.?ray|mri|ct\s*scan)\b/.test(lowerText)) {
    return "test_decision";
  }
  if (/\b(care\s*setting|living\s*arrangement|residential|facility|home\s*care)\b/.test(lowerText)) {
    return "care_setting_decision";
  }
  if (/\b(responsibility|duty|task|role|assign)\b/.test(lowerText)) {
    return "responsibility_assignment";
  }
  if (/\b(treatment\s*plan|care\s*plan|therapy|intervention)\b/.test(lowerText)) {
    return "treatment_plan_decision";
  }
  if (/\b(escalate|increase|intensify|reduce|decrease|de\-escalate)\b/.test(lowerText)) {
    return "escalation_de_escalation";
  }
  if (/\b(family|relative|kin).*\b(coordinate|coordination|meeting|discuss)\b/.test(lowerText)) {
    return "family_coordination";
  }
  if (/\b(doctor|physician|professional).*\b(recommend|advise|suggest|prescribe).*\b(agreed|accepted|decided|chose)\b/.test(lowerText)) {
    return "professional_recommendation_accepted";
  }
  if (/\b(defer|delay|postpone|wait|hold\s*off)\b/.test(lowerText)) {
    return "action_deferred";
  }
  
  return "other";
}

function inferDecisionMaker(
  who: string[],
  text: string
): { decisionMaker: string; decisionMakerRole: DecisionMemoryEntry["decision_maker_role"] } {
  // If who is provided, use it; otherwise try to infer from text
  if (who.length > 0) {
    // Take the first person as decision maker for simplicity
    const decisionMaker = who[0];
    
    // Try to infer role from text or who descriptions
    const combinedText = [...who, text].join(" ").toLowerCase();
    
    if (/\b(doc|doctor|physician|dr\.)\b/.test(combinedText)) {
      return { decisionMaker, decisionMakerRole: "physician" };
    }
    if (/\b(specialist|spclist)\b/.test(combinedText)) {
      return { decisionMaker, decisionMakerRole: "specialist" };
    }
    if (/\b(nurse|rn|lpn)\b/.test(combinedText)) {
      return { decisionMaker, decisionMakerRole: "nurse" };
    }
    if (/\b(pharmacist|pharm|rx)\b/.test(combinedText)) {
      return { decisionMaker, decisionMakerRole: "pharmacist" };
    }
    if (/\b(care\s*coordinator|case\s*manager)\b/.test(combinedText)) {
      return { decisionMaker, decisionMakerRole: "care_coordinator" };
    }
    if (/\b(caregiver|carer)\b/.test(combinedText)) {
      return { decisionMaker, decisionMakerRole: "caregiver" };
    }
    if (/\b(family|relative|kin|spouse|parent|child)\b/.test(combinedText)) {
      return { decisionMaker, decisionMakerRole: "family_member" };
    }
    if (/\b(patient|client|resident)\b/.test(combinedText)) {
      return { decisionMaker, decisionMakerRole: "patient" };
    }
    if (/\b(team|group|committee|panel)\b/.test(combinedText)) {
      return { decisionMaker, decisionMakerRole: "organization_team" };
    }
    if (/\b(joint|shared|collaborat(e|ion))\b/.test(combinedText)) {
      return { decisionMaker, decisionMakerRole: "jointly_decided" };
    }
    
    // Default to unknown if we can't determine
    return { decisionMaker, decisionMakerRole: "unknown" };
  }
  
  // Try to infer from text alone
  const lowerText = text.toLowerCase();
  if (/\b(doc|doctor|physician|dr\.)\s+(said|recommended|prescribed|decided|chose)\b/.test(lowerText)) {
    return { decisionMaker: "Unknown Physician", decisionMakerRole: "physician" };
  }
  if (/\b(nurse|rn|lpn)\s+(said|recommended|noted|observed)\b/.test(lowerText)) {
    return { decisionMaker: "Unknown Nurse", decisionMakerRole: "nurse" };
  }
  if (/\b(pharmacist|pharm|rx)\s+(said|recommended|advised)\b/.test(lowerText)) {
    return { decisionMaker: "Unknown Pharmacist", decisionMakerRole: "pharmacist" };
  }
  if (/\b(care\s*coordinator|case\s*manager)\s+(said|recommended|noted)\b/.test(lowerText)) {
    return { decisionMaker: "Unknown Care Coordinator", decisionMakerRole: "care_coordinator" };
  }
  if (/\b(caregiver|carer|family|relative)\s+(said|recommended|noted|worried|concerned)\b/.test(lowerText)) {
    return { decisionMaker: "Unknown Caregiver/Family", decisionMakerRole: "caregiver" };
  }
  if (/\b(patient|client|resident)\s+(said|recommended|requested|preferred)\b/.test(lowerText)) {
    return { decisionMaker: "Unknown Patient", decisionMakerRole: "patient" };
  }
  
  // Default fallback
  return { decisionMaker: "Unknown", decisionMakerRole: "unknown" };
}

function inferCaregiverConcern(text: string): string | null {
  const concernPatterns = [
    /\b(concerned|worried|afraid|scared|troubled|bothered).*\b(about|over|regarding)\b/i,
    /\b(worried|concerned).*\b(that|because|since|due to)\b/i,
    /\b(afraid|scared|frightened).*\b(of|that|by)\b/i,
    /\b(troubled|bothered|distressed|upset).*\b(by|because|since|due to)\b/i,
  ];
  
  for (const pattern of concernPatterns) {
    const match = text.match(pattern);
    if (match) {
      // Extract the concern description - simple approach: take a window around the match
      const start = Math.max(0, match.index - 20);
      const end = Math.min(text.length, match.index + match[0].length + 100);
      const concernText = text.slice(start, end).trim();
      return concernText.length > 10 ? concernText : null;
    }
  }
  
  return null;
}

function inferExpectedOutcomeAndFollowup(text: string): {
  expectedOutcome: string | null;
  followUp: string | null;
} {
  const lowerText = text.toLowerCase();
  
  // Look for expected outcome patterns
  const expectedOutcomePatterns = [
    { pattern: /\b(expect(ing|ant|ation)?|anticipat(e|ing)|predict|forecast).*\b(will|would|should|expect).*\b(improve|reduce|increase|decrease|resolve|eliminate|better|worse)\b/i, group: 0 },
    { pattern: /\b(hope|wish|desire).*\b(for|that|to).*\b(improve|reduce|increase|decrease|resolve|eliminate|better|worse)\b/i, group: 0 },
    { pattern: /\b(goal|target|objective).*\b(is|was|to).*\b(achieve|reach|attain|maintain|keep)\b/i, group: 0 },
  ];
  
  let expectedOutcome: string | null = null;
  for (const { pattern, group } of expectedOutcomePatterns) {
    const match = text.match(pattern);
    if (match) {
      const matchedText = match[group];
      // Clean up the matched text
      expectedOutcome = matchedText
        .replace(/^(expect|expecting|expectation|anticipate|anticipating|anticipation|predict|predicting|forecast|forecasting|hope|wishing|desire|desiring|goal|target|objective|is|was|to)\s*/i, "")
        .replace(/\s*$/, "")
        .trim();
      if (expectedOutcome.length > 5) {
        break;
      }
    }
  }
  
  // Look for follow-up patterns
  const followUpPatterns = [
    /\b(follow.?up|check|monitor|review|reassess|revisit|see.*again|back.*for).*\b(in|within|after|during|every|each)\s+\d+\s*(day|days|week|weeks|month|months|year|years)\b/i,
    /\b(see.*doctor|return.*clinic|visit.*provider|appointment).*\b(in|within|after|during|every|each)\s+\d+\s*(day|days|week|weeks|month|months|year|years)\b/i,
    /\b(call|phone|contact).*\b(in|within|after|during|every|each)\s+\d+\s*(day|days|week|weeks|month|months|year|years)\b/i,
    /\b(monitor|track|watch|keep.*eye.*on).*\b(for|in|during|throughout)\s+\d+\s*(day|days|week|weeks|month|months|year|years)\b/i,
  ];
  
  let followUp: string | null = null;
  for (const pattern of followUpPatterns) {
    const match = text.match(pattern);
    if (match) {
      followUp = match[0].trim();
      if (followUp.length > 5) {
        break;
      }
    }
  }
  
  return { expectedOutcome, followUp };
}

function inferOutcomeComparison(reason: string, outcome: string): DecisionMemoryEntry["outcome_comparison"] {
  const combined = (reason + " " + outcome).toLowerCase();
  
  // Check for explicit comparison language
  if (/\b(achieved|met|reached|attained|accomplished|successful|worked|effective)\b/.test(combined)) {
    return "achieved";
  }
  if (/\b(partially|partly|somewhat|moderately).*\b(achieved|met|reached|attained|accomplished)\b/.test(combined)) {
    return "partially_achieved";
  }
  if (/\b(not|didn't|did not|failed|didn't work|ineffective|didn't help|no change|unchanged|same|worse|deteriorated|exacerbated|aggravated)\b/.test(combined)) {
    // Check if it's explicitly different from expected
    if (/\b(different|other|alternate|unexpected|surprising|contradict|conflict|opposite|reverse)\b/.test(combined)) {
      return "different_from_expected";
    }
    return "not_achieved";
  }
  if (/\b(pending|awaiting|waiting for|expected|anticipated|forthcoming|imminent|upcoming)\b/.test(combined)) {
    return "pending";
  }
  if (/\b(unknown|uncertain|unclear|unsure|don't know|do not know|unknown|tbd|t.b.d.)\b/.test(combined)) {
    return "unknown";
  }
  if (/\b(conflict|contradict|disagree|inconsistent|mismatch|variance|discrepancy)\b/.test(combined)) {
    return "conflicting";
  }
  
  // Default to unknown if we can't determine
  return "unknown";
}

function extractAlternatives(text: string): string[] {
  const out: string[] = [];
  const instead = text.match(
    /\b(?:instead of|rather than|as opposed to)\s+([^.,;]{3,60})/i,
  );
  if (instead?.[1]) out.push(instead[1].trim());
  const vs = text.match(/\b([^.,;]{3,40})\s+vs\.?\s+([^.,;]{3,40})/i);
  if (vs?.[1] && vs[2]) {
    out.push(vs[1].trim(), vs[2].trim());
  }
  const orHome = text.match(
    /\b(rehab(?:ilitation)?|home care|home|hospital|assisted living)\b.*\bor\b.*\b(rehab(?:ilitation)?|home care|home|hospital|assisted living)\b/i,
  );
  if (orHome?.[1] && orHome[2] && orHome[1].toLowerCase() !== orHome[2].toLowerCase()) {
    out.push(orHome[1], orHome[2]);
  }
  return [...new Set(out.map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean))].slice(
    0,
    4,
  );
}

function inferStatus(text: string): DecisionMemoryStatus {
  if (/\b(will|plan is|planning to|considering|might|may)\b/i.test(text)) {
    return "CURRENT"; // Treat planned decisions as current for now
  }
  if (/\b(cancel|stop|discontinue|cease|terminate|end|abandon)\b/i.test(text)) {
    return "CANCELLED";
  }
  if (/\b(change|modify|alter|adjust|switch|replace|substitute|swap)\b/i.test(text)) {
    return "SUPERSEDED"; // This decision will be superseded by a new one
  }
  if (/\b(reconsider|review|re[e-]valuate|rethink|reassess)\b/i.test(text)) {
    return "RECONSIDERED";
  }
  // Default to CURRENT for active decisions
  return "CURRENT";
}

function storeKey(careKey: string): string {
  return resolveCareRealityStoreKey(careKey);
}

function load(careKey: string): Store {
  const id = storeKey(careKey);
  const cached = memory.get(id);
  if (cached) return cached;
  const durable = readDurableJson<Store>(pathFor(id));
  if (durable?.entries) {
    const migrated: Store = {
      care_key: id,
      entries: durable.entries
        .map((e) => migrateEntry(e as LegacyEntry, id))
        .filter((e): e is DecisionMemoryEntry => e != null),
      updated_at: durable.updated_at ?? new Date().toISOString(),
    };
    memory.set(id, migrated);
    return migrated;
  }
  return { care_key: id, entries: [], updated_at: new Date().toISOString() };
}

function save(store: Store): void {
  memory.set(store.care_key, store);
  writeDurableJson(pathFor(store.care_key), store);
}

export function listDecisionMemory(careKey: string): DecisionMemoryEntry[] {
  return [...load(careKey).entries];
}

/**
 * Extract a decision candidate from caregiver / document language.
 * Delegates to unified epistemic decision signal (`decision-signal.ts`).
 */
export { looksLikeDecisionEvidence } from "./decision-signal";
import { looksLikeDecisionEvidence } from "./decision-signal";

export function recordDecisionFromText(params: {
  careKey: string;
  rawText: string;
  nowIso?: string;
  who?: string[];
  situationId?: string | null;
  contextSummary?: string | null;
  source?: string;
  eventId?: string;
  /** SRE ADD_RELATED_EVENT (non-improvement) — record even if epistemic cue is thin. */
  forceFromRelationshipEngine?: boolean;
  /**
   * Decision Extraction: explicit why from extraction layer.
   * Pass `null` with `reasonUnknown: true` to store Reason unknown (never invent).
   */
  reason?: string | null;
  reasonUnknown?: boolean;
  alternatives?: string[];
  outcome?: string | null;
  status?: DecisionMemoryStatus;
}): DecisionMemoryEntry | null {
  const t = params.rawText.trim();
  if (!t) return null;
  if (!params.forceFromRelationshipEngine && !looksLikeDecisionEvidence(t)) return null;

  const now = params.nowIso ?? new Date().toISOString();
  const careKey = storeKey(params.careKey);
  
  // Extract reason from text if not provided
  let reason: string | null = params.reason;
  if (reason === undefined && !params.reasonUnknown) {
    const reasonMatch =
      t.match(/\b(?:because|for|to (?:help|treat|manage)|due to)\s+([^.]{5,80})/i) ??
      null;
    reason = reasonMatch ? reasonMatch[1]!.trim() : null;
  }
  
  const reasonUnknown =
    params.reasonUnknown === true ||
    /\b(?:can'?t remember why|don'?t know why|reason (?:is )?unknown|not sure why)\b/i.test(t);

  // If reason is unknown, set it to null
  if (reasonUnknown) {
    reason = null;
  }

   const entry: DecisionMemoryEntry = {
     id: `dm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
     care_key: careKey,
     care_record_id: careKey,
     decision_type: inferDecisionType(t),
     decision: t.length > 200 ? `${t.slice(0, 197)}...` : t,
     decision_description: t.length > 500 ? `${t.slice(0, 497)}...` : t,
     decision_date: now, // Default to now if not specified elsewhere
     recorded_date: now,
     decision_maker: params.who?.[0] ?? "Unknown",
     decision_maker_role: params.who?.length > 0 ? 
       inferDecisionMaker(params.who, t).decisionMakerRole : 
       "unknown",
     decision_context: params.contextSummary ?? t.slice(0, 200),
     supporting_evidence: [
       {
         source: params.source,
         text: t.slice(0, 240),
         event_id: params.eventId,
         provenance: {
           obtained_at: now,
           method: params.source ?? "unknown",
           confidence: params.source ? 0.8 : 0.5,
         },
       },
     ],
     caregiver_concern: inferCaregiverConcern(t),
     alternatives: params.alternatives ?? extractAlternatives(t),
     expected_outcome: params.outcome !== undefined ? params.outcome : null, // This is tricky - outcome param might be actual outcome
     follow_up: null, // Would need more sophisticated extraction
     actual_outcome: null, // Will be filled in later via linkDecisionOutcome
     outcome_comparison: "unknown", // Will be updated when actual outcome is known
     follow_up_date: null,
     related_appointment: null,
     related_professional_response: null,
     related_medication: null,
     related_referral: null,
     related_test: null,
     related_open_loop: null,
     supersedes: null,
     superseded_by: null,
     reconsidered_from: null,
     source_provenance: params.source ?? "unknown",
     confidence: params.source ? 0.8 : 0.5,
     uncertainty: reasonUnknown ? "Reason for decision is unknown" : null,
     created_at: now,
     updated_at: now,
     version: 1,
     access_scope: "shared",
     content_tokens: tokens(t), // Initialize content tokens from the decision text
     outcome_event_ids: [], // Initialize as empty array
     status: params.status ?? inferStatus(t),
   };

  const store = load(careKey);
  // Remove any existing entries with the same decision to avoid duplicates
  const filteredEntries = store.entries.filter(
    existing => existing.decision !== entry.decision && existing.decision_description !== entry.decision_description
  );
  
  const next = [...filteredEntries, entry].slice(-24); // Keep last 24 decisions
  save({ care_key: careKey, entries: next, updated_at: now });
  return entry;
}

/**
 * Link what happened afterward to an open decision (outcome continuity).
 */
export function linkDecisionOutcome(params: {
  careKey: string;
  outcomeText: string;
  eventId?: string;
  decisionId?: string;
  matchTokens?: readonly string[];
  status?: DecisionMemoryStatus;
  nowIso?: string;
}): DecisionMemoryEntry | null {
  const store = load(params.careKey);
  if (store.entries.length === 0) return null;

  const outcome = params.outcomeText.trim().slice(0, 240);
  if (!outcome) return null;

  let target: DecisionMemoryEntry | null = null;
  if (params.decisionId) {
    target = store.entries.find((e) => e.id === params.decisionId) ?? null;
  }
  if (!target) {
    const qTokens =
      params.matchTokens && params.matchTokens.length > 0
        ? [...params.matchTokens]
        : tokens(outcome);
    let bestScore = 0;
    for (const e of store.entries) {
  // Skip completed decisions unless we're updating a specific one
  if (e.status === "CANCELLED" && !params.decisionId) continue;
      const score = overlap(e.content_tokens, qTokens);
      if (score > bestScore) {
        bestScore = score;
        target = e;
      }
    }
    if (bestScore < 1) target = store.entries[store.entries.length - 1] ?? null;
  }
  if (!target) return null;

  const changed =
    /\b(instead|changed (?:to|from)|switched|no longer|reversed)\b/i.test(outcome);
  const nextStatus: DecisionMemoryStatus =
    params.status ?? (changed ? "SUPERSEDED" : "CURRENT"); // If changed, mark as SUPERSEDED (will be superseded by new decision)

   // Calculate outcome comparison
   const outcomeComparison = inferOutcomeComparison(
     target.reason ?? "", 
     outcome
   );

  const updated: DecisionMemoryEntry = {
    ...target,
    actual_outcome: outcome,
    outcome_comparison: outcomeComparison,
    outcome_event_ids: params.eventId
      ? [...new Set([...target.outcome_event_ids, params.eventId])]
      : target.outcome_event_ids,
    status: nextStatus,
  };

  const now = params.nowIso ?? new Date().toISOString();
  const entries = store.entries.map((e) => (e.id === updated.id ? updated : e));
  save({ care_key: params.careKey, entries, updated_at: now });
  return updated;
}

export type RecordQuestionAnswer = {
  answered_from_memory: boolean;
  lines: string[];
  evidence_line: string | null;
  note: string | null;
  /** Never force Clarity workflow. */
  forces_clarity_form: false;
  /** True when reason was not held — unknown is first-class. */
  reason_unknown: boolean;
};

function overlap(a: string[], b: string[]): number {
  const set = new Set(a);
  let n = 0;
  for (const w of b) if (set.has(w)) n += 1;
  return n;
}

/**
 * Answer a record question from decision memory + optional prior observation texts.
 * Never medical advice. Never Clarity form.
 */
export function answerRecordQuestion(params: {
  careKey: string;
  question: string;
  priorObservationTexts?: readonly string[];
}): RecordQuestionAnswer {
  const qTokens = tokens(params.question);
  const entries = listDecisionMemory(params.careKey);

  let best: DecisionMemoryEntry | null = null;
  let bestScore = 0;
  for (const e of entries) {
    const score = overlap(e.content_tokens, qTokens);
    if (score > bestScore) {
      bestScore = score;
      best = e;
    }
  }

  if (!best || bestScore < 1) {
    for (const raw of params.priorObservationTexts ?? []) {
      if (!looksLikeDecisionEvidence(raw)) continue;
      const score = overlap(tokens(raw), qTokens);
      if (score > bestScore) {
        bestScore = score;
        best = migrateEntry(
          {
            id: "ephemeral",
            care_key: params.careKey,
            decision: raw.slice(0, 140),
            reason: null,
            evidence_texts: [raw.slice(0, 240)],
            recorded_at: new Date().toISOString(),
            content_tokens: tokens(raw),
          },
          params.careKey,
        );
      }
    }
  }

  if (!best || bestScore < 1) {
    return {
      answered_from_memory: false,
      lines: [],
      evidence_line: null,
      note: "Nothing in the Living Care Record yet explains this — you can add what you know.",
      forces_clarity_form: false,
      reason_unknown: true,
    };
  }

  const lines: string[] = [best.decision];
  if (best.decision_description && best.decision_description !== best.decision) {
    lines.push(`Details: ${best.decision_description}`);
  }
  if (best.reason) {
    lines.push(`Reason: ${best.reason}`);
  } else {
    lines.push("Reason for this decision is not held yet.");
  }
  if (best.alternatives.length > 0) {
    lines.push(`Options considered: ${best.alternatives.slice(0, 2).join("; ")}`);
  }
  if (best.expected_outcome) {
    lines.push(`Expected outcome: ${best.expected_outcome}`);
  }
  if (best.follow_up) {
    lines.push(`Planned follow-up: ${best.follow_up}`);
  }
  if (best.actual_outcome) {
    lines.push(`Actual outcome: ${best.actual_outcome}`);
  }
  if (best.outcome_comparison !== "unknown") {
    lines.push(`Outcome comparison: ${best.outcome_comparison}`);
  }
  if (best.superseded_by) {
    lines.push(`This decision has been superseded by a later decision.`);
  }
  if (best.supersedes) {
    lines.push(`This decision supersedes an earlier decision.`);
  }

  const evidenceText = best.supporting_evidence[0]?.text ?? best.supporting_evidence[0]?.text ?? null;

   return {
     answered_from_memory: true,
     lines: lines.slice(0, 6), // Increased from 4 to show more detail
     evidence_line: evidenceText
       ? `From the Living Care Record: ${evidenceText.slice(0, 120)}`
       : null,
     note: "Answered from what is already held — not a Clarity workflow.",
     reason_unknown: best.reason == null,
     forces_clarity_form: false,
   };
}

/**
 * Decision preparation lines for guidance / overload turns —
 * situation understanding, not "what you should choose."
 */
export function composeDecisionPreparation(params: {
  careKey: string;
  maxLines?: number;
}): {
  lines: string[];
  has_decisions: boolean;
  open_unknowns: string[];
} {
  const entries = listDecisionMemory(params.careKey);
  const max = params.maxLines ?? 3;
  if (entries.length === 0) {
    return { lines: [], has_decisions: false, open_unknowns: [] };
  }

  // Get recent non-superseded decisions for preparation
  const recentEntries = entries
    .filter(e => e.status !== "SUPERSEDED" && e.status !== "CANCELLED")
    .slice(-max);
    
  const lines: string[] = [];
  const open_unknowns: string[] = [];

  for (const e of recentEntries) {
    lines.push(`${e.decision_type}: ${e.decision}`);
    if (!e.reason) {
      open_unknowns.push("Why this path was chosen is not held yet.");
    }
    if (e.expected_outcome && !e.actual_outcome) {
      open_unknowns.push(`Expected outcome "${e.expected_outcome}" has not yet been observed.`);
    }
    if (e.follow_up && !e.actual_outcome) {
      open_unknowns.push(`Planned follow-up "${e.follow_up}" status unknown.`);
    }
  }

  return {
    lines: [...new Set(lines)].slice(0, max),
    has_decisions: true,
    open_unknowns: [...new Set(open_unknowns)].slice(0, 2),
  };
}

export function resetDecisionMemoryStore(): void {
  memory.clear();
  clearDurableDirectory(livingCareRecordDataDir("decision-memory"));
}

export function clearDecisionMemoryCache(): void {
  memory.clear();
}