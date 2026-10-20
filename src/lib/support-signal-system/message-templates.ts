import type { MessageTemplate } from "./types";

/**
 * Static template library — neutral, calm, grounded.
 * Forbidden: guilt, praise addiction, emotional dependency, artificial intimacy.
 */
export const MESSAGE_TEMPLATES: readonly MessageTemplate[] = [
  // crisis
  {
    id: "crisis-01",
    category: "crisis",
    text: "A high-risk moment was noted. If this is an emergency, use your local emergency number.",
  },
  {
    id: "crisis-02",
    category: "crisis",
    text: "This situation may need urgent attention. One clear next step is enough right now.",
  },
  // overload — spec example
  {
    id: "overload-01",
    category: "overload",
    text: "What you shared is held. You do not need to solve everything at once. One manageable care detail is enough for now.",
  },
  {
    id: "overload-02",
    category: "overload",
    text: "Sustained care pressure is present in what was shared. Reduce scope to what is essential today.",
  },
  // fatigue
  {
    id: "fatigue-01",
    category: "fatigue",
    text: "Sustained care pressure is present. It is reasonable to pause and reassess what can wait.",
  },
  {
    id: "fatigue-02",
    category: "fatigue",
    text: "Sustained care pressure is present in what was shared. A short break or delegated task may reduce strain without changing what matters clinically.",
  },
  // stable (stabilization)
  {
    id: "stable-01",
    category: "stable",
    text: "Pressure has eased after a sustained period. You can hold a lighter scope until something new requires attention.",
  },
  {
    id: "stable-02",
    category: "stable",
    text: "Conditions appear steadier than recent days. It is fine to operate at a sustainable pace.",
  },
  // reentry
  {
    id: "reentry-01",
    category: "reentry",
    text: "You returned after time away. Start with one orientation question: what needs attention today?",
  },
  {
    id: "reentry-02",
    category: "reentry",
    text: "After a gap, it is normal to feel disoriented. Review only what is current — past items can wait.",
  },
] as const;

export function getTemplatesForCategory(
  category: MessageTemplate["category"],
): readonly MessageTemplate[] {
  return MESSAGE_TEMPLATES.filter((t) => t.category === category);
}

export function selectTemplateForState(
  category: MessageTemplate["category"],
  seed: number = 0,
): MessageTemplate | undefined {
  const candidates = getTemplatesForCategory(category);
  if (candidates.length === 0) return undefined;
  const index = Math.abs(seed) % candidates.length;
  return candidates[index];
}

export function getTemplateById(id: string): MessageTemplate | undefined {
  return MESSAGE_TEMPLATES.find((t) => t.id === id);
}

export const OVERLOAD_SPEC_EXAMPLE_TEMPLATE_ID = "overload-01";
