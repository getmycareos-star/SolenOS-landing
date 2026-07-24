import { upsertCase } from "./stores/case-store";
import {
  appendCaseEvent,
  createEventId,
} from "./stores/event-timeline-store";
import {
  outcomeFromSuccess,
  recordInterventionOutcome,
} from "./stores/intervention-outcome-store";
import { persistCaseBestEffort, persistEventBestEffort } from "./stores/persistence-adapters";
import type { Case, CaseEvent, CaseIntervention, ExtractedCaseFacts } from "./types";

export type UpdateCaseResult = {
  caseEntity: Case;
  newEvents: CaseEvent[];
};

function conditionId(name: string): string {
  return `cond_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
}

/**
 * Mutate Case layers from extracted facts; append Timeline events; index interventions.
 */
export function updateCaseFromFacts(
  caseEntity: Case,
  facts: ExtractedCaseFacts,
  params?: { source?: string; now?: string; situationId?: string },
): UpdateCaseResult {
  const now = params?.now ?? new Date().toISOString();
  const source = params?.source ?? "caregiver_input";
  let next: Case = {
    ...caseEntity,
    conditions: [...caseEntity.conditions],
    medications: [...caseEntity.medications],
    providers: [...caseEntity.providers],
    facilities: [...caseEntity.facilities],
    documents: [...caseEntity.documents],
    familyContext: { ...caseEntity.familyContext },
    understanding: { ...caseEntity.understanding, activePatterns: [...caseEntity.understanding.activePatterns], successfulInterventions: [...caseEntity.understanding.successfulInterventions], openRisks: [...caseEntity.understanding.openRisks] },
    situationIds: [...caseEntity.situationIds],
    updatedAt: now,
  };

  if (facts.relationshipHint && !next.profile.relationship) {
    next = {
      ...next,
      profile: { ...next.profile, relationship: facts.relationshipHint },
    };
  }

  for (const c of facts.conditions) {
    if (!next.conditions.some((x) => x.name.toLowerCase() === c.name.toLowerCase())) {
      next.conditions.push({
        id: conditionId(c.name),
        name: c.name,
        status: "active",
        notedAt: now,
        source,
      });
    }
  }

  for (const m of facts.medications) {
    if (!next.medications.some((x) => x.name.toLowerCase() === m.name.toLowerCase())) {
      next.medications.push({
        id: `med_${m.name.toLowerCase()}`,
        name: m.name,
        dose: m.dose,
        status: "active",
        notedAt: now,
        source,
      });
    }
  }

  for (const p of facts.providers) {
    if (!next.providers.some((x) => x.name.toLowerCase() === p.name.toLowerCase())) {
      next.providers.push({
        id: `prov_${p.name.toLowerCase().replace(/\s+/g, "_")}`,
        name: p.name,
        role: p.role,
        notedAt: now,
        source,
      });
    }
  }

  for (const f of facts.facilities) {
    if (!next.facilities.some((x) => x.name.toLowerCase() === f.name.toLowerCase())) {
      next.facilities.push({
        id: `fac_${f.name.toLowerCase().replace(/\s+/g, "_")}`,
        name: f.name,
        notedAt: now,
        source,
      });
    }
  }

  const newEvents: CaseEvent[] = [];

  for (const ev of facts.events) {
    const event: CaseEvent = {
      id: createEventId(),
      caseId: next.id,
      timestamp: now,
      eventType: ev.eventType,
      source,
      summary: ev.summary,
      location: ev.location,
      riskLevel: ev.riskLevel,
      tags: ev.tags,
      situationId: params?.situationId,
    };
    appendCaseEvent(event);
    persistEventBestEffort(event);
    newEvents.push(event);

    if (ev.riskLevel === "high" || ev.riskLevel === "medium") {
      const riskLabel = `${ev.eventType}:${ev.riskLevel}`;
      if (!next.understanding.openRisks.includes(riskLabel)) {
        next.understanding.openRisks.push(riskLabel);
      }
    }
    if (!next.understanding.activePatterns.includes(ev.eventType) && ev.eventType !== "general") {
      next.understanding.activePatterns.push(ev.eventType);
    }
  }

  for (const iv of facts.interventions) {
    const intervention: CaseIntervention = {
      id: `int_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      label: iv.label,
      technique: iv.technique,
      appliedAt: now,
      outcome:
        iv.success === true
          ? outcomeFromSuccess(iv.outcomeSummary ?? `${iv.label} succeeded`, now)
          : iv.success === false
            ? { success: false, summary: iv.outcomeSummary ?? `${iv.label} failed`, recordedAt: now }
            : undefined,
    };

    const relatedType = newEvents.find((e) => e.eventType === "wandering" || e.eventType === "agitation")?.eventType
      ?? newEvents[0]?.eventType
      ?? "intervention";

    const linkedEvent: CaseEvent = {
      id: createEventId(),
      caseId: next.id,
      timestamp: now,
      eventType: "intervention",
      source,
      summary: iv.label,
      tags: [iv.technique ?? iv.label, relatedType].map((t) => t.toLowerCase().replace(/\s+/g, "_")),
      intervention,
      outcome: intervention.outcome,
      riskLevel: "medium",
    };
    appendCaseEvent(linkedEvent);
    persistEventBestEffort(linkedEvent);
    newEvents.push(linkedEvent);

    recordInterventionOutcome({
      caseId: next.id,
      intervention,
      eventTypeHints: [relatedType, "wandering", "agitation", "behavior"],
      tags: linkedEvent.tags,
    });

    if (iv.success && !next.understanding.successfulInterventions.includes(iv.label)) {
      next.understanding.successfulInterventions.push(iv.label);
    }
  }

  const condNames = next.conditions.map((c) => c.name).join(", ") || "none noted";
  next.understanding = {
    ...next.understanding,
    summary: `${next.profile.displayName} (${next.profile.relationship ?? "care recipient"}): conditions=${condNames}; patterns=${next.understanding.activePatterns.join(", ") || "none"}; successful interventions=${next.understanding.successfulInterventions.join(", ") || "none"}.`,
    updatedAt: now,
  };

  if (params?.situationId && !next.situationIds.includes(params.situationId)) {
    next.situationIds.push(params.situationId);
  }

  const saved = upsertCase(next);
  persistCaseBestEffort(saved);
  return { caseEntity: saved, newEvents };
}
