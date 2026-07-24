/**
 * Golden scenario map — required IDs (Phase 3.3 SoT / Phase 4.2 CI meta-verify).
 * Doc: docs/17-canonical-architecture/golden-scenario-map.md
 */

/** Product gate: G1–G19 + dementia-critical + dementia-extended + G61. */
export const REQUIRED_GOLDEN_SCENARIO_IDS = [
  ...Array.from({ length: 19 }, (_, i) => `G${i + 1}`),
  "G31", "G32", "G33", "G34", "G35", "G36", "G37", "G38", "G39", "G40", "G41", "G42",
  "G43", "G44", "G45", "G46", "G47", "G48", "G49", "G50", "G51", "G52", "G53", "G54",
  "G55", "G56", "G57", "G58", "G59", "G60", "G61",
] as const;

export type GoldenScenarioId = (typeof REQUIRED_GOLDEN_SCENARIO_IDS)[number];

export const GOLDEN_COMPOSER_VALUES = ["yes", "partial", "no", "verify-only"] as const;

export type GoldenComposerValue = (typeof GOLDEN_COMPOSER_VALUES)[number];

export type ParsedGoldenMapRow = {
  id: string;
  set: string;
  scenario: string;
  verifyScripts: string;
  composer: GoldenComposerValue;
  runtimePath: string;
};

export const GOLDEN_SCENARIO_MAP_DOC =
  "docs/17-canonical-architecture/golden-scenario-map.md" as const;

/** Extract master table lines from golden-scenario-map.md (avoids |----| false positive on ---). */
export function extractMasterMapSection(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const out: string[] = [];
  let inMaster = false;
  for (const line of lines) {
    if (line.startsWith("## Master map")) {
      inMaster = true;
      continue;
    }
    if (inMaster && line.startsWith("## ")) {
      break;
    }
    if (inMaster) {
      out.push(line);
    }
  }
  return out.join("\n");
}

function normalizeComposer(cell: string): GoldenComposerValue | null {
  const raw = cell.replace(/[†‡]/g, "").trim().toLowerCase();
  return (GOLDEN_COMPOSER_VALUES as readonly string[]).includes(raw)
    ? (raw as GoldenComposerValue)
    : null;
}

/** Parse master table data rows (| G* | …). */
export function parseMasterMapRows(markdown: string): ParsedGoldenMapRow[] {
  const section = extractMasterMapSection(markdown);
  const rows: ParsedGoldenMapRow[] = [];
  for (const line of section.split(/\r?\n/)) {
    if (!/^\|\s*G\d+\s*\|/.test(line)) continue;
    const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length < 6) continue;
    const composer = normalizeComposer(cells[4] ?? "");
    if (!composer) continue;
    rows.push({
      id: cells[0]!,
      set: cells[1]!,
      scenario: cells[2]!,
      verifyScripts: cells[3]!,
      composer,
      runtimePath: cells[5]!,
    });
  }
  return rows;
}

export function extractVerifyScriptRefs(text: string): string[] {
  const refs = new Set<string>();
  for (const m of text.matchAll(/`verify:([a-z0-9-]+)`/g)) {
    refs.add(`verify:${m[1]}`);
  }
  return [...refs];
}

export function validateGoldenMapMarkdown(markdown: string): {
  ok: boolean;
  errors: string[];
  rows: ParsedGoldenMapRow[];
} {
  const errors: string[] = [];
  const rows = parseMasterMapRows(markdown);

  const ids = rows.map((r) => r.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length > 0) {
    errors.push(`Duplicate golden IDs in master map: ${[...new Set(dupes)].join(", ")}`);
  }

  const mapped = new Set(ids);
  const missing = REQUIRED_GOLDEN_SCENARIO_IDS.filter((id) => !mapped.has(id));
  if (missing.length > 0) {
    errors.push(`Missing golden IDs in master map: ${missing.join(", ")}`);
  }

  const extra = ids.filter((id) => !(REQUIRED_GOLDEN_SCENARIO_IDS as readonly string[]).includes(id));
  if (extra.length > 0) {
    errors.push(`Unexpected golden IDs in master map: ${extra.join(", ")}`);
  }

  for (const row of rows) {
    const scripts = extractVerifyScriptRefs(row.verifyScripts);
    if (scripts.length === 0) {
      errors.push(`${row.id}: master row must reference at least one verify: script`);
    }
    if (!row.runtimePath.trim()) {
      errors.push(`${row.id}: runtime path column empty`);
    }
    if (row.id === "G61" && row.composer !== "verify-only" && row.composer !== "partial") {
      errors.push("G61 composer must be verify-only or partial (ADR-025 amended)");
    }
  }

  if (!/Composer column/i.test(markdown)) {
    errors.push("Map must document Composer column legend");
  }

  return { ok: errors.length === 0, errors, rows };
}
