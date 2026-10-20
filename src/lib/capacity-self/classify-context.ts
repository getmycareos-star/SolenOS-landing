import type { ContextType } from "./types";

const RULES: { pattern: RegExp; context: ContextType }[] = [
  { pattern: /\b(call|phone|insurance company|billing department|hold music)\b/i, context: "phone_call" },
  { pattern: /\b(electrical|roof|plumb|repair|fix|wiring|mice|pest|contractor|DIY)\b/i, context: "home_repair" },
  { pattern: /\b(doctor|dentist|clinic|hospital|medication|symptom|pain|appointment|medical)\b/i, context: "medical" },
  { pattern: /\b(tax|pay|bill|budget|afford|financial|property tax|insurance premium)\b/i, context: "financial" },
  { pattern: /\b(shopping|errand|pick up|pharmacy|grocery|drive to|mail)\b/i, context: "errand" },
];

export function classifyContextType(description: string): ContextType {
  const text = description.trim();
  for (const rule of RULES) {
    if (rule.pattern.test(text)) return rule.context;
  }
  return "other";
}

export function classifyEffortScore(description: string, contextType: ContextType): number {
  if (contextType === "errand" && /\b(pick up|pharmacy|mail)\b/i.test(description)) return 1;
  if (contextType === "phone_call" && !/\b(insurance|billing dispute)\b/i.test(description)) return 2;
  if (contextType === "home_repair" || /\b(electrical|roof|structural)\b/i.test(description)) return 3;
  if (contextType === "medical" && /\b(follow-up|refill|schedule)\b/i.test(description)) return 2;
  if (contextType === "financial" && /\b(pay|submit|mail check)\b/i.test(description)) return 2;
  if (/\b(repaint|cosmetic|organize)\b/i.test(description)) return 1;
  return 2;
}
