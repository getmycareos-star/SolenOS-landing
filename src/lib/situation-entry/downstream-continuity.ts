/**
 * Downstream continuity for a caregiver capture.
 *
 * The capture pipeline produces understanding. This module carries that
 * understanding forward in time — the journey timeline, the relationship
 * graph, the caregiver's own capacity, and the patterns that only emerge
 * across several captures.
 *
 * Two rules govern everything here:
 *
 * 1. **Fail-soft.** A fault in any downstream graph must never cost the
 *    caregiver their capture. Each capability is isolated, errors are captured
 *    rather than thrown, and the remaining capabilities still run.
 * 2. **Advisory.** Nothing here overwrites what the caregiver said. These
 *    layers extend and cross-reference the record; they never rewrite it.
 */

import { recordJourneyEventFromCareCapture } from "../care-journey/record";
import { processCareJourneyInputAsync } from "../care-journey-graph/pipeline";
import { syncFromJourneyResult } from "../continuity-graph/pipeline";
import { ingestCareEntry } from "../cognitive-relief/ingest-entry";
import { runPatternIntelligence } from "../pattern-intelligence/proactive-engine";
import { ingestCaregiverSelfEntry } from "../capacity-self/caregiver-profile/ingest-self";

export type DownstreamInput = {
  caregiver_id: string;
  raw_input: string;
  events_created: unknown[];
  all_events: unknown[];
  case_id: string | null;
  captured_at: string;
};

export type DownstreamCapabilityStatus = {
  wired: boolean;
  error: string | null;
};

export type DownstreamResult = {
  journey: DownstreamCapabilityStatus;
  journey_graph: DownstreamCapabilityStatus;
  continuity_graph: DownstreamCapabilityStatus;
  cognitive_relief: DownstreamCapabilityStatus;
  patterns: DownstreamCapabilityStatus;
  caregiver_self: DownstreamCapabilityStatus;
  /** The events recorded onto the caregiver's journey timeline this capture. */
  journey_event_description: string | null;
  /** True when at least one downstream capability accepted this capture. */
  any_wired: boolean;
};

function ok(wired: boolean): DownstreamCapabilityStatus {
  return { wired, error: null };
}

function fail(error: unknown): DownstreamCapabilityStatus {
  return { wired: false, error: error instanceof Error ? error.message : String(error) };
}

/**
 * Run each downstream capability against this capture, isolating failures.
 * Never throws.
 */
export async function extendUnderstandingDownstream(
  input: DownstreamInput,
): Promise<DownstreamResult> {
  const { caregiver_id, raw_input, case_id, captured_at } = input;
  const description = raw_input.trim();
  const primary = firstEventDescription(input.events_created) ?? description;

  let journey = ok(false);
  let journey_graph = ok(false);
  let continuity_graph = ok(false);
  let cognitive_relief = ok(false);
  let patterns = ok(false);
  let caregiver_self = ok(false);
  let journeyEventDescription: string | null = null;

  // Journey timeline: the caregiver's own sequence of events, over time.
  if (description) {
    try {
      const event = await recordJourneyEventFromCareCapture({
        description: primary,
        caregiver_id,
        case_id,
        source: "caregiver_input",
        event_date: captured_at,
        metadata: { events_created: input.events_created.length },
      });
      journey = ok(Boolean(event?.event_id));
      journeyEventDescription = event?.description ?? primary;
    } catch (error) {
      journey = fail(error);
    }
  }

  // Journey graph, then the continuity graph derived from it. These are
  // sequential by nature: continuity reasons over the journey result.
  if (description) {
    try {
      const journeyResult = await processCareJourneyInputAsync({
        description: primary,
        caregiver_id,
        case_id,
        source: "caregiver_input",
      });
      journey_graph = ok(Boolean(journeyResult?.event));

      try {
        const continuity = syncFromJourneyResult(journeyResult);
        continuity_graph = ok(Boolean(continuity?.graph));
      } catch (error) {
        continuity_graph = fail(error);
      }
    } catch (error) {
      journey_graph = fail(error);
      continuity_graph = fail(error);
    }
  }

  // Caregiver relief profile: what the caregiver has been carrying.
  if (description) {
    try {
      const ingested = await ingestCareEntry({
        caregiver_id,
        case_id,
        content: primary,
        captured_at,
        raw_entry_id: `${caregiver_id}:${captured_at}`,
      });
      cognitive_relief = ok(Boolean(ingested));
    } catch (error) {
      cognitive_relief = fail(error);
    }
  }

  // Patterns: only meaningful once there is history to compare against.
  try {
    const result = runPatternIntelligence(caregiver_id, case_id, new Date(captured_at));
    patterns = ok(Boolean(result));
  } catch (error) {
    patterns = fail(error);
  }

  // Caregiver's own capacity. The ingest itself decides whether this entry
  // was about the caregiver rather than the person they care for, so a
  // zero-item result is a correct outcome, not a failure.
  if (description) {
    try {
      const result = ingestCaregiverSelfEntry({
        content: description,
        raw_entry_id: `${caregiver_id}:${captured_at}`,
        caregiver_id,
        captured_at,
      });
      caregiver_self = ok(true);
      if (result && result.caregiver_items_added === 0) {
        caregiver_self = { wired: true, error: null };
      }
    } catch (error) {
      caregiver_self = fail(error);
    }
  }

  const statuses = [journey, journey_graph, continuity_graph, cognitive_relief, patterns, caregiver_self];

  return {
    journey,
    journey_graph,
    continuity_graph,
    cognitive_relief,
    patterns,
    caregiver_self,
    journey_event_description: journeyEventDescription,
    any_wired: statuses.some((s) => s.wired),
  };
}

function firstEventDescription(events: unknown[]): string | null {
  for (const event of events) {
    if (!event || typeof event !== "object") continue;
    const record = event as Record<string, unknown>;
    for (const key of ["text", "description", "raw_text", "summary"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return null;
}
