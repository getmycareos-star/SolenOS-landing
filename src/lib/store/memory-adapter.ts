import type { SessionMemory, SignalVector } from "../process/types";
import type { MemoryItem, SolenOSStore } from "./types";
import { newId, nowIso } from "./utils";

/** Session-scoped memory only — no cross-session leakage. */
export function getSessionMemoryItems(
  store: SolenOSStore,
  sessionId: string,
): MemoryItem[] {
  return store.memory.filter((m) => m.session_id === sessionId);
}

export function memoryItemsToSessionMemory(items: MemoryItem[]): SessionMemory {
  const baseline_facts: string[] = [];
  const provider_names: string[] = [];
  const unresolved_issues: string[] = [];
  const session_summaries: string[] = [];
  const medications: string[] = [];

  for (const item of items) {
    if (item.fact.startsWith("baseline:")) baseline_facts.push(item.fact.slice(9));
    else if (item.fact.startsWith("provider:")) provider_names.push(item.fact.slice(9));
    else if (item.fact.startsWith("unresolved:")) unresolved_issues.push(item.fact.slice(11));
    else if (item.fact.startsWith("summary:")) session_summaries.push(item.fact.slice(8));
    else if (item.fact.startsWith("medication:")) medications.push(item.fact.slice(11));
  }

  return {
    baseline_facts: [...new Set(baseline_facts)].slice(-10),
    provider_names: [...new Set(provider_names)].slice(-10),
    unresolved_issues: [...new Set(unresolved_issues)].slice(-8),
    session_summaries: session_summaries.slice(-5),
    medications: [...new Set(medications)].slice(-15),
    turn_count: session_summaries.length,
    last_question: "",
  };
}

export function persistMemoryFromTurn(
  store: SolenOSStore,
  params: {
    user_id: string;
    session_id: string;
    source_event_id: string;
    raw: string;
    signals: SignalVector;
    summary: string;
    unresolved: string;
    offset: number;
  },
): MemoryItem[] {
  const created: MemoryItem[] = [];
  const ts = nowIso();

  function push(fact: string, weight: number, salience: number) {
    const item: MemoryItem = {
      memory_id: newId("mem", params.session_id, params.offset + created.length),
      user_id: params.user_id,
      session_id: params.session_id,
      fact,
      weight,
      recency: 1,
      emotional_salience: salience,
      contradiction_flag: false,
      source_event_id: params.source_event_id,
      created_at: ts,
    };
    store.memory.push(item);
    created.push(item);
  }

  if (/\b(normal|baseline|usually)\b/i.test(params.raw)) {
    push(`baseline:${params.raw.trim().slice(0, 120)}`, 0.8, 0.2);
  }

  for (const med of params.signals.medical_entities.filter((e) => /med/.test(e))) {
    push(`medication:${med}`, 0.7, 0.1);
  }

  const providers = params.raw.match(
    /\b(doctor|physician|nurse|dr\.?\s+\w+|pulmonologist|provider)\b/gi,
  );
  if (providers) {
    for (const p of providers) {
      push(`provider:${p.toLowerCase()}`, 0.6, 0.1);
    }
  }

  if (params.unresolved) {
    push(`unresolved:${params.unresolved}`, 0.75, 0.3);
  }

  if (params.summary) {
    push(`summary:${params.summary.slice(0, 200)}`, 0.5, params.signals.emotional_intensity);
  }

  return created;
}
