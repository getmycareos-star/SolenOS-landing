/**
 * Event layer — real-world care journey occurrences (timeline).
 * Never invent meaning, reasons, or future intentions as events.
 *
 * SoT: docs/02-product/solenos-event-extraction.md
 */

import type { ExtractedEvent, ExtractedObservation } from "./types";

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Planned / future actions are not events until they happen.
 * Structural intention discourse — not scenario nouns.
 */
export function looksLikeIntentionNotEvent(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  // Future / plan framing without completed occurrence
  if (
    /\b(?:plan(?:s|ned|ning)? to|going to|will|won't|hope to|want to|intend(?:s|ed)? to|thinking of|scheduled for)\b/i.test(
      t,
    ) &&
    !/\b(?:had|went|attended|admitted|discharged|came home|transferred|visited|occurred|happened)\b/i.test(
      t,
    )
  ) {
    return true;
  }
  if (/\b(?:next week|next month|tomorrow|soon|later this)\b/i.test(t) && /\b(?:plan|will|going to|schedule)\b/i.test(t)) {
    return true;
  }
  return false;
}

/**
 * Journey occurrence / healthcare encounter / care transition — Event, not Observation.
 * Discourse structure (encounter + occurrence, or transition), not illustration-noun if-branches.
 */
export function looksLikeCareJourneyEventFragment(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (looksLikeIntentionNotEvent(t)) return false;

  // Healthcare encounter that occurred
  if (
    /\b(?:hospital|clinic|er|emergency|urgent care)\b/i.test(t) &&
    /\b(?:visit|went|admitted|discharge|discharged|seen|took|came home|came back|stay)\b/i.test(t)
  ) {
    return true;
  }
  if (/\b(?:had|after)\s+(?:a\s+|the\s+|an\s+)?(?:hospital|clinic|er)\b/i.test(t)) return true;

  // Appointment that already occurred (not merely scheduled)
  if (/\bappointment\b/i.test(t) && /\b(?:had|went|attended|after)\b/i.test(t)) {
    return true;
  }

  // Completed clinical visit / escort to care (journey moment — not intention)
  if (
    /\b(?:took|brought|drove)\b/i.test(t) &&
    /\bto (?:the )?(?:doctor|clinic|hospital|appointment|er|emergency)\b/i.test(t)
  ) {
    return true;
  }
  if (/\bwent to (?:the )?(?:doctor|clinic|hospital|er)\b/i.test(t)) {
    return true;
  }

  // Care transition / setting change
  if (
    /\b(?:transferred|transition(?:ed)?|moved to|came home from|admitted to|discharged from|rehabilitation|rehab)\b/i.test(
      t,
    )
  ) {
    return true;
  }
  // Admission / discharge discourse without requiring the word "hospital" in-fragment
  if (/\b(?:admitted|discharged)\b/i.test(t) && /\b(?:after|from|to|following)\b/i.test(t)) {
    return true;
  }

  // Occurrence with setting + time — past fall / tumble is a journey event (incl. today / this morning)
  if (
    /\b(?:almost\s+)?(?:fell|fall|fallen|tumble|tumbled)\b/i.test(t) &&
    /\b(?:hospital|visit|clinic|doctor|er|bathroom|home|yesterday|today|tonight|this morning|this afternoon|this evening|last night|ago|days?|had|went|after|again)\b/i.test(
      t,
    )
  ) {
    return true;
  }

  // Specialist / clinical appointment as care interaction (today / had / attended)
  if (
    /\bappointment\b/i.test(t) &&
    /\b(?:today|yesterday|had|went|attended|after|with (?:the )?(?:neurologist|specialist|doctor|clinic))\b/i.test(
      t,
    )
  ) {
    return true;
  }
  if (
    /\b(?:neurologist|specialist|primary care|memory clinic)\b/i.test(t) &&
    /\b(?:appointment|visit|today|yesterday|seen|saw)\b/i.test(t)
  ) {
    return true;
  }

  return false;
}

/**
 * Strip why / good-bad conclusions — Event records what happened only.
 */
export function normalizeEventDescription(raw: string): string {
  let t = raw.trim().replace(/\s+/g, " ");
  if (!t) return "A care journey occurrence was reported.";

  // Drop trailing interpretation clauses (because / so that / which meant)
  t = t
    .replace(/\b(?:because|so that|which meant|which means|thankfully|unfortunately)[,:]?\s+.+$/i, "")
    .trim();
  // Drop evaluative wrappers
  t = t.replace(/\b(?:good|bad|terrible|wonderful)\s+(?:that|news)\b/gi, "").trim();
  t = t.replace(/\s{2,}/g, " ").replace(/^[,.\s]+|[,.\s]+$/g, "");

  if (t.length < 12) return raw.trim().slice(0, 240);
  return t.slice(0, 240);
}

export function extractEventTime(text: string): string | null {
  const m = text.match(
    /\b(?:yesterday|today|this morning|last night|last week|couple of weeks|few days ago|days? ago|over the last[^.!]{0,40}|last month|this week)\b/i,
  );
  return m ? m[0]! : null;
}

/**
 * Structural participant roles from discourse — never invent named people.
 */
export function extractEventParticipants(text: string): string[] {
  const who = new Set<string>();
  if (/\b(?:i|we|us|my|our)\b/i.test(text)) who.add("caregiver");
  if (/\b(?:brother|sister|son|daughter|family|husband|wife|spouse)\b/i.test(text)) {
    who.add("family_member");
  }
  if (/\b(?:doctor|physician|clinician|nurse|specialist)\b/i.test(text)) who.add("clinician");
  if (/\b(?:hospital|er|clinic|urgent care)\b/i.test(text)) who.add("hospital");
  if (/\b(?:care team|they)\b/i.test(text) && /\b(?:hospital|clinic|doctor|admitted|discharged)\b/i.test(text)) {
    who.add("care_team");
  }
  if (who.size === 0) who.add("caregiver");
  return [...who];
}

export function createExtractedEvent(params: {
  raw_fragment: string;
  description?: string;
}): ExtractedEvent {
  const description = normalizeEventDescription(
    params.description ?? params.raw_fragment,
  );
  return {
    id: newId("evt"),
    layer: "event",
    description,
    time: extractEventTime(params.raw_fragment),
    participants: extractEventParticipants(params.raw_fragment),
    related_observation_ids: [],
    raw_fragment: params.raw_fragment,
  };
}

/**
 * Link existing observations only (shared time / shared capture context).
 * Never creates observation objects.
 */
export function linkRelatedObservationsToEvents(params: {
  events: ExtractedEvent[];
  observations: ExtractedObservation[];
}): void {
  for (const evt of params.events) {
    for (const obs of params.observations) {
      const sharedTime =
        Boolean(evt.time) &&
        Boolean(obs.approximate_time) &&
        evt.time!.toLowerCase() === obs.approximate_time!.toLowerCase();
      const sharedCapture =
        evt.raw_fragment === obs.raw_fragment ||
        (obs.raw_fragment.length >= 40 &&
          evt.raw_fragment.includes(obs.raw_fragment.slice(0, Math.min(48, obs.raw_fragment.length))));
      if (!sharedTime && !sharedCapture) continue;
      if (!evt.related_observation_ids.includes(obs.id)) {
        evt.related_observation_ids.push(obs.id);
      }
    }
  }
}
