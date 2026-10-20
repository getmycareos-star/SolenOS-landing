import { AHA_MOMENT_SECTIONS } from "./contract-constants";
import type { AhaMomentView } from "./types";
import type { SituationResponse } from "../situation-entry/types";
import {
  classifyInputMessiness,
  dedupeCaregiverFacingLines,
  humanizeUncertaintyForCaregiver,
  isGenericSignalText,
  resolveCaregiverWords,
  sanitizeCaregiverDisplayText,
} from "../mvp-input-architecture";

const SECTION_TITLES: Record<(typeof AHA_MOMENT_SECTIONS)[number], string> = {
  what_i_understood: "What I understood",
  what_is_uncertain: "What is uncertain",
  what_needs_clarification: "What needs clarification",
  what_changed: "What changed",
  what_will_be_tracked: "What will be tracked",
};

function filterEngineNoise(items: string[]): string[] {
  return items.filter(
    (item) =>
      !item.startsWith("CareContextRoot") &&
      !item.startsWith("New event added (") &&
      !item.startsWith("New uncertainty introduced:") &&
      !/^ce_/.test(item),
  );
}

export function buildAhaMomentView(
  response: Pick<
    SituationResponse,
    | "what_i_understood"
    | "what_is_uncertain"
    | "what_needs_clarification"
    | "what_changed"
    | "what_will_be_tracked"
    | "events_created"
    | "is_first_situation"
    | "north_star_experience_layer"
  >,
): AhaMomentView {
  const caregiverWords = resolveCaregiverWords(response.events_created);

  const understoodFromEngine = response.what_i_understood
    .map((u) => {
      const label = u.label;
      // "Incident detected: "Mom fell..." → strip embedded quotes in clause
      const colon = label.indexOf(": ");
      if (colon > 0) {
        const prefix = label.slice(0, colon + 2);
        const clause = sanitizeCaregiverDisplayText(label.slice(colon + 2));
        return `${prefix}${clause}`;
      }
      return sanitizeCaregiverDisplayText(label);
    })
    .filter((label) => !isGenericSignalText(label));

  const understoodItems = dedupeCaregiverFacingLines(
    caregiverWords
      ? [
          `You shared: ${caregiverWords.slice(0, 200)}${caregiverWords.length > 200 ? "…" : ""}`,
          ...understoodFromEngine,
        ]
      : understoodFromEngine.length > 0
        ? understoodFromEngine
        : response.events_created.map((e) => {
            const text =
              typeof e.attributes?.source_situation_text === "string"
                ? e.attributes.source_situation_text
                : e.raw_input;
            return sanitizeCaregiverDisplayText(text).slice(0, 120);
          }),
    5,
  );

  const uncertainItems = dedupeCaregiverFacingLines(
    response.what_is_uncertain.map(humanizeUncertaintyForCaregiver),
    5,
  );

  const clarificationItems = dedupeCaregiverFacingLines(
    response.what_needs_clarification.map(humanizeUncertaintyForCaregiver),
    4,
  );

  const changedItems = filterEngineNoise(response.what_changed).slice(0, 4);

  const trackedItems = response.what_will_be_tracked.map((d) => d.replace(/_/g, " "));

  const messiness = caregiverWords ? classifyInputMessiness(caregiverWords) : "messy";
  const messinessNote =
    response.is_first_situation && messiness !== "structured"
      ? messiness === "extra_messy"
        ? "Extra messy input is fine — no need to organize first."
        : "Messy input is fine — no need to organize first."
      : null;

  return {
    headline:
      response.north_star_experience_layer?.continuity_recognition ??
      "You don't have to hold all of this in your head anymore.",
    is_first_value_moment: response.is_first_situation,
    events_extracted: response.events_created.length,
    sections: {
      what_i_understood: {
        title: SECTION_TITLES.what_i_understood,
        items: messinessNote ? [messinessNote, ...understoodItems] : understoodItems,
      },
      what_is_uncertain: {
        title: SECTION_TITLES.what_is_uncertain,
        items: uncertainItems,
      },
      what_needs_clarification: {
        title: SECTION_TITLES.what_needs_clarification,
        items: clarificationItems,
      },
      what_changed: {
        title: SECTION_TITLES.what_changed,
        items: changedItems,
      },
      what_will_be_tracked: {
        title: SECTION_TITLES.what_will_be_tracked,
        items: trackedItems,
      },
    },
  };
}
