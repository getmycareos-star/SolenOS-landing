import type { ENTRY_INPUT_KINDS, ENTRY_MODES } from "./contract-constants";

export type EntryInputKind = (typeof ENTRY_INPUT_KINDS)[number];
export type EntryMode = (typeof ENTRY_MODES)[number];

export type EntryInputClassification = {
  kind: EntryInputKind;
  is_greeting: boolean;
  has_care_semantics: boolean;
  reason: string;
};

export type EntryBehaviorResult = {
  active: boolean;
  mode: EntryMode;
  input_classification: EntryInputKind;
  state_reconciled: boolean;
  /** Ingestion-first prompt — initialization mode only; no intake wizard */
  ingestion_ready_prompt: string;
  rules_upheld: readonly string[];
  defining_principle: string;
};

export type ProcessEntryBehaviorInput = {
  caregiver_id: string;
  raw_input: string;
  has_documents: boolean;
  timestamp?: string;
};
