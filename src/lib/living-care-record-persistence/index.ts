/**
 * Compatibility exports for legacy prototype modules. This filesystem helper
 * is not the authoritative Living Care Record store. PostgreSQL via the
 * authenticated backend is the only production source of truth for care data.
 */

export {
  livingCareRecordDataDir,
  sanitizeDurableCareKey,
} from "./fs-store";
