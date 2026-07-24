import type { GoldenSoftOrientationCheck } from "./types";
import { containsAiProductLanguage } from "./ai-product-language";

const EMPATHY =
  /\b(i understand how you feel|i'?m here for you|that sounds difficult|your feelings are valid|take a deep breath)\b/i;
const MEDICAL =
  /\b(you should (?:take|stop|start)|i (?:diagnose|prescribe)|this is (?:dementia|alzheimer)|confidence score)\b/i;
const ISOLATED =
  /\b(starting a new story|unrelated to anything|brand new situation with no connection)\b/i;

/**
 * Soft golden inputs must still leave useful orientation — not a form, not therapy, not extraction.
 * Checks are structural/quality — not required exact phrases from the input.
 */
export function evaluateGoldenSoftOrientation(params: {
  input: string;
  confirmation: string;
  what_we_know?: readonly string[] | null;
  what_changed?: string | null;
  situation_summary?: string | null;
  what_matters_now?: string | null;
  still_unclear?: readonly string[] | null;
  show_clarity?: boolean;
}): GoldenSoftOrientationCheck {
  const failures: string[] = [];
  const confirmation = params.confirmation.trim();
  const know = (params.what_we_know ?? []).map((s) => s.trim()).filter(Boolean);
  const changed = (params.what_changed ?? "").trim();
  const summary = (params.situation_summary ?? "").trim();
  const matters = (params.what_matters_now ?? "").trim();
  const asks = (params.still_unclear ?? []).map((s) => s.trim()).filter(Boolean);

  const blob = [confirmation, ...know, changed, summary, matters, ...asks].join("\n");

  const has_held_confirmation =
    confirmation.length > 0 &&
    /held|living care record|using what|oriented|already/i.test(confirmation);

  const has_orientation =
    know.length > 0 ||
    changed.length > 0 ||
    summary.length > 0 ||
    matters.length > 0 ||
    has_held_confirmation;

  if (!has_orientation) failures.push("no_orientation");
  if (!has_held_confirmation && confirmation.length === 0) {
    failures.push("empty_confirmation");
  }
  if (asks.length > 3) failures.push("too_many_asks");
  if (containsAiProductLanguage(blob)) failures.push("ai_product_language");
  if (EMPATHY.test(blob)) failures.push("generic_empathy");
  if (MEDICAL.test(blob)) failures.push("medical_advice_or_diagnosis");
  if (ISOLATED.test(blob)) failures.push("isolated_event_framing");
  if (/^note created\.?$/i.test(confirmation)) failures.push("note_created_feel");

  return {
    input: params.input,
    has_orientation,
    has_held_confirmation,
    ask_count: asks.length,
    failures,
    ok: failures.length === 0 && has_orientation,
  };
}
