/**
 * Care recipient display name — ask once (Q29A / identity naming).
 * Never silently infer Mom/Dad from notes into identity.
 */
import assert from "node:assert/strict";
import {
  getCareRecipientDisplayName,
  resolveSubjectLabel,
  setCareRecipientDisplayName,
  resetCareRecipientIdentityStore,
} from "../src/lib/care-recipient-identity/index.ts";
import { detectSubjectLabel, hasExplicitIdentityConflict } from "../src/lib/situation-relationship-engine/signals.ts";
import { identifyCase } from "../src/lib/case-memory/identify-case.ts";
import { resetCaseStore } from "../src/lib/case-memory/stores/case-store.ts";

resetCareRecipientIdentityStore();

assert.equal(getCareRecipientDisplayName("care-a"), null, "unset");
assert.equal(resolveSubjectLabel({ careKey: "care-a" }), "they", "fallback");
assert.equal(
  resolveSubjectLabel({ careKey: "care-a", rawText: "Mom fell yesterday" }),
  "they",
  "never infer Mom/Dad from notes",
);

assert.equal(detectSubjectLabel("she fell yesterday"), "they", "no she→Mom");
assert.equal(detectSubjectLabel("he refuses food"), "they", "no he→Dad");
assert.equal(detectSubjectLabel("Mom fell yesterday"), "they", "no kinship infer");
assert.equal(detectSubjectLabel("Dad hasn't been well"), "they", "no dad infer");

assert.equal(
  hasExplicitIdentityConflict("Mom", "Dad had a doctor's appointment today."),
  true,
  "G17 explicit Dad vs Mom ACS",
);
assert.equal(
  hasExplicitIdentityConflict("Mom", "She seemed quieter after lunch."),
  false,
  "pronouns are not identity conflict",
);

resetCaseStore();
const fromMomNote = identifyCase("Mom fell yesterday");
assert.equal(fromMomNote.created, true, "creates neutral case only");
assert.notEqual(fromMomNote.caseEntity.profile.displayName, "Mom", "no silent Mom case");
assert.equal(fromMomNote.identified, false, "kinship alone is not identified");

setCareRecipientDisplayName({ careKey: "care-a", displayName: "Mom" });
assert.equal(getCareRecipientDisplayName("care-a"), "Mom", "persisted");
assert.equal(resolveSubjectLabel({ careKey: "care-a" }), "Mom", "resolve after set");
assert.equal(
  resolveSubjectLabel({ careKey: "care-a", rawText: "Dad had an appointment" }),
  "Mom",
  "durable name wins over note text",
);

let threw = false;
try {
  setCareRecipientDisplayName({ careKey: "care-a", displayName: "  " });
} catch {
  threw = true;
}
assert.equal(threw, true, "blank rejected");
assert.equal(getCareRecipientDisplayName("care-a"), "Mom", "blank did not clear");

setCareRecipientDisplayName({ careKey: "care-b", displayName: "Dad" });
assert.equal(getCareRecipientDisplayName("care-a"), "Mom", "isolation a");
assert.equal(getCareRecipientDisplayName("care-b"), "Dad", "isolation b");

resetCareRecipientIdentityStore();
assert.equal(getCareRecipientDisplayName("care-a"), null, "reset clears");

console.log("\nCare recipient identity verify passed.\n");
