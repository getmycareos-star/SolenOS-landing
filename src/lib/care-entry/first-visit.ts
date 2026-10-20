/**
 * First-visit care entry — welcome home before the Living Care Record workspace.
 * Returning caregivers (entered flag or existing situations) go straight to continuity.
 */

export const SOLENOS_ENTERED_CARE_STORAGE_KEY = "solenos_entered_care_record";

export function hasEnteredCareRecord(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SOLENOS_ENTERED_CARE_STORAGE_KEY) === "1";
}

export function markEnteredCareRecord(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SOLENOS_ENTERED_CARE_STORAGE_KEY, "1");
}

/** Query flag on `/` after welcome CTA — marks entry without a flash of redirect. */
export const ENTER_CARE_QUERY = "enter";
