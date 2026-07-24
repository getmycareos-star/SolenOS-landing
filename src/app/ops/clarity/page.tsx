import { notFound } from "next/navigation";
import Link from "next/link";
import { assertOpsAccess } from "@/lib/ops-console/access";
import { OPS_QUARANTINED_WORKSPACE_STATES, WORKSPACE_STATES } from "@/lib/mvp-workspace";
import "../ops-console.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "SolenOS Ops · Clarity quarantine",
  robots: { index: false, follow: false },
};

/**
 * Quarantine index for the dead Clarity dump path.
 * Caregiver CognitiveWorkspace never enters CLARITY / CONTINUITY.
 * Panels live under src/components/ops-clarity for ops inspection only.
 */
export default async function OpsClarityQuarantinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const key = typeof params.key === "string" ? params.key : null;
  if (!assertOpsAccess(key)) notFound();

  const keyQ = encodeURIComponent(key!);

  return (
    <div className="ops-console">
      <header className="ops-header">
        <div>
          <h1>Clarity dump quarantine</h1>
          <p className="ops-meta">
            Internal · removed from caregiver state machine · not a caregiver surface
          </p>
        </div>
        <div className="ops-meta">
          <Link href={`/ops?key=${keyQ}`}>← Ops console</Link>
          {" · "}
          <Link href={`/ops/devtools?key=${keyQ}`}>Engine panels</Link>
        </div>
      </header>

      <section className="ops-section" aria-label="State machine">
        <h2>Caregiver workspace states</h2>
        <p>
          Primary flow: <code>{WORKSPACE_STATES.join(" → ")}</code> (Living Care Record).
        </p>
        <p>
          Quarantined (never entered by CognitiveWorkspace):{" "}
          <code>{OPS_QUARANTINED_WORKSPACE_STATES.join(", ")}</code>
        </p>
      </section>

      <section className="ops-section" aria-label="Quarantined panels">
        <h2>Panels under src/components/ops-clarity</h2>
        <ul>
          <li>ClarityPanel — engine dump, confidence %, “why concluded”</li>
          <li>ReasoningSection — trust / priority / load dumps</li>
          <li>CarryingPanel — envelope carrying phase (legacy)</li>
          <li>ContinuityPanel — legacy continuity checks</li>
          <li>FinalOutputPanel — final-output contract renderer</li>
          <li>CareContinuityPanel — journey graph dump</li>
        </ul>
        <p className="ops-meta">
          Analyze pipeline remains ops-gated. Caregiver entry is POST /api/situation only.
        </p>
      </section>
    </div>
  );
}
