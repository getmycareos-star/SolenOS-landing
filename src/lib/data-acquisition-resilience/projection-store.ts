import type {
  ConflictingEventSet,
  CorrectionEvent,
  ExtractionCandidate,
  UncertainEventCandidate,
  ValidatedCareEvent,
} from "./types";

const candidates = new Map<string, ExtractionCandidate>();
const uncertain = new Map<string, UncertainEventCandidate>();
const validated = new Map<string, ValidatedCareEvent>();
const corrections = new Map<string, CorrectionEvent>();
const conflicts = new Map<string, ConflictingEventSet>();

const caregiverCandidates = new Map<string, string[]>();
const caregiverValidated = new Map<string, string[]>();
const caregiverCorrections = new Map<string, string[]>();
const caregiverConflicts = new Map<string, string[]>();

function index(map: Map<string, string[]>, key: string, id: string) {
  const list = map.get(key) ?? [];
  list.push(id);
  map.set(key, list);
}

export function storeCandidates(items: ExtractionCandidate[], caregiverId: string): void {
  for (const c of items) {
    candidates.set(c.id, c);
    index(caregiverCandidates, caregiverId, c.id);
  }
}

export function storeUncertainEvents(items: UncertainEventCandidate[]): void {
  for (const u of items) uncertain.set(u.id, u);
}

export function storeValidatedEvent(event: ValidatedCareEvent, caregiverId: string): void {
  validated.set(event.id, event);
  index(caregiverValidated, caregiverId, event.id);
}

export function storeCorrection(correction: CorrectionEvent): void {
  corrections.set(correction.id, correction);
  index(caregiverCorrections, correction.caregiver_id, correction.id);
}

export function storeConflict(conflict: ConflictingEventSet, caregiverId: string): void {
  conflicts.set(conflict.id, conflict);
  index(caregiverConflicts, caregiverId, conflict.id);
}

export function getCandidate(id: string): ExtractionCandidate | undefined {
  return candidates.get(id);
}

export function getValidatedEvent(id: string): ValidatedCareEvent | undefined {
  return validated.get(id);
}

export function listValidatedForCaregiver(caregiverId: string): ValidatedCareEvent[] {
  const ids = caregiverValidated.get(caregiverId) ?? [];
  return ids.map((id) => validated.get(id)).filter((v): v is ValidatedCareEvent => v !== undefined);
}

export function listUncertainForCaregiver(caregiverId: string): UncertainEventCandidate[] {
  const cIds = caregiverCandidates.get(caregiverId) ?? [];
  const allCandidates = cIds.map((id) => candidates.get(id)).filter(Boolean) as ExtractionCandidate[];
  const uncertainIds = new Set<string>();
  for (const u of uncertain.values()) {
    if (allCandidates.some((c) => u.candidate_ids.includes(c.id))) {
      uncertainIds.add(u.id);
    }
  }
  return [...uncertainIds].map((id) => uncertain.get(id)).filter(Boolean) as UncertainEventCandidate[];
}

export function listCorrectionsForCaregiver(caregiverId: string): CorrectionEvent[] {
  const ids = caregiverCorrections.get(caregiverId) ?? [];
  return ids.map((id) => corrections.get(id)).filter((c): c is CorrectionEvent => c !== undefined);
}

export function listConflictsForCaregiver(caregiverId: string): ConflictingEventSet[] {
  const ids = caregiverConflicts.get(caregiverId) ?? [];
  return ids.map((id) => conflicts.get(id)).filter((c): c is ConflictingEventSet => c !== undefined);
}

export function updateValidatedEvent(event: ValidatedCareEvent, caregiverId: string): void {
  validated.set(event.id, event);
  if (!caregiverValidated.get(caregiverId)?.includes(event.id)) {
    index(caregiverValidated, caregiverId, event.id);
  }
}

export function deleteValidatedEvent(id: string, caregiverId: string): void {
  const existing = validated.get(id);
  if (existing) {
    updateValidatedEvent(
      {
        ...existing,
        attributes: {
          ...existing.attributes,
          lifecycle_status: "invalidated",
          invalidated_at: new Date().toISOString(),
        },
      },
      caregiverId,
    );
    return;
  }
  validated.delete(id);
  const ids = caregiverValidated.get(caregiverId) ?? [];
  caregiverValidated.set(
    caregiverId,
    ids.filter((i) => i !== id),
  );
}

export function resetDareProjectionStore(): void {
  candidates.clear();
  uncertain.clear();
  validated.clear();
  corrections.clear();
  conflicts.clear();
  caregiverCandidates.clear();
  caregiverValidated.clear();
  caregiverCorrections.clear();
  caregiverConflicts.clear();
}

export function createValidatedEventId(): string {
  return `ve_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createCorrectionId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createConflictId(): string {
  return `conf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
