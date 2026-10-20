import type {
  CrossDomainReasoningInput,
  CrossDomainReasoningResult,
  EventDomainAssignment,
  RelationshipCandidate,
  CrossDomainRelationship,
  CrossDomainSituation,
  DomainParticipation,
} from "./types";
import type { CanonicalCareEvent } from "../situation-entry/types";
import type { OpenContradiction } from "../contradiction-detection-engine/types";
import type { DomainCategory, RelationshipStrength, SituationStatus } from "./contract-constants";
import {
  DOMAIN_MAPPING_RULES,
  EXPLICIT_CONNECTION_PATTERNS,
  CONTEXTUAL_LINK_PATTERNS,
  TEMPORAL_WINDOWS,
  MINIMUM_DOMAINS_FOR_SITUATION,
  MINIMUM_EVENTS_FOR_SITUATION,
  MAX_SITUATIONS_PER_RECIPIENT,
  CROSS_DOMAIN_REASONING_PURPOSE,
  CROSS_DOMAIN_REASONING_DEFINING_PRINCIPLE,
} from "./contract-constants";

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseTimeToDays(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  const now = new Date();
  return Math.abs(now.getTime() - t.getTime()) / (1000 * 60 * 60 * 24);
}

function timeBetweenDays(a?: string | null, b?: string | null): number | null {
  if (!a || !b) return null;
  const ta = new Date(a);
  const tb = new Date(b);
  if (Number.isNaN(ta.getTime()) || Number.isNaN(tb.getTime())) return null;
  return Math.abs(ta.getTime() - tb.getTime()) / (1000 * 60 * 60 * 24);
}

function eventTimeStart(event: { event_time: { start?: string; type?: string }; timestamp: string }): string | null {
  if (event.event_time.type === "unknown") return null;
  return event.event_time.start ?? event.timestamp;
}

function domainMatchesKeywords(
  domain: string,
  text: string,
  attributeKeys: string[],
  attributes: Record<string, string | string[] | boolean | null>,
): boolean {
  const lower = text.toLowerCase();
  for (const kw of DOMAIN_MAPPING_RULES.find((r) => r.domain === domain)?.keywords ?? []) {
    if (lower.includes(kw.toLowerCase())) return true;
  }
  for (const key of attributeKeys) {
    if (key in attributes) {
      const val = attributes[key];
      if (val === true) return true;
      if (typeof val === "string" && val.length > 0) {
        const domainKeywords = DOMAIN_MAPPING_RULES.find((r) => r.domain === domain)?.keywords ?? [];
        if (domainKeywords.some((kw) => val.toLowerCase().includes(kw.toLowerCase()))) {
          return true;
        }
        return true;
      }
      if (Array.isArray(val) && val.length > 0) return true;
    }
  }
  return false;
}

export function assignDomainsToEvent(
  event: { id: string; extracted_type: string; raw_input: string; attributes: Record<string, string | string[] | boolean | null> },
): EventDomainAssignment[] {
  const matches: { domain: DomainCategory; score: number }[] = [];
  const extractedType = event.extracted_type;

  for (const rule of DOMAIN_MAPPING_RULES) {
    let score = 0;
    if (rule.extractedTypes.includes(extractedType as any)) score += 1;
    if (domainMatchesKeywords(rule.domain, event.raw_input, rule.attributeKeys, event.attributes)) score += 2;
    if (score >= 2) matches.push({ domain: rule.domain as DomainCategory, score });
  }

  matches.sort((a, b) => b.score - a.score);

  const unique = matches.filter(
    (m, i, arr) => i === 0 || m.domain !== arr[i - 1].domain,
  );

  const primary = unique[0]?.domain ?? "caregiver_observation";
  const all = unique.map((m) => m.domain);

  const confidence: "low" | "medium" | "high" =
    unique.length >= 2 && unique[0].score >= 3 ? "high" : unique.length >= 1 && unique[0].score >= 2 ? "medium" : "low";

  return [
    {
      event_id: event.id,
      domains: all.length > 0 ? all : [],
      primary_domain: primary,
      confidence,
    },
  ];
}

function detectExplicitConnection(text: string): { connected: boolean; evidence: string } {
  for (const pattern of EXPLICIT_CONNECTION_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return { connected: true, evidence: match[0] };
    }
  }
  return { connected: false, evidence: "" };
}

function detectContextualLinks(text: string): string[] {
  const links: string[] = [];
  for (const pattern of CONTEXTUAL_LINK_PATTERNS) {
    const match = text.match(pattern);
    if (match) links.push(match[0]);
  }
  return links;
}

const CONTRADICTION_PAIRS: Array<{ positive: RegExp; negative: RegExp; label: string }> = [
  { positive: /\b(?:walking|walk)\b/i, negative: /\b(?:walking|walk)\b/i, label: "mobility" },
  { positive: /\b(?:eating|ate)\b/i, negative: /\b(?:eating|ate)\b/i, label: "appetite" },
  { positive: /\b(?:sleeping|sleep)\b/i, negative: /\b(?:sleeping|sleep)\b/i, label: "sleep" },
  { positive: /\b(?:confused|confusion)\b/i, negative: /\b(?:confused|confusion)\b/i, label: "cognition" },
  { positive: /\b(?:mood|behavior)\b/i, negative: /\b(?:mood|behavior)\b/i, label: "mood" },
];

export function detectWithinSituationContradictions(
  eventIds: string[],
  events: CanonicalCareEvent[],
): Array<{ event_ids: [string, string]; description: string }> {
  const eventMap = new Map(events.map((e) => [e.id, e]));
  const contradictions: Array<{ event_ids: [string, string]; description: string }> = [];

  const POSITIVE_MODIFIERS = /\b(?:normally|well|independently|better|good|improved|calm|stable)\b/i;
  const NEGATIVE_MODIFIERS = /\b(?:much\s+less|less|worse|difficulty|struggling|unsteady|poorly|badly|more|increased|frequently|often|agitated|anxious|depressed|refused)\b/i;

  for (let i = 0; i < eventIds.length; i++) {
    for (let j = i + 1; j < eventIds.length; j++) {
      const a = eventMap.get(eventIds[i]);
      const b = eventMap.get(eventIds[j]);
      if (!a || !b) continue;

      const textA = a.raw_input.toLowerCase();
      const textB = b.raw_input.toLowerCase();

      for (const pair of CONTRADICTION_PAIRS) {
        const aHasTopic = pair.positive.test(textA);
        const bHasTopic = pair.positive.test(textB);
        if (!aHasTopic && !bHasTopic) continue;

        const aPositive = POSITIVE_MODIFIERS.test(textA);
        const aNegative = NEGATIVE_MODIFIERS.test(textA);
        const bPositive = POSITIVE_MODIFIERS.test(textB);
        const bNegative = NEGATIVE_MODIFIERS.test(textB);

        if ((aPositive && bNegative) || (aNegative && bPositive)) {
          contradictions.push({
            event_ids: [a.id, b.id],
            description: `Conflicting observations regarding ${pair.label}: both versions are preserved.`,
          });
          break;
        }
      }
    }
  }

  return contradictions;
}

function computeTemporalRelationship(
  source: { event_time: { start?: string; type?: string }; timestamp: string },
  target: { event_time: { start?: string; type?: string }; timestamp: string },
): { proximity_days: number | null; ordering: "before" | "after" | "same" | "unknown" } {
  const sourceStart = eventTimeStart(source);
  const targetStart = eventTimeStart(target);
  const diff = timeBetweenDays(sourceStart ?? undefined, targetStart ?? undefined);

  let ordering: "before" | "after" | "same" | "unknown" = "unknown";
  if (diff !== null && sourceStart && targetStart) {
    const s = new Date(sourceStart);
    const t = new Date(targetStart);
    if (diff < 1) {
      ordering = "same";
    } else if (s < t) {
      ordering = "before";
    } else if (s > t) {
      ordering = "after";
    }
  }

  return { proximity_days: diff, ordering };
}

function buildRelationshipCandidate(
  sourceEvent: any,
  targetEvent: any,
  sourceAssign: EventDomainAssignment,
  targetAssign: EventDomainAssignment,
): RelationshipCandidate {
  const { proximity_days, ordering } = computeTemporalRelationship(sourceEvent, targetEvent);

  const sharedContext = [
    ...detectContextualLinks(sourceEvent.raw_input),
    ...detectContextualLinks(targetEvent.raw_input),
  ];

  const explicitSource = detectExplicitConnection(sourceEvent.raw_input);
  const explicitTarget = detectExplicitConnection(targetEvent.raw_input);
  const explicitConnection = explicitSource.connected || explicitTarget.connected;
  const explicitEvidence = explicitSource.evidence || explicitTarget.evidence;

  const samePrimaryDomain = sourceAssign.primary_domain === targetAssign.primary_domain;

  return {
    source_event_id: sourceEvent.id,
    target_event_id: targetEvent.id,
    source_domains: sourceAssign.domains,
    target_domains: targetAssign.domains,
    same_domain: samePrimaryDomain,
    temporal_proximity_days: proximity_days,
    temporal_ordering: ordering,
    shared_context: sharedContext,
    explicit_connection: explicitConnection,
    explicit_evidence: explicitEvidence,
    baseline_deviation: false,
    contradicts: false,
  };
}

function getTemporalWindow(sourceDomains: string[], targetDomains: string[]): { near: number; far: number } {
  const key = [...sourceDomains].sort().join("_") + "_" + [...targetDomains].sort().join("_");
  const reverseKey = [...targetDomains].sort().join("_") + "_" + [...sourceDomains].sort().join("_");
  return TEMPORAL_WINDOWS[key] ?? TEMPORAL_WINDOWS[reverseKey] ?? TEMPORAL_WINDOWS.default;
}

function evaluateCandidateAsRelationship(
  candidate: RelationshipCandidate,
  sourceEvent: any,
  targetEvent: any,
): CrossDomainRelationship | null {
  if (candidate.same_domain) return null;

  const window = getTemporalWindow(candidate.source_domains, candidate.target_domains);
  const proximity = candidate.temporal_proximity_days;

  let strength: RelationshipStrength = "INFERRED";
  let confidence: "low" | "medium" | "high" = "low";
  let basis = "Temporal proximity in care events across domains.";
  let uncertainty: string[] = [];

  if (candidate.explicit_connection) {
    strength = "EXPLICIT";
    confidence = "high";
    basis = `Source explicitly connects these observations: "${candidate.explicit_evidence}".`;
  } else if (proximity !== null && proximity <= window.near) {
    strength = "TEMPORAL";
    confidence = "medium";
    basis = `Events occurred within ${Math.round(proximity)} days across related care domains.`;
  } else if (candidate.shared_context.length > 0) {
    strength = "CONTEXTUAL";
    confidence = "medium";
    basis = `Events share care context: ${candidate.shared_context.join(", ")}.`;
  } else if (proximity !== null && proximity <= window.far) {
    strength = "TEMPORAL";
    confidence = "low";
    basis = `Events occurred within ${Math.round(proximity)} days. Temporal relationship is notable but distant.`;
    uncertainty.push("Temporal separation reduces confidence in connection.");
  } else if (proximity === null) {
    uncertainty.push("Event dates unknown — temporal relationship cannot be evaluated.");
    return null;
  } else {
    return null;
  }

  if (candidate.contradicts) {
    uncertainty.push("Conflicting observations exist — relationship may reflect disagreement rather than change.");
  }

  if (proximity !== null && proximity > window.far) {
    uncertainty.push(`Events are separated by ${Math.round(proximity)} days — beyond typical relationship window.`);
  }

  if (confidence === "low") {
    uncertainty.push("Available evidence does not establish a strong cross-domain connection.");
  }

  const relationship: CrossDomainRelationship = {
    id: newId("xrel"),
    source_event_id: candidate.source_event_id,
    target_event_id: candidate.target_event_id,
    source_domain: candidate.source_domains[0] ?? "caregiver_observation",
    target_domain: candidate.target_domains[0] ?? "caregiver_observation",
    strength,
    confidence,
    basis,
    temporal_relationship: proximity !== null && candidate.temporal_ordering !== "unknown"
      ? {
          source_event_time: eventTimeStart(sourceEvent) ?? "",
          target_event_time: eventTimeStart(targetEvent) ?? "",
          proximity_days: proximity,
          ordering: candidate.temporal_ordering,
        }
      : undefined,
    evidence_event_ids: [candidate.source_event_id, candidate.target_event_id],
    uncertainty,
    is_explicit_documented: candidate.explicit_connection,
  };

  return relationship;
}

function buildSituationExplanation(
  situation: CrossDomainSituation,
  relationships: CrossDomainRelationship[],
): string {
  const domainList = [...new Set(situation.domains)].join(", ");
  const eventCount = situation.participating_event_ids.length;
  const relCount = relationships.length;

  const parts = [`Potential cross-domain care situation involving ${domainList}.`];
  parts.push(`${eventCount} event(s) across ${new Set(situation.domains).size} domain(s) appear connected.`);
  parts.push(`${relCount} relationship(s) detected.`);

  const explicitRels = relationships.filter((r) => r.is_explicit_documented);
  if (explicitRels.length > 0) {
    parts.push(`${explicitRels.length} relationship(s) explicitly documented by source.`);
  }

  const temporalRels = relationships.filter((r) => r.strength === "TEMPORAL");
  if (temporalRels.length > 0) {
    const proximities = temporalRels
      .map((r) => r.temporal_relationship?.proximity_days)
      .filter((d): d is number => d !== null && d !== undefined);
    if (proximities.length > 0) {
      const min = Math.min(...proximities);
      parts.push(`Temporal proximity ranges from ${Math.round(min)} days.`);
    }
  }

  if (situation.contradictions.length > 0) {
    parts.push("Conflicting observations are preserved within this situation.");
  }

  if (situation.uncertainty.length > 0) {
    parts.push("Uncertainty remains about the nature of these connections.");
  }

  parts.push("The available evidence does not establish causation.");

  return parts.join(" ");
}

function buildEvidenceTrail(
  events: CanonicalCareEvent[],
  eventIds: string[],
): CrossDomainSituation["evidence_trail"] {
  const eventMap = new Map(events.map((e) => [e.id, e]));
  return eventIds
    .map((id) => eventMap.get(id))
    .filter((e): e is CanonicalCareEvent => e !== undefined)
    .map((e) => ({
      event_id: e.id,
      source_type: e.source,
      timestamp: eventTimeStart(e) ?? e.timestamp,
      excerpt: e.raw_input.slice(0, 200),
    }));
}

function domainsFromAssignments(assignments: EventDomainAssignment[]): string[] {
  const domainSet = new Set<string>();
  for (const a of assignments) {
    for (const d of a.domains) domainSet.add(d);
  }
  return [...domainSet];
}

function situationsFromClusters(
  clusters: Map<string, string[]>,
  relationships: CrossDomainRelationship[],
  events: CanonicalCareEvent[],
  assignments: EventDomainAssignment[],
  contradictions: OpenContradiction[] = [],
): CrossDomainSituation[] {
  const situations: CrossDomainSituation[] = [];
  const assignmentMap = new Map(assignments.map((a) => [a.event_id, a]));

  let clusterIndex = 0;
  for (const [_, eventIds] of clusters) {
    if (clusterIndex >= MAX_SITUATIONS_PER_RECIPIENT) break;
    if (eventIds.length < MINIMUM_EVENTS_FOR_SITUATION) continue;

    const domainSet = new Set<DomainCategory>();
    const domainEventMap = new Map<string, string[]>();
    const observedChanges: string[] = [];
    const contextualLinks: string[] = [];
    const rels = relationships.filter(
      (r) => eventIds.includes(r.source_event_id) && eventIds.includes(r.target_event_id),
    );

    for (const eid of eventIds) {
      const assign = assignmentMap.get(eid);
      if (!assign) continue;
      for (const d of assign.domains) {
        domainSet.add(d);
        if (!domainEventMap.has(d)) domainEventMap.set(d, []);
        domainEventMap.get(d)!.push(eid);
      }
    }

    const uniqueDomains = [...domainSet];
    if (uniqueDomains.length < MINIMUM_DOMAINS_FOR_SITUATION) continue;

    const eventObjects = events.filter((e) => eventIds.includes(e.id));
    const timestamps = eventObjects.map((e) => eventTimeStart(e)).filter(Boolean) as string[];
    const start = timestamps.length > 0 ? new Date(Math.min(...timestamps.map((t) => new Date(t).getTime()))).toISOString() : null;
    const end = timestamps.length > 0 ? new Date(Math.max(...timestamps.map((t) => new Date(t).getTime()))).toISOString() : null;

    const situationContradictions: CrossDomainSituation["contradictions"] = [];
    for (const c of contradictions) {
      if (eventIds.some((id) => (c as any).event_ids?.includes(id))) {
        situationContradictions.push({
          event_ids: (c as any).event_ids ?? [""],
          description: (c as any).description ?? "Contradictory observation preserved.",
        });
      }
    }
    const withinSituationContradictions = detectWithinSituationContradictions(eventIds, events);
    for (const c of withinSituationContradictions) {
      const exists = situationContradictions.some(
        (sc) => sc.event_ids[0] === c.event_ids[0] && sc.event_ids[1] === c.event_ids[1],
      );
      if (!exists) situationContradictions.push(c);
    }

    const confidence: "low" | "medium" | "high" =
      rels.some((r) => r.is_explicit_documented)
        ? "high"
        : rels.some((r) => r.confidence === "medium")
          ? "medium"
          : "low";

    const uncertainty: string[] = [];
    for (const r of rels) {
      for (const u of r.uncertainty) {
        if (!uncertainty.includes(u)) uncertainty.push(u);
      }
    }

    const explanation = buildSituationExplanation(
      {
        id: "",
        care_recipient_id: "",
        status: "detected",
        domains: uniqueDomains,
        participating_event_ids: eventIds,
        relationships: rels,
        temporal_span: { start, end },
        observed_changes: observedChanges,
        contextual_links: contextualLinks,
        confidence,
        uncertainty,
        explanation: "",
        evidence_trail: [],
        contradictions: situationContradictions,
        missing_information: [],
        detected_at: "",
        updated_at: "",
      },
      rels,
    );

    const situation: CrossDomainSituation = {
      id: newId("xsit"),
      care_recipient_id: events[0]?.situation_id ?? "",
      status: "detected",
      domains: uniqueDomains,
      participating_event_ids: eventIds,
      relationships: rels,
      temporal_span: { start, end },
      observed_changes: observedChanges,
      contextual_links: contextualLinks,
      confidence,
      uncertainty,
      explanation,
      evidence_trail: buildEvidenceTrail(events, eventIds),
      contradictions: situationContradictions,
      missing_information: [],
      detected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    situations.push(situation);
    clusterIndex++;
  }

  return situations;
}

export function detectCrossDomainSituations(
  input: CrossDomainReasoningInput,
): CrossDomainReasoningResult {
  const events = input.events.filter((e) => e.status !== "invalidated" && e.status !== "superseded");
  if (events.length < MINIMUM_EVENTS_FOR_SITUATION) {
    return {
      situations: [],
      event_to_situation_map: {},
      updated_event_ids: [],
      domains_participated: [],
      summary: "Insufficient events to evaluate cross-domain relationships.",
    };
  }

  const assignments: EventDomainAssignment[] = [];
  for (const event of events) {
    assignments.push(...assignDomainsToEvent(event));
  }

  const assignmentMap = new Map(assignments.map((a) => [a.event_id, a]));

  const candidates: RelationshipCandidate[] = [];
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const source = events[i];
      const target = events[j];
      const sourceAssign = assignmentMap.get(source.id);
      const targetAssign = assignmentMap.get(target.id);
      if (!sourceAssign || !targetAssign) continue;

      const candidate = buildRelationshipCandidate(source, target, sourceAssign, targetAssign);
      candidates.push(candidate);
    }
  }

  const relationships: CrossDomainRelationship[] = [];
  for (const candidate of candidates) {
    const sourceEvent = events.find((e) => e.id === candidate.source_event_id);
    const targetEvent = events.find((e) => e.id === candidate.target_event_id);
    if (!sourceEvent || !targetEvent) continue;

    const rel = evaluateCandidateAsRelationship(candidate, sourceEvent, targetEvent);
    if (rel) relationships.push(rel);
  }

  const unionFind = new Map<string, string>();
  function find(id: string): string {
    if (!unionFind.has(id)) unionFind.set(id, id);
    const parent = unionFind.get(id)!;
    if (parent !== id) unionFind.set(id, find(parent));
    return unionFind.get(id)!;
  }
  function union(a: string, b: string) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) unionFind.set(ra, rb);
  }

  for (const rel of relationships) {
    union(rel.source_event_id, rel.target_event_id);
  }

  const clusters = new Map<string, string[]>();
  for (const event of events) {
    const root = find(event.id);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root)!.push(event.id);
  }

  const contradictions = input.contradictions ?? [];
  const situations = situationsFromClusters(clusters, relationships, events, assignments, contradictions);

  const eventToSituationMap: Record<string, string[]> = {};
  for (const situation of situations) {
    for (const eventId of situation.participating_event_ids) {
      if (!eventToSituationMap[eventId]) eventToSituationMap[eventId] = [];
      eventToSituationMap[eventId].push(situation.id);
    }
  }

  const allDomains = new Set<string>();
  for (const s of situations) {
    for (const d of s.domains) allDomains.add(d);
  }

  const updatedEventIds = new Set<string>();
  for (const situation of situations) {
    for (const eid of situation.participating_event_ids) updatedEventIds.add(eid);
  }

  const summary =
    situations.length > 0
      ? `${situations.length} cross-domain situation(s) detected across ${allDomains.size} domain(s).`
      : "No cross-domain situations detected from available evidence.";

  return {
    situations,
    event_to_situation_map: eventToSituationMap,
    updated_event_ids: [...updatedEventIds],
    domains_participated: [...allDomains] as any,
    summary,
  };
}

export function explainCrossDomainSituation(
  situation: CrossDomainSituation,
): string {
  return situation.explanation;
}

export function listDomainsForSituation(
  situation: CrossDomainSituation,
): DomainParticipation[] {
  const domainMap = new Map<string, { event_count: number; event_ids: string[]; changes: string[] }>();
  for (const eid of situation.participating_event_ids) {
    const rels = situation.relationships.filter((r) => r.source_event_id === eid || r.target_event_id === eid);
    const domains = rels.flatMap((r) =>
      r.source_event_id === eid ? [r.source_domain] : r.target_event_id === eid ? [r.target_domain] : [],
    );
    for (const d of domains) {
      if (!domainMap.has(d)) domainMap.set(d, { event_count: 0, event_ids: [], changes: [] });
      const entry = domainMap.get(d)!;
      if (!entry.event_ids.includes(eid)) {
        entry.event_count += 1;
        entry.event_ids.push(eid);
      }
    }
  }
  return [...domainMap.entries()].map(([domain, data]) => ({
    domain: domain as any,
    ...data,
  }));
}
