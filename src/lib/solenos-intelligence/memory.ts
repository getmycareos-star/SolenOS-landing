/**
 * SolenOS Intelligence Layer — memory retrieval.
 *
 * Before any new input is processed, SolenOS retrieves the relevant
 * prior care reality. This is the continuity boundary: every interaction
 * connects to prior understanding before generating anything new.
 */

import type {
  ActiveCareSituation,
  CanonicalCareEvent,
  CareRealityState,
  ContinuityDecision,
} from "../situation-entry";
import { getCareRealityState } from "../care-reality-state";
import { getActiveCareSituation } from "../active-care-situation";
import { getCareContextRoot } from "../situation-entry/context-store";
import { detectContinuity } from "../care-identity/continuity-detection";
import { listCareEventsForCaregiver } from "../care-events/store";
import type { SolenOSInput, SolenOSMemory } from "./types";

export function retrieveMemory(input: SolenOSInput): SolenOSMemory {
  const careRealityState = getCareRealityState(input.careRecipientId ?? input.caregiverId);
  const activeSituation = getActiveCareSituation(
    input.careRecipientId ?? input.caregiverId,
  );

  let continuityDecision: ContinuityDecision | null = null;
  if (input.careRecipientId) {
    try {
      continuityDecision = detectContinuity({
        caregiverId: input.caregiverId,
        careRecipientId: input.careRecipientId,
        rawText: input.raw,
      });
    } catch {
      continuityDecision = null;
    }
  }

  const contextRoot = getCareContextRoot(input.caregiverId);
  const recentEvents = listCareEventsForCaregiver(input.caregiverId)
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 20);

  return {
    careRealityState,
    activeSituation,
    continuityDecision,
    recentEvents: recentEvents as any,
  };
}
