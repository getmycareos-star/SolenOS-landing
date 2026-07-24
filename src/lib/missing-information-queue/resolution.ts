import type { DocumentIntelligenceLayerResult } from "../document-intelligence/types";
import type { MemoryInfluenceState } from "../memory-influence/types";
import { resolveMissingInformationItem } from "./store";
import type {
  MissingInformationItem,
  MissingInformationQueueState,
  MissingInformationResolutionEvent,
} from "./types";

export type EvidenceResolutionPair = {
  questionPattern: RegExp;
  evidencePattern: RegExp;
  reason: string;
  trigger: MissingInformationResolutionEvent["trigger"];
};

/** Evidence that answers an open knowledge gap. */
export const RESOLUTION_PAIRS: readonly EvidenceResolutionPair[] = [
  {
    questionPattern: /discharge\s+date/i,
    evidencePattern:
      /\bdischarg(?:ed|e)\s+(?:on|as of)\s+|[Dd]ischarged on\s+\w+\s+\d{1,2}|\bdischarge\s+date[:\s]+\S+/i,
    reason: "evidence provides discharge date",
    trigger: "document",
  },
  {
    questionPattern: /medication\s+dosage|what is the (?:medication )?dosage/i,
    evidencePattern: /\b(?:dosage|dose)[:\s]+\S+|\b\d+\s*(?:mg|mcg|ml|units)\b/i,
    reason: "evidence provides dosage",
    trigger: "document",
  },
  {
    questionPattern: /primary\s+caregiver/i,
    evidencePattern:
      /\bprimary\s+caregiver\s+(?:is|=)\s+\w+|\bI am the primary caregiver\b/i,
    reason: "evidence confirms primary caregiver",
    trigger: "user_input",
  },
  {
    questionPattern: /policy\s+number/i,
    evidencePattern: /\bpolicy\s*(?:#|number|no\.?)[:\s]+\w+/i,
    reason: "evidence provides policy number",
    trigger: "document",
  },
  {
    questionPattern: /appeal\s+status|insurance\s+appeal/i,
    evidencePattern:
      /\bappeal\s+(?:was\s+)?(?:approved|denied|granted|pending|resolved)\b/i,
    reason: "evidence states appeal status",
    trigger: "user_input",
  },
  {
    questionPattern: /exact\s+date|relevant\s+date|timeframe/i,
    evidencePattern:
      /\b(?:on|as of)\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}|\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/i,
    reason: "evidence provides a concrete date",
    trigger: "user_input",
  },
  {
    questionPattern: /claim\s+number/i,
    evidencePattern: /\bclaim\s*(?:#|number|no\.?)[:\s]+\w+/i,
    reason: "evidence provides claim number",
    trigger: "document",
  },
];

function collectEvidenceTexts(params: {
  input?: string;
  documentIntelligence?: DocumentIntelligenceLayerResult;
  memoryState?: MemoryInfluenceState;
}): string[] {
  const texts: string[] = [];
  if (params.input?.trim()) texts.push(params.input.trim());
  if (params.documentIntelligence && !params.documentIntelligence.skipped) {
    for (const node of params.documentIntelligence.nodes) {
      texts.push(node.extracted.rawText ?? "");
      texts.push(...node.extracted.timestamps);
      texts.push(...node.inference.suggestedInterpretations);
      for (const [k, v] of Object.entries(node.extracted.extractedFields)) {
        texts.push(`${k}: ${String(v)}`);
      }
    }
  }
  if (params.memoryState) {
    for (const entry of params.memoryState.memory.identityMemory.entries) {
      if (!entry.tags.outdated && !entry.tags.incorrect) {
        texts.push(`${entry.key}: ${entry.influenceLabel}`);
      }
    }
  }
  return texts;
}

/**
 * Auto-resolve open gaps when answering evidence appears.
 * Example: "Discharged on January 22" → resolve "What is the discharge date?"
 */
export function autoResolveMissingInformation(
  state: MissingInformationQueueState,
  params: {
    input?: string;
    documentIntelligence?: DocumentIntelligenceLayerResult;
    memoryState?: MemoryInfluenceState;
    nowMs?: number;
  },
): { state: MissingInformationQueueState; events: MissingInformationResolutionEvent[] } {
  const evidenceTexts = collectEvidenceTexts(params);
  if (evidenceTexts.length === 0) return { state, events: [] };

  const combined = evidenceTexts.join("\n");
  const events: MissingInformationResolutionEvent[] = [];
  let next = state;

  for (const item of state.items) {
    if (item.status !== "open") continue;
    for (const pair of RESOLUTION_PAIRS) {
      if (!pair.questionPattern.test(item.question)) continue;
      if (!pair.evidencePattern.test(combined)) continue;

      const trigger: MissingInformationResolutionEvent["trigger"] =
        params.documentIntelligence && !params.documentIntelligence.skipped
          ? pair.trigger
          : params.memoryState && pair.trigger === "memory"
            ? "memory"
            : "user_input";

      const result = resolveMissingInformationItem(
        next,
        item.id,
        pair.reason,
        trigger === "document" || trigger === "user_input" || trigger === "memory"
          ? trigger
          : "user_input",
        params.nowMs,
      );
      next = result.state;
      if (result.event) events.push(result.event);
      break;
    }
  }

  return { state: next, events };
}

export function formatNeedsNextPhrase(item: MissingInformationItem): string {
  // Soft clarification framing — not a task.
  const q = item.question.trim().replace(/\?$/, "");
  if (/^what is|^who is|^when |^is this/i.test(q)) {
    return q.startsWith("What is") || q.startsWith("Who is")
      ? `Confirm ${q.replace(/^What is |^Who is /i, "").replace(/\?$/, "")}`
      : item.question;
  }
  return item.question.includes("?") ? item.question : `${item.question}?`;
}
