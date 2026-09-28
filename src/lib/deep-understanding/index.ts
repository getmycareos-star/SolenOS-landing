/**
 * Deep understanding integration — wires all new layers into the situation-entry pipeline.
 *
 * Runs after semantic extraction and baseline enrichment. Each layer is
 * non-fatal: if Qwen is unavailable or times out, the deterministic floor
 * carries the pipeline forward. Nothing here blocks capture.
 */

import type { ProcessSituationInput } from "../situation-entry/types";
import { extractPersonModel } from "../person-model/extractor";
import { getOrCreatePersonModel, savePersonModel } from "../person-model/store";
import { appendDialogueTurn, getOrCreateDialogue } from "../dialogue-record/store";
import { getOrCreateCaregiverPerson, saveCaregiverPerson } from "../caregiver-person/store";
import { getOrCreateTimeModel } from "../time-model/store";
import { getOrCreateGoodCare } from "../good-care-model/store";
import { getOrCreateCareSetting } from "../care-setting/store";
import { getOrCreateProactiveEngine } from "../proactive-engine/store";
import { buildExplanation } from "../explanation-engine/types";

export interface DeepUnderstandingLayerResult {
  personModelUpdated: boolean;
  dialogueRecorded: boolean;
  caregiverPersonUpdated: boolean;
  timeModelUpdated: boolean;
  goodCareUpdated: boolean;
  careSettingUpdated: boolean;
  proactiveEngineUpdated: boolean;
  explanation: ReturnType<typeof buildExplanation> | null;
  errors: string[];
  durationMs: number;
}

export async function runDeepUnderstandingLayer(params: {
  input: ProcessSituationInput;
  caregiverId: string;
  careRecipientId: string;
  rawInput: string;
  semanticExtraction?: {
    source?: string;
    extraction?: {
      uncertainties?: number;
    };
  } | null;
}): Promise<DeepUnderstandingLayerResult> {
  const start = Date.now();
  const errors: string[] = [];
  let personModelUpdated = false;
  let dialogueRecorded = false;
  let caregiverPersonUpdated = false;
  let timeModelUpdated = false;
  let goodCareUpdated = false;
  let careSettingUpdated = false;
  let proactiveEngineUpdated = false;
  let explanation: ReturnType<typeof buildExplanation> | null = null;

  const careRecipientId = params.careRecipientId;
  const rawInput = params.rawInput.trim();

  // ─── Person Model — Qwen extracts lived experience ────────────────────
  if (rawInput.length >= 12) {
    try {
      const personResult = await extractPersonModel({ text: rawInput });
      const existing = getOrCreatePersonModel({
        careRecipientId,
        displayName: careRecipientId,
      });
      // Merge extracted values — never overwrite stated with inferred
      const seen = new Set(existing.values.map((v) => v.text.toLowerCase()));
      for (const v of personResult.result.values) {
        if (!seen.has(v.text.toLowerCase())) {
          existing.values.push({
            id: `pv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            text: v.text,
            source: v.source,
            confidence: v.confidence,
            recordedAt: new Date().toISOString(),
          });
          seen.add(v.text.toLowerCase());
        }
      }
      savePersonModel(existing);
      personModelUpdated = true;
    } catch (e) {
      errors.push(`person_model: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ─── Dialogue Record — persist what was said ──────────────────────────
  try {
    const dialogue = getOrCreateDialogue({
      careRecipientId,
      dialogueId: `${careRecipientId}:${new Date().toISOString().slice(0, 10)}`,
    });
    appendDialogueTurn(careRecipientId, dialogue.id, {
      participantId: params.caregiverId,
      speakerRole: "caregiver",
      content: rawInput,
      timestamp: new Date().toISOString(),
      sentiment: null,
      topics: [],
      careRelevant: true,
      understoodAs: null,
      openQuestions: [],
      decisions: [],
    });
    dialogueRecorded = true;
  } catch (e) {
    errors.push(`dialogue_record: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ─── Caregiver as Person — identity, capacity, fears ──────────────────
  try {
    const caregiver = getOrCreateCaregiverPerson({
      caregiverId: params.caregiverId,
      relationshipToPerson: params.input.care_recipient_id ?? null,
    });
    saveCaregiverPerson(caregiver);
    caregiverPersonUpdated = true;
  } catch (e) {
    errors.push(`caregiver_person: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ─── Time Model — ensure exists ───────────────────────────────────────
  try {
    getOrCreateTimeModel(careRecipientId);
    timeModelUpdated = true;
  } catch (e) {
    errors.push(`time_model: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ─── Good Care Model — ensure exists ──────────────────────────────────
  try {
    getOrCreateGoodCare(careRecipientId);
    goodCareUpdated = true;
  } catch (e) {
    errors.push(`good_care: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ─── Care Setting — ensure exists ─────────────────────────────────────
  try {
    getOrCreateCareSetting(careRecipientId);
    careSettingUpdated = true;
  } catch (e) {
    errors.push(`care_setting: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ─── Proactive Engagement — ensure exists ─────────────────────────────
  try {
    getOrCreateProactiveEngine(careRecipientId);
    proactiveEngineUpdated = true;
  } catch (e) {
    errors.push(`proactive_engine: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ─── Explanation — plain language ─────────────────────────────────────
  try {
    const uncertaintyCount = params.semanticExtraction?.extraction?.uncertainties ?? 0;
    const uncertaintyList = uncertaintyCount > 0 ? [`${uncertaintyCount} uncertain item(s) detected`] : [];
    explanation = buildExplanation({
      headline: "Understanding updated",
      whyItMatters: "What you shared has been added to the care record.",
      whatWeUnderstood: rawInput.slice(0, 200),
      whatWeAreUnsureAbout: uncertaintyList,
      whatWouldHelp: uncertaintyCount > 0 ? ["Tell us more about what is unclear"] : [],
      whatYouCanDo: ["Continue sharing what you observe"],
      whatCanWait: [],
    });
  } catch (e) {
    errors.push(`explanation: ${e instanceof Error ? e.message : String(e)}`);
  }

  return {
    personModelUpdated,
    dialogueRecorded,
    caregiverPersonUpdated,
    timeModelUpdated,
    goodCareUpdated,
    careSettingUpdated,
    proactiveEngineUpdated,
    explanation,
    errors,
    durationMs: Date.now() - start,
  };
}