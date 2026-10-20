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
  | "active"
  | "pending"
  | "changed"
  | "completed"
  | "reversed"
  | "uncertain"
  | "needs_review";

export type DecisionMemoryEvidence = {
  source?: string;
  text: string;
  event_id?: string;
};

export type DecisionMemoryEntry = {
  id: string;
  care_key: string;
  /** What changed or was chosen. */
  what: string;
  /** @deprecated Prefer `what` — kept for older callers / JSON. */
  decision: string;
  /** When the decision was recorded (ISO). */
  when: string;
  /** People involved when known (contributors / roles). */
  who: string[];
  /** ACS / situation id when linked. */
  context_situation_id: string | null;
  /** Short situation summary when known. */
  context_summary: string | null;
  evidence: DecisionMemoryEvidence[];
  /** Options mentioned (e.g. rehab vs home); empty if unknown. */
  alternatives: string[];
  /** Why this path was selected — null when unknown (first-class). */
  reason: string | null;
  /** What happened afterward when linked. */
  outcome: string | null;
  outcome_event_ids: string[];
  status: DecisionMemoryStatus;
  /** @deprecated Prefer `evidence` — kept for older JSON / overlap. */
  evidence_texts: string[];
  recorded_at: string;
  content_tokens: string[];
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
  const what = (raw.what ?? raw.decision ?? "").trim();
  if (!what) return null;
  const when = raw.when ?? raw.recorded_at ?? new Date().toISOString();
  const evidence: DecisionMemoryEvidence[] =
    Array.isArray(raw.evidence) && raw.evidence.length > 0
      ? raw.evidence.map((e) => ({
          source: e.source,
          text: e.text,
          event_id: e.event_id,
        }))
      : (raw.evidence_texts ?? []).map((text) => ({ text }));
  const evidence_texts =
    evidence.map((e) => e.text).filter(Boolean).length > 0
      ? evidence.map((e) => e.text)
      : (raw.evidence_texts ?? [what]);

  return {
    id: raw.id ?? `dm_${Date.now().toString(36)}`,
    care_key: raw.care_key ?? careKey,
    what,
    decision: what,
    when,
    who: Array.isArray(raw.who) ? raw.who.filter(Boolean) : [],
    context_situation_id: raw.context_situation_id ?? null,
    context_summary: raw.context_summary ?? null,
    evidence,
    alternatives: Array.isArray(raw.alternatives)
      ? raw.alternatives.filter(Boolean)
      : [],
    reason: raw.reason ?? null,
    outcome: raw.outcome ?? null,
    outcome_event_ids: Array.isArray(raw.outcome_event_ids)
      ? raw.outcome_event_ids
      : [],
    status: raw.status ?? "active",
    evidence_texts,
    recorded_at: raw.recorded_at ?? when,
    content_tokens:
      Array.isArray(raw.content_tokens) && raw.content_tokens.length > 0
        ? raw.content_tokens
        : tokens(what),
  };
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
    return "pending";
  }
  return "active";
}

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
  const reasonMatch =
    t.match(/\b(?:because|for|to (?:help|treat|manage)|due to)\s+([^.]{5,80})/i) ??
    null;
  const what = t.length > 140 ? `${t.slice(0, 137).trim()}…` : t;
  const evidenceText = t.slice(0, 240);
  const evidence: DecisionMemoryEvidence[] = [
    {
      source: params.source,
      text: evidenceText,
      event_id: params.eventId,
    },
  ];

  const reasonUnknown =
    params.reasonUnknown === true ||
    /\b(?:can'?t remember why|don'?t know why|reason (?:is )?unknown|not sure why)\b/i.test(t);

  let reason: string | null;
  if (params.reasonUnknown === true) {
    reason = null;
  } else if (params.reason !== undefined) {
    reason = params.reason;
  } else if (reasonUnknown) {
    reason = null;
  } else {
    reason = reasonMatch ? reasonMatch[1]!.trim() : null;
  }

  const entry: DecisionMemoryEntry = {
    id: `dm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    care_key: careKey,
    what,
    decision: what,
    when: now,
    who: (params.who ?? []).filter(Boolean),
    context_situation_id: params.situationId ?? null,
    context_summary: params.contextSummary ?? null,
    evidence,
    alternatives: params.alternatives ?? extractAlternatives(t),
    reason,
    outcome: params.outcome !== undefined ? params.outcome : null,
    outcome_event_ids: [],
    status: params.status ?? (reason === null && reasonUnknown ? "pending" : inferStatus(t)),
    evidence_texts: [evidenceText],
    recorded_at: now,
    content_tokens: tokens(t),
  };

  const store = load(careKey);
  const next = [
    ...store.entries.filter((e) => e.what !== entry.what && e.decision !== entry.what),
    entry,
  ].slice(-24);
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
      if (e.status === "completed") continue;
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
    params.status ?? (changed ? "changed" : "completed");

  const updated: DecisionMemoryEntry = {
    ...target,
    outcome,
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

  const lines: string[] = [best.what];
  if (best.reason) {
    lines.push(`Reason held: ${best.reason}`);
  } else {
    lines.push("Reason for this decision is not held yet.");
  }
  if (best.alternatives.length > 0) {
    lines.push(`Options noted: ${best.alternatives.slice(0, 2).join("; ")}`);
  }
  if (best.outcome) {
    lines.push(`Afterward: ${best.outcome}`);
  }

  const evidenceText = best.evidence[0]?.text ?? best.evidence_texts[0] ?? null;

  return {
    answered_from_memory: true,
    lines: lines.slice(0, 4),
    evidence_line: evidenceText
      ? `From the Living Care Record: ${evidenceText.slice(0, 120)}`
      : null,
    note: "Answered from what is already held — not a Clarity workflow.",
    forces_clarity_form: false,
    reason_unknown: best.reason == null,
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

  const recent = entries.slice(-max);
  const lines: string[] = [];
  const open_unknowns: string[] = [];

  for (const e of recent) {
    lines.push(e.what);
    if (!e.reason) {
      open_unknowns.push("Why this path was chosen is not held yet.");
    }
    if (e.outcome) {
      lines.push(`Outcome held: ${e.outcome}`);
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
