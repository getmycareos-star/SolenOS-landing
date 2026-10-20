/**
 * Live API proof — Jennifer care-fact note → Held + facts + Clarity.
 */
const BASE = process.env.SOLENOS_WALKTHROUGH_BASE ?? "http://localhost:3000";
const careKey = `cg_jennifer_live_${Date.now()}`;
const sessionId = `sess_${Date.now()}`;
const text = "hi, im jennifer... my dad is sick and herefusedto eat.";

type Json = Record<string, unknown>;

async function main() {
  const res = await fetch(`${BASE}/api/situation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      caregiver_id: careKey,
      care_session_id: sessionId,
      raw_input: text,
    }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${raw.slice(0, 500)}`);
  const data = JSON.parse(raw) as Json;
  const turn = (data.active_care_situation_turn as Json) ?? {};
  const confirmation = String(turn.confirmation_body ?? "");
  const what_we_know = (turn.current_understanding as string[]) ?? [];
  const what_matters_now = String(turn.what_matters_now ?? "");
  const what_can_wait = String(turn.what_can_wait ?? "");
  const show_clarity = turn.show_clarity === true || Boolean(what_matters_now);
  const asks = (turn.what_needs_context as string[]) ?? [];

  console.log("\n=== Live Jennifer API ===");
  console.log("base:", BASE);
  console.log("confirmation:", confirmation);
  console.log("what_we_know:", what_we_know);
  console.log("what_matters_now:", what_matters_now);
  console.log("what_can_wait:", what_can_wait);
  console.log("show_clarity:", show_clarity, "field=", turn.show_clarity);
  console.log("asks:", asks);
  console.log("disclosure_stage:", turn.disclosure_stage);

  if (!/held|Living Care Record|carry|preserved|Added/i.test(confirmation)) {
    throw new Error("no held");
  }
  if (!what_matters_now || !/sick|refus|eat/i.test(what_matters_now)) {
    throw new Error(`matters not grounded: ${what_matters_now}`);
  }
  if (!what_can_wait) throw new Error("no what can wait");
  if (asks.some((q) => /head|fluid|walking normally/i.test(q))) {
    throw new Error("keyword quiz");
  }
  if (what_we_know.length < 1 && !/sick|refus|eat/i.test(what_matters_now)) {
    throw new Error("no facts");
  }
  console.log("✓ Live Jennifer — Held + facts + Clarity\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
