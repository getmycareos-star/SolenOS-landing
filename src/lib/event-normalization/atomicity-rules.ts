import { NOISE_PATTERNS } from "./contract-constants";
import type { AtomicEventType, NormalizedAtomicEvent } from "./types";

export function isNoiseFragment(text: string): { noise: boolean; attach_to?: AtomicEventType; merge_into?: AtomicEventType } {
  for (const rule of NOISE_PATTERNS) {
    if (rule.pattern.test(text)) {
      if ("attach_to" in rule) return { noise: true, attach_to: rule.attach_to };
      if ("merge_into" in rule) return { noise: true, merge_into: rule.merge_into };
    }
  }
  if (text.split(/\s+/).length <= 3 && /\b(tired|better|worse|okay|fine)\b/i.test(text)) {
    return { noise: true, attach_to: "symptom_observed" };
  }
  return { noise: false };
}

export function attachNoiseToParent(
  fragment: string,
  attachTo: AtomicEventType,
  parents: NormalizedAtomicEvent[],
): NormalizedAtomicEvent | null {
  const parent = [...parents].reverse().find((p) => p.atomic_type === attachTo);
  if (!parent) return null;
  return {
    ...parent,
    attached_fragments: [...parent.attached_fragments, fragment],
    attributes: {
      ...parent.attributes,
      attached_observations: [...(parent.attached_fragments ?? []), fragment],
    },
  };
}
