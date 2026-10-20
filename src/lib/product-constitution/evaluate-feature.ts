import {

  CONSTITUTION_DECISION_FILTER,

  CONSTITUTION_ELIMINATES,

  PRODUCT_CONSTITUTION_WORLDVIEW,

} from "./contract-constants";

import { evaluateFeatureAgainstNorthStar } from "../product-north-star";

import type { FeatureConstitutionEvaluation } from "./types";



const REJECT_PATTERNS = [

  /\bchatbot\b/i,

  /\bAI companion\b/i,

  /\bsocial feed\b/i,

  /\bforum\b/i,

  /\bdashboard\b/i,

  /\bgamification\b/i,

  /\bengag(?:e|ement) metric/i,

  /\bproductivity app\b/i,

  /\btask manager\b/i,

  /\breminder app\b/i,

  /\bmanual tracking\b/i,

  /\bEHR replacement\b/i,

  /\bhealthcare is broken\b/i,

  /\bdiagnose\b/i,

  /\bpretend to be (?:a )?friend\b/i,

  /\bdocument vault\b/i,

  /\bnotification digests?\b/i,

  /\bdaily check[- ]?ins?\b/i,

  /\bmarketplace\b/i,

  /\btraining platform\b/i,

  /\bresource directory\b/i,

  /\bfinancial assistance platform\b/i,

];



const PASS_PATTERNS = [

  /\bcare.?state\b/i,

  /\bcare.?record\b/i,

  /\bliving care record\b/i,

  /\bchange detection\b/i,

  /\bmissing information\b/i,

  /\bblind spot\b/i,

  /\buncertainty\b/i,

  /\bdiff\b/i,

  /\bunknowns?\b/i,

  /\battention\b/i,

  /\bconfidence\b/i,

  /\bcontinuity\b/i,

  /\btimeline\b/i,

  /\bevidence\b/i,

  /\bhandoff\b/i,

  /\bevent extraction\b/i,

  /\bingestion\b/i,

  /\bdecision memory\b/i,

];



/**

 * Constitution gate — layers on North Star. Unclear → reject.

 * Eliminate-list patterns are hard rejects before North Star wording games.

 */

export function evaluateFeatureAgainstConstitution(

  featureDescription: string,

): FeatureConstitutionEvaluation {

  const text = featureDescription.trim();



  if (!text) {

    return {

      feature_description: text,

      verdict: "unclear_rejected",

      reduces_uncertainty: null,

      improves_care_state_understanding: null,

      reason: "Empty feature — constitution defaults to reject.",

      filters_failed: [CONSTITUTION_DECISION_FILTER[1]!],

    };

  }



  if (REJECT_PATTERNS.some((p) => p.test(text))) {

    return {

      feature_description: text,

      verdict: "reject",

      reduces_uncertainty: false,

      improves_care_state_understanding: false,

      reason: `Rejected by constitution (${CONSTITUTION_ELIMINATES.slice(0, 4).join(", ")}…): ${PRODUCT_CONSTITUTION_WORLDVIEW}`,

      filters_failed: [

        CONSTITUTION_DECISION_FILTER[5]!,

        CONSTITUTION_DECISION_FILTER[7]!,

      ],

    };

  }



  const northStar = evaluateFeatureAgainstNorthStar(text);

  if (northStar.verdict !== "pass") {

    return {

      feature_description: text,

      verdict: northStar.verdict === "reject" ? "reject" : "unclear_rejected",

      reduces_uncertainty: false,

      improves_care_state_understanding: false,

      reason: `Fails North Star first: ${northStar.reason}`,

      filters_failed: [northStar.north_star_test],

    };

  }



  if (!PASS_PATTERNS.some((p) => p.test(text))) {

    return {

      feature_description: text,

      verdict: "unclear_rejected",

      reduces_uncertainty: null,

      improves_care_state_understanding: null,

      reason:

        "Unclear whether this improves Care State understanding or strengthens the Living Care Record — reject by default.",

      filters_failed: [

        CONSTITUTION_DECISION_FILTER[0]!,

        CONSTITUTION_DECISION_FILTER[7]!,

      ],

    };

  }



  return {

    feature_description: text,

    verdict: "pass",

    reduces_uncertainty: true,

    improves_care_state_understanding: true,

    reason:

      "Improves Care State understanding and reduces uncertainty without adding maintenance burden.",

    filters_failed: [],

  };

}


