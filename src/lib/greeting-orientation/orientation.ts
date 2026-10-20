/**
 * Greeting Orientation — the sole module for generating caregiver-facing
 * orientation text. It projects existing care state into orientation lines.
 *
 * Core rules:
 * - First sentence = orientation (not politeness)
 * - Never simulate emotions, feelings, moods, or experiences
 * - Never encourage casual conversation
 * - Never "I'm here for you", "How can I help?", companion/therapist language
 * - Continuity must feel effortless — memory as context, not a feature
 * - Silence/brevity is acceptable when it reduces clarity
 * - AI is not the protagonist — caregiver and care recipient are
 * - Professional does not mean robotic: language should feel like a care coordinator, not a machine
 */

import type { CareRealityState } from "../care-reality-state/types";
import type { CareRealityMemoryObject } from "../care-reality-intelligence/care-reality-memory";
import type {
  GreetingOrientationContext,
  GreetingOrientationOutput,
  CareRealityMemorySummary,
} from "./types";

/**
 * Build greeting orientation from existing care state.
 *
 * Input: continuity state + care memory + CRS (all existing systems)
 * Output: orientation line (or null)
 *
 * This function does NOT create new state.
 * It does NOT have access to conversation history — only care reality.
 *
 * Dementia Wedge: The first experience is "Something changed? Help me understand it."
 * not "Create your dementia record." — the caregiver brings a problem, SolenOS builds the memory.
 */
export function buildGreetingOrientation(
  context: GreetingOrientationContext,
): GreetingOrientationOutput {
  // If this is a substantive care event (not a greeting), no orientation needed.
  if (!context.is_casual_greeting && !context.is_how_are_you && !context.is_gratitude) {
    return { orientation_line: null, should_orient: false, orientation_kind: "none" };
  }

  // CHANGE ORIENTED — the caregiver is reporting a change.
  // This is the Dementia Wedge entry point. Route to change detection experience.
  if (context.is_change_oriented) {
    return buildChangeDetectedOrientation(context);
  }

  // HOW ARE YOU — never simulate emotions. Communicate readiness.
  if (context.is_how_are_you) {
    return buildHowAreYouOrientation(context);
  }

  // GRATITUDE — reinforce continuity, not close the interaction.
  if (context.is_gratitude) {
    return buildGratitudeOrientation(context);
  }

  // FIRST SESSION — no care record exists yet.
  if (context.is_first_session) {
    return buildNewCaregiverOrientation();
  }

  // RETURNING with open continuity threads (unresolved hooks, unknowns)
  const hooks = context.crs?.continuity_hooks ?? context.memory?.continuity_hooks ?? [];
  if (hooks.length > 0) {
    return buildReturningWithThreadsOrientation(context, hooks);
  }

  // RETURNING with care memory but no open threads
  if (
    context.continuity.should_acknowledge_return &&
    !context.is_first_session
  ) {
    return buildReturningOrientation(context);
  }

  // CASUAL GREETING — brief acknowledge, transition to care.
  if (context.is_casual_greeting) {
    return buildCasualGreetingOrientation(context);
  }

  // Fallback: minimal orientation
  return {
    orientation_line: null,
    should_orient: false,
    orientation_kind: "none",
  };
}

/**
 * Returning caregiver with no open continuity threads.
 * Remind that care record exists. Transition to capture.
 */
function buildReturningOrientation(
  context: GreetingOrientationContext,
): GreetingOrientationOutput {
  const recipient = context.crs?.care_recipient_label?.trim();
  const hasCareData =
    (context.memory?.observation_count ?? 0) > 0 || (context.memory?.event_count ?? 0) > 0;

  if (hasCareData && recipient && recipient !== "Your loved one" && recipient !== "they" && recipient !== "person") {
    return {
      orientation_line: `I'm keeping your updates about ${recipient} ready. What has changed since the last update?`,
      should_orient: true,
      orientation_kind: "returning_no_threads",
    };
  }

  if (hasCareData) {
    return {
      orientation_line: "Your previous updates are still here. What has changed since then?",
      should_orient: true,
      orientation_kind: "returning_no_threads",
    };
  }

  return {
    orientation_line: "Welcome back. Share an update about the person you care for when you are ready.",
    should_orient: true,
    orientation_kind: "returning_no_threads",
  };
}

/**
 * Returning caregiver with open continuity threads.
 * Surface ONE natural continuity hook.
 * Do not overwhelm. Do not list every stored item.
 */
function buildReturningWithThreadsOrientation(
  context: GreetingOrientationContext,
  hooks: string[],
): GreetingOrientationOutput {
  const recipient = context.crs?.care_recipient_label?.trim();
  const named =
    recipient && recipient !== "Your loved one" && recipient !== "they" && recipient !== "person"
      ? recipient
      : null;

  // Pick the most relevant continuity thread
  const hooksToShow = hooks
    .filter((h: string) => h.trim().length > 0)
    .slice(0, 1);

  // Check if there are open unknowns that are more specific than generic hooks
  const unknowns = context.crs?.open_uncertainties ?? context.memory?.open_unknowns ?? [];
  const specificUnknown: string | undefined = unknowns.find(
    (u: string) => u.length > 10 && /\b(?:medication|mobility|fall|sleep|eat|appetite|pain|when|started|timing|change)\b/i.test(u),
  ) as string | undefined;

  if (hooksToShow.length > 0) {
    const h = hooksToShow[0]!.replace(/\.$/m, "").toLowerCase();
    if (named) {
      return {
        orientation_line: `The last update about ${named} mentioned ${h}. Has anything changed since then?`,
        should_orient: true,
        orientation_kind: "returning_with_threads",
      };
    }
    return {
      orientation_line: `The last update mentioned ${h}. Has anything changed since then?`,
      should_orient: true,
      orientation_kind: "returning_with_threads",
    };
  }

  if (specificUnknown) {
    const q = specificUnknown.replace(/[.?]+$/, "").toLowerCase();
    if (named) {
      return {
        orientation_line: `There's still an open question about ${named}: ${q}. Have you learned anything new?`,
        should_orient: true,
        orientation_kind: "returning_with_threads",
      };
    }
    return {
      orientation_line: `There's still an open question from the last update: ${q}. Have you learned anything new?`,
      should_orient: true,
      orientation_kind: "returning_with_threads",
    };
  }

  // Fallback: generic returning with threads
  if (named) {
    return {
      orientation_line: `What you shared about ${named} is still here. Let me know if anything has changed.`,
      should_orient: true,
      orientation_kind: "returning_with_threads",
    };
  }

  return {
    orientation_line: "Your earlier updates are still here. Share what has changed since then.",
    should_orient: true,
    orientation_kind: "returning_with_threads",
  };
}

/**
 * Casual greeting (hi, hello, good morning).
 * Acknowledge briefly. Transition immediately toward care orientation.
 */
function buildCasualGreetingOrientation(
  context: GreetingOrientationContext,
): GreetingOrientationOutput {
  const recipient = context.crs?.care_recipient_label?.trim();
  const named =
    recipient && recipient !== "Your loved one" && recipient !== "they" && recipient !== "person"
      ? recipient
      : null;
  const hasCareData =
    (context.memory?.observation_count ?? 0) > 0 || (context.memory?.event_count ?? 0) > 0;

  if (hasCareData && named) {
    return {
      orientation_line: `What you shared about ${named} is still here. Has anything changed since then?`,
      should_orient: true,
      orientation_kind: "casual_greeting",
    };
  }

  if (hasCareData) {
    return {
      orientation_line: "Your earlier updates are still here. Has anything changed since then?",
      should_orient: true,
      orientation_kind: "casual_greeting",
    };
  }

  // No care data yet — transition new user
  return buildNewCaregiverOrientation();
}

/**
 * "How are you?" — never simulate emotions. Communicate operational readiness.
 */
function buildHowAreYouOrientation(
  context: GreetingOrientationContext,
): GreetingOrientationOutput {
  const recipient = context.crs?.care_recipient_label?.trim();
  const named =
    recipient && recipient !== "Your loved one" && recipient !== "they" && recipient !== "person"
      ? recipient
      : null;
  const hasCareData =
    (context.memory?.observation_count ?? 0) > 0 || (context.memory?.event_count ?? 0) > 0;

  if (hasCareData && named) {
    return {
      orientation_line: `Updates about ${named} are ready. Share what has changed or check what we understand so far.`,
      should_orient: true,
      orientation_kind: "how_are_you",
    };
  }

  if (hasCareData) {
    return {
      orientation_line: "Your earlier updates are ready. Share what has changed or check what we understand so far.",
      should_orient: true,
      orientation_kind: "how_are_you",
    };
  }

  return {
    orientation_line: "Ready to organize care information. Share details about the person you care for when you are ready.",
    should_orient: true,
    orientation_kind: "how_are_you",
  };
}

/**
 * Gratitude ("thank you"). Reinforce continuity — do not close the interaction.
 */
function buildGratitudeOrientation(
  context: GreetingOrientationContext,
): GreetingOrientationOutput {
  const recipient = context.crs?.care_recipient_label?.trim();
  const named =
    recipient && recipient !== "Your loved one" && recipient !== "they" && recipient !== "person"
      ? recipient
      : null;
  const hasCareData =
    (context.memory?.observation_count ?? 0) > 0 || (context.memory?.event_count ?? 0) > 0;

  if (hasCareData && named) {
    return {
      orientation_line: `What you shared about ${named} is kept here. Come back whenever something changes.`,
      should_orient: true,
      orientation_kind: "gratitude",
    };
  }

  if (hasCareData) {
    return {
      orientation_line: "All your updates are kept here. Come back whenever something changes.",
      should_orient: true,
      orientation_kind: "gratitude",
    };
  }

  return {
    orientation_line: "Nothing has been added to the care record yet. Share an update about the person you care for when you are ready.",
    should_orient: true,
    orientation_kind: "gratitude",
  };
}

/**
 * Detect whether raw input is a casual greeting.
 */
export function isCasualGreetingInput(text: string): boolean {
  const t = text.trim().toLowerCase();
  // Pure greetings
  if (/^(hi|hello|hey|yo|hiya|howdy)[,.!]?\s*$/i.test(t)) return true;
  if (/^(good\s+(morning|afternoon|evening|day))[,.!]?\s*$/i.test(t)) return true;
  if (/^(what'?s\s+up|sup|how'?s\s+it\s+going)[,.!]?\s*$/i.test(t)) return true;
  // Greeting + product name
  if (/^(hi|hello|hey)\s+solenos[,.!]?\s*$/i.test(t)) return true;
  if (/^solenos[,.!]?\s*$/i.test(t)) return true;
  return false;
}

/**
 * Detect whether raw input is asking "how are you?" or similar.
 */
export function isHowAreYouInput(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (/^how\s+(?:are|is)\s+(?:you|solenos|it\s+going)[?.!\s]*$/i.test(t)) return true;
  if (/^how'?re?\s+(?:you|things)[?.!\s]*$/i.test(t)) return true;
  if (/^(?:are\s+)?you\s+(?:doing\s+)?(?:okay|ok|alright)[?.!\s]*$/i.test(t)) return true;
  return false;
}

/**
 * Detect whether raw input is gratitude.
 */
export function isGratitudeInput(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (/^(thanks|thank\s+you|thankyou|appreciate\s+(?:it|that|this))[,.!\s]*$/i.test(t)) return true;
  if (/^(?:i\s+)?appreciate\s+(?:your\s+)?(?:help|assistance|support)[,.!\s]*$/i.test(t)) return true;
  return false;
}

/**
 * Dementia Wedge: Detect whether raw input is describing a change in the care recipient.
 *
 * Change-oriented inputs are the entry point for the "Something Changed" product experience.
 * Examples: "Mom has been more confused lately", "He stopped eating", "She's not sleeping well"
 */
export function isChangeOrientedInput(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.length < 8) return false;

  // Change verbs: noticing something different
  const hasChangeVerb = /\b(changed?|changing|different|started|stopped|began|became|turned|got|become)\b/i.test(t);

  // Comparison language: comparing to before
  const hasComparison = /\b(more|less|worse|better|increased|decreased|improved|declined)\b/i.test(t) &&
    /\b(than|since|after|from|now|before|recently|lately|this week|this month)\b/i.test(t);

  // Temporal markers: situating change in time
  const hasTemporalChange = /\b(now|today|yesterday|last night|this morning|recently|lately|this week|this month|for the past|started|stopped|no longer|still)\b/i.test(t) &&
    /\b(she|he|they|mom|dad|mother|father|grandma|grandpa|her|him)\b/i.test(t);

  // Care domain patterns: specific care areas where change is commonly noticed
  const hasCareDomainChange = /\b(?:sleep|eating|appetite|confus|memory|forget|wander|mood|agitat|aggress|fall|mobility|walk|medication|medicine)\b/i.test(t) &&
    /\b(more|less|worse|better|different|changed|started|stopped|not|no longer)\b/i.test(t);

  // Explicit change framing
  const hasExplicitChange = /\b(something (?:changed|is different|is wrong|changed|happened)|i'?ve noticed|it seems different|what changed|help me understand|is this normal)\b/i.test(t);

  // Must not be a pure greeting, gratitude, or "how are you"
  const isPhatic = isCasualGreetingInput(text) || isHowAreYouInput(text) || isGratitudeInput(text);

  if (isPhatic) return false;

  const signals = [hasChangeVerb, hasComparison, hasTemporalChange, hasCareDomainChange, hasExplicitChange];
  const signalCount = signals.filter(Boolean).length;

  // At least 2 signals for confidence, or an explicit change framing alone
  return signalCount >= 2 || hasExplicitChange;
}

/**
 * Dementia Wedge: caregiver reported a change — orientation routes to change detection.
 *
 * The product thesis:
 * "Transform weeks of behavior into a decision-ready understanding."
 *
 * Not: "Store dementia information."
 * The caregiver does not need another place to store notes. They need help understanding:
 * - What changed?
 * - Why might it matter?
 * - What information is important?
 * - What decision needs to happen next?
 */
function buildChangeDetectedOrientation(
  context: GreetingOrientationContext,
): GreetingOrientationOutput {
  const recipient = context.crs?.care_recipient_label?.trim();
  const named =
    recipient && recipient !== "Your loved one" && recipient !== "they" && recipient !== "person"
      ? recipient
      : null;

  if (context.is_first_session && named) {
    return {
      orientation_line: `You noticed something different about ${named}. Tell me what changed — I will compare it against what was normal before and help you understand what matters.`,
      should_orient: true,
      orientation_kind: "change_detected",
    };
  }

  // Check if there are existing memory objects to compare against
  const hasCareData =
    (context.memory?.observation_count ?? 0) > 0 || (context.memory?.event_count ?? 0) > 0;

  if (hasCareData && named) {
    // Surface relevant prior observations as hooks
    const topObs = context.memory?.top_observations ?? [];
    const topEvents = context.memory?.top_events ?? [];
    const priorContext = [...topObs, ...topEvents].slice(0, 1);

    if (priorContext.length > 0) {
      const prior = priorContext[0]!.replace(/\.$/, "").toLowerCase();
      return {
        orientation_line: `You mentioned a change. Earlier updates noted: ${prior}. Can you describe what is different now so I can connect it to what was already known?`,
        should_orient: true,
        orientation_kind: "change_detected",
      };
    }

    return {
      orientation_line: `You noticed a change in ${named}. Tell me what is different, and I will compare it to what was already known.`,
      should_orient: true,
      orientation_kind: "change_detected",
    };
  }

  if (hasCareData) {
    return {
      orientation_line: "You noticed a change. Tell me what is different, and I will compare it to what was already known.",
      should_orient: true,
      orientation_kind: "change_detected",
    };
  }

  if (named) {
    return {
      orientation_line: `Something changed with ${named}? Tell me what is different — I will help you understand what matters and what to do next.`,
      should_orient: true,
      orientation_kind: "change_detected",
    };
  }

  // First session, no named recipient yet
  return {
    orientation_line: "Something changed with someone you care for? Tell me what is different — I will help you understand what matters and what to do next.",
    should_orient: true,
    orientation_kind: "change_detected",
  };
}

/**
 * Dementia Wedge: Modify new caregiver orientation to center on change.
 * The first experience should be "Something changed. Help me understand it."
 * Not "Create your dementia record."
 */
function buildNewCaregiverOrientation(): GreetingOrientationOutput {
  return {
    orientation_line:
      "Something changed with someone you care for? Start by telling me what is different — I will help you understand what matters and what to do next.",
    should_orient: true,
    orientation_kind: "new_caregiver",
  };
}

/**
 * Build a memory summary from existing care state.
 * This does NOT create new state — it reads from CRS + care memory.
 */
export function buildMemorySummary(params: {
  crs: CareRealityState | null;
  memory: CareRealityMemoryObject[];
  careKey: string;
}): CareRealityMemorySummary {
  const { crs, memory } = params;

  const observations = memory.filter((m) => m.type === "observation" || m.type === "change");
  const events = memory.filter((m) => m.type === "event");
  const decisions = memory.filter((m) => m.type === "decision");
  const unknowns = memory.filter((m) => m.type === "unknown");

  return {
    has_events: events.length > 0,
    has_observations: observations.length > 0,
    has_decisions: decisions.length > 0,
    has_open_unknowns: unknowns.length > 0,
    event_count: events.length,
    observation_count: observations.length,
    top_observations: observations
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 2)
      .map((o) => o.description.replace(/\.$/, "")),
    top_events: events
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 2)
      .map((e) => e.description.replace(/\.$/, "")),
    open_unknowns: unknowns.slice(0, 3).map((u) => u.description),
    continuity_hooks: crs?.continuity_hooks ?? [],
  };
}
