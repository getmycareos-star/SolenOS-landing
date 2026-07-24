/**
 * Live smoke — Decision Memory + competing attention against running Next server.
 */
const BASE = process.env.SOLENOS_WALKTHROUGH_BASE ?? "http://localhost:3001";

type Json = Record<string, unknown>;

async function postSituation(
  caregiverId: string,
  sessionId: string,
  raw_input: string,
): Promise<Json> {
  const res = await fetch(`${BASE}/api/situation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      caregiver_id: caregiverId,
      care_session_id: sessionId,
      raw_input,
    }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${raw.slice(0, 500)}`);
  return JSON.parse(raw) as Json;
}

function turnOf(data: Json): Json {
  return (data.active_care_situation_turn as Json) ?? (data.caregiver_response as Json) ?? {};
}

function blobOf(t: Json): string {
  return [
    t.confirmation_body ?? t.confirmation,
    t.situation_summary ?? t.what_seems_happening,
    ...((t.current_understanding as string[]) ?? (t.what_we_know as string[]) ?? []),
    t.what_matters_now,
    t.what_changed_in_understanding ?? t.what_changed,
  ]
    .filter(Boolean)
    .join(" | ");
}

async function main() {
  console.log(`=== Live SolenOS @ ${BASE} ===\n`);

  const careKey = `cg_live_${Date.now()}`;
  const sessionId = `sess_${Date.now()}`;

  await postSituation(
    careKey,
    sessionId,
    "The doctor started a blood pressure medication because readings stayed high.",
  );
  const q = await postSituation(careKey, sessionId, "Why is Mom taking this medication?");
  const t = turnOf(q);
  const conf = String(t.confirmation_body ?? t.confirmation ?? "");
  const know = JSON.stringify(
    t.current_understanding ?? t.what_we_know ?? [],
  ).toLowerCase();
  console.log("[G13] confirmation:", conf);
  console.log("[G13] what_we_know:", t.current_understanding ?? t.what_we_know);
  console.log("[G13] show_clarity:", t.show_clarity);
  if (!/held|living care record|using what/i.test(conf)) {
    throw new Error(`G13 confirmation weak: ${conf}`);
  }
  if (t.show_clarity === true) throw new Error("G13 forced Clarity");
  if (!/medication|blood|pressure|high|reason/i.test(know + conf.toLowerCase())) {
    throw new Error("G13 missing decision memory content");
  }
  console.log("✓ Decision memory / record question\n");

  const careKey2 = `cg_compete_${Date.now()}`;
  const d2 = await postSituation(
    careKey2,
    `sess2_${Date.now()}`,
    "Mom fell yesterday. Doctor appointment next month. Insurance form due Friday.",
  );
  const t2 = turnOf(d2);
  const blob = blobOf(t2);
  console.log("[compete]", blob);
  if (/^note created/i.test(String(t2.confirmation_body ?? t2.confirmation ?? ""))) {
    throw new Error("note-created feel");
  }
  if (
    !/reconstruct|held|connected|monitoring|paperwork|upcoming|competing|living care/i.test(
      blob,
    )
  ) {
    throw new Error(`mental load / competing missing: ${blob}`);
  }
  if (/\btodo\b|task 1|checklist/i.test(blob)) throw new Error("task chrome");
  console.log("✓ Competing concerns + mental load\n");

  console.log("=== Live SolenOS passed ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
