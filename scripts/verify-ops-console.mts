/**
 * verify-ops-console.mts — smoke checks for Ops Console contracts.
 */

import "./_verify-env.mts";
import fs from "node:fs";
import path from "node:path";

import {
  assertMetricsAccess,
  assertOpsAccess,
  insertSolenEvent,
  isOpsEventName,
  OPS_EVENT_NAMES,
  resetSolenEventsMemoryForTests,
  getMemorySolenEvents,
} from "../src/lib/ops-console";
import { OPS_CONSOLE } from "../src/lib/solenos-layers/architecture-map";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  assert(OPS_CONSOLE.notANewPillar === true, "Ops Console is not a product pillar");
  assert(OPS_CONSOLE.status === "IMPLEMENTED", "Ops Console status");
  assert(fs.existsSync(path.join(root, "db/migrations/075_solen_ops_events.sql")), "migration 075");
  assert(fs.existsSync(path.join(root, "src/app/api/track/route.ts")), "track route");
  assert(fs.existsSync(path.join(root, "src/app/ops/page.tsx")), "ops page");
  assert(fs.existsSync(path.join(root, "src/app/metrics/page.tsx")), "metrics page");
  assert(fs.existsSync(path.join(root, "public/robots.txt")), "robots.txt");
  const robots = fs.readFileSync(path.join(root, "public/robots.txt"), "utf8");
  assert(robots.includes("Disallow: /ops"), "robots disallow ops");
  assert(robots.includes("Disallow: /metrics"), "robots disallow metrics");

  assert(isOpsEventName("care_record_viewed"), "continuity event registered");
  assert(OPS_EVENT_NAMES.includes("return_visit"), "return_visit required");

  resetSolenEventsMemoryForTests();
  await insertSolenEvent({
    user_id: "verify_user",
    event_name: "page_view",
    session_id: "verify_session",
    metadata: { page: "/welcome" },
  });
  assert(getMemorySolenEvents().length === 1, "memory insert works without DATABASE_URL");

  const prevOps = process.env.OPS_SECRET;
  const prevMet = process.env.METRICS_SECRET;
  process.env.OPS_SECRET = "a".repeat(32);
  process.env.METRICS_SECRET = "b".repeat(32);
  assert(assertOpsAccess("a".repeat(32)), "ops key match");
  assert(!assertOpsAccess("wrong"), "ops key reject");
  assert(assertMetricsAccess("b".repeat(32)), "metrics key match");
  assert(!assertMetricsAccess("a".repeat(32)), "metrics key isolation");
  process.env.OPS_SECRET = prevOps;
  process.env.METRICS_SECRET = prevMet;

  console.log("verify:ops-console OK");
}

void main();
