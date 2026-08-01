/**
 * Greeting Orientation — projects existing care state into caregiver-facing orientation.
 *
 * This module does NOT create new state, memory, conversation state, or personality.
 * It reads from existing systems: Care Identity, Care Reality State, Care Reality Memory.
 *
 * SolenOS does not respond to greetings. It responds to system state.
 * Orientation is a bridge into care continuity — not a conversation opener.
 */
export {
  buildGreetingOrientation,
  isCasualGreetingInput,
  isHowAreYouInput,
  isGratitudeInput,
  isChangeOrientedInput,
  buildMemorySummary,
} from "./orientation";
export type {
  GreetingOrientationContext,
  GreetingOrientationOutput,
  CareRealityMemorySummary,
} from "./types";

