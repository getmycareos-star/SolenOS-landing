/**
 * Telemetry domain — relief scoring, interaction logging, observability.
 * Observes — does NOT decide or generate conclusions.
 */

export const TELEMETRY_DOMAIN_PURPOSE =
  "Measurement, relief validation, and append-only event emission — never drives product behavior.";

export * from "../../telemetry-persistence";
export {
  emitSystemEvent,
  resetSystemEventsForTests,
  getMemorySystemEvents,
} from "../../system-architecture/emit-event";
