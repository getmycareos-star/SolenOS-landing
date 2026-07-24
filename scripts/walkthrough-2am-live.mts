/**
 * Manual 2AM caregiver walkthrough against the live Next API (localhost).
 * Exercises: soft note → hard event (no template quiz) → Clarity → thread → pause → return.
 */
import assert from "node:assert/strict";

const BASE = process.env.SOLENOS_WALKTHROUGH_BASE ?? "http://localhost:3005";
const careKey = `walk_2am_${Date.now().toString(36)}`;
const sessionId = `sess_${careKey}`;

type Json = Record<string, unknown>;

async function postSituation(raw_input: string, extra: Json = {}): Promise<Json> {
  const res = await fetch(`${BASE}/api/situation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      raw_input,
      caregiver_id: careKey,
      care_session_id: sessionId,
      ...extra,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`POST failed ${res.status} for: ${raw_input.slice(0, 40)} :: ${text.slice(0, 400)}`);
  }
  return JSON.parse(text) as Json;
}

async function getSituation(): Promise<Json> {
  const url = `${BASE}/api/situation?caregiver_id=${encodeURIComponent(careKey)}&care_session_id=${encodeURIComponent(sessionId)}`;
  const res = await fetch(url);
  assert.equal(res.ok, true, `GET failed ${res.status}`);
  return (await res.json()) as Json;
}

function acs(r: Json): Json {
  return (r.active_care_situation as Json) ?? {};
}
function turn(r: Json): Json {
  return (r.active_care_situation_turn as Json) ?? {};
}

function bannedHit(blob: string): string | null {
  const bans = [
    "dementia is worsening",
    "dementia patient",
    "everything will be fine",
    "chat summary",
    "document analyzer",
    "ocr confidence",
    "you should choose",
  ];
  const lower = blob.toLowerCase();
  return bans.find((b) => lower.includes(b)) ?? null;
}

console.log(`=== 2AM walkthrough @ ${BASE}  careKey=${careKey} ===\n`);

const results: { step: string; pass: boolean; note: string }[] = [];

function record(step: string, pass: boolean, note: string) {
  results.push({ step, pass, note });
  console.log(`${pass ? "✓" : "✗"} ${step}: ${note}`);
}

// 1) Soft first note
{
  const r = await postSituation("Mom refused dinner and pushed the plate away.");
  const t = turn(r);
  const obs = (acs(r).observations as unknown[]) ?? [];
  const conf = String(t.confirmation_body ?? "");
  const hit = bannedHit(JSON.stringify(r).slice(0, 8000));
  record(
    "1 Soft note held",
    obs.length >= 1 && /held|Living Care Record|carry/i.test(conf) && !hit,
    hit ? `banned: ${hit}` : `obs=${obs.length}; ${conf.slice(0, 80)}`,
  );
}

// 2) Hard event held — no kind-template quiz (messy input is bigger than falls)
{
  const r = await postSituation("Mom fell in the hallway this evening.");
  const t = turn(r);
  const asks = (t.what_needs_context as string[]) ?? [];
  const stage = String(t.disclosure_stage ?? "");
  record(
    "2 Hard event held without template quiz",
    /held|Living Care Record|Connected|Updated|preserved|stays connected|Added/i.test(
      String(t.confirmation_body ?? ""),
    ) && !asks.some((q) => /head|walking normally|hit their head/i.test(q)),
    `asks=${asks.join(" | ") || "(none)"}; stage=${stage}; conf=${String(t.confirmation_body ?? "").slice(0, 80)}`,
  );
}

// 3) More context on hard event → Clarity faster
{
  const r = await postSituation(
    "She is sitting with me now. Urgent care said to watch her overnight.",
  );
  const t = turn(r);
  const stage = String(t.disclosure_stage ?? "");
  const clarityFaster = stage === "growing" || stage === "established";
  const matters = t.what_matters_now != null || (acs(r).what_matters_now != null);
  record(
    "3 Linked context → Clarity faster",
    clarityFaster,
    `stage=${stage}; relation=${t.relation}; matters=${Boolean(matters)}`,
  );
}

// 4) Long thread → multiple linked observations
{
  const thread = `Alex: Energy dipped after lunch today and she seemed quieter.
Sam: Later she asked what day it was twice.
Alex: The evening walk was skipped — she said she was too tired.
Sam: By 9 she seemed a bit more settled on the couch.`;
  const before = ((acs(await getSituation()).observations as unknown[]) ?? []).length;
  const r = await postSituation(thread);
  const obs = (acs(r).observations as unknown[]) ?? [];
  const eventsCreated = Array.isArray(r.events_created) ? r.events_created.length : 0;
  // Long thread Locked B: ACS must grow by multiple observations — never one chat-summary.
  const grew = obs.length >= Math.max(before + 2, 3);
  const hit = bannedHit(JSON.stringify({ t: turn(r), a: acs(r) }));
  record(
    "4 Thread → multiple linked observations / events",
    grew && !hit,
    hit
      ? `banned: ${hit}`
      : `obs before≈${before} after=${obs.length}; events=${eventsCreated}; pattern=${turn(r).pattern_label}`,
  );
}

// 5) Done for now = pause only
{
  const res = await fetch(`${BASE}/api/situation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "pause_active_care_situation",
      caregiver_id: careKey,
      care_session_id: sessionId,
    }),
  });
  assert.equal(res.ok, true, "pause POST ok");
  const r = (await res.json()) as Json;
  const situation = (r.active_care_situation as Json) ?? acs(await getSituation());
  const paused = situation.interaction_paused_at != null || situation.lifecycle_status === "quiet";
  const stillThere = ((situation.observations as unknown[]) ?? []).length >= 1;
  record(
    "5 Done for now pauses (does not wipe)",
    paused && stillThere,
    `paused_at=${situation.interaction_paused_at}; lifecycle=${situation.lifecycle_status}; obs=${((situation.observations as unknown[]) ?? []).length}`,
  );
}

// 6) Return continuity
{
  const r = await getSituation();
  const rc = (r.return_continuity as Json) ?? {};
  const hasReality = rc.has_durable_care_reality === true || rc.suppress_first_time_ux === true;
  const invite = (rc.soft_invite as Json) ?? {};
  record(
    "6 Return restores durable reality",
    hasReality,
    `suppress_first_time=${rc.suppress_first_time_ux}; invite_offered=${invite.offered_now}; recent=${((rc.recent_relevant_changes as unknown[]) ?? []).length}`,
  );
}

const failed = results.filter((x) => !x.pass);
console.log(
  `\n=== Walkthrough ${failed.length === 0 ? "PASS" : "FAIL"} (${results.length - failed.length}/${results.length}) ===\n`,
);
if (failed.length) {
  process.exitCode = 1;
}
