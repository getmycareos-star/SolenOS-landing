/**
 * Care Reality Memory — store journey objects, not sentences.
 * Reality recurrence ≠ text recurrence.
 *
 * SoT: docs/02-product/solenos-care-reality-memory.md
 * Doc examples are illustrations only — never product if-branches on scenario nouns.
 */

import {
  livingCareRecordDataDir,
  readDurableJson,
  sanitizeDurableCareKey,
  writeDurableJson,
  clearDurableDirectory,
} from "../living-care-record-persistence/fs-store";
import { resolveCareRealityStoreKey } from "../multi-caregiver-context-model";
import {
  extractCareRealityFromText,
  type CareRealityExtractionResult,
} from "../care-reality-extraction";
import { classifyExtractionFragment } from "../care-reality-extraction/classify";

export const CARE_REALITY_MEMORY_PURPOSE =
  "Remember what happened in the care journey — never what the caregiver typed.";

export type CareRealityMemoryType =
  | "event"
  | "observation"
  | "decision"
  | "outcome"
  | "unknown"
  | "change"
  | "relationship"
  | "contributor_context";

export type CareRealityMemoryStatus =
  | "current"
  | "resolved"
  | "unknown"
  | "historical";

/** Engine-only bands — never % in caregiver UI. */
export type MemoryConfidenceBand = "low" | "medium" | "high";

/**
 * Care Reality Object — structured long-term memory unit.
 * Description is structured meaning — not a chat quote stored as memory.
 */
export type CareRealityMemoryObject = {
  id: string;
  care_key: string;
  type: CareRealityMemoryType;
  subject: string | null;
  description: string;
  time: string | null;
  source: string;
  related_object_ids: string[];
  confidence: {
    observation: MemoryConfidenceBand;
    cause: MemoryConfidenceBand;
  };
  status: CareRealityMemoryStatus;
  /** Memory priority 1 (care changes) … 5 (contributor context). */
  priority: 1 | 2 | 3 | 4 | 5;
  /** Tokens for reality recurrence — not raw sentence matching. */
  reality_signature: string[];
  recurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
  /** Evidence pointer only — raw text is not the memory. */
  evidence_ref: string | null;
};

type MemoryStore = {
  care_key: string;
  objects: CareRealityMemoryObject[];
  updated_at: string;
};

const memoryCache = new Map<string, MemoryStore>();

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
  "had",
  "was",
  "were",
  "are",
  "been",
  "her",
  "his",
  "she",
  "him",
  "they",
  "them",
  "mom",
  "dad",
  "about",
  "thinks",
  "too",
  "much",
  "more",
  "than",
  "only",
  "once",
  "month",
  "sister",
  "brother",
  "worrying",
  "overreacting",
]);

/** Theater: treating text/conversation frequency as care memory. */
export const TEXT_MEMORY_THEATER_PATTERNS = [
  /\bmentioned multiple times\b/i,
  /\brepeated (?:phrase|sentence|topic)\b/i,
  /\bconversation frequency\b/i,
  /\bremembers? what (?:you|i) (?:wrote|said|typed)\b/i,
  /\bhighlight(?:ed)? repeated\b/i,
  /\bfamily disagreement\b.*\b(?:as )?(?:the )?(?:main|primary) (?:memory|concern|situation)\b/i,
] as const;

export function containsTextMemoryTheater(blob: string): boolean {
  return TEXT_MEMORY_THEATER_PATTERNS.some((p) => p.test(blob));
}

export function memoryPriorityForType(type: CareRealityMemoryType): 1 | 2 | 3 | 4 | 5 {
  switch (type) {
    case "change":
    case "observation":
      return 1;
    case "decision":
    case "event":
      return 2;
    case "outcome":
      return 3;
    case "unknown":
    case "relationship":
      return 4;
    case "contributor_context":
      return 5;
    default:
      return 5;
  }
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function resolveKey(careKey: string): string {
  return resolveCareRealityStoreKey(careKey);
}

function filePath(careKey: string): string {
  return livingCareRecordDataDir(
    "care-reality-memory",
    `${sanitizeDurableCareKey(careKey)}.json`,
  );
}

function contentTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/** Structural reality signature — situation kind, not quote fingerprint. */
function realitySignature(params: {
  type: CareRealityMemoryType;
  description: string;
}): string[] {
  const tokens = contentTokens(params.description).slice(0, 8);
  const domainHints: string[] = [];
  const d = params.description.toLowerCase();
  if (/\b(?:sleep|nap|tired|fatigue)\b/.test(d)) domainHints.push("domain:sleep");
  if (/\b(?:eat|eating|appetite|food|meal)\b/.test(d)) domainHints.push("domain:nutrition");
  if (/\b(?:confused|confusion|question|forget|memory|cognitive)\b/.test(d)) {
    domainHints.push("domain:cognition");
  }
  if (/\b(?:walk|mobility|fall|unsteady)\b/.test(d)) domainHints.push("domain:mobility");
  if (/\b(?:hospital|discharg|medication|medicine|doctor)\b/.test(d)) {
    domainHints.push("domain:medical");
  }
  if (/\b(?:left (?:the )?(?:house|home)|leave home|wander)\b/.test(d)) {
    domainHints.push("domain:safety");
  }
  return [`type:${params.type}`, ...domainHints, ...tokens].slice(0, 12);
}

function signatureOverlap(a: string[], b: string[]): number {
  const setB = new Set(b);
  return a.filter((t) => setB.has(t)).length;
}

function loadStore(careKey: string): MemoryStore {
  const resolved = resolveKey(careKey);
  const cached = memoryCache.get(resolved);
  if (cached) return cached;
  const durable = readDurableJson<MemoryStore>(filePath(resolved));
  const store: MemoryStore = durable?.objects
    ? { ...durable, care_key: resolved }
    : { care_key: resolved, objects: [], updated_at: new Date().toISOString() };
  memoryCache.set(resolved, store);
  return store;
}

function saveStore(store: MemoryStore): void {
  const resolved = resolveKey(store.care_key);
  const normalized = { ...store, care_key: resolved, updated_at: new Date().toISOString() };
  memoryCache.set(resolved, normalized);
  writeDurableJson(filePath(resolved), normalized);
}

export function listCareRealityMemory(careKey: string): CareRealityMemoryObject[] {
  return [...loadStore(careKey).objects].sort((a, b) => a.priority - b.priority);
}

export function listPrimaryCareRealityMemory(careKey: string): CareRealityMemoryObject[] {
  return listCareRealityMemory(careKey).filter((o) => o.priority <= 4);
}

export function resetCareRealityMemoryStore(): void {
  memoryCache.clear();
  clearDurableDirectory(livingCareRecordDataDir("care-reality-memory"));
}

/**
 * True when matching is only on quote/phrase overlap — theater, not care intelligence.
 */
export function isTextRecurrenceOnly(params: {
  priorText: string;
  incomingText: string;
}): boolean {
  const a = params.priorText.trim().toLowerCase();
  const b = params.incomingText.trim().toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  // Near-identical chat lines without shared care-domain signature
  const short = a.length <= b.length ? a : b;
  const long = a.length <= b.length ? b : a;
  if (short.length >= 20 && long.includes(short.slice(0, Math.min(48, short.length)))) {
    const sig = realitySignature({ type: "observation", description: short });
    const hasCareDomain = sig.some((s) => s.startsWith("domain:"));
    return !hasCareDomain;
  }
  return false;
}

/**
 * Has this care situation (domain + type) happened before — not “same sentence typed.”
 */
export function detectRealityRecurrence(params: {
  careKey: string;
  type: CareRealityMemoryType;
  description: string;
}): CareRealityMemoryObject | null {
  const sig = realitySignature({ type: params.type, description: params.description });
  const domains = sig.filter((s) => s.startsWith("domain:"));
  if (domains.length === 0 && params.type === "contributor_context") return null;

  let best: CareRealityMemoryObject | null = null;
  let bestScore = 0;
  for (const o of listCareRealityMemory(params.careKey)) {
    if (o.type !== params.type && !(o.type === "observation" && params.type === "change")) {
      continue;
    }
    const score = signatureOverlap(sig, o.reality_signature);
    const domainHit = domains.some((d) => o.reality_signature.includes(d));
    if (domainHit && score >= 2 && score > bestScore) {
      best = o;
      bestScore = score;
    } else if (score >= 3 && score > bestScore) {
      best = o;
      bestScore = score;
    }
  }
  return best;
}

function upsertObject(
  store: MemoryStore,
  draft: Omit<
    CareRealityMemoryObject,
    "id" | "recurrence_count" | "first_seen_at" | "last_seen_at" | "reality_signature"
  > & { reality_signature?: string[]; nowIso: string },
): CareRealityMemoryObject {
  const sig =
    draft.reality_signature ??
    realitySignature({ type: draft.type, description: draft.description });
  const existing = detectRealityRecurrence({
    careKey: store.care_key,
    type: draft.type,
    description: draft.description,
  });

  if (existing) {
    const updated: CareRealityMemoryObject = {
      ...existing,
      description: draft.description.length < existing.description.length
        ? draft.description
        : existing.description,
      time: draft.time ?? existing.time,
      related_object_ids: [
        ...new Set([...existing.related_object_ids, ...draft.related_object_ids]),
      ],
      confidence: draft.confidence,
      status: draft.status,
      recurrence_count: existing.recurrence_count + 1,
      last_seen_at: draft.nowIso,
      reality_signature: [...new Set([...existing.reality_signature, ...sig])].slice(0, 12),
      evidence_ref: draft.evidence_ref ?? existing.evidence_ref,
    };
    store.objects = store.objects.map((o) => (o.id === existing.id ? updated : o));
    return updated;
  }

  const created: CareRealityMemoryObject = {
    id: newId("crm"),
    care_key: store.care_key,
    type: draft.type,
    subject: draft.subject,
    description: draft.description,
    time: draft.time,
    source: draft.source,
    related_object_ids: draft.related_object_ids,
    confidence: draft.confidence,
    status: draft.status,
    priority: draft.priority,
    reality_signature: sig,
    recurrence_count: 1,
    first_seen_at: draft.nowIso,
    last_seen_at: draft.nowIso,
    evidence_ref: draft.evidence_ref,
  };
  store.objects.push(created);
  return created;
}

/** Structured description — strip quote theater; keep meaning. */
function structureDescription(raw: string, max = 140): string {
  let t = raw.trim().replace(/\s+/g, " ");
  // Drop leading kinship chat framing when we already have subject
  t = t.replace(/^(?:my (?:mom|dad|mother|father|sister|brother)\s+)/i, "");
  t = t.replace(/^["“]|["”]$/g, "");
  if (t.length > max) t = `${t.slice(0, max - 1)}…`;
  return t.endsWith(".") ? t : `${t}.`;
}

/**
 * Ingest Care Reality Memory from a capture.
 * Family disagreement → contributor_context. Care recipient changes → observation/change/event.
 */
export function ingestCareRealityMemoryFromCapture(params: {
  careKey: string;
  rawText: string;
  subject: string | null;
  contributorId: string;
  nowIso?: string;
  extraction?: CareRealityExtractionResult | null;
}): {
  objects: CareRealityMemoryObject[];
  primary: CareRealityMemoryObject[];
  context_only: CareRealityMemoryObject[];
} {
  const resolved = resolveKey(params.careKey);
  const store = loadStore(resolved);
  const now = params.nowIso ?? new Date().toISOString();
  const extraction =
    params.extraction ??
    (params.rawText.trim().length >= 40
      ? extractCareRealityFromText({
          rawText: params.rawText,
          contributorId: params.contributorId,
        })
      : null);

  const created: CareRealityMemoryObject[] = [];
  const idByLayer = new Map<string, string>();

  const push = (
    type: CareRealityMemoryType,
    description: string,
    extras?: Partial<
      Pick<
        CareRealityMemoryObject,
        "time" | "related_object_ids" | "status" | "confidence" | "evidence_ref"
      >
    >,
  ) => {
    // Never promote disagreement / load as care-recipient observation
    if (type === "observation" || type === "change") {
      const cat = classifyExtractionFragment(description);
      if (cat === "contributor_load" || cat === "disagreement_perspective") {
        type = "contributor_context";
      }
    }
    const obj = upsertObject(store, {
      care_key: resolved,
      type,
      subject: type === "contributor_context" ? null : params.subject,
      description: structureDescription(description),
      time: extras?.time ?? null,
      source: params.contributorId,
      related_object_ids: extras?.related_object_ids ?? [],
      confidence: extras?.confidence ?? {
        observation: type === "contributor_context" ? "medium" : "high",
        cause: "low",
      },
      status: extras?.status ?? (type === "unknown" ? "unknown" : "current"),
      priority: memoryPriorityForType(type),
      evidence_ref: extras?.evidence_ref ?? null,
      nowIso: now,
    });
    created.push(obj);
    return obj;
  };

  if (extraction) {
    for (const e of extraction.events) {
      // Compound: "sleeping more since the hospital visit" → observation + event
      const compound = e.description.match(
        /^(.+?)\s+(?:since|after|following)\s+(.+)$/i,
      );
      if (
        compound &&
        /\b(?:sleep|tired|eat|eating|confused|confusion|walk|stopped|started|more|less)\b/i.test(
          compound[1]!,
        ) &&
        /\b(?:hospital|discharg|medication|medicine|doctor|appointment)\b/i.test(
          compound[2]!,
        )
      ) {
        const obsObj = push("observation", compound[1]!, {
          time: e.time,
          evidence_ref: e.id,
        });
        const evtObj = push("event", compound[2]!, {
          time: e.time,
          evidence_ref: e.id,
        });
        idByLayer.set(e.id, evtObj.id);
        push("relationship", "Change may relate to a recent medical event.", {
          related_object_ids: [obsObj.id, evtObj.id],
          confidence: { observation: "medium", cause: "low" },
          status: "unknown",
        });
        continue;
      }
      const o = push("event", e.description, {
        time: e.time,
        evidence_ref: e.id,
      });
      idByLayer.set(e.id, o.id);
    }
    for (const obs of extraction.observations) {
      const o = push("observation", obs.description, {
        time: obs.approximate_time,
        evidence_ref: obs.id,
        confidence: {
          observation: obs.confidence,
          cause: "low",
        },
      });
      idByLayer.set(obs.id, o.id);
    }
    for (const d of extraction.decisions) {
      const o = push("decision", d.description, {
        evidence_ref: d.id,
        status: d.status === "completed" ? "resolved" : "current",
      });
      idByLayer.set(d.id, o.id);
    }
    for (const out of extraction.outcomes) {
      const related = out.related_id ? idByLayer.get(out.related_id) : null;
      const o = push("outcome", out.description, {
        time: out.time,
        related_object_ids: related ? [related] : [],
        evidence_ref: out.id,
        status: out.status === "resolved" ? "resolved" : "current",
      });
      idByLayer.set(out.id, o.id);
    }
    for (const u of extraction.unknowns) {
      if (u.status !== "open") continue;
      const related = u.related_object_id ? idByLayer.get(u.related_object_id) : null;
      push("unknown", u.question, {
        related_object_ids: related ? [related] : [],
        evidence_ref: u.id,
        status: "unknown",
        confidence: { observation: "medium", cause: "low" },
      });
    }
    for (const n of extraction.non_care_facts) {
      push("contributor_context", n.text, {
        evidence_ref: n.id,
        confidence: { observation: "medium", cause: "low" },
      });
    }
    for (const r of extraction.relationships) {
      const from = idByLayer.get(r.from_id);
      const to = idByLayer.get(r.to_id);
      push("relationship", r.evidence_note || "Possible connection between care moments.", {
        related_object_ids: [from, to].filter(Boolean) as string[],
        evidence_ref: r.id,
        confidence: {
          observation: "medium",
          cause: r.certainty === "supported" ? "medium" : "low",
        },
        status: "unknown",
      });
    }
  }

  // Discourse fallbacks when extraction thin — still structured, not quote storage
  const raw = params.rawText.trim();
  if (created.filter((c) => c.priority <= 2).length === 0 && raw.length >= 20) {
    const cat = classifyExtractionFragment(raw);
    if (cat === "disagreement_perspective" || cat === "contributor_load") {
      push("contributor_context", raw);
    } else if (/\b(?:hospital|discharg|medication|medicine)\b/i.test(raw)) {
      push("event", raw);
    } else if (
      /\b(?:sleep|eating|confused|confusion|walk|stopped|started|more|less)\b/i.test(raw)
    ) {
      push("observation", raw);
    }
  }

  // Link medical event ↔ sleep/nutrition observation when co-present
  const events = store.objects.filter((o) => o.type === "event");
  const obs = store.objects.filter((o) => o.type === "observation" || o.type === "change");
  const med = events.find((e) => /hospital|medication|medicine|discharg/i.test(e.description));
  const sleep = obs.find((o) => /sleep|tired|appetite|eat/i.test(o.description));
  if (med && sleep) {
    push("relationship", "Sleep or daily-function change may relate to a recent medical event.", {
      related_object_ids: [med.id, sleep.id],
      confidence: { observation: "medium", cause: "low" },
      status: "unknown",
    });
    if (!store.objects.some((o) => o.type === "unknown" && /cause|why|reason/i.test(o.description))) {
      push("unknown", "Cause of the change after the medical event is not held yet.", {
        related_object_ids: [med.id, sleep.id],
        status: "unknown",
      });
    }
  }

  // Cap store size — prefer keeping higher-priority objects
  store.objects = [...store.objects]
    .sort((a, b) => a.priority - b.priority || b.last_seen_at.localeCompare(a.last_seen_at))
    .slice(0, 80);
  saveStore(store);

  const uniqueCreated = [...new Map(created.map((o) => [o.id, o])).values()];
  return {
    objects: uniqueCreated,
    primary: uniqueCreated.filter((o) => o.priority <= 4),
    context_only: uniqueCreated.filter((o) => o.type === "contributor_context"),
  };
}

/**
 * Journey answer from memory — not “what sentences were stored.”
 */
export function summarizeCareRealityMemory(params: {
  careKey: string;
  subject?: string | null;
}): {
  what_changed: string[];
  decisions: string[];
  outcomes: string[];
  unknowns: string[];
  context: string[];
  recurring_patterns: string[];
} {
  const all = listCareRealityMemory(params.careKey);
  const what_changed = all
    .filter((o) => o.type === "observation" || o.type === "change" || o.type === "event")
    .filter((o) => o.priority <= 2)
    .slice(0, 5)
    .map((o) => o.description);
  const decisions = all.filter((o) => o.type === "decision").slice(0, 3).map((o) => o.description);
  const outcomes = all.filter((o) => o.type === "outcome").slice(0, 3).map((o) => o.description);
  const unknowns = all.filter((o) => o.type === "unknown").slice(0, 3).map((o) => o.description);
  const context = all
    .filter((o) => o.type === "contributor_context")
    .slice(0, 2)
    .map((o) => o.description);
  const recurring_patterns = all
    .filter((o) => o.recurrence_count >= 2 && o.priority <= 2)
    .slice(0, 3)
    .map(
      (o) =>
        `Recurring care pattern (${o.recurrence_count}×): ${o.description.replace(/\.$/, "")}.`,
    );

  return { what_changed, decisions, outcomes, unknowns, context, recurring_patterns };
}

/**
 * True when primary memories wrongly center family disagreement over care recipient changes.
 */
export function centersArgumentAsCareMemory(params: {
  careKey: string;
}): boolean {
  const all = listCareRealityMemory(params.careKey);
  if (all.length === 0) return false;
  const care = all.filter((o) => o.priority <= 2);
  const ctx = all.filter((o) => o.type === "contributor_context");
  // Fail if only family/context was stored as memory
  if (care.length === 0 && ctx.length > 0) return true;
  // Fail if a context object outranks care-recipient changes
  if (ctx[0] && care[0] && ctx[0].priority < care[0].priority) return true;
  return false;
}
