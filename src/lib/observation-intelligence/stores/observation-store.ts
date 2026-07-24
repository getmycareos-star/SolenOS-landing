import type { OBSERVATION_SOURCES } from "../contract-constants";
import type { StructuredObservation } from "../ontology";

export type ObservationSource = (typeof OBSERVATION_SOURCES)[number];

/** Raw caregiver observation record. `transcript` aliases `raw_text`; `source_type` aliases `source`. */
export type ObservationRecord = {
  id: string;
  caregiver_id: string;
  /** Canonical text field (product docs may call this transcript). */
  raw_text: string;
  /** Alias of raw_text for voice FUTURE data model. */
  transcript: string;
  created_at: string;
  /** Canonical source field. */
  source: ObservationSource;
  /** Alias of source (`voice` | `text`). */
  source_type: ObservationSource;
};

/** Structured signal extracted from an observation. */
export type StructuredObservationRecord = StructuredObservation & {
  id: string;
  observation_id: string;
  created_at: string;
  /** Alias of signal for product data model naming. */
  extracted_signal: StructuredObservation["signal"];
};

/** Postgres persistence contract stub — wire when DB layer is ready. */
export type ObservationPersistenceAdapter = {
  insertObservation(record: ObservationRecord): Promise<void>;
  insertStructured(records: StructuredObservationRecord[]): Promise<void>;
  listObservations(caregiverId: string): Promise<ObservationRecord[]>;
  listStructured(caregiverId: string): Promise<StructuredObservationRecord[]>;
};

const observations = new Map<string, ObservationRecord>();
const structuredByObservation = new Map<string, StructuredObservationRecord[]>();
const caregiverIndex = new Map<string, string[]>();

export function createObservationId(): string {
  return `obs_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createStructuredId(): string {
  return `str_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function saveObservation(
  caregiverId: string,
  rawText: string,
  source: ObservationSource,
  structured: StructuredObservation[],
): { observation: ObservationRecord; structured: StructuredObservationRecord[] } {
  const now = new Date().toISOString();
  const text = rawText.trim();
  const observation: ObservationRecord = {
    id: createObservationId(),
    caregiver_id: caregiverId,
    raw_text: text,
    transcript: text,
    created_at: now,
    source,
    source_type: source,
  };

  const structuredRecords: StructuredObservationRecord[] = structured.map((s) => ({
    ...s,
    id: createStructuredId(),
    observation_id: observation.id,
    created_at: now,
    extracted_signal: s.signal,
  }));

  observations.set(observation.id, observation);
  structuredByObservation.set(observation.id, structuredRecords);

  const ids = caregiverIndex.get(caregiverId) ?? [];
  ids.push(observation.id);
  caregiverIndex.set(caregiverId, ids);

  return { observation, structured: structuredRecords };
}

export function getObservation(id: string): ObservationRecord | undefined {
  return observations.get(id);
}

export function getStructuredForObservation(id: string): StructuredObservationRecord[] {
  return structuredByObservation.get(id) ?? [];
}

export function listObservationsForCaregiver(caregiverId: string): ObservationRecord[] {
  const ids = caregiverIndex.get(caregiverId) ?? [];
  return ids
    .map((id) => observations.get(id))
    .filter((r): r is ObservationRecord => r !== undefined)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function listStructuredForCaregiver(caregiverId: string): StructuredObservationRecord[] {
  return listObservationsForCaregiver(caregiverId).flatMap((o) =>
    getStructuredForObservation(o.id),
  );
}

export function countObservationsThisWeek(caregiverId: string, now = new Date()): number {
  const weekStart = startOfWeek(now);
  return listObservationsForCaregiver(caregiverId).filter(
    (o) => o.created_at >= weekStart.toISOString(),
  ).length;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** No-op persistence stub for Postgres wiring (see migration 013). */
export async function persistObservations(_caregiverId: string): Promise<void> {
  // Stub: INSERT INTO observations / structured_observations when DB adapter wired.
}

export function resetObservationStore(): void {
  observations.clear();
  structuredByObservation.clear();
  caregiverIndex.clear();
}

export const observationStoreSchema = {
  observations: {
    table: "observations",
    columns: [
      "id",
      "caregiver_id",
      "transcript",
      "raw_text",
      "source_type",
      "source",
      "created_at",
    ] as const,
  },
  structured_observations: {
    table: "structured_observations",
    columns: [
      "id",
      "observation_id",
      "category",
      "severity",
      "extracted_signal",
      "signal",
      "created_at",
    ] as const,
  },
} as const;
