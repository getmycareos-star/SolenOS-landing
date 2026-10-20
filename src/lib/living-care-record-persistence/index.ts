/**
 * Living Care Record durability — CareContext + ACS as source of truth;
 * process Maps are cache only (mirror policy consent `.data/` pattern).
 */

export {
  livingCareRecordDataDir,
  sanitizeDurableCareKey,
} from "./fs-store";
