/**
 * Plain language explanation engine — why, uncertainty, what would help.
 *
 * Every layer produces structured output. When a caregiver asks "why did
 * you say that?", the answer is a JSON trace of 47 layers. This layer adds
 * the missing piece: natural language explanation of the reasoning chain,
 * translation of structured decisions into human judgment, acknowledgment
 * of uncertainty in the explanation itself.
 */

export const EXPLANATION_ENGINE_VERSION = "1.0.0";

export type ExplanationLayer = {
  layer: string;
  whatItSaid: string;
  whyItMatters: string;
  evidence: string[];
  confidence: "high" | "moderate" | "limited" | "unknown";
};

export type PlainLanguageExplanation = {
  version: string;
  headline: string;
  /** Why this matters to the caregiver, in plain English. */
  whyItMatters: string;
  /** What SolenOS understood. */
  whatWeUnderstood: string;
  /** What SolenOS is unsure about. */
  whatWeAreUnsureAbout: string[];
  /** What would help SolenOS be more sure. */
  whatWouldHelp: string[];
  /** The reasoning chain, translated to human judgment. */
  reasoningChain: ExplanationLayer[];
  /** What the caregiver can do. */
  whatYouCanDo: string[];
  /** What can wait. */
  whatCanWait: string[];
  /** Trust footer — never a claim of certainty. */
  trustFooter: string;
  createdAt: string;
};

export function buildExplanation(params: {
  headline: string;
  whyItMatters: string;
  whatWeUnderstood: string;
  whatWeAreUnsureAbout?: string[];
  whatWouldHelp?: string[];
  reasoningChain?: ExplanationLayer[];
  whatYouCanDo?: string[];
  whatCanWait?: string[];
  trustFooter?: string;
  createdAt?: string;
}): PlainLanguageExplanation {
  return {
    version: EXPLANATION_ENGINE_VERSION,
    headline: params.headline,
    whyItMatters: params.whyItMatters,
    whatWeUnderstood: params.whatWeUnderstood,
    whatWeAreUnsureAbout: params.whatWeAreUnsureAbout ?? [],
    whatWouldHelp: params.whatWouldHelp ?? [],
    reasoningChain: params.reasoningChain ?? [],
    whatYouCanDo: params.whatYouCanDo ?? [],
    whatCanWait: params.whatCanWait ?? [],
    trustFooter: params.trustFooter ?? "SolenOS is not a doctor. It does not diagnose. It helps you understand what is happening so you can make better decisions with your care team.",
    createdAt: params.createdAt ?? new Date().toISOString(),
  };
}

export function formatExplanation(explanation: PlainLanguageExplanation): string {
  const parts: string[] = [];
  parts.push(explanation.headline);
  parts.push("");
  parts.push(explanation.whyItMatters);
  parts.push("");
  if (explanation.whatWeUnderstood) {
    parts.push("What we understood:");
    parts.push(explanation.whatWeUnderstood);
    parts.push("");
  }
  if (explanation.whatWeAreUnsureAbout.length > 0) {
    parts.push("What we are unsure about:");
    for (const u of explanation.whatWeAreUnsureAbout) {
      parts.push(`- ${u}`);
    }
    parts.push("");
  }
  if (explanation.whatWouldHelp.length > 0) {
    parts.push("What would help us be more sure:");
    for (const w of explanation.whatWouldHelp) {
      parts.push(`- ${w}`);
    }
    parts.push("");
  }
  if (explanation.whatYouCanDo.length > 0) {
    parts.push("What you can do:");
    for (const d of explanation.whatYouCanDo) {
      parts.push(`- ${d}`);
    }
    parts.push("");
  }
  if (explanation.whatCanWait.length > 0) {
    parts.push("What can wait:");
    for (const w of explanation.whatCanWait) {
      parts.push(`- ${w}`);
    }
    parts.push("");
  }
  parts.push(explanation.trustFooter);
  return parts.join("\n");
}