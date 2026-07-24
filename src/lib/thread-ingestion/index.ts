/**
 * Thread Ingestion (G6) — long chats/emails → multiple linked observations.
 *
 * Decision B: collection of related information, not one summary.
 * Preserve original source as evidence; derive fragments for ACS ingest.
 *
 * Caregiver never sees extraction steps or relationship enums.
 */

import type { CareEventKind } from "../living-care-record-ux/event-clarifiers";
import { classifyCareEventKind } from "../living-care-record-ux/event-clarifiers";
import { ingestActiveCareObservation } from "../active-care-situation";
import type { ActiveSituationTurn } from "../active-care-situation/types";
import { THREAD_SOURCE_EVIDENCE_PREFIX } from "./detect";
import { recordThreadSourceEvidence } from "./source-evidence";

export const THREAD_INGESTION_PURPOSE =
  "Long threads become multiple linked care observations — source preserved, not one chat summary.";

export {
  THREAD_SOURCE_EVIDENCE_PREFIX,
  caregiverFacingFragmentText,
  looksLikeCareThread,
} from "./detect";

export {
  recordThreadSourceEvidence,
  listThreadSourceEvidence,
  getThreadSourceEvidence,
  resetThreadSourceEvidenceStore,
} from "./source-evidence";

const MAX_FRAGMENTS = 8;
const MIN_FRAGMENT_LEN = 12;

/** Care-relevant enough to stand as its own observation (principle shapes, not scenario nouns). */
function looksCareRelevant(text: string): boolean {
  const t = text.trim();
  if (t.length < MIN_FRAGMENT_LEN) return false;
  return (
    /\b(fell|fall|ate|eat|eating|refus|medication|medicine|dose|doctor|appointment|confused|ask(?:ed)?|walk|afraid|worried|decided|stopped|started|urgent|hospital|home|bathroom|sleep|energy)\b/i.test(
      t,
    ) || t.length >= 40
  );
}

/**
 * Split a long family thread into care-relevant fragments.
 * Does not invent content — only partitions the source.
 */
export function splitCareThread(rawThread: string): string[] {
  const raw = rawThread.replace(/\r\n/g, "\n").trim();
  if (!raw) return [];

  // 1) Speaker / timestamp blocks (WhatsApp-like / email)
  const speakerBlocks = raw
    .split(/\n(?=(?:\[[^\]]+\]\s*)?[A-Za-z][A-Za-z .'-]{0,40}:\s)/)
    .map((b) => b.trim())
    .filter(Boolean);

  let candidates: string[] = [];
  if (speakerBlocks.length >= 2) {
    candidates = speakerBlocks.map((b) =>
      b.replace(/^(?:\[[^\]]+\]\s*)?[A-Za-z][A-Za-z .'-]{0,40}:\s*/u, "").trim(),
    );
  } else {
    // 2) Blank-line paragraphs
    const paras = raw.split(/\n\s*\n/).map((p) => p.replace(/\n/g, " ").trim()).filter(Boolean);
    if (paras.length >= 2) {
      candidates = paras;
    } else {
      // 3) Sentence split for dense blobs
      candidates = raw
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }

  const fragments = candidates
    .map((c) => c.replace(/\s+/g, " ").trim())
    .filter(looksCareRelevant)
    .slice(0, MAX_FRAGMENTS);

  // If nothing split usefully, keep whole as one fragment (still not a "summary product")
  if (fragments.length === 0 && raw.length >= MIN_FRAGMENT_LEN) {
    return [raw.slice(0, 500)];
  }
  return fragments;
}

export type ThreadIngestResult = {
  source_preserved: string;
  thread_id: string;
  fragments: string[];
  turns: ActiveSituationTurn[];
  /** True when more than one linked observation was produced. */
  multiple_linked_events: boolean;
  /** Never the product — chat summary forbidden. */
  is_chat_summary: false;
};

/**
 * Ingest a long thread as multiple linked ACS observations.
 * Full source is durable evidence; observations are fragments with pointer on first.
 * Per-fragment kind classification — never force one event type for the whole thread.
 */
export function ingestCareThread(params: {
  caregiverId: string;
  rawThread: string;
  nowIso?: string;
  contributorId?: string;
  /** @deprecated Prefer per-fragment classify — do not force one kind. */
  baseKind?: CareEventKind;
  /** Optional CareEvent ids from spine — attached to the last fragment. */
  eventIds?: string[];
  situationId?: string;
  rootEventId?: string | null;
}): ThreadIngestResult {
  const source_preserved = params.rawThread.replace(/\r\n/g, "\n").trim();
  const fragments = splitCareThread(source_preserved);
  const turns: ActiveSituationTurn[] = [];
  const base = Date.parse(params.nowIso ?? new Date().toISOString()) || Date.now();

  const evidence = recordThreadSourceEvidence({
    careKey: params.caregiverId,
    sourceText: source_preserved,
    fragmentCount: fragments.length,
    capturedAt: params.nowIso,
  });

  let situationId = params.situationId;
  let rootEventId = params.rootEventId ?? null;

  fragments.forEach((frag, i) => {
    // First obs: durable pointer + fragment (full source is in thread-evidence store).
    // Later obs: fragment only. Never embed a truncated "chat summary" as the product.
    const text =
      i === 0
        ? `${THREAD_SOURCE_EVIDENCE_PREFIX}\n${evidence.thread_id}\n---\n${frag}`
        : frag;
    const kind = classifyCareEventKind(frag);
    const isLast = i === fragments.length - 1;
    const turn = ingestActiveCareObservation({
      caregiverId: params.caregiverId,
      rawText: text,
      kind,
      contributorId: params.contributorId,
      nowIso: new Date(base + i * 60_000).toISOString(),
      eventIds: isLast ? params.eventIds : undefined,
      situationId,
      rootEventId,
      // Locked B: all fragments update one Active Care Situation — not separate opens.
      forceRelation: i === 0 ? undefined : "adds_context",
    });
    if (i === 0) {
      situationId = turn.situation.id;
      rootEventId = turn.situation.root_event_id;
    }
    turns.push(turn);
  });

  return {
    source_preserved,
    thread_id: evidence.thread_id,
    fragments,
    turns,
    multiple_linked_events: fragments.length > 1,
    is_chat_summary: false,
  };
}
