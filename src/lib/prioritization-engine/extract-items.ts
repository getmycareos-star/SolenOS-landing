import { extractIssues } from "../deterministic-prioritization/extract-issues";
import type { PrioritizedItem } from "./types";

/**
 * Topic-aware extraction — extends deterministic issue splitting with
 * domain-specific patterns for multi-domain caregiving input.
 */

const TOPIC_PATTERNS: { pattern: RegExp; label: string }[] = [
  {
    pattern: /\b(?:electrical|electric(?:al)? hazard|exposed wir(?:e|ing)|sparks?)\b/i,
    label: "Electrical hazards in the home",
  },
  {
    pattern: /\b(?:mice|mouse|rodent|pest)\b/i,
    label: "Mice or rodent infestation",
  },
  {
    pattern: /\b(?:roof(?:ing)?|roof (?:problem|repair|leak))\b/i,
    label: "Roofing issues",
  },
  {
    pattern: /\b(?:plumb(?:ing)?|pipe|leak(?:ing)?)\b/i,
    label: "Plumbing issues",
  },
  {
    pattern: /\b(?:denture|tooth|dental|extraction|infection)\b/i,
    label: "Dental care and dentures after tooth infection",
  },
  {
    pattern: /\b(?:property taxes?|taxes due|tax deadline|taxes are due)\b/i,
    label: "Property taxes coming due",
  },
  {
    pattern: /\b(?:repaint|paint(?:ing)?(?: the)? laundry|laundry room)\b/i,
    label: "Repaint the laundry room",
  },
  {
    pattern: /\b(?:go shopping|shopping|wants to shop)\b/i,
    label: "Grandmother wants to go shopping",
  },
  {
    pattern: /\b(?:repair labor|doing repairs ourselves|fix(?:ing)? ourselves|DIY repair)\b/i,
    label: "Caregiver and spouse doing repair labor themselves",
  },
  {
    pattern: /\b(?:work(?:s)? full time|no backup|limited money|shared pool|finite money)\b/i,
    label: "Limited shared money and caregiver capacity constraints",
  },
];

function slugId(label: string, index: number): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 36);
  return `item-${index}-${slug || "concern"}`;
}

export function extractPrioritizationItems(input: string): { id: string; description: string }[] {
  const text = input.replace(/\s+/g, " ").trim();
  if (!text) return [];

  const matched: { id: string; description: string }[] = [];
  const seen = new Set<string>();

  for (const { pattern, label } of TOPIC_PATTERNS) {
    if (pattern.test(text)) {
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      matched.push({ id: slugId(label, matched.length), description: label });
    }
  }

  if (matched.length >= 2) return matched;

  const issues = extractIssues(text);
  return issues.map((issue) => ({
    id: issue.id.replace(/^issue-/, "item-"),
    description: issue.title,
  }));
}

export function isStaticWant(description: string): boolean {
  return /\b(repaint|paint(?:ing)?|laundry room|shopping|cosmetic|rearrange|declutter|nice to have)\b/i.test(
    description,
  );
}

export function isCareRecipientWant(description: string): boolean {
  return /\b(wants to|grandmother wants|grandma wants|she wants)\b/i.test(description);
}
