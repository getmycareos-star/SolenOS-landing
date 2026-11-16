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
import { getJSON, postJSON, patchJSON } from "../../api/client";

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
  evidence_id?: string;
};

export type DecisionMemoryRevision = {
  id: string;
  revision_number: number;
  previous_payload: unknown;
  current_payload: unknown;
  revision_reason: string | null;
  changed_by_caregiver_id: string | null;
  changed_at: string | null;
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
  /** Canonical PostgreSQL record ID once server persistence succeeds. */
  postgres_id?: string;
  postgres_outcome_id?: string;
  postgres_outcome_snapshot?: string;
  postgres_snapshot?: string;
  extraction_ids?: string[];
  client_reference_id?: string;
  revisions?: DecisionMemoryRevision[];
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
          evidence_id: e.evidence_id,
        }))
      : (raw.evidence_texts ?? []).map((text) => ({ text }));
  const evidence_texts =
    evidence.map((e) => e.text).filter(Boolean).length > 0
      ? evidence.map((e) => e.text)
      : (raw.evidence_texts ?? [what]);

  return {
    id: raw.id ?? `dm_${Date.now().toString(36)}`,
    extraction_ids: Array.isArray(raw.extraction_ids) ? raw.extraction_ids.filter((v): v is string => typeof v === "string") : [],
    client_reference_id: typeof raw.client_reference_id === "string" ? raw.client_reference_id : undefined,
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
 * Rehydrate the decision cache from the authenticated PostgreSQL care record.
 * Local JSON is a cache only; the API remains the durable source of truth.
 */
export async function hydrateDecisionMemoryFromPostgres(careKey: string): Promise<void> {
  const [rows, outcomeRows, revisionRows] = await Promise.all([
    getJSON("/care-continuity/decisions") as Promise<Array<Record<string, unknown>>>,
    getJSON("/care-continuity/decision-outcomes") as Promise<Array<Record<string, unknown>>>,
    getJSON("/care-continuity/decision-revisions") as Promise<Array<Record<string, unknown>>>,
  ]);
  const revisionsByDecision = new Map<string, DecisionMemoryRevision[]>();
  for (const revision of revisionRows) {
    if (typeof revision.decision_id !== "string" || typeof revision.id !== "string") continue;
    const list = revisionsByDecision.get(revision.decision_id) ?? [];
    list.push({
      id: revision.id,
      revision_number: Number(revision.revision_number ?? 0),
      previous_payload: revision.previous_payload ?? null,
      current_payload: revision.current_payload ?? null,
      revision_reason: typeof revision.revision_reason === "string" ? revision.revision_reason : null,
      changed_by_caregiver_id: typeof revision.changed_by_caregiver_id === "string" ? revision.changed_by_caregiver_id : null,
      changed_at: typeof revision.changed_at === "string" ? revision.changed_at : null,
    });
    revisionsByDecision.set(revision.decision_id, list);
  }
  const outcomesByDecision = new Map<string, Record<string, unknown>>();
  for (const outcome of outcomeRows) {
    if (typeof outcome.decision_id === "string" && !outcomesByDecision.has(outcome.decision_id)) outcomesByDecision.set(outcome.decision_id, outcome);
  }
  const store = load(careKey);
  const existingById = new Map(store.entries.map((entry) => [entry.postgres_id ?? entry.id, entry]));
  const hydrated: DecisionMemoryEntry[] = rows
    .filter((row) => typeof row.id === "string" && typeof row.decision_text === "string")
    .map((row) => {
      let context: Record<string, unknown> = {};
      if (typeof row.context === "string") {
        try {
          const parsed = JSON.parse(row.context);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) context = parsed;
        } catch {
          context = { context_summary: row.context };
        }
      }
      const id = String(row.id);
      const previous = existingById.get(id);
      const serverWhat = String(row.decision_text);
      const what = previous?.postgres_snapshot !== undefined && previous.postgres_snapshot !== serverWhat ? previous.what : serverWhat;
      const when = String(row.decided_at ?? row.recorded_at ?? row.created_at ?? new Date().toISOString());
      const evidenceIds = Array.isArray(row.evidence_ids) ? row.evidence_ids.filter((v): v is string => typeof v === "string") : [];
      const evidenceText = typeof context.evidence_text === "string" ? context.evidence_text : what;
      const persistedOutcome = outcomesByDecision.get(id);
      return {
        id,
        postgres_id: id,
        postgres_snapshot: serverWhat,
        extraction_ids: previous?.extraction_ids ?? [],
        client_reference_id: typeof row.client_reference_id === "string" ? row.client_reference_id : previous?.client_reference_id,
        revisions: (revisionsByDecision.get(id) ?? []).sort((a, b) => a.revision_number - b.revision_number),
        ...(persistedOutcome && typeof persistedOutcome.id === "string" ? { postgres_outcome_id: persistedOutcome.id, postgres_outcome_snapshot: String(persistedOutcome.description ?? "") } : {}),
        care_key: storeKey(careKey),
        what,
        decision: what,
        when,
        who: previous?.who ?? (typeof row.created_by_caregiver_id === "string" ? [row.created_by_caregiver_id] : []),
        context_situation_id: typeof context.situation_id === "string" ? context.situation_id : null,
        context_summary: typeof context.context_summary === "string" ? context.context_summary : null,
        evidence: [{ source: "postgresql", text: evidenceText, ...(evidenceIds[0] ? { evidence_id: evidenceIds[0] } : {}), ...(typeof context.event_id === "string" ? { event_id: context.event_id } : {}) }],
        alternatives: Array.isArray(context.alternatives) ? context.alternatives.filter((v): v is string => typeof v === "string") : [],
        reason: typeof context.reason === "string" ? context.reason : null,
        outcome: previous && previous.postgres_outcome_snapshot !== undefined && previous.postgres_outcome_snapshot !== previous.outcome
          ? previous.outcome
          : typeof persistedOutcome?.description === "string" ? persistedOutcome.description : previous?.outcome ?? null,
        outcome_event_ids: previous?.outcome_event_ids ?? [],
        status: ["pending", "changed", "completed", "reversed", "uncertain", "needs_review"].includes(String(row.decision_status))
          ? row.decision_status as DecisionMemoryStatus
          : previous?.status ?? "active",
        evidence_texts: [evidenceText],
        recorded_at: String(row.recorded_at ?? row.created_at ?? when),
        content_tokens: tokens(what),
      };
    });
  const byId = new Map(hydrated.map((entry) => [entry.id, entry]));
  const hydratedByReference = new Map(
    hydrated.filter((entry) => entry.client_reference_id).map((entry) => [entry.client_reference_id!, entry]),
  );
  // Reconcile an ambiguous prior POST response by its stable person-scoped client reference.
  for (const entry of store.entries) {
    if (entry.postgres_id || byId.has(entry.id)) continue;
    const matched = entry.client_reference_id ? hydratedByReference.get(entry.client_reference_id) : undefined;
    if (matched) {
      byId.set(matched.id, {
        ...matched,
        ...entry,
        id: matched.id,
        postgres_id: matched.id,
        postgres_snapshot: matched.what,
        client_reference_id: matched.client_reference_id,
      });
    } else {
      byId.set(entry.id, entry);
    }
  }
  save({ care_key: storeKey(careKey), entries: [...byId.values()].slice(-100), updated_at: new Date().toISOString() });
}

/** Persist any newly captured decisions and replace temporary IDs with server IDs. */
export async function syncDecisionMemoryToPostgres(careKey: string): Promise<void> {
  const store = load(careKey);
  const entries = [...store.entries];
  for (const entry of entries) {
    if (entry.postgres_id) {
      if (entry.postgres_snapshot !== entry.what) {
        await patchJSON(`/care-continuity/decisions/${entry.postgres_id}`, {
          title: entry.what.slice(0, 240),
          decision_text: entry.what,
          decision_status: entry.status === "active" ? "recorded" : entry.status,
          context: JSON.stringify({
            reason: entry.reason,
            alternatives: entry.alternatives,
            situation_id: entry.context_situation_id,
            context_summary: entry.context_summary,
            evidence_text: entry.evidence[0]?.text ?? entry.what,
            event_id: entry.evidence[0]?.event_id ?? null,
          }),
        });
        const current = load(careKey);
        save({
          care_key: storeKey(careKey),
          entries: current.entries.map((candidate) =>
            candidate.postgres_id === entry.postgres_id ? { ...candidate, postgres_snapshot: candidate.what } : candidate,
          ),
          updated_at: new Date().toISOString(),
        });
      }
      continue;
    }
    const saved = await postJSON("/care-continuity/decisions", {
      title: entry.what.slice(0, 240),
      decision_text: entry.what,
      client_reference_id: entry.client_reference_id ?? entry.extraction_ids?.[0] ?? entry.id,
      decision_status: entry.status === "active" ? "recorded" : entry.status,
      decided_at: entry.when,
      context: JSON.stringify({
        reason: entry.reason,
        alternatives: entry.alternatives,
        situation_id: entry.context_situation_id,
        context_summary: entry.context_summary,
        evidence_text: entry.evidence[0]?.text ?? entry.what,
        event_id: entry.evidence[0]?.event_id ?? null,
      }),
      evidence_ids: [],
    }) as Record<string, unknown>;
    if (typeof saved.id !== "string" || !saved.id) {
      throw new Error("PostgreSQL did not return a canonical decision ID");
    }
    const current = load(careKey);
    save({
      care_key: storeKey(careKey),
      entries: current.entries.map((candidate) =>
        candidate.id === entry.id
          ? { ...candidate, id: saved.id as string, postgres_id: saved.id as string, postgres_snapshot: String(saved.decision_text ?? candidate.what), client_reference_id: entry.client_reference_id ?? entry.extraction_ids?.[0] ?? entry.id }
          : candidate,
      ),
      updated_at: new Date().toISOString(),
    });
  }

  // Outcome rows are written only after their decision has a server-issued ID.
  for (const entry of load(careKey).entries) {
    if (!entry.postgres_id || !entry.outcome || entry.postgres_outcome_snapshot === entry.outcome) continue;
    const outcome = await postJSON("/care-continuity/decision-outcomes", {
      decision_id: entry.postgres_id,
      outcome_status: "observed",
      observed_at: new Date().toISOString(),
      description: entry.outcome,
      evidence_ids: [],
      is_intended_outcome: false,
    }) as Record<string, unknown>;
    if (typeof outcome.id !== "string" || !outcome.id) {
      throw new Error("PostgreSQL did not return a persisted decision outcome ID");
    }
    const current = load(careKey);
    save({
      care_key: storeKey(careKey),
      entries: current.entries.map((candidate) =>
        candidate.postgres_id === entry.postgres_id
          ? { ...candidate, postgres_outcome_id: outcome.id as string, postgres_outcome_snapshot: candidate.outcome ?? "" }
          : candidate,
      ),
      updated_at: new Date().toISOString(),
    });
  }
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
  /** Preserve the extraction-layer identity so linked outcomes reference this exact decision. */
  id?: string;
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
    id: params.id ?? `dm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    extraction_ids: params.id ? [params.id] : [],
    client_reference_id: params.id ?? undefined,
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
  const prior = store.entries.find((e) => e.what === entry.what || e.decision === entry.what);
  const persistedEntry = prior?.postgres_id
    ? {
        ...entry,
        id: prior.id,
        postgres_id: prior.postgres_id,
        postgres_snapshot: prior.postgres_snapshot ?? prior.what,
        outcome: params.outcome !== undefined ? entry.outcome : prior.outcome,
        outcome_event_ids: prior.outcome_event_ids,
        extraction_ids: [...new Set([...(prior.extraction_ids ?? []), ...(params.id ? [params.id] : [])])],
        client_reference_id: prior.client_reference_id ?? params.id,
        revisions: prior.revisions ?? [],
        ...(prior.postgres_outcome_id ? { postgres_outcome_id: prior.postgres_outcome_id } : {}),
        ...(prior.postgres_outcome_snapshot ? { postgres_outcome_snapshot: prior.postgres_outcome_snapshot } : {}),
      }
    : entry;
  const next = [
    ...store.entries.filter((e) => e.what !== entry.what && e.decision !== entry.what),
    persistedEntry,
  ].slice(-24);
  save({ care_key: careKey, entries: next, updated_at: now });
  return persistedEntry;
}

/**
 * Link what happened afterward to an open decision (outcome continuity).
 */
export function linkDecisionOutcome(params: {
  careKey: string;
  outcomeText: string;
  eventId?: string;
  /** Required: outcomes must never be guessed onto the latest or a fuzzy-matched decision. */
  decisionId?: string;
  status?: DecisionMemoryStatus;
  nowIso?: string;
}): DecisionMemoryEntry | null {
  const outcome = params.outcomeText.trim().slice(0, 240);
  if (!outcome || !params.decisionId) return null;

  const store = load(params.careKey);
  const target = store.entries.find((entry) => entry.id === params.decisionId || entry.extraction_ids?.includes(params.decisionId));
  // A missing or cross-context decision reference is not permission to guess.
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
  const entries = store.entries.map((entry) =>
    entry.id === updated.id ? updated : entry,
  );
  save({ care_key: params.careKey, entries, updated_at: now });
  return updated;
}

/** Attach an extracted outcome only through its explicit same-extraction decision ID. */
export function recordDecisionOutcomeObservation(params: {
  careKey: string;
  decisionId: string;
  outcomeText: string;
  eventId?: string;
  nowIso?: string;
}): DecisionMemoryEntry | null {
  const outcome = params.outcomeText.trim().slice(0, 1000);
  if (!outcome || !params.decisionId) return null;
  const store = load(params.careKey);
  const target = store.entries.find((entry) => entry.id === params.decisionId || entry.extraction_ids?.includes(params.decisionId));
  if (!target) return null;
  const updated: DecisionMemoryEntry = {
    ...target,
    outcome,
    outcome_event_ids: params.eventId
      ? [...new Set([...target.outcome_event_ids, params.eventId])]
      : target.outcome_event_ids,
  };
  const now = params.nowIso ?? new Date().toISOString();
  save({
    care_key: storeKey(params.careKey),
    entries: store.entries.map((entry) => entry.id === updated.id ? updated : entry),
    updated_at: now,
  });
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
