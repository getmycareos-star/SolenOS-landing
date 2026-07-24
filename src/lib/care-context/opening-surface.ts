import type { CareContext } from "./types";
import type { OpeningSurface } from "./failure-model-types";
import { assessContinuity } from "./continuity-engine";
import { computeDiff } from "./engines/diff-engine";
import { assessStateOfCare } from "./engines/state-of-care-engine";
import { assessCaregiverLoad } from "./engines/caregiver-load-engine";

/**
 * Opening surface — what caregivers see when they open SolenOS.
 * The question disappears because the system already surfaced the answer.
 *
 * Instead of: "Is my parent getting worse?"
 * They see: what changed, what is stable, what needs attention, what is uncertain, what's next.
 */
export function buildOpeningSurface(context: CareContext): OpeningSurface {
  const diff = computeDiff(context);
  const state = assessStateOfCare(context);
  const load = assessCaregiverLoad(context);
  const continuity = assessContinuity(context);

  const whatChanged =
    diff.summary.length > 0
      ? [diff.headline, ...diff.summary]
      : ["No significant changes detected in recent window."];

  const whatIsStable: string[] = [];
  if (state.trajectory === "stable") {
    whatIsStable.push(state.summary);
  }
  if (load.level === "low" || load.level === "moderate") {
    whatIsStable.push(`Caregiver load: ${load.level}`);
  }
  const stableCategories = diff.changes.filter((c) =>
    /\bunchanged|stable\b/i.test(c.description),
  );
  if (stableCategories.length === 0 && state.trajectory === "stable") {
    whatIsStable.push("No deterioration signals in recent timeline.");
  }
  if (whatIsStable.length === 0) {
    whatIsStable.push("Stability assessment requires more observation time.");
  }

  const whatNeedsAttention: string[] = [...continuity.whatMattersNow];
  if (state.trajectory === "deteriorating") {
    whatNeedsAttention.unshift(`Trajectory: ${state.trajectory} — review recent changes`);
  }
  if (load.level === "high" || load.level === "critical") {
    whatNeedsAttention.unshift(
      `Caregiver load ${load.level} — ${load.factors[0]?.factor ?? "support needed"}`,
    );
  }

  const whatIsUncertain = [...continuity.whatRemainsUncertain];
  if (state.trajectory === "insufficient_data") {
    whatIsUncertain.unshift("Insufficient timeline depth for trajectory assessment.");
  }

  const whatShouldHappenNext = continuity.whatShouldHappenNext.map(
    (a) => `[${a.urgency}] ${a.action}`,
  );
  if (whatShouldHappenNext.length === 0) {
    whatShouldHappenNext.push("Continue documenting observations.");
  }

  return {
    whatChanged,
    whatIsStable,
    whatNeedsAttention,
    whatIsUncertain,
    whatShouldHappenNext,
  };
}

export function formatOpeningSurface(surface: OpeningSurface): string {
  const section = (title: string, items: string[]) =>
    `${title}\n${items.map((i) => `- ${i}`).join("\n")}`;

  return [
    "SOLENOS OPENING SURFACE",
    "(Questions disappear — continuity already surfaced)",
    "",
    section("What changed", surface.whatChanged),
    "",
    section("What is stable", surface.whatIsStable),
    "",
    section("What needs attention", surface.whatNeedsAttention),
    "",
    section("What is uncertain", surface.whatIsUncertain),
    "",
    section("What should happen next", surface.whatShouldHappenNext),
  ].join("\n");
}
