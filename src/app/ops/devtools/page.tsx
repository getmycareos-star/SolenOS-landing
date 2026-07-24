import { notFound } from "next/navigation";
import Link from "next/link";
import fs from "node:fs";
import path from "node:path";
import { assertOpsAccess } from "@/lib/ops-console/access";
import {
  CAREGIVER_MVP_WORKSPACE_FILES,
  OPS_DEVTOOLS_ENGINE_PANELS_NOTE,
} from "@/lib/mvp-workspace";
import "../ops-console.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "SolenOS Ops · Engine panels quarantine",
  robots: { index: false, follow: false },
};

/**
 * Index of engine / secondary panels quarantined under ops-devtools.
 * Caregiver CognitiveWorkspace must never import these.
 */
export default async function OpsDevtoolsQuarantinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const key = typeof params.key === "string" ? params.key : null;
  if (!assertOpsAccess(key)) notFound();

  const keyQ = encodeURIComponent(key!);
  const dir = path.join(process.cwd(), "src/components/ops-devtools");
  const panels = fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".tsx"))
        .sort()
    : [];

  return (
    <div className="ops-console">
      <header className="ops-header">
        <div>
          <h1>Engine panels quarantine</h1>
          <p className="ops-meta">
            Internal · ops/devtools · excluded from caregiver Living Care Record surface
          </p>
        </div>
        <div className="ops-meta">
          <Link href={`/ops?key=${keyQ}`}>← Ops console</Link>
          {" · "}
          <Link href={`/ops/clarity?key=${keyQ}`}>Clarity quarantine</Link>
        </div>
      </header>

      <section className="ops-section" aria-label="Policy">
        <h2>Policy</h2>
        <p>{OPS_DEVTOOLS_ENGINE_PANELS_NOTE}</p>
        <p>
          Caregiver <code>mvp-workspace</code> allowlist:{" "}
          <code>{CAREGIVER_MVP_WORKSPACE_FILES.join(", ")}</code>
        </p>
      </section>

      <section className="ops-section" aria-label="Quarantined panels">
        <h2>src/components/ops-devtools ({panels.length})</h2>
        <ul>
          {panels.map((name) => (
            <li key={name}>
              <code>{name}</code>
            </li>
          ))}
        </ul>
        <p className="ops-meta">
          Includes TrustProvenance, ClarificationEngine, ContinuityDecay, ObservationPanel
          signals, RealMoment engine dump, and related secondary panels.
        </p>
      </section>
    </div>
  );
}
