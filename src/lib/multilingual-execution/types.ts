export type SolenOSLanguage =
  | "en"
  | "es"
  | "zh"
  | "tl"
  | "vi"
  | "ko"
  | "fa"
  | "ar"
  | "ru"
  | "hy";

export interface MultilingualExecutionMeta {
  userLanguage: SolenOSLanguage;
  promptWrapped: boolean;
}

export interface MultilingualValidationResult {
  ok: boolean;
  violations: readonly string[];
}
