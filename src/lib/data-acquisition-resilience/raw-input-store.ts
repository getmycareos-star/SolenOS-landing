import type { RawInput } from "./types";

const rawInputs = new Map<string, RawInput>();
const caregiverIndex = new Map<string, string[]>();

export function createRawInputId(): string {
  return `ri_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function storeRawInput(input: RawInput): RawInput {
  rawInputs.set(input.id, input);
  const ids = caregiverIndex.get(input.caregiver_id) ?? [];
  ids.push(input.id);
  caregiverIndex.set(input.caregiver_id, ids);
  return input;
}

export function getRawInput(id: string): RawInput | undefined {
  return rawInputs.get(id);
}

export function listRawInputsForCaregiver(caregiverId: string): RawInput[] {
  const ids = caregiverIndex.get(caregiverId) ?? [];
  return ids.map((id) => rawInputs.get(id)).filter((r): r is RawInput => r !== undefined);
}

export function resetRawInputStore(): void {
  rawInputs.clear();
  caregiverIndex.clear();
}
