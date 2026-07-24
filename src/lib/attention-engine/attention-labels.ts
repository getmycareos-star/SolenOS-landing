import type { AttentionClass, AttentionPriority } from "./types";

export const ATTENTION_CLASS_LABELS: Record<AttentionClass, string> = {
  A: "This needs attention now.",
  B: "Pay attention. Not urgent.",
  C: "Can wait.",
};

export const ATTENTION_PRIORITY_LABELS: Record<AttentionPriority, string> = {
  Now: "Needs attention now",
  Watch: "Pay attention — not urgent",
  Later: "Can wait",
};

export function attentionClassToPriority(attentionClass: AttentionClass): AttentionPriority {
  switch (attentionClass) {
    case "A":
      return "Now";
    case "B":
      return "Watch";
    case "C":
      return "Later";
  }
}

export function labelForAttentionClass(attentionClass: AttentionClass): string {
  return ATTENTION_CLASS_LABELS[attentionClass];
}
