"use client";

import type { ClarityEnvelope, MvpReasoningContext } from "@/lib/mvp-workspace";
import { emphasizeActionVerbs } from "@/lib/mvp-workspace";
import { RiskUncertaintyPanel } from "@/components/ops-devtools/RiskUncertaintyPanel";
import { ReasoningSection } from "./ReasoningSection";
import { CareContinuityPanel } from "./CareContinuityPanel";

type Props = {
  rawInput: string;
  envelope: ClarityEnvelope;
  reasoning: MvpReasoningContext;
  languageHint?: string;
  onContinue: () => void;
};

function EmphasizedText({ text }: { text: string }) {
  const parts = emphasizeActionVerbs(text);
  return (
    <>
      {parts.map((part, i) =>
        part.strong ? (
          <strong key={`${i}-${part.text}`} className="action-verb">
            {part.text}
          </strong>
        ) : (
          <span key={`${i}-${part.text.slice(0, 12)}`}>{part.text}</span>
        ),
      )}
    </>
  );
}

export function ClarityPanel({ rawInput, envelope, reasoning, onContinue }: Props) {
  return (
    <>
      <section className="panel panel-input" aria-label="Caregiver input">
        <div className="workspace-panel-inner">
          <h2 className="workspace-headline">Your words</h2>
          <p className="read-only-dump">{rawInput}</p>
        </div>
      </section>

      <section className="panel panel-output" aria-label="Clarity output">
        <div className="workspace-panel-inner clarity-side">
          <section className="clarity-section matters-now">
            <h2 className="section-kicker">Matters now</h2>
            <p className="matters-body">
              <EmphasizedText text={envelope.what_matters_now} />
            </p>
            {envelope.follow_up_items.length > 0 && (
              <ul className="follow-ups">
                {envelope.follow_up_items.map((item) => (
                  <li key={item}>
                    <EmphasizedText text={item} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <RiskUncertaintyPanel layer={reasoning.riskUncertainty} />

          <CareContinuityPanel layer={reasoning.careJourneyGraph} />

          {envelope.prioritization?.self_neglect_flag && envelope.prioritization.self_neglect_note && (
            <section className="clarity-section self-neglect" aria-label="Caregiver visibility">
              <h2 className="section-kicker">Worth noticing</h2>
              <p className="self-neglect-note">{envelope.prioritization.self_neglect_note}</p>
            </section>
          )}

          {envelope.prioritization && envelope.prioritization.resource_tension.length > 0 && (
            <section className="clarity-section resource-tension" aria-label="Resource tradeoffs">
              <h2 className="section-kicker">Resource tension</h2>
              <ul>
                {envelope.prioritization.resource_tension.map((t) => (
                  <li key={`${t.item_a}-${t.item_b}-${t.pool}`}>
                    <span className="tension-pool">{t.pool.replace(/_/g, " ")}</span>: {t.note}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {envelope.prioritization && envelope.prioritization.risk_cascade.length > 0 && (
            <section className="clarity-section risk-cascade" aria-label="Compounding risks">
              <h2 className="section-kicker">Compounding risks</h2>
              <ul>
                {envelope.prioritization.risk_cascade.map((c) => (
                  <li key={`${c.item_a}-${c.item_b}`}>{c.compounding_note}</li>
                ))}
              </ul>
            </section>
          )}

          {envelope.prioritization && envelope.prioritization.items.length > 1 && (
            <section className="clarity-section prioritized-items" aria-label="Situation items">
              <h2 className="section-kicker">What you are carrying</h2>
              <ul className="prioritized-items-list">
                {envelope.prioritization.items.map((item) => (
                  <li key={item.id} className={`item-type-${item.type}`}>
                    <strong>{item.description}</strong>
                    <span className="item-meta">
                      {item.type === "static"
                        ? "static — parked, not ranked against decaying items"
                        : `${item.decay_rate ?? "unknown"} decay · ${item.clock_type?.replace(/_/g, " ") ?? "no clock"}`}
                      {item.assessment_source === "caregiver_reported" ? " · caregiver-reported" : ""}
                    </span>
                    {item.autonomy_note && (
                      <span className="item-autonomy">{item.autonomy_note}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="clarity-section can-wait">
            <h2 className="section-kicker">Can wait</h2>
            <p>{envelope.what_can_wait}</p>
          </section>

          <section className="clarity-section watch-for">
            <h2 className="section-kicker">May become serious</h2>
            {envelope.watch_for.length > 0 ? (
              <ul>
                {envelope.watch_for.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">Nothing additional flagged to watch tonight.</p>
            )}
          </section>

          <ReasoningSection reasoning={reasoning} />

          <section className="clarity-meta">
            <p>
              <span className="meta-label">Ask next</span>
              {envelope.what_to_ask_next}
            </p>
            <p>
              <span className="meta-label">Risk</span>
              <span className={`risk-chip risk-${envelope.risk_level}`}>
                {envelope.risk_level}
              </span>
            </p>
            <p className="happening-echo">{envelope.what_is_happening}</p>
          </section>

          <button type="button" className="workspace-primary" onClick={onContinue}>
            Review Continuity
          </button>
        </div>
      </section>
    </>
  );
}
