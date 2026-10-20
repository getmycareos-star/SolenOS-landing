export const DELEGATION_LAYER_IDENTITY =
  "Delegation Layer suggests who could handle tasks when caregiver load is elevated — suggest only, no auto-reassignment";

export const DELEGATION_LAYER_ONE_LINE_TRUTH =
  "When load is HIGH/CRITICAL, optional 'could be handled by X' suggestions from responsibility graph — not availability forecasting.";

export const DELEGATION_LAYER_PIPELINE_POSITION =
  "Decision Engine → Fail-Safe → Crisis Prevention → Confidence → DELEGATION → Human Trust → Safety → Output";

export const DELEGATION_LAYER_FORBIDDEN = [
  "auto-reassignment or backup owner enforcement",
  "availability forecasting or calendar integration",
  "persisting delegation as independent system of record",
  "new sidebar sections for delegation",
] as const;
