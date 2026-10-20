export { VOICE_CONFIDENCE_THRESHOLD, VOICE_INPUT_LANG } from "./constants";

export {
  BrowserVoiceCapture,
  defaultBrowserVoiceCapture,
} from "./browser-capture";

export {
  getSpeechRecognitionConstructor,
  isVoiceInputAvailable,
  type VoiceCaptureState,
  type VoiceCaptureResult,
  type VoiceCaptureCallbacks,
} from "./types";

export { useVoiceInput, type UseVoiceInputOptions, type UseVoiceInputResult } from "./use-voice-input";
