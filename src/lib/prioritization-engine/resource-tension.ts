import type { PrioritizedItem, ResourcePool, ResourceTension } from "./types";

function sharesPool(a: PrioritizedItem, b: PrioritizedItem, pool: ResourcePool): boolean {
  return a.pool.includes(pool) && b.pool.includes(pool);
}

function findItem(items: PrioritizedItem[], pattern: RegExp): PrioritizedItem | undefined {
  return items.find((i) => pattern.test(i.description));
}

export function detectResourceTensions(
  items: PrioritizedItem[],
  fullInput: string,
  loadScores?: { emotionalLoadScore?: number; cognitiveLoadScore?: number },
): ResourceTension[] {
  const tensions: ResourceTension[] = [];
  const seen = new Set<string>();

  function add(a: PrioritizedItem, b: PrioritizedItem, pool: ResourcePool, note: string) {
    const key = [a.id, b.id, pool].sort().join("|");
    if (seen.has(key)) return;
    seen.add(key);
    tensions.push({ item_a: a.id, item_b: b.id, pool, note });
  }

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]!;
      const b = items[j]!;

      if (sharesPool(a, b, "money")) {
        const aDeadline = a.clock_type === "deadline_bound";
        const bDeadline = b.clock_type === "deadline_bound";
        const note =
          aDeadline || bDeadline
            ? `Spending on ${shortLabel(a.description)} reduces what's available for ${shortLabel(b.description)} before its deadline. You likely can't fully fund both — the tradeoff is visible here; you decide.`
            : `Both ${shortLabel(a.description)} and ${shortLabel(b.description)} draw from the same limited money pool.`;
        add(a, b, "money", note);
      }

      if (sharesPool(a, b, "caregiver_time")) {
        add(
          a,
          b,
          "caregiver_time",
          `Time on ${shortLabel(a.description)} competes with ${shortLabel(b.description)} — both need caregiver hours from the same finite week.`,
        );
      }

      if (
        (a.pool.includes("caregiver_time") && b.pool.includes("presence_with_care_recipient")) ||
        (b.pool.includes("caregiver_time") && a.pool.includes("presence_with_care_recipient"))
      ) {
        add(
          a,
          b,
          "presence_with_care_recipient",
          `DIY repair labor trades money saved for time with grandma — hours on repairs are hours not spent with her. This tradeoff is not free.`,
        );
      }
    }
  }

  const roof = findItem(items, /\broof/i);
  const tax = findItem(items, /\bproperty tax|taxes/i);
  if (roof && tax) {
    add(
      roof,
      tax,
      "money",
      `Spending on the roof this month reduces what's available for the property tax deadline. You likely can't fully fund both before the due date. SolenOS surfaces the tradeoff — you decide the allocation.`,
    );
  }

  const repair = findItem(items, /\brepair labor|doing repairs|DIY/i);
  const presence = findItem(items, /\bpresence|grandmother|grandma|shopping/i);
  if (repair && presence && /\brepair labor|ourselves|trades time/i.test(fullInput)) {
    add(
      repair,
      presence,
      "presence_with_care_recipient",
      `Doing repairs yourselves trades money saved for time with grandma. Time on the roof is time not spent with her — that tradeoff should be visible, not assumed free.`,
    );
  }

  if ((loadScores?.emotionalLoadScore ?? 0) >= 0.6 || (loadScores?.cognitiveLoadScore ?? 0) >= 0.6) {
    const emotional = items.filter((i) => i.pool.includes("emotional_capacity"));
    const cognitive = items.filter((i) => i.pool.includes("cognitive_capacity"));
    if (emotional.length >= 2) {
      add(
        emotional[0]!,
        emotional[1]!,
        "emotional_capacity",
        `These both draw heavily on the same emotional capacity the load engine already flagged as strained today.`,
      );
    }
    if (cognitive.length >= 1 && emotional.length >= 1) {
      add(
        cognitive[0]!,
        emotional[0]!,
        "cognitive_capacity",
        `This call or decision will draw on the same cognitive capacity already in use elsewhere today.`,
      );
    }
  }

  return tensions;
}

function shortLabel(description: string, max = 40): string {
  return description.length > max ? `${description.slice(0, max - 1)}…` : description;
}
