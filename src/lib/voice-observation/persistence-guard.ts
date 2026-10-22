/** Pure persistence gate shared by voice capture and tests. */
export function isObservationDurablyPersisted(
  status: string | null | undefined,
): status is "persisted" {
  return status === "persisted";
}

export const OBSERVATION_PERSISTENCE_UNAVAILABLE_MESSAGE =
  "Observation persistence is unavailable; this input was not durably saved.";
