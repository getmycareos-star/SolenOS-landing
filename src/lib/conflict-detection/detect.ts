import { randomUUID } from "node:crypto";
import type {
  Conflict,
  ConflictSeverity,
  ConflictType,
  FactCandidate,
} from "./types";
import { buildClarificationForConflict } from "./clarification";

type DetectedPair = {
  type: ConflictType;
  statementA: string;
  statementB: string;
  confidence: number;
  severity: ConflictSeverity;
};

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function includesAny(text: string, needles: readonly string[]): boolean {
  const hay = text.toLowerCase();
  return needles.some((n) => hay.includes(n.toLowerCase()));
}

function extractNameCue(text: string): string | null {
  const m =
    text.match(
      /\b([A-Z][a-z]+)\b(?:\s+(?:handles|manages|is|was)\b|\s*:\s*)/,
    ) ??
    text.match(
      /(?:primary caregiver|caregiver|sister|brother|son|daughter|mom|dad|wife|husband)[:\s]+([A-Za-z]+)/i,
    ) ??
    text.match(/\b([A-Z][a-z]+)\s+(?:handles|manages|owns)\b/);
  return m?.[1]?.toLowerCase() ?? null;
}

/** Living arrangement mutual exclusion. */
function detectFactHousing(a: string, b: string): DetectedPair | null {
  const alone = (t: string) =>
    includesAny(t, ["lives alone", "living alone", "live alone"]);
  const withOther = (t: string) =>
    includesAny(t, [
      "lives with",
      "living with",
      "live with",
      "lives with daughter",
      "lives with son",
      "resides with",
    ]);
  if ((alone(a) && withOther(b)) || (alone(b) && withOther(a))) {
    return {
      type: "fact_conflict",
      statementA: a,
      statementB: b,
      confidence: 0.85,
      severity: "HIGH",
    };
  }
  return null;
}

/** Primary caregiver / ownership of care role. */
function detectFactCaregiver(a: string, b: string): DetectedPair | null {
  const caregiverCue = (t: string) =>
    includesAny(t, [
      "primary caregiver",
      "main caregiver",
      "manages all medication",
      "manages all medications",
      "handles all medication",
      "handles medications",
      "manages medications",
    ]);
  if (!caregiverCue(a) && !caregiverCue(b)) return null;
  const nameA = extractNameCue(a);
  const nameB = extractNameCue(b);
  if (nameA && nameB && nameA !== nameB) {
    const med = includesAny(a + " " + b, ["medication", "medications", "meds"]);
    return {
      type: med ? "responsibility_conflict" : "fact_conflict",
      statementA: a,
      statementB: b,
      confidence: 0.8,
      severity: med ? "HIGH" : "MEDIUM",
    };
  }
  // "Primary caregiver: David" vs "My sister manages all medications"
  if (
    includesAny(a, ["primary caregiver"]) &&
    includesAny(b, ["sister", "brother", "manages all", "handles all"])
  ) {
    return {
      type: "responsibility_conflict",
      statementA: a,
      statementB: b,
      confidence: 0.75,
      severity: "HIGH",
    };
  }
  if (
    includesAny(b, ["primary caregiver"]) &&
    includesAny(a, ["sister", "brother", "manages all", "handles all"])
  ) {
    return {
      type: "responsibility_conflict",
      statementA: a,
      statementB: b,
      confidence: 0.75,
      severity: "HIGH",
    };
  }
  return null;
}

function detectResponsibility(a: string, b: string): DetectedPair | null {
  const role = (t: string) =>
    includesAny(t, [
      "handles medications",
      "manages medications",
      "manages medication",
      "owns",
      "responsible for",
      "in charge of",
    ]);
  if (!role(a) || !role(b)) return null;
  const nameA = extractNameCue(a);
  const nameB = extractNameCue(b);
  if (nameA && nameB && nameA !== nameB) {
    return {
      type: "responsibility_conflict",
      statementA: a,
      statementB: b,
      confidence: 0.82,
      severity: "HIGH",
    };
  }
  return null;
}

function detectPreference(a: string, b: string): DetectedPair | null {
  const home = (t: string) =>
    includesAny(t, [
      "remain home",
      "stay home",
      "aging in place",
      "age in place",
      "wants to remain home",
      "wants to stay home",
    ]);
  const facility = (t: string) =>
    includesAny(t, [
      "assisted living",
      "nursing home",
      "facility",
      "memory care",
      "move to a facility",
    ]);
  if ((home(a) && facility(b)) || (home(b) && facility(a))) {
    return {
      type: "preference_conflict",
      statementA: a,
      statementB: b,
      confidence: 0.78,
      severity: "MEDIUM",
    };
  }
  return null;
}

function detectTimeline(a: string, b: string): DetectedPair | null {
  const discharged = (t: string) =>
    includesAny(t, ["discharged", "discharge on", "was discharged", "left hospital"]);
  const hospitalized = (t: string) =>
    includesAny(t, [
      "still hospitalized",
      "in hospital",
      "hospitalized",
      "admitted",
      "inpatient",
    ]);
  if (
    (discharged(a) && hospitalized(b)) ||
    (discharged(b) && hospitalized(a))
  ) {
    return {
      type: "timeline_conflict",
      statementA: a,
      statementB: b,
      confidence: 0.88,
      severity: "HIGH",
    };
  }

  const supplyEnds = (t: string) =>
    includesAny(t, [
      "supply ends",
      "medication supply ends",
      "runs out",
      "running out",
      "refill due",
    ]);
  const alreadyRefilled = (t: string) =>
    includesAny(t, [
      "already picked up",
      "already refilled",
      "90-day refill",
      "90 day refill",
      "picked up a refill",
      "refilled already",
    ]);
  if (
    (supplyEnds(a) && alreadyRefilled(b)) ||
    (supplyEnds(b) && alreadyRefilled(a))
  ) {
    return {
      type: "timeline_conflict",
      statementA: a,
      statementB: b,
      confidence: 0.84,
      severity: "HIGH",
    };
  }
  return null;
}

function detectMedical(a: string, b: string): DetectedPair | null {
  const stopped = (t: string) =>
    includesAny(t, [
      "discontinued",
      "stopped",
      "no longer taking",
      "held",
      "off blood thinner",
    ]);
  const active = (t: string) =>
    includesAny(t, [
      "active",
      "still taking",
      "continues",
      "continuing",
      "on blood thinner",
      "blood thinner active",
    ]);
  const medMention = (t: string) =>
    includesAny(t, [
      "blood thinner",
      "warfarin",
      "eliquis",
      "xarelto",
      "medication",
      "insulin",
      "dosage",
      "dose",
    ]);

  if (medMention(a) && medMention(b) && ((stopped(a) && active(b)) || (stopped(b) && active(a)))) {
    return {
      type: "medical_conflict",
      statementA: a,
      statementB: b,
      confidence: 0.9,
      severity: "CRITICAL",
    };
  }

  // Same med class opposing states without both saying "medication"
  if (
    includesAny(a, ["blood thinner"]) &&
    includesAny(b, ["blood thinner"]) &&
    ((stopped(a) && active(b)) || (stopped(b) && active(a)))
  ) {
    return {
      type: "medical_conflict",
      statementA: a,
      statementB: b,
      confidence: 0.92,
      severity: "CRITICAL",
    };
  }
  return null;
}

/**
 * Spec examples that coexist — must NOT detect:
 * Lives alone + Home health aide visits daily.
 */
function isExplicitNonConflict(a: string, b: string): boolean {
  const alone = includesAny(a + " " + b, ["lives alone", "living alone"]);
  const aide = includesAny(a + " " + b, [
    "home health aide",
    "aide visits",
    "home health visits",
  ]);
  return alone && aide;
}

function detectPair(aRaw: string, bRaw: string): DetectedPair | null {
  const a = aRaw.trim();
  const b = bRaw.trim();
  if (!a || !b) return null;
  if (norm(a) === norm(b)) return null;
  if (isExplicitNonConflict(a, b)) return null;

  return (
    detectMedical(a, b) ??
    detectTimeline(a, b) ??
    detectPreference(a, b) ??
    detectResponsibility(a, b) ??
    detectFactCaregiver(a, b) ??
    detectFactHousing(a, b)
  );
}

function toConflict(pair: DetectedPair, nowIso: string, situationId?: string): Conflict {
  const base: Conflict = {
    id: randomUUID(),
    type: pair.type,
    statementA: pair.statementA,
    statementB: pair.statementB,
    confidence: pair.confidence,
    severity: pair.severity,
    status: "open",
    createdAt: nowIso,
    situationId,
  };
  const clarification = buildClarificationForConflict(base);
  return {
    ...base,
    clarificationQuestion: clarification.question,
    clarificationOptions: clarification.options,
  };
}

/**
 * Detect pairwise conflicts among fact candidates.
 * MVP: heuristic coexistence checks only — no clustering / source reliability.
 */
export function detectConflicts(params: {
  candidates: readonly FactCandidate[];
  situationId?: string;
  nowIso?: string;
}): Conflict[] {
  const nowIso = params.nowIso ?? new Date().toISOString();
  const statements = params.candidates
    .map((c) => c.statement.trim())
    .filter((s) => s.length > 0);
  // Dedupe exact statements
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const s of statements) {
    const key = norm(s);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(s);
  }

  const out: Conflict[] = [];
  const emitted = new Set<string>();
  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      const pair = detectPair(unique[i]!, unique[j]!);
      if (!pair) continue;
      const key = `${pair.type}|${norm(pair.statementA)}|${norm(pair.statementB)}`;
      if (emitted.has(key)) continue;
      emitted.add(key);
      out.push(toConflict(pair, nowIso, params.situationId));
    }
  }
  return out;
}

/**
 * Extract lightweight fact candidates from free text + memory labels.
 */
export function extractFactCandidates(params: {
  userInput?: string;
  memoryLabels?: readonly string[];
  assumptionHints?: readonly string[];
  responsibilityHints?: readonly string[];
  documentFlags?: readonly string[];
}): FactCandidate[] {
  const out: FactCandidate[] = [];
  const push = (statement: string, source: FactCandidate["source"]) => {
    const s = statement.trim();
    if (s.length < 3) return;
    out.push({ statement: s, source });
  };

  for (const m of params.memoryLabels ?? []) push(m, "memory");
  for (const a of params.assumptionHints ?? []) push(a, "assumption");
  for (const r of params.responsibilityHints ?? []) push(r, "responsibility");
  for (const d of params.documentFlags ?? []) push(d, "document");

  const input = (params.userInput ?? "").trim();
  if (input) {
    // Keep whole input as one candidate; also split sentences lightly.
    push(input.slice(0, 280), "input");
    for (const part of input.split(/[.!?\n]+/)) {
      if (part.trim().length >= 8) push(part.trim().slice(0, 200), "input");
    }
  }

  return out;
}

/** Convenience: detect from common caregiver inputs matching spec examples. */
export function detectConflictsFromText(params: {
  memoryStatements: readonly string[];
  newInput: string;
  situationId?: string;
  nowIso?: string;
}): Conflict[] {
  return detectConflicts({
    candidates: extractFactCandidates({
      userInput: params.newInput,
      memoryLabels: params.memoryStatements,
    }),
    situationId: params.situationId,
    nowIso: params.nowIso,
  });
}
