/**
 * Temporary probe — current golden multi-signal paste → extraction / compose.
 * Delete after audit; not a product verify.
 */
import {
  ingestActiveCareObservation,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import { resetCareRealityStateStore } from "../src/lib/care-reality-state";
import { resetMultiCaregiverContextStore } from "../src/lib/multi-caregiver-context-model";
import { resetCareEpistemicsStores } from "../src/lib/care-epistemics";
import {
  resetCareRecipientIdentityStore,
  setCareRecipientDisplayName,
} from "../src/lib/care-recipient-identity";
import { resetDecisionMemoryStore } from "../src/lib/decision-memory";
import { resolveCareRealityStoreKey } from "../src/lib/multi-caregiver-context-model";
import { composeCaregiverResponse } from "../src/lib/caregiver-response-composer";
import { extractCareRealityFromText } from "../src/lib/care-reality-extraction";
import { processGeneralizedCareUnderstanding } from "../src/lib/generalized-care-understanding";

resetActiveCareSituationStore();
resetCareRealityStateStore();
resetMultiCaregiverContextStore();
resetCareEpistemicsStores();
resetCareRecipientIdentityStore();
resetDecisionMemoryStore();

const text = `Mom fell again this morning but she says she's fine. I don't know if she's just saying that because she doesn't want to worry me.

Her walking has been getting worse and she seems confused more in the evenings. The doctor changed one of her medications two weeks ago but I can't remember if this started before or after that.

My brother asked what happened but I don't even know how to explain everything because it's all mixed together.

I have her medication list somewhere, the hospital papers from last month, and messages from my sister about what she noticed.

I just feel like I'm the only person holding all these pieces.`;

const contributorId = "audit_golden";
const careKey = resolveCareRealityStoreKey(contributorId);
setCareRecipientDisplayName({ careKey, displayName: "Mom" });

const extraction = extractCareRealityFromText({ rawText: text, contributorId });
console.log(
  "EXTRACTION",
  JSON.stringify(
    {
      observations: extraction.observations.map((o) => o.description),
      events: extraction.events.map((e) => e.description),
      decisions: extraction.decisions.map((d) => d.description),
      unknowns: extraction.unknowns.map((u) => u.question),
    },
    null,
    2,
  ),
);

const g = processGeneralizedCareUnderstanding({
  raw_input: text,
  contributor_id: contributorId,
});
console.log(
  "GENERALIZED",
  JSON.stringify(
    {
      observed: g.epistemic.observed.slice(0, 8),
      unknown: g.epistemic.unknown.slice(0, 8),
      matters: g.requires_attention_now,
      wait: g.useful_background.slice(0, 4),
      loops: g.open_loops.slice(0, 4),
    },
    null,
    2,
  ),
);

const turn = ingestActiveCareObservation({
  caregiverId: contributorId,
  rawText: text,
  kind: "general",
  nowIso: "2026-07-23T16:00:00.000Z",
});
const composed = composeCaregiverResponse({
  turn,
  latestRawText: text,
  kind: "general",
});
console.log(
  "COMPOSED",
  JSON.stringify(
    {
      recognition: composed.recognition_line,
      confirmation: composed.confirmation,
      what_changed: composed.what_changed,
      what_matters_now: composed.what_matters_now,
      still_unclear: composed.still_unclear,
      what_we_know: composed.what_we_know,
      follow_up: composed.follow_up_items,
      situation_summary: composed.situation_summary,
    },
    null,
    2,
  ),
);
