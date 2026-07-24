import {
  DEMENTIA_STAGES,
  DRIVING_STATUSES,
  MEDICATION_RISK_LEVELS,
  type DementiaContext,
  type DementiaStage,
  type DrivingStatus,
  type FinancialRiskEvent,
  type MedicationRiskLevel,
  type SundowningWindow,
  type WanderingEvent,
} from "./types";
import { DEFAULT_DEMENTIA_CONTEXT } from "./defaults";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function isEnum<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

function parseWanderingEvent(raw: unknown): WanderingEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.id !== "string" || typeof obj.timestamp !== "string") return null;
  if (typeof obj.description !== "string" || !obj.description.trim()) return null;
  return {
    id: obj.id,
    timestamp: obj.timestamp,
    description: obj.description.trim(),
    ...(typeof obj.trigger === "string" && obj.trigger.trim() ? { trigger: obj.trigger.trim() } : {}),
    ...(typeof obj.location === "string" && obj.location.trim() ? { location: obj.location.trim() } : {}),
  };
}

function parseFinancialRiskEvent(raw: unknown): FinancialRiskEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.id !== "string" || typeof obj.timestamp !== "string") return null;
  if (typeof obj.description !== "string" || !obj.description.trim()) return null;
  return {
    id: obj.id,
    timestamp: obj.timestamp,
    description: obj.description.trim(),
  };
}

function parseSundowningWindow(raw: unknown): SundowningWindow | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.start !== "string" || typeof obj.end !== "string") return undefined;
  if (!TIME_PATTERN.test(obj.start) || !TIME_PATTERN.test(obj.end)) return undefined;
  return { start: obj.start, end: obj.end };
}

export function parseDementiaContext(raw: unknown): DementiaContext {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_DEMENTIA_CONTEXT };
  const obj = raw as Record<string, unknown>;

  const wandering = Array.isArray(obj.wandering_events)
    ? obj.wandering_events.map(parseWanderingEvent).filter((e): e is WanderingEvent => e !== null)
    : [];

  const financial = Array.isArray(obj.possible_financial_risk_events)
    ? obj.possible_financial_risk_events
        .map(parseFinancialRiskEvent)
        .filter((e): e is FinancialRiskEvent => e !== null)
    : [];

  const history = Array.isArray(obj.driving_status_history)
    ? obj.driving_status_history
        .filter(
          (entry): entry is { status: DrivingStatus; recorded_at: string } =>
            !!entry &&
            typeof entry === "object" &&
            isEnum((entry as Record<string, unknown>).status, DRIVING_STATUSES) &&
            typeof (entry as Record<string, unknown>).recorded_at === "string",
        )
        .map((entry) => ({ status: entry.status, recorded_at: entry.recorded_at }))
    : [];

  return {
    dementia_stage: isEnum(obj.dementia_stage, DEMENTIA_STAGES)
      ? obj.dementia_stage
      : DEFAULT_DEMENTIA_CONTEXT.dementia_stage,
    wandering_events: wandering,
    sundowning_window: parseSundowningWindow(obj.sundowning_window),
    medication_risk: isEnum(obj.medication_risk, MEDICATION_RISK_LEVELS)
      ? obj.medication_risk
      : DEFAULT_DEMENTIA_CONTEXT.medication_risk,
    driving_status: isEnum(obj.driving_status, DRIVING_STATUSES)
      ? obj.driving_status
      : DEFAULT_DEMENTIA_CONTEXT.driving_status,
    driving_status_history: history,
    possible_financial_risk_events: financial,
  };
}

export function validateDementiaStage(value: unknown): value is DementiaStage {
  return isEnum(value, DEMENTIA_STAGES);
}

export function validateMedicationRisk(value: unknown): value is MedicationRiskLevel {
  return isEnum(value, MEDICATION_RISK_LEVELS);
}

export function validateDrivingStatus(value: unknown): value is DrivingStatus {
  return isEnum(value, DRIVING_STATUSES);
}

export function validateSundowningWindow(value: unknown): value is SundowningWindow {
  return parseSundowningWindow(value) !== undefined;
}
