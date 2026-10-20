import { buildSnapshot, toPlainText } from "../src/lib/care-snapshot";
import { SAMPLE_CARE_LOGS } from "../src/data/sample-care-logs";
const snapshot = buildSnapshot(SAMPLE_CARE_LOGS, {
  referenceDate: "2026-07-13T09:00:00",
});
console.log(toPlainText(snapshot));
