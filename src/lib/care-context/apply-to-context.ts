import type {
  CareContext,
  ChangeRecord,
  ContextCareEvent,
  QuestionInterpretation,
} from "./types";
import {
  createEmptyOMLState,
  updateCareContextWithOML,
} from "../oml/integrate-context";
import type { OMLState } from "../oml/types";

function generateId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function detectChanges(
  existing: ContextCareEvent[],
  incoming: ContextCareEvent[],
): ChangeRecord[] {
  const changes: ChangeRecord[] = [];
  const now = new Date().toISOString();

  const existingDescs = new Set(
    existing.map((e) => e.description.toLowerCase()),
  );

  for (const event of incoming) {
    if (!existingDescs.has(event.description.toLowerCase())) {
      let category: ChangeRecord["category"] = "other";
      const lower = event.description.toLowerCase();

      if (/\b(wander(?:ing)?|agitat(?:ed|ion)?|confus(?:ed|ion)?|memory)\b/.test(lower)) {
        category = "behavior_change";
      } else if (/\b(worse|declin|progress|new symptom)\b/.test(lower)) {
        category = "progression";
      } else if (/\b(pain|headache|fever|symptom|appetite)\b/.test(lower)) {
        category = "new_symptom";
      } else if (/\b(24\s*\/\s*7|professional care|nursing|memory care)\b/.test(lower)) {
        category = "care_level";
      }

      changes.push({
        description: event.description,
        detectedAt: now,
        category,
        evidence: [event.description],
      });
    }
  }

  return changes;
}

function mergeUncertainties(
  existing: string[],
  fromInterpretation: string[],
): string[] {
  const seen = new Set(existing.map((u) => u.toLowerCase()));
  const merged = [...existing];
  for (const u of fromInterpretation) {
    if (!seen.has(u.toLowerCase())) {
      seen.add(u.toLowerCase());
      merged.push(u);
    }
  }
  return merged;
}

/**
 * Apply a question interpretation to longitudinal CareContext.
 * This is the core continuity pipeline — not an answer generator.
 */
export function applyQuestionToContext(
  context: CareContext,
  interpretation: QuestionInterpretation,
  omlState: OMLState = createEmptyOMLState(),
): CareContext {
  const now = new Date().toISOString();

  const newEvents: ContextCareEvent[] = interpretation.proposedEvents.map(
    (e) => ({
      ...e,
      id: generateId(),
      recordedAt: now,
    }),
  );

  const recentChanges = detectChanges(context.timeline, newEvents);
  const timeline = [...context.timeline, ...newEvents].sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return a.recordedAt.localeCompare(b.recordedAt);
  });

  const prioritizedActions = [...context.prioritizedActions];

  if (interpretation.engineActions.includes("recommend_professional_consultation")) {
    const action = {
      action: "Consult with an appropriate healthcare professional",
      urgency: "soon" as const,
      reason: "Decision threshold or clinical concern detected in caregiver input",
    };
    if (!prioritizedActions.some((a) => a.action === action.action)) {
      prioritizedActions.push(action);
    }
  }

  if (interpretation.signalThemes.includes("emotional_burden")) {
    prioritizedActions.push({
      action: "Assess caregiver capacity and support needs",
      urgency: "soon",
      reason: "Emotional burden signal detected — continuity includes caregiver state",
    });
  }

  const updated: CareContext = {
    ...context,
    timeline,
    recentChanges: [...context.recentChanges, ...recentChanges],
    uncertainties: mergeUncertainties(context.uncertainties, interpretation.uncertainties),
    prioritizedActions: prioritizedActions.slice(-8),
    updatedAt: now,
  };

  const { context: withOml } = updateCareContextWithOML(updated, omlState);
  return withOml;
}

export function createEmptyContext(): CareContext {
  return {
    timeline: [],
    recentChanges: [],
    uncertainties: [],
    prioritizedActions: [],
    updatedAt: new Date().toISOString(),
  };
}
