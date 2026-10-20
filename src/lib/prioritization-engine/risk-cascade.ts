import type { PrioritizedItem, RiskCascade } from "./types";

const CASCADE_PAIRS: {
  a: RegExp;
  b: RegExp;
  note: string;
}[] = [
  {
    a: /\b(mice|mouse|rodent)\b/i,
    b: /\b(electrical|wiring|wir)\b/i,
    note: "Mice chewing through wiring can turn a moderate pest problem and a fast electrical risk into something worse than either alone.",
  },
  {
    a: /\b(plumb|leak|pipe)\b/i,
    b: /\b(electrical|wiring|wir)\b/i,
    note: "A plumbing leak near old wiring compounds both risks — water and electricity in proximity escalate faster than either issue alone.",
  },
  {
    a: /\b(mice|mouse|rodent)\b/i,
    b: /\b(infection|dental|tooth)\b/i,
    note: "Rodent infestation near food or wound care areas can compound health risks beyond either issue in isolation.",
  },
  {
    a: /\b(roof|leak)\b/i,
    b: /\b(electrical|wiring)\b/i,
    note: "Roof leaks near electrical runs can accelerate both structural and fire risk — compounding, not just competing for budget.",
  },
];

export function detectRiskCascades(items: PrioritizedItem[]): RiskCascade[] {
  const cascades: RiskCascade[] = [];
  const seen = new Set<string>();

  for (const pair of CASCADE_PAIRS) {
    const matchA = items.filter((i) => pair.a.test(i.description));
    const matchB = items.filter((i) => pair.b.test(i.description));
    for (const a of matchA) {
      for (const b of matchB) {
        if (a.id === b.id) continue;
        const key = [a.id, b.id].sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        cascades.push({
          item_a: a.id,
          item_b: b.id,
          compounding_note: pair.note,
        });
      }
    }
  }

  return cascades;
}
