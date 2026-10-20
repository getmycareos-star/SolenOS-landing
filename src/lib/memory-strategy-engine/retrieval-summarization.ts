import type { MemoryRecord, MemoryTier } from "./types";

export function prioritizeRetrieval(
  records: MemoryRecord[],
  currentTopics: string[],
): Array<{ memory_id: string; score: number; reason: string }> {
  const active = records.filter((r) => r.status === "active" || r.status === "promoted");

  return active
    .map((r) => {
      let score = r.confidence_pct;
      const tierBoost: Record<MemoryTier, number> = {
        permanent: 30,
        long_lived: 20,
        short_lived: 10,
        session: 0,
      };
      score += tierBoost[r.tier];
      if (currentTopics.some((t) => r.label.toLowerCase().includes(t.toLowerCase()))) {
        score += 25;
      }
      return {
        memory_id: r.id,
        score,
        reason: `${r.tier} tier, ${r.confidence_pct}% confidence`,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

export function buildCurrentStatusSummary(records: MemoryRecord[]): string[] {
  const active = records.filter((r) => r.status === "active" || r.status === "promoted");
  const lines: string[] = [];

  const mobility = active.filter((r) => /mobil|walk|wheel|fall/i.test(r.label));
  if (mobility.length >= 2) {
    lines.push("Mobility has changed over time — historical transitions preserved.");
  } else if (mobility.length === 1) {
    lines.push(`Mobility: ${mobility[0]!.label.slice(0, 80)}`);
  }

  const med = active.find((r) => /med|medication|pill/i.test(r.label));
  if (med) lines.push("Medication context tracked in long-lived memory.");

  const recent = active.filter((r) => r.tier === "short_lived").slice(-3);
  for (const r of recent) {
    lines.push(`Current: ${r.label.slice(0, 70)} (${r.confidence_pct}% confidence)`);
  }

  if (lines.length === 0) {
    lines.push("Care journey memory building — selective continuity active.");
  }

  return lines.slice(0, 6);
}
