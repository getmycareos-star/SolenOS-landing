import {
  ACTIVE_SITUATION_STORAGE_KEY,
  SITUATIONS_STORAGE_KEY,
} from "./contract-constants";
import type {
  ActiveSituation,
  DecisionRiskLevel,
  Situation,
  SituationStatus,
} from "./types";

function createSituationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `sit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createSituation(params: {
  title: string;
  riskLevel?: DecisionRiskLevel;
  status?: SituationStatus;
  id?: string;
}): Situation {
  const now = new Date().toISOString();
  return {
    id: params.id ?? createSituationId(),
    title: params.title.slice(0, 120) || "Untitled situation",
    status: params.status ?? "active",
    riskLevel: params.riskLevel ?? "MEDIUM",
    documents: [],
    openQuestions: [],
    nextActions: [],
    risks: [],
    responsibilities: [],
    contextSummary: "",
    updatedAt: now,
  };
}

export function toActiveSituation(situation: Situation): ActiveSituation {
  return {
    id: situation.id,
    title: situation.title,
    status: situation.status,
    riskLevel: situation.riskLevel,
  };
}

export function listActiveSituations(situations: Situation[]): ActiveSituation[] {
  return situations
    .filter((s) => s.status !== "resolved" && uiStatusIsOperationallyActiveSafe(s.status))
    .map(toActiveSituation)
    .sort((a, b) => {
      const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
      return rank[a.riskLevel] - rank[b.riskLevel];
    });
}

/** Local helper — keep ui-runtime free of hard resolution-engine import cycles in browser. */
function uiStatusIsOperationallyActiveSafe(status: SituationStatus): boolean {
  return status === "active" || status === "blocked" || status === "waiting";
}

export function upsertSituation(
  situations: Situation[],
  next: Situation,
): Situation[] {
  const idx = situations.findIndex((s) => s.id === next.id);
  if (idx === -1) return [...situations, next];
  const copy = [...situations];
  copy[idx] = next;
  return copy;
}

export function updateSituationFromDecision(
  situation: Situation,
  params: {
    riskLevel: DecisionRiskLevel;
    openQuestions: string[];
    nextBestAction: string;
    whatIsHappening: string;
  },
): Situation {
  return {
    ...situation,
    riskLevel: params.riskLevel,
    openQuestions: params.openQuestions,
    nextActions: [params.nextBestAction],
    contextSummary: params.whatIsHappening.slice(0, 200),
    // Never resurrect resolved situations — create a new ACTIVE via Resolution Engine instead.
    status: situation.status,
    updatedAt: new Date().toISOString(),
  };
}

export function titleFromInput(input: string): string {
  const cleaned = input.trim().replace(/\s+/g, " ");
  if (cleaned.length <= 72) return cleaned || "Untitled situation";
  return `${cleaned.slice(0, 69)}…`;
}

export function loadSituationsFromStorage(): Situation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SITUATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Situation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistSituations(situations: Situation[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SITUATIONS_STORAGE_KEY, JSON.stringify(situations));
}

export function loadActiveSituationId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_SITUATION_STORAGE_KEY);
}

export function persistActiveSituationId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (!id) {
    window.localStorage.removeItem(ACTIVE_SITUATION_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(ACTIVE_SITUATION_STORAGE_KEY, id);
}
