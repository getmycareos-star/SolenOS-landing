import { randomUUID } from "node:crypto";

export function createChangeId(): string {
  return `chg_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
}

export function createHistoryId(): string {
  return `hist_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
}
