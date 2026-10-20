import { randomUUID } from "node:crypto";

export function createRunId(): string {
  return `run_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
}

export function createClaimId(): string {
  return `claim_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
}

export function createEvidenceId(): string {
  return `ev_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
}

export function createRawInputId(): string {
  return `ri_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
}
