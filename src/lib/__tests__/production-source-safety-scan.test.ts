import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function productionSourceFiles(dir: string): string[] {
  return readdirSync(resolve(process.cwd(), dir), { withFileTypes: true }).flatMap((entry) => {
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (
        entry.name === "__tests__" ||
        entry.name === "fixtures" ||
        entry.name === "test-fixtures" ||
        entry.name === "stories"
      ) return [];
      return productionSourceFiles(relative);
    }
    if (!/\.(ts|tsx|js|jsx)$/.test(entry.name)) return [];
    if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(entry.name)) return [];
    return [relative];
  });
}

describe("production source fake-data and identity-fallback scan", () => {
  const files = productionSourceFiles("src");
  const content = files.map((path) => ({ path, text: readFileSync(resolve(process.cwd(), path), "utf8") }));

  it("does not assign the legacy shared caregiver key as a fallback", () => {
    const unsafeFallbacks = [
      /\?\?\s*["']default_caregiver["']/,
      /\|\|\s*["']default_caregiver["']/,
      /caregiver_id\s*:\s*["']default_caregiver["']/,
      /DEFAULT_CAREGIVER_ID\s*=\s*["']default_caregiver["']/,
      /DEFAULT_DURABLE_CARE_KEY\s*=\s*["']default_caregiver["']/,
    ];
    const matches = content.flatMap(({ path, text }) =>
      unsafeFallbacks.some((pattern) => pattern.test(text)) ? [path] : [],
    );
    expect(matches).toEqual([]);
  });

  it("does not ship known fabricated people, dashboard metrics, or demo record identifiers", () => {
    const forbiddenMarkers = [
      "demo-person-id",
      "Alex Johnson",
      "SAMPLE_POSTS",
      "DEMO_RISK",
      "DEMO_REVIEW",
      "DEMO_REPORT",
      "142 caregivers",
      "4.2 helpfulness",
    ];
    const matches = content.flatMap(({ path, text }) =>
      forbiddenMarkers.some((marker) => text.includes(marker)) ? [path] : [],
    );
    expect(matches).toEqual([]);
  });

  it("does not import verification fixtures into application source", () => {
    const imports = content.flatMap(({ path, text }) =>
      /from\s+["'][^"']*(?:scripts\/fixtures|tests\/fixtures|test-fixtures)[^"']*["']/.test(text)
        ? [path]
        : [],
    );
    expect(imports).toEqual([]);
  });
});
