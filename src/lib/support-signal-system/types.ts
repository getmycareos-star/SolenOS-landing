import type { CareContextState } from "../post-care-insight/contract-constants";
import type { CaregiverDepletionState } from "../caregiver-depletion-signals/contract-constants";
import type {
  MessageTemplateCategory,
  SupportState,
  TimeOfDay,
} from "./contract-constants";

/**
 * Observational input only — surface signals for notification selection.
 * Must NOT drive UI modes, product behavior, or lifecycle routing.
 */
export type SupportSignal = {
  care_context_state: CareContextState;
  caregiver_depletion_state: CaregiverDepletionState;
  is_single_caregiver: boolean;
  recent_high_risk_event: boolean;
  inactivity_days: number;
  time_of_day: TimeOfDay;
};

export type MessageTemplate = {
  id: string;
  category: MessageTemplateCategory;
  text: string;
};

export type DeliveryDecision = {
  deliver: boolean;
  suppressed: boolean;
  support_state: SupportState;
  template?: MessageTemplate;
  reason: string;
};

/** Prior delivery context used only for suppression — not engagement tracking. */
export type SupportSignalEvaluationContext = {
  /** ISO timestamp of last delivered (non-suppressed) notification, if any. */
  last_delivered_at?: string | null;
  /** Previous SupportState used for selection; silence when unchanged. */
  previous_support_state?: SupportState | null;
  /** Sustained elevated/critical depletion days (for rare stabilization). */
  sustained_pressure_days?: number;
  /** Now override for deterministic tests (ms since epoch). */
  now_ms?: number;
};

export type SupportSignalEvaluateInput = SupportSignal & SupportSignalEvaluationContext;

export type SupportSignalEvaluateResult = {
  deliver: boolean;
  suppressed: boolean;
  support_state: SupportState;
  template?: MessageTemplate;
  reason: string;
};

/** Telemetry payload shape — delivery/suppression only. */
export type SupportSignalTelemetryEvent = {
  notification_id: string;
  category: string;
  delivered_at: string | null;
  suppressed: boolean;
};

export type { SupportState, MessageTemplateCategory, TimeOfDay };
