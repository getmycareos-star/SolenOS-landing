import {
  BUILD_FILTER_QUESTION,
  FORBIDDEN_OUTPUT_PATTERNS,
} from "./contract-constants";
import type { BuildFilterResult, ForbiddenFeatureCategory } from "./types";
import { evaluateFeatureAgainstConstitution } from "../product-constitution";

const FEATURE_KEYWORDS: Record<ForbiddenFeatureCategory, RegExp[]> = {
  chat_system: [/\bchat\b/i, /\bmessaging\b/i, /\bconversation thread\b/i],
  scheduling_calendar_ui: [/\bcalendar view\b/i, /\bagenda builder\b/i, /\breminder timeline\b/i],
  ai_assistant_persona: [/\bask solenos\b/i, /\bai assistant persona\b/i, /\bchat assistant\b/i],
  generic_health_dashboard: [/\bhealth dashboard\b/i, /\bwellness score\b/i, /\bKPI card\b/i],
  long_onboarding_forms: [/\bonboarding wizard\b/i, /\bstep \d+ of \d+\b/i, /\bprofile setup\b/i],
  care_marketplaces: [/\bmarketplace\b/i, /\bnurse matching\b/i, /\bhiring platform\b/i],
  symptom_checker: [/\bsymptom checker\b/i, /\bsymptom quiz\b/i, /\bself.?diagnos/i],
  dementia_faq_assistant: [/\bdementia FAQ\b/i, /\bwhy does dementia\b/i, /\bsymptom encyclopedia\b/i],
  generic_health_chatbot: [/\bhealth chatbot\b/i, /\bmedical Q&A\b/i, /\bhealth advice bot\b/i],
  medical_recommendation_engine: [
    /\bmedical recommendation\b/i,
    /\btreatment recommendation engine\b/i,
    /\bdiagnosis engine\b/i,
    /\bmedication dosage advice\b/i,
  ],
  answer_engine_optimization: [
    /\bask me anything\b/i,
    /\banswer engine\b/i,
    /\bsearch-style Q&A\b/i,
    /\bFAQ response generator\b/i,
  ],
  document_vault_primary: [
    /\bdocument vault\b/i,
    /\bfile management primary\b/i,
    /\bdocument folder\b/i,
    /\btranscript only\b/i,
  ],
  task_manager_primary: [
    /\btask manager primary\b/i,
    /\bchecklist primary\b/i,
    /\btask dashboard\b/i,
    /\boverdue task notification\b/i,
  ],
  reminder_app_primary: [
    /\bmedication reminder primary\b/i,
    /\breminder app\b/i,
    /\bnudge notification core\b/i,
  ],
  family_coordination_platform: [
    /\bfamily chat primary\b/i,
    /\bcaregiver messaging platform\b/i,
    /\bsocial feed for care\b/i,
  ],
  generic_communication_assistant: [
    /\bcommunication assistant\b/i,
    /\bhelp me write (?:a )?message\b/i,
    /\bAI message writer\b/i,
    /\bcommunication coach\b/i,
  ],
  gamified_care_scores: [
    /\bcaregiving confidence:\s*\d+/i,
    /\bcare health score\b/i,
    /\bcaregiver performance rating\b/i,
    /\bbadge streak leaderboard\b/i,
  ],
};

export function passesBuildFilter(input: {
  feature_description: string;
  touches_event_pipeline: boolean;
  improves_care_record: boolean;
}): BuildFilterResult {
  const constitution = evaluateFeatureAgainstConstitution(input.feature_description);
  const allowed =
    input.improves_care_record &&
    input.touches_event_pipeline &&
    constitution.verdict === "pass";
  return {
    allowed,
    improves_care_record: input.improves_care_record,
    passes_event_state_pipeline: input.touches_event_pipeline,
    reason: allowed
      ? "Passes Product Constitution + North Star + Care Record event→state pipeline."
      : `${BUILD_FILTER_QUESTION} NO — ${constitution.reason}`,
  };
}

export function scanForbiddenOutput(text: string): string[] {
  const violations: string[] = [];
  for (const pattern of FORBIDDEN_OUTPUT_PATTERNS) {
    const match = text.match(pattern);
    if (match) violations.push(match[0]);
  }
  return violations;
}

export function scanForbiddenFeatureRequest(description: string): {
  category: ForbiddenFeatureCategory;
  matched: string;
}[] {
  const hits: { category: ForbiddenFeatureCategory; matched: string }[] = [];
  for (const [category, patterns] of Object.entries(FEATURE_KEYWORDS) as [
    ForbiddenFeatureCategory,
    RegExp[],
  ][]) {
    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match) {
        hits.push({ category, matched: match[0] });
      }
    }
  }
  return hits;
}

export function scanAllOutputSurfaces(
  surfaces: Record<string, string | string[]>,
): string[] {
  const all: string[] = [];
  for (const value of Object.values(surfaces)) {
    const texts = Array.isArray(value) ? value : [value];
    for (const t of texts) {
      if (typeof t === "string") all.push(...scanForbiddenOutput(t));
    }
  }
  return [...new Set(all)];
}
