export type CareEventType =
  | "symptom"
  | "medication"
  | "observation"
  | "task"
  | "unknown";

export interface CareEvent {
  date: string | null;
  dateLabel: string;
  description: string;
  type: CareEventType;
  sourceIndex: number;
}

export interface CareSnapshot {
  identity?: {
    patientName?: string;
    contextLabel?: string;
  };
  timeline: CareEvent[];
  keyObservations: string[];
  careNotes: string[];
  generatedAt: string;
}

export interface RawCareInput {
  text: string;
  recordedAt?: string;
  metadata?: {
    patientName?: string;
    contextLabel?: string;
  };
}

export interface SnapshotOptions {
  referenceDate?: string;
}
