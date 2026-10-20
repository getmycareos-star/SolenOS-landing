/**
 * Research feedback — capture understanding Yes/No (+ No details). Never discard.
 * SoT: docs/02-product/solenos-learning-first-release.md
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
  UNDERSTANDING_FEEDBACK_NO_PROMPTS,
  UNDERSTANDING_FEEDBACK_PROMPT,
} from "../learning-first-release";

export const RESEARCH_FEEDBACK_PURPOSE =
  "Store caregiver understanding feedback after each response — product research, not engagement.";

export type ResearchUnderstandingFeedback = {
  id: string;
  care_key: string;
  created_at: string;
  /** Did SolenOS help understand this situation? */
  helped_understand: boolean;
  /** Free-text answers when helped_understand === false */
  missed: string | null;
  expected_understanding: string | null;
  confusing: string | null;
  expected_notice: string | null;
  /** Optional link to situation / observation turn */
  situation_id: string | null;
  raw_input_excerpt: string | null;
};

type ResearchFeedbackStore = {
  care_key: string;
  entries: ResearchUnderstandingFeedback[];
};

function normalizeCareKey(careKey: string): string {
  return resolveCareRealityStoreKey(careKey.trim());
}

function filePath(careKey: string): string {
  return livingCareRecordDataDir(
    "research-feedback",
    `${sanitizeDurableCareKey(normalizeCareKey(careKey))}.json`,
  );
}

const memory = new Map<string, ResearchFeedbackStore>();

function loadStore(careKey: string): ResearchFeedbackStore {
  const key = normalizeCareKey(careKey);
  const cached = memory.get(key);
  if (cached) return cached;
  const fromDisk = readDurableJson<ResearchFeedbackStore>(filePath(key));
  const store: ResearchFeedbackStore = fromDisk ?? { care_key: key, entries: [] };
  memory.set(key, store);
  return store;
}

function saveStore(store: ResearchFeedbackStore): void {
  memory.set(store.care_key, store);
  writeDurableJson(filePath(store.care_key), store);
}

export function recordUnderstandingFeedback(params: {
  careKey: string;
  helpedUnderstand: boolean;
  missed?: string | null;
  expectedUnderstanding?: string | null;
  confusing?: string | null;
  expectedNotice?: string | null;
  situationId?: string | null;
  rawInputExcerpt?: string | null;
  id?: string;
  nowIso?: string;
}): ResearchUnderstandingFeedback {
  const store = loadStore(params.careKey);
  const entry: ResearchUnderstandingFeedback = {
    id: params.id ?? `rf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    care_key: store.care_key,
    created_at: params.nowIso ?? new Date().toISOString(),
    helped_understand: params.helpedUnderstand,
    missed: params.helpedUnderstand ? null : trimOrNull(params.missed),
    expected_understanding: params.helpedUnderstand
      ? null
      : trimOrNull(params.expectedUnderstanding),
    confusing: params.helpedUnderstand ? null : trimOrNull(params.confusing),
    expected_notice: params.helpedUnderstand ? null : trimOrNull(params.expectedNotice),
    situation_id: params.situationId?.trim() || null,
    raw_input_excerpt: params.rawInputExcerpt?.trim().slice(0, 400) || null,
  };
  store.entries.push(entry);
  saveStore(store);
  return entry;
}

function trimOrNull(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t.slice(0, 2000) : null;
}

export function listUnderstandingFeedback(careKey: string): ResearchUnderstandingFeedback[] {
  return [...loadStore(careKey).entries];
}

export function countUnderstandingFeedback(careKey?: string): {
  total: number;
  yes: number;
  no: number;
} {
  if (careKey) {
    const entries = listUnderstandingFeedback(careKey);
    return {
      total: entries.length,
      yes: entries.filter((e) => e.helped_understand).length,
      no: entries.filter((e) => !e.helped_understand).length,
    };
  }
  let total = 0;
  let yes = 0;
  let no = 0;
  for (const store of memory.values()) {
    for (const e of store.entries) {
      total += 1;
      if (e.helped_understand) yes += 1;
      else no += 1;
    }
  }
  return { total, yes, no };
}

export function resetResearchFeedbackStore(): void {
  memory.clear();
  clearDurableDirectory(livingCareRecordDataDir("research-feedback"));
}

export {
  UNDERSTANDING_FEEDBACK_PROMPT,
  UNDERSTANDING_FEEDBACK_NO_PROMPTS,
};
