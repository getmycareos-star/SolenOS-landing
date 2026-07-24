import type { AssumptionStatus } from "./types";

/**
 * Spec synonym map: external "confirmed" ↔ internal "validated".
 * Registry stores validated; adapters may speak confirmed.
 */
export function mapConfirmedToValidated(
  status: AssumptionStatus | "confirmed",
): AssumptionStatus {
  return status === "confirmed" ? "validated" : status;
}

export function mapValidatedToConfirmed(
  status: AssumptionStatus,
): AssumptionStatus | "confirmed" {
  return status === "validated" ? "confirmed" : status;
}

export function isConfirmedOrValidated(
  status: AssumptionStatus | "confirmed",
): boolean {
  return status === "validated" || status === "confirmed";
}

/** Influenceable: active | validated (confirmed synonym). */
export function isInfluenceableIncludingConfirmed(
  status: AssumptionStatus | "confirmed",
): boolean {
  return status === "active" || isConfirmedOrValidated(status);
}
