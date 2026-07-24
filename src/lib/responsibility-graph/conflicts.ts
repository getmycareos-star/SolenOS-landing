import { createHash } from "node:crypto";
import type { CareProfile } from "../care-profile/types";
import type { Demand } from "../demand-engine/types";
import { findPersonByName, stablePersonId } from "./seed";
import type { OwnershipConflict, Person } from "./types";

type OwnershipClaim = {
  ownerName: string;
  topic: string;
  raw: string;
};

const CLAIM_PATTERNS: RegExp[] = [
  /\b([A-Z][a-z]+)\s+(?:handles?|is\s+responsible\s+for|owns?|manages?|takes?\s+care\s+of)\s+(?:the\s+)?([a-z][a-z\s]{2,40})/gi,
  /\b(?:sister|brother|mom|dad|daughter|son|spouse|wife|husband)\s+(?:handles?|is\s+responsible\s+for|owns?|manages?)\s+(?:the\s+)?([a-z][a-z\s]{2,40})/gi,
  /\b([A-Z][a-z]+)\s+(?:should|will|can)\s+(?:pick\s+up|handle|manage|own)\s+(?:the\s+)?([a-z][a-z\s]{2,40})/gi,
];

function normalizeTopic(topic: string): string {
  return topic.trim().toLowerCase().replace(/\s+/g, " ");
}

function topicsOverlap(a: string, b: string): boolean {
  const ta = normalizeTopic(a);
  const tb = normalizeTopic(b);
  if (!ta || !tb) return false;
  if (ta.includes(tb) || tb.includes(ta)) return true;
  const wa = new Set(ta.split(" "));
  const wb = tb.split(" ");
  return wb.some((w) => w.length > 3 && wa.has(w));
}

function extractClaims(input: string): OwnershipClaim[] {
  const claims: OwnershipClaim[] = [];
  for (const pattern of CLAIM_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(input)) !== null) {
      if (match.length >= 3 && match[1] && match[2]) {
        claims.push({
          ownerName: match[1].trim(),
          topic: match[2].trim(),
          raw: match[0],
        });
      } else if (match.length >= 2 && match[1] && !match[2]) {
        // Relative pronoun pattern — capture group 1 is topic; owner is matched prefix word.
        const raw = match[0];
        const rel = raw.match(
          /^(sister|brother|mom|dad|daughter|son|spouse|wife|husband)/i,
        );
        if (rel) {
          claims.push({
            ownerName: rel[1]!,
            topic: match[1].trim(),
            raw,
          });
        }
      }
    }
  }
  return claims;
}

function conflictId(
  stored: string,
  inferred: string,
  demandId?: string,
): string {
  const h = createHash("sha256")
    .update(`${stored}::${inferred}::${demandId ?? ""}`)
    .digest("hex")
    .slice(0, 12);
  return `ocf_${h}`;
}

/**
 * Detect ownership conflicts (e.g. memory/profile primary vs input says sister handles meds).
 * Flag only — never auto-resolve or overwrite confirmed ownership.
 */
export function detectOwnershipConflicts(params: {
  input: string;
  careProfile?: CareProfile;
  persons: readonly Person[];
  demands: readonly Demand[];
  existingConflicts?: readonly OwnershipConflict[];
  nowIso?: string;
}): OwnershipConflict[] {
  const now = params.nowIso ?? new Date().toISOString();
  const claims = extractClaims(params.input);
  const out: OwnershipConflict[] = [];
  const seen = new Set(
    (params.existingConflicts ?? [])
      .filter((c) => !c.resolved)
      .map((c) => c.conflictId),
  );

  // Profile primary vs competing named claims on overlapping demand topics.
  const primaryName =
    findPersonByName(params.persons, "Primary caregiver")?.name ??
    "Primary caregiver";

  for (const claim of claims) {
    const claimPerson =
      findPersonByName(params.persons, claim.ownerName) ??
      ({
        id: stablePersonId("inferred", claim.ownerName),
        name: claim.ownerName,
      } as const);

    for (const demand of params.demands) {
      const demandTopic = `${demand.title} ${demand.description} ${demand.category}`;
      if (!topicsOverlap(claim.topic, demandTopic) && !topicsOverlap(claim.topic, demand.category)) {
        // Still flag meds/medical language broadly.
        if (
          !/\b(meds?|medication|prescription|pharmacy)\b/i.test(claim.topic) ||
          demand.category !== "medical"
        ) {
          continue;
        }
      }

      const storedOwner =
        params.careProfile?.roleInCareGraph === "primary_caregiver"
          ? primaryName
          : params.careProfile?.roleInCareGraph ?? primaryName;

      if (
        claim.ownerName.toLowerCase() === storedOwner.toLowerCase() ||
        claim.ownerName.toLowerCase() === "primary caregiver"
      ) {
        continue;
      }

      // Shared-care or sister/family claim vs primary → conflict needing clarification.
      const id = conflictId(storedOwner, claimPerson.name, demand.id);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        conflictId: id,
        demandId: demand.id,
        situationId: demand.situationId,
        detail: `Ownership conflict: stored/primary suggests ${storedOwner}, input claims ${claim.ownerName} handles "${claim.topic}"`,
        storedOwnerHint: storedOwner,
        inferredOwnerHint: claim.ownerName,
        detectedAt: now,
        resolved: false,
      });
    }
  }

  // Competing claims within the same input for the same topic.
  for (let i = 0; i < claims.length; i++) {
    for (let j = i + 1; j < claims.length; j++) {
      const a = claims[i]!;
      const b = claims[j]!;
      if (a.ownerName.toLowerCase() === b.ownerName.toLowerCase()) continue;
      if (!topicsOverlap(a.topic, b.topic)) continue;
      const id = conflictId(a.ownerName, b.ownerName, a.topic);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        conflictId: id,
        detail: `Competing ownership claims: ${a.ownerName} vs ${b.ownerName} for "${a.topic}"`,
        storedOwnerHint: a.ownerName,
        inferredOwnerHint: b.ownerName,
        detectedAt: now,
        resolved: false,
      });
    }
  }

  return out;
}

export type InferredOwnerAssignment = {
  demandId: string;
  ownerId: string;
  situationId: string;
  person?: Person;
};

/**
 * Infer owner assignments from input claims + care profile defaults.
 * Does not overwrite existing active responsibilities for a demand.
 */
export function inferOwnerAssignments(params: {
  input: string;
  demands: readonly Demand[];
  persons: readonly Person[];
  careProfile?: CareProfile;
}): InferredOwnerAssignment[] {
  const assignments: InferredOwnerAssignment[] = [];
  const claims = extractClaims(params.input);
  const primary = params.persons.find(
    (p) =>
      p.relationship === "self" ||
      p.role === "primary_caregiver" ||
      p.role === params.careProfile?.roleInCareGraph,
  );

  for (const demand of params.demands) {
    if (demand.ownerId) {
      assignments.push({
        demandId: demand.id,
        ownerId: demand.ownerId,
        situationId: demand.situationId,
      });
      continue;
    }

    let matched: Person | undefined;
    let created: Person | undefined;
    for (const claim of claims) {
      const demandTopic = `${demand.title} ${demand.description} ${demand.category}`;
      const medOverlap =
        /\b(meds?|medication|prescription|pharmacy)\b/i.test(claim.topic) &&
        demand.category === "medical";
      if (!topicsOverlap(claim.topic, demandTopic) && !medOverlap) continue;
      matched = findPersonByName(params.persons, claim.ownerName);
      if (!matched) {
        created = {
          id: stablePersonId("inferred", claim.ownerName),
          name: claim.ownerName,
          role: "inferred_owner",
          relationship: "inferred",
        };
        matched = created;
      }
      break;
    }

    // Default: primary caregiver owns when no competing claim and no conflict signal.
    if (!matched && primary && claims.length === 0) {
      matched = primary;
    }

    if (matched) {
      assignments.push({
        demandId: demand.id,
        ownerId: matched.id,
        situationId: demand.situationId,
        person: created,
      });
    }
  }

  return assignments;
}
