import type {
  ExtractedClaim,
  ReconciliationResult,
  MatchedPair,
  DisagreementLog,
  AOnlyLog,
  ReconciliationMetrics,
  ExtractionRunOutput,
} from "./types";
import { computeSourceSpanOverlap } from "./source-pointer";
import { createClaimId } from "./ids";

const OVERLAP_THRESHOLD = 0.5;

const CONFIDENCE_RANK: Record<string, number> = {
  confirmed: 0,
  reported: 1,
  inferred: 2,
  unknown: 3,
  contradictory: 4,
};

function conservativeConfidence(tagA: string, tagB: string): string {
  const rankA = CONFIDENCE_RANK[tagA] ?? 3;
  const rankB = CONFIDENCE_RANK[tagB] ?? 3;
  return rankA >= rankB ? tagA : tagB;
}

function findMatchingClaim(
  claimA: ExtractedClaim,
  otherClaims: ExtractedClaim[],
  matchedIds: Set<string>,
): ExtractedClaim | null {
  if (!claimA.source_span) return null;

  let bestMatch: ExtractedClaim | null = null;
  let bestOverlap = 0;

  for (const claimB of otherClaims) {
    if (matchedIds.has(claimB.id)) continue;
    if (!claimB.source_span) continue;

    const overlap = computeSourceSpanOverlap(claimA.source_span, claimB.source_span);
    if (overlap > bestOverlap && overlap >= OVERLAP_THRESHOLD) {
      bestOverlap = overlap;
      bestMatch = claimB;
    }
  }

  return bestMatch;
}

function reconcilePair(claimA: ExtractedClaim, claimB: ExtractedClaim): MatchedPair {
  const entityAgrees = claimA.entity_type === claimB.entity_type;
  const eventTypeAgrees = claimA.event_type === claimB.event_type;
  const confidenceAgrees = claimA.confidence_tag === claimB.confidence_tag;

  let finalTag: string;
  let reason: string;

  if (!entityAgrees || !eventTypeAgrees) {
    finalTag = "inferred";
    reason = `Disagreement on entity_type=${!entityAgrees} event_type=${!eventTypeAgrees}`;
  } else if (!confidenceAgrees) {
    finalTag = conservativeConfidence(claimA.confidence_tag, claimB.confidence_tag);
    reason = `Confidence disagreement: ${claimA.confidence_tag} vs ${claimB.confidence_tag}`;
  } else {
    finalTag = claimA.confidence_tag;
    reason = "Full agreement";
  }

  const finalClaim: ExtractedClaim = {
    ...claimA,
    id: createClaimId(),
    confidence_tag: finalTag as ExtractedClaim["confidence_tag"],
  };

  const overlapRatio = claimA.source_span && claimB.source_span
    ? computeSourceSpanOverlap(claimA.source_span, claimB.source_span)
    : 0;

  return {
    claim_a: claimA,
    claim_b: claimB,
    overlap_ratio: overlapRatio,
    entity_agrees: entityAgrees,
    event_type_agrees: eventTypeAgrees,
    confidence_agrees: confidenceAgrees,
    final_claim: finalClaim,
  };
}

export function reconcileExtractionRuns(
  runA: ExtractionRunOutput,
  runB: ExtractionRunOutput,
  evidenceId: string,
): ReconciliationResult {
  const claimsA = runA.success ? runA.claims : [];
  const claimsB = runB.success ? runB.claims : [];

  const matchedPairs: MatchedPair[] = [];
  const reconciledClaims: ExtractedClaim[] = [];
  const disagreements: DisagreementLog[] = [];
  const aOnlyLogs: AOnlyLog[] = [];
  const bOnlyLogs: AOnlyLog[] = [];

  const matchedBIds = new Set<string>();
  const matchedAIds = new Set<string>();

  const remainingA = new Set(claimsA.map((c) => c.id));
  const remainingB = new Set(claimsB.map((c) => c.id));

  for (const claimA of claimsA) {
    const match = findMatchingClaim(claimA, claimsB, matchedBIds);
    if (match) {
      const pair = reconcilePair(claimA, match);
      matchedPairs.push(pair);
      reconciledClaims.push(pair.final_claim);
      matchedAIds.add(claimA.id);
      matchedBIds.add(match.id);
      remainingA.delete(claimA.id);
      remainingB.delete(match.id);

      if (!pair.entity_agrees || !pair.event_type_agrees || !pair.confidence_agrees) {
        const disagreementFields: string[] = [];
        if (!pair.entity_agrees) disagreementFields.push("entity_type");
        if (!pair.event_type_agrees) disagreementFields.push("event_type");
        if (!pair.confidence_agrees) disagreementFields.push("confidence_tag");

        disagreements.push({
          evidence_id: evidenceId,
          claim_id_a: claimA.id,
          claim_id_b: match.id,
          run_a_confidence: claimA.confidence_tag,
          run_b_confidence: match.confidence_tag,
          final_confidence: pair.final_claim.confidence_tag,
          entity_a: claimA.entity_type,
          entity_b: match.entity_type,
          event_type_a: claimA.event_type,
          event_type_b: match.event_type,
          disagreement_fields: disagreementFields,
          source_span_a: claimA.source_span,
          source_span_b: match.source_span,
          reason: pair.confidence_agrees ? "Entity or event type disagreement" : "Confidence disagreement",
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  for (const claimA of claimsA) {
    if (remainingA.has(claimA.id)) {
      const finalClaim: ExtractedClaim = {
        ...claimA,
        confidence_tag: "unknown",
        id: createClaimId(),
      };
      reconciledClaims.push(finalClaim);
      aOnlyLogs.push({
        evidence_id: evidenceId,
        claim_id: claimA.id,
        run: "A",
        reason: "claim appeared in only one extraction run",
        original_confidence: claimA.confidence_tag,
        final_confidence: "unknown",
        timestamp: new Date().toISOString(),
      });
    }
  }

  for (const claimB of claimsB) {
    if (remainingB.has(claimB.id)) {
      const finalClaim: ExtractedClaim = {
        ...claimB,
        confidence_tag: "unknown",
        id: createClaimId(),
      };
      reconciledClaims.push(finalClaim);
      bOnlyLogs.push({
        evidence_id: evidenceId,
        claim_id: claimB.id,
        run: "B",
        reason: "claim appeared in only one extraction run",
        original_confidence: claimB.confidence_tag,
        final_confidence: "unknown",
        timestamp: new Date().toISOString(),
      });
    }
  }

  const confirmedCount = reconciledClaims.filter((c) => c.confidence_tag === "confirmed").length;
  const eligibleForConfirmation = matchedPairs.filter(
    (p) => p.entity_agrees && p.event_type_agrees && p.confidence_agrees && p.final_claim.confidence_tag === "confirmed",
  ).length;
  const totalEligible = matchedPairs.length;

  const downgradeCount = matchedPairs.filter(
    (p) => p.claim_a.confidence_tag === "confirmed" && p.final_claim.confidence_tag !== "confirmed",
  ).length;

  const metrics: ReconciliationMetrics = {
    total_extracted_claims: claimsA.length + claimsB.length,
    matched_claims: matchedPairs.length,
    a_only_claims: aOnlyLogs.length,
    b_only_claims: bOnlyLogs.length,
    full_agreement_claims: matchedPairs.filter((p) => p.entity_agrees && p.event_type_agrees && p.confidence_agrees).length,
    disagreement_claims: disagreements.length,
    confirmed_claims: confirmedCount,
    reported_claims: reconciledClaims.filter((c) => c.confidence_tag === "reported").length,
    inferred_claims: reconciledClaims.filter((c) => c.confidence_tag === "inferred").length,
    unknown_claims: reconciledClaims.filter((c) => c.confidence_tag === "unknown").length,
    downgrade_count: downgradeCount,
    confirmed_survival_rate: totalEligible > 0 ? eligibleForConfirmation / totalEligible : 1,
  };

  return {
    evidence_id: evidenceId,
    reconciled_claims: reconciledClaims,
    matched_pairs: matchedPairs,
    a_only_claims: claimsA.filter((c) => remainingA.has(c.id)),
    b_only_claims: claimsB.filter((c) => remainingB.has(c.id)),
    disagreements,
    a_only_logs: aOnlyLogs,
    b_only_logs: bOnlyLogs,
    metrics,
  };
}
