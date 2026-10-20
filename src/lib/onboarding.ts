/**
 * Onboarding flag — single source of truth for whether the first-time
 * welcome → consent → app-shell sequence has been completed.
 *
 * One flag only (`onboarding_complete`). No second consent state.
 */

export const ONBOARDING_COMPLETE_STORAGE_KEY = "onboarding_complete";

export function hasCompletedOnboarding(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(ONBOARDING_COMPLETE_STORAGE_KEY) === "1";
}

export function markOnboardingComplete(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ONBOARDING_COMPLETE_STORAGE_KEY, "1");
}

export function getOnboardingCompletedAt(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(`${ONBOARDING_COMPLETE_STORAGE_KEY}_at`);
}

export function markOnboardingCompleteAt(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    `${ONBOARDING_COMPLETE_STORAGE_KEY}_at`,
    new Date().toISOString(),
  );
}
