"use client";

import type { AttachedDocument, ClarityEnvelope } from "@/lib/mvp-workspace";
import type { HistoricalContextResult } from "@/lib/care-record";
import type { UniversalKnowledgeLayerPayload } from "@/lib/universal-knowledge-extraction";
import { buildCarryingReflection } from "@/lib/mvp-workspace";
import { HistoricalContextPanel } from "@/components/ops-devtools/HistoricalContextPanel";
import { DocumentKnowledgePanel } from "@/components/ops-devtools/DocumentKnowledgePanel";

type Props = {
  rawInput: string;
  documents: AttachedDocument[];
  envelope: ClarityEnvelope;
  historicalContext: HistoricalContextResult | null;
  documentKnowledge: UniversalKnowledgeLayerPayload[] | null;
  onContinue: () => void;
};

function LoadBars({ risk }: { risk: ClarityEnvelope["risk_level"] }) {
  const filled = risk === "critical" || risk === "high" ? 3 : risk === "medium" ? 2 : 1;
  return (
    <div className="load-viz" aria-label={`Cognitive weight: ${risk}`}>
      <span className="load-viz-label">What you are carrying</span>
      <div className="load-bars" role="img" aria-hidden>
        {[1, 2, 3].map((n) => (
          <span key={n} className={`load-bar${n <= filled ? " is-filled" : ""}`} />
        ))}
      </div>
    </div>
  );
}

export function CarryingPanel({
  rawInput,
  documents,
  envelope,
  historicalContext,
  documentKnowledge,
  onContinue,
}: Props) {
  const reflection = buildCarryingReflection(
    envelope,
    documents.map((d) => d.name),
  );

  return (
    <>
      <section className="panel panel-input" aria-label="Caregiver input">
        <div className="workspace-panel-inner">
          <h2 className="workspace-headline">What you shared</h2>
          <p className="read-only-dump">{rawInput}</p>
          {documents.length > 0 && (
            <ul className="attached-list">
              {documents.map((d) => (
                <li key={d.id}>{d.name} attached</li>
              ))}
            </ul>
          )}
        </div>
      </section>
      <section className="panel panel-output" aria-label="Clarity output">
        <div className="workspace-panel-inner clarity-side">
          <h2 className="workspace-headline">Held in the Living Care Record</h2>
          <p className="workspace-lede">What was shared is preserved — not advice yet.</p>

          <LoadBars risk={envelope.risk_level} />

          <HistoricalContextPanel context={historicalContext} />

          <DocumentKnowledgePanel knowledge={documentKnowledge} />

          {reflection.concerns.length > 0 && (
            <section className="reflect-block">
              <h3>Concerns</h3>
              <ul>
                {reflection.concerns.map((c) => (
                  <li key={c.slice(0, 48)}>{c}</li>
                ))}
              </ul>
            </section>
          )}

          {reflection.appointments.length > 0 && (
            <section className="reflect-block">
              <h3>Appointments &amp; follow-through</h3>
              <ul>
                {reflection.appointments.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </section>
          )}

          {reflection.emotionalWorries.length > 0 && (
            <section className="reflect-block">
              <h3>Emotional weight</h3>
              <ul>
                {reflection.emotionalWorries.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </section>
          )}

          {reflection.documents.length > 0 && (
            <section className="reflect-block">
              <h3>Documents</h3>
              <ul>
                {reflection.documents.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </section>
          )}

          <button type="button" className="workspace-primary" onClick={onContinue}>
            Move to Clarity
          </button>
        </div>
      </section>
    </>
  );
}
