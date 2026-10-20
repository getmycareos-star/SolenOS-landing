/**
 * Probe: hospital discharge / checkup note → Response Contract fields vs LCR disclosure.
 */
import { ingestActiveCareObservation, resetActiveCareSituationStore } from "../src/lib/active-care-situation";
import { resetCareRealityStateStore } from "../src/lib/care-reality-state";
import { resetMultiCaregiverContextStore, resolveCareRealityStoreKey } from "../src/lib/multi-caregiver-context-model";
import { setCareRecipientDisplayName, resetCareRecipientIdentityStore } from "../src/lib/care-recipient-identity";
import { composeCaregiverResponse } from "../src/lib/caregiver-response-composer";
import { buildLivingCareRecordResponse } from "../src/lib/living-care-record-ux";
import { classifyCaregiverTurn, resolveReliefDecisionForTurn } from "../src/lib/response-behavior";
import { careRealityObservations } from "../src/lib/progressive-understanding";
import type { SituationResponse } from "../src/lib/situation-entry/types";

function probe(label: string, text: string) {
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetMultiCaregiverContextStore();
  resetCareRecipientIdentityStore();

  const id = `contract_probe_${label}`;
  const careKey = resolveCareRealityStoreKey(id);
  setCareRecipientDisplayName({ careKey, displayName: "Mom" });

  const turn = ingestActiveCareObservation({
    caregiverId: id,
    rawText: text,
    kind: "general",
    nowIso: "2026-07-22T20:00:00.000Z",
  });

  const turnClass = classifyCaregiverTurn({ latestRawText: text, kind: "general", turn });
  const relief = resolveReliefDecisionForTurn({ turn, turnClass, latestRawText: text });
  const composed = composeCaregiverResponse({ turn, latestRawText: text, kind: "general" });
  const view = buildLivingCareRecordResponse({
    response: {
      active_care_situation_turn: turn,
      active_care_situation: turn.situation,
      events_created: [],
      context: { caregiver_id: id },
    } as unknown as SituationResponse,
    rawInput: text,
  });

  console.log(
    JSON.stringify(
      {
        label,
        turnClass,
        careWorthyCount: careRealityObservations(turn.situation).length,
        human_fact: turn.situation.observations[0]?.human_fact ?? null,
        relief: {
          mode: relief.mode,
          form_full_contract: relief.form_full_contract,
          show_clarity: relief.show_clarity,
          show_asks: relief.show_asks,
          show_follow_up: relief.show_follow_up,
        },
        composed: {
          show_clarity: composed.show_clarity,
          matters: composed.what_matters_now,
          wait: composed.what_can_wait,
          asks: composed.still_unclear,
          follow: composed.follow_up_items,
          risk: composed.risk_level,
        },
        disclosed: {
          show_matters: view.disclosure_plan.show_what_matters_now,
          show_asks: view.disclosure_plan.show_questions,
          matters: view.what_matters_now,
          wait: view.what_can_wait,
          asks: view.what_needs_context,
          follow: view.follow_up_items,
          risk: view.risk_level,
          attention: view.attention_label,
        },
      },
      null,
      2,
    ),
  );
}

probe(
  "discharge_mixed",
  "i got a discharge from the hospital, it say mom needs to be repoorting to the hospital for checkups, what do i do?",
);
probe("pure_guidance", "what do i do?");
