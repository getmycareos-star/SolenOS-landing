export type AppointmentSourceEvidence = {
  id: string;
  type: string;
  source_text: string;
  uploaded_at?: string;
};

export type AppointmentBriefing = {
  id: string;
  sourceEvidenceId: string;
  sourceType: string;
  sourceDate?: string;
  sourceSentence: string;
  when: string | null;
  who: string | null;
  preparation: string[];
  detailsToConfirm: string[];
};

const APPOINTMENT_SIGNAL =
  /\b(?:appointment|scheduled|booked|follow[- ]?up|follow up|recheck|return visit|specialist referral|see (?:dr\.?|doctor)|clinic visit|care conference|family meeting)\b/i;
const PREPARATION_SIGNAL =
  /\b(?:bring|take with you|prepare|have ready|gather|fast(?:ing)?|do not eat|arrive early|check in|paperwork|medication list|medical records|questions to ask)\b/i;
const DATE_OR_TIME =
  /\b(?:\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:\s*,?\s+[A-Z][a-z]+\s+\d{1,2})?|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:,\s*\d{4})?|\d{1,2}:\d{2}\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))\b/i;

function splitSentences(text: string): string[] {
  return text
    .replace(/\r/g, "\n")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function extractWho(sentence: string): string | null {
  const clinician = sentence.match(/\b(?:Dr\.?|Doctor)\s+[A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,3}/);
  if (clinician?.[0]) return clinician[0].trim();
  const clinic = sentence.match(/\b(?:cardiology|neurology|oncology|primary care|clinic|hospital|specialist)\b/i);
  return clinic?.[0] ?? null;
}

/**
 * Builds a briefing only from explicit source sentences. It does not infer a
 * booking, preparation requirement, clinician, or date absent from the evidence.
 */
export function buildAppointmentBriefings(
  evidence: readonly AppointmentSourceEvidence[],
): AppointmentBriefing[] {
  const briefings: AppointmentBriefing[] = [];
  const seen = new Set<string>();

  for (const item of evidence) {
    const sentences = splitSentences(item.source_text);
    for (let index = 0; index < sentences.length; index += 1) {
      const sentence = sentences[index];
      if (!APPOINTMENT_SIGNAL.test(sentence)) continue;

      const preparation = sentences.filter((candidate) =>
        PREPARATION_SIGNAL.test(candidate),
      );
      const key = `${item.id}|${sentence.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const when = DATE_OR_TIME.exec(sentence)?.[0] ?? null;
      const who = extractWho(sentence);
      const detailsToConfirm: string[] = [];
      if (!when) detailsToConfirm.push("Confirm the appointment date and time.");
      if (!who) detailsToConfirm.push("Confirm the clinician, clinic, or service.");
      if (preparation.length === 0) {
        detailsToConfirm.push("Check the original source for preparation or documents to bring.");
      }
      detailsToConfirm.push("Verify that this is a current plan, not a past or superseded appointment.");

      briefings.push({
        id: key,
        sourceEvidenceId: item.id,
        sourceType: item.type,
        ...(item.uploaded_at ? { sourceDate: item.uploaded_at } : {}),
        sourceSentence: sentence,
        when,
        who,
        preparation,
        detailsToConfirm,
      });
    }
  }

  return briefings;
}
