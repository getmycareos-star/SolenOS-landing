/**
 * Unknown layer — preserve missing / uncertain / confirmation needs.
 * Never convert uncertainty into facts. Never guess. Never invent closure.
 * Do not remove uncertainty. Uncertainty is part of the care reality.
 *
 * SoT: docs/02-product/solenos-unknown-extraction.md
 * Doc examples are illustrations only — never product if-branches on scenario nouns.
 */

import type {
  ExtractedDecision,
  ExtractedEvent,
  ExtractedNonCareFact,
  ExtractedObservation,
  ExtractedUnknown,
  UnknownRelatedObjectType,
  UnknownStatus,
} from "./types";

export const UNKNOWN_EXTRACTION_ASK =
  "What important information is missing, uncertain, or requires confirmation?";

export const UNKNOWN_EXTRACTION_NEVER_ASK =
  "How do we make the record look complete?";

export const UNKNOWN_EXTRACTION_CORE =
  "Do not remove uncertainty. Uncertainty is part of the care reality.";

/** Caregiver UI must never show these — engine-only. */
export const UNKNOWN_STATUS_LEAKAGE_PATTERNS = [
  /\bstatus:\s*(?:open|answered|declined|no_longer_relevant)\b/i,
  /\bunknown status\b/i,
  /\bextracted unknown\b/i,
  /\bunk_[a-z0-9_]+\b/i,
] as const;

export function containsUnknownStatusLeakage(blob: string): boolean {
  return UNKNOWN_STATUS_LEAKAGE_PATTERNS.some((p) => p.test(blob));
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Shared substantial span — contextual link, not keyword topic matching. */
function sameCaptureContext(a: string, b: string): boolean {
  if (a === b) return true;
  const short = a.length <= b.length ? a : b;
  const long = a.length <= b.length ? b : a;
  if (short.length < 40) return false;
  return long.includes(short.slice(0, Math.min(48, short.length)));
}

/**
 * Normalize caregiver uncertainty into a confirmation-oriented question.
 * Does not invent answers or assert facts.
 */
export function normalizeUnknownQuestion(raw: string): string {
  const t = raw.trim().replace(/\s+/g, " ");
  if (!t) return "Something important still needs confirmation.";

  // Already a question
  if (/\?\s*$/.test(t)) return t.slice(0, 240);

  // Medication usage confirmation — structural discourse, not scenario nouns
  if (
    /\b(?:not sure|don'?t know|unsure)\b/i.test(t) &&
    /\b(?:still )?(?:taking|on)\b/i.test(t) &&
    /\b(?:medication|medicine|meds?|dose|pill)\b/i.test(t)
  ) {
    return "Current medication usage requires confirmation.";
  }

  if (/\bi(?:'m| am)? not sure (?:if|whether)\b/i.test(t)) {
    const after = t.split(/\bi(?:'m| am)? not sure (?:if|whether)\b/i)[1]?.trim() ?? "";
    const cleaned = after.replace(/[.,;]+$/, "").trim();
    if (cleaned.length >= 8) {
      return `Whether ${cleaned} still needs confirmation.`.slice(0, 240);
    }
  }

  if (/\bnot sure (?:if|whether)\b/i.test(t)) {
    const after = t.split(/\bnot sure (?:if|whether)\b/i)[1]?.trim() ?? "";
    const cleaned = after.replace(/[.,;]+$/, "").trim();
    if (cleaned.length >= 8) {
      return `Whether ${cleaned} still needs confirmation.`.slice(0, 240);
    }
  }

  if (/\bdon'?t know (?:if|whether)\b/i.test(t)) {
    const after = t.split(/\bdon'?t know (?:if|whether)\b/i)[1]?.trim() ?? "";
    const cleaned = after.replace(/[.,;]+$/, "").trim();
    if (cleaned.length >= 8) {
      return `Whether ${cleaned} still needs confirmation.`.slice(0, 240);
    }
  }

  // Timing relationship unknown — before/after a care change (not "why was it decided")
  if (
    /\b(?:can'?t remember|don'?t know|not sure|unsure|unclear)\b/i.test(t) &&
    /\b(?:before or after|before|after)\b/i.test(t) &&
    /\b(?:start(?:ed)?|began|this|that|it|changes?|symptoms?)\b/i.test(t)
  ) {
    return "Whether the observed changes began before or after the recent care change still needs confirmation.";
  }

  if (/\bcan'?t remember why\b/i.test(t) || /\bi honestly can'?t remember\b/i.test(t)) {
    return "Why this care choice was made still needs confirmation.";
  }

  if (/\bwhat matters most\b/i.test(t) || /\bwhat i should be paying attention\b/i.test(t)) {
    return "What matters most right now is still unclear.";
  }

  return t.slice(0, 240);
}

function defaultImportance(question: string, relatedType: UnknownRelatedObjectType | null): string {
  if (relatedType === "decision") {
    return "Without why this path was chosen, later outcomes are harder to interpret.";
  }
  if (relatedType === "event") {
    return "Confirmation would clarify how this journey moment fits the care story.";
  }
  if (relatedType === "observation") {
    return "Confirmation would clarify what is currently true about the person receiving care.";
  }
  if (/medication usage|still taking/i.test(question)) {
    return "Whether medication is currently being taken changes how later changes are understood.";
  }
  if (/conflict|perspective|disagree/i.test(question)) {
    return "Conflicting perspectives leave current understanding incomplete.";
  }
  return "Missing confirmation leaves a gap in the Living Care Record.";
}

export function createExtractedUnknown(params: {
  questionOrFragment: string;
  source: string;
  raw_fragment: string;
  related_object_id?: string | null;
  related_object_type?: UnknownRelatedObjectType | null;
  importance?: string | null;
  status?: UnknownStatus;
}): ExtractedUnknown {
  const question = normalizeUnknownQuestion(params.questionOrFragment);
  const related_object_type = params.related_object_type ?? null;
  return {
    id: newId("unk"),
    layer: "unknown",
    question,
    related_object_id: params.related_object_id ?? null,
    related_object_type,
    source: params.source,
    importance:
      params.importance?.trim() ||
      defaultImportance(question, related_object_type),
    // Extraction never invents closure — new unknowns start open
    status: params.status ?? "open",
    raw_fragment: params.raw_fragment,
  };
}

/**
 * Attach related observation / event / decision by shared capture context.
 * Never invents a related object when none fits.
 */
export function attachRelatedObjectsToUnknowns(params: {
  unknowns: ExtractedUnknown[];
  observations: ExtractedObservation[];
  events: ExtractedEvent[];
  decisions: ExtractedDecision[];
}): ExtractedUnknown[] {
  return params.unknowns.map((u) => {
    if (u.related_object_id) return u;

    for (const d of params.decisions) {
      if (
        sameCaptureContext(u.raw_fragment, d.raw_fragment) ||
        u.raw_fragment === d.raw_fragment
      ) {
        return {
          ...u,
          related_object_id: d.id,
          related_object_type: "decision" as const,
          importance: defaultImportance(u.question, "decision"),
        };
      }
    }
    for (const e of params.events) {
      if (
        sameCaptureContext(u.raw_fragment, e.raw_fragment) ||
        u.raw_fragment === e.raw_fragment
      ) {
        return {
          ...u,
          related_object_id: e.id,
          related_object_type: "event" as const,
          importance: defaultImportance(u.question, "event"),
        };
      }
    }
    for (const o of params.observations) {
      if (
        sameCaptureContext(u.raw_fragment, o.raw_fragment) ||
        u.raw_fragment === o.raw_fragment
      ) {
        return {
          ...u,
          related_object_id: o.id,
          related_object_type: "observation" as const,
          importance: defaultImportance(u.question, "observation"),
        };
      }
    }
    return u;
  });
}

/** Decision with Reason unknown → explicit Unknown linked to that decision. */
export function unknownsFromReasonUnknownDecisions(params: {
  decisions: ExtractedDecision[];
  source: string;
}): ExtractedUnknown[] {
  const out: ExtractedUnknown[] = [];
  for (const d of params.decisions) {
    if (!d.reason_unknown) continue;
    out.push(
      createExtractedUnknown({
        questionOrFragment: "Why this care choice was made still needs confirmation.",
        source: params.source,
        raw_fragment: d.raw_fragment,
        related_object_id: d.id,
        related_object_type: "decision",
        importance: defaultImportance("", "decision"),
        status: "open",
      }),
    );
  }
  return out;
}

/**
 * Conflicting perspectives → unknown gap (preserve both sides; do not pick a winner).
 */
export function unknownsFromConflictingPerspectives(params: {
  non_care_facts: ExtractedNonCareFact[];
  source: string;
}): ExtractedUnknown[] {
  const conflicts = params.non_care_facts.filter(
    (n) => n.layer === "disagreement_perspective",
  );
  if (conflicts.length === 0) return [];
  return [
    createExtractedUnknown({
      questionOrFragment:
        "Whether differing perspectives on this care situation can be reconciled still needs confirmation.",
      source: params.source,
      raw_fragment: conflicts[0]!.raw_fragment,
      importance:
        "Conflicting perspectives leave current understanding incomplete.",
      status: "open",
    }),
  ];
}

/**
 * Caregiver-facing line for an open unknown — never status enums, never invented facts.
 */
export function composeCaregiverUnknownAsk(unknown: ExtractedUnknown): string | null {
  if (unknown.status !== "open") return null;
  const q = unknown.question.trim();
  if (!q) return null;
  if (containsUnknownStatusLeakage(q)) return null;
  if (/differing perspectives|reconciled still needs/i.test(q)) {
    return null;
  }
  if (/\?\s*$/.test(q)) return q.slice(0, 200);
  if (
    /still needs confirmation|requires confirmation|still unclear|not held yet/i.test(
      q,
    )
  ) {
    return q.endsWith(".") ? q.slice(0, 200) : `${q}.`.slice(0, 200);
  }
  return `${q}${q.endsWith("?") ? "" : "?"}`.slice(0, 200);
}

/** True if a description wrongly asserts a fact that uncertainty forbids. */
export function looksLikeInventedCertaintyFromUncertainty(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  // Medication / resolution certainty — not ordinary observations like "stopped eating".
  if (
    /\b(?:medication|medicine|dose|pill).{0,48}\b(?:stopp(?:ed)?|discontinued|no longer taking)\b/i.test(
      t,
    ) ||
    /\b(?:stopp(?:ed)?|discontinued|no longer taking).{0,48}\b(?:medication|medicine|dose|pill)\b/i.test(
      t,
    ) ||
    /\bmedication stopped\b/i.test(t) ||
    /\b(?:has ended|is resolved)\b/i.test(t)
  ) {
    return true;
  }
  if (/\b(?:definitely|certainly|caused by|is because)\b/i.test(t)) return true;
  return false;
}

/**
 * Hard gate: response must not invent facts from open uncertainty, or leak status enums.
 */
export function validateUnknownPreservation(params: {
  responseBlob: string;
  unknowns?: ExtractedUnknown[];
}): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  if (containsUnknownStatusLeakage(params.responseBlob)) {
    failures.push("unknown_status_leakage");
  }
  if (looksLikeInventedCertaintyFromUncertainty(params.responseBlob)) {
    const hasOpenMedGap = (params.unknowns ?? []).some(
      (u) =>
        u.status === "open" &&
        /medication|confirmation|still taking|usage/i.test(u.question),
    );
    // Only treat as converted-to-fact when the invented certainty is about the med gap
    // (not ordinary observations like "stopped eating" near a medication mention).
    const inventsMedStatus =
      /\bmedication stopped\b/i.test(params.responseBlob) ||
      /\b(?:medication|medicine|dose|pill).{0,40}\b(?:stopp(?:ed)?|discontinued|no longer taking|has ended|is resolved)\b/i.test(
        params.responseBlob,
      ) ||
      /\b(?:stopp(?:ed)?|discontinued|no longer taking).{0,24}\b(?:medication|medicine|dose|pill)\b/i.test(
        params.responseBlob,
      ) ||
      (hasOpenMedGap &&
        /\b(?:definitely|certainly|caused by|is because)\b/i.test(params.responseBlob));
    if (inventsMedStatus) {
      failures.push("uncertainty_converted_to_fact");
    }
  }
  if (
    (params.unknowns ?? []).some((u) => u.status === "open") &&
    /\b(?:everything is (?:known|clear)|no uncertainty|record is complete)\b/i.test(
      params.responseBlob,
    )
  ) {
    failures.push("uncertainty_removed_for_completeness");
  }
  return { ok: failures.length === 0, failures };
}

export function assertUnknownPreservation(params: {
  responseBlob: string;
  unknowns?: ExtractedUnknown[];
}): void {
  const result = validateUnknownPreservation(params);
  if (!result.ok) {
    throw new Error(
      `Unknown preservation failed: ${result.failures.join(", ")} — do not remove uncertainty; it is part of care reality`,
    );
  }
}

/**
 * Deduplicate unknowns by normalized question; keep first.
 * Never drops unknowns to look complete — only exact question dupes.
 */
export function dedupeExtractedUnknowns(unknowns: ExtractedUnknown[]): ExtractedUnknown[] {
  const seen = new Set<string>();
  const out: ExtractedUnknown[] = [];
  for (const u of unknowns) {
    const key = u.question.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(u);
  }
  return out.slice(0, 16);
}
