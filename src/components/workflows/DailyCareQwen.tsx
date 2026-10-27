"use client";

import { useState } from "react";
import { getPersonId, postJSON } from "@/api/client";

type SourceRecord = {
  source_type: string;
  source_id: string;
  date?: string | null;
  title?: string;
};

type Proposal = {
  title: string;
  field: string;
  proposed_value: string;
  source_ids: string[];
  uncertainty: string;
  reason: string;
  review_status: string;
};

type AskResult = {
  status: string;
  answer: string;
  source_records: SourceRecord[];
  proposal_analysis_id: string | null;
  proposals: Proposal[];
  history_scope: {
    events?: number;
    corrections?: number;
    evidence?: number;
    appointments?: number;
    matched_records?: number;
    records_sent_to_model?: number;
    oldest_record_at?: string | null;
    newest_record_at?: string | null;
  };
  review_required: boolean;
  written_to_lcr: boolean;
  notice?: string;
};

function readableDate(value?: string | null): string {
  if (!value) return "Date not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function DailyCareQwen() {
  const [question, setQuestion] = useState("");
  const [historyQuery, setHistoryQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AskResult | null>(null);
  const [corrections, setCorrections] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState("");

  async function ask() {
    const prompt = question.trim();
    if (!prompt || busy) return;
    setBusy(true);
    setError("");
    setFeedback("");
    setResult(null);
    try {
      const personId = getPersonId();
      if (!personId) throw new Error("Your care session could not be verified. Reopen Daily Care and try again.");
      const response = (await postJSON("/daily-care/intelligence/ask", {
        person_id: personId,
        question: prompt,
        history_query: historyQuery.trim() || null,
        prepare_lcr_proposals: true,
      })) as AskResult;
      setResult(response);
      if (response.status !== "completed") {
        setFeedback(response.answer || "Daily Care records remain available.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Daily Care Qwen is unavailable. Your saved care records have not been changed.");
    } finally {
      setBusy(false);
    }
  }

  async function review(index: number, decision: "accept" | "correct" | "reject") {
    if (!result?.proposal_analysis_id || reviewing !== null) return;
    const correctedValue = corrections[index]?.trim();
    if (decision === "correct" && !correctedValue) {
      setError("Enter the corrected wording before saving a correction.");
      return;
    }
    setReviewing(index);
    setError("");
    setFeedback("");
    try {
      const response = (await postJSON(
        `/daily-care/intelligence/proposals/${encodeURIComponent(result.proposal_analysis_id)}/${index}/review`,
        {
          person_id: getPersonId(),
          decision,
          corrected_value: decision === "correct" ? correctedValue : undefined,
        },
      )) as { proposal: Proposal; written_to_lcr: boolean; message: string };
      setResult((current) => {
        if (!current) return current;
        const proposals = [...current.proposals];
        proposals[index] = response.proposal;
        return { ...current, proposals };
      });
      setFeedback(response.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The review decision could not be saved. Please try again.");
    } finally {
      setReviewing(null);
    }
  }

  return (
    <section className="daily-care-qwen" aria-labelledby="daily-care-qwen-title">
      <div className="daily-care-qwen__heading">
        <div>
          <p className="daily-care-qwen__eyebrow">DAILY CARE INTELLIGENCE</p>
          <h2 id="daily-care-qwen-title">Ask about the care history</h2>
          <p>Qwen searches the available records for this care session and shows the source entries it used. Its answers are assistance, not established care facts.</p>
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void ask();
        }}
        className="daily-care-qwen__form"
      >
        <label htmlFor="daily-care-qwen-question">What would you like to understand?</label>
        <textarea
          id="daily-care-qwen-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          maxLength={3000}
          rows={3}
          placeholder="For example: What changed in sleep over the last few weeks, and which entries support that?"
          required
        />
        <label htmlFor="daily-care-qwen-filter">Optional: focus the record search</label>
        <input
          id="daily-care-qwen-filter"
          value={historyQuery}
          onChange={(event) => setHistoryQuery(event.target.value)}
          maxLength={500}
          placeholder="e.g. sleep, meals, appointments"
        />
        <button type="submit" disabled={busy || !question.trim()}>
          {busy ? "Searching care history…" : "Ask Daily Care Qwen"}
        </button>
      </form>

      {error ? <p className="daily-care-qwen__error" role="alert">{error}</p> : null}
      {feedback ? <p className="daily-care-qwen__feedback" role="status">{feedback}</p> : null}

      {result ? (
        <div className="daily-care-qwen__result" aria-live="polite">
          <h3>Qwen’s response</h3>
          <p className="daily-care-qwen__answer">{result.answer}</p>
          {result.history_scope ? (
            <p className="daily-care-qwen__scope">
              Retrieved {result.history_scope.matched_records ?? 0} matching records
              {typeof result.history_scope.records_sent_to_model === "number"
                ? `; sent ${result.history_scope.records_sent_to_model} relevant records to Qwen`
                : ""}.
              {result.history_scope.oldest_record_at
                ? ` Available history begins ${readableDate(result.history_scope.oldest_record_at)}`
                : ""}
              {result.history_scope.newest_record_at
                ? ` and extends to ${readableDate(result.history_scope.newest_record_at)}.`
                : "."}
              Qwen’s response uses a bounded relevant evidence set; this count is not a claim that every record was sent to the model.
            </p>
          ) : null}

          {result.source_records?.length ? (
            <div className="daily-care-qwen__sources">
              <h3>Source records</h3>
              <ul>
                {result.source_records.map((source) => (
                  <li key={`${source.source_type}:${source.source_id}`}>
                    <strong>{source.title || source.source_type}</strong>
                    <span>{readableDate(source.date)}</span>
                    <code>{source.source_type} · {source.source_id}</code>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.proposals?.length ? (
            <div className="daily-care-qwen__proposals">
              <h3>Possible Living Care Record updates</h3>
              <p>Review each proposal against its original entries. Nothing below is saved to the LCR until you explicitly accept it.</p>
              {result.proposals.map((proposal, index) => {
                const final = ["accepted_by_caregiver", "rejected_by_caregiver"].includes(proposal.review_status);
                return (
                  <article className="daily-care-qwen__proposal" key={`${result.proposal_analysis_id}:${index}`}>
                    <h4>{proposal.title}</h4>
                    <p><strong>Proposed record:</strong> {proposal.proposed_value}</p>
                    <p><strong>Why it may matter:</strong> {proposal.reason || "No reason supplied."}</p>
                    <p><strong>Uncertainty:</strong> {proposal.uncertainty || "Not specified."}</p>
                    <p><strong>Sources:</strong> {proposal.source_ids.join(", ")}</p>
                    <p className="daily-care-qwen__status">Review status: {proposal.review_status.replaceAll("_", " ")}</p>
                    {!final ? (
                      <>
                        <label htmlFor={`daily-care-qwen-correction-${index}`}>Correct the wording (optional)</label>
                        <textarea
                          id={`daily-care-qwen-correction-${index}`}
                          value={corrections[index] ?? ""}
                          onChange={(event) => setCorrections((current) => ({ ...current, [index]: event.target.value }))}
                          rows={2}
                          maxLength={4000}
                          placeholder="Enter corrected wording, then choose Save correction."
                        />
                        <div className="daily-care-qwen__actions">
                          <button type="button" disabled={reviewing !== null} onClick={() => void review(index, "correct")}>Save correction</button>
                          <button type="button" disabled={reviewing !== null} onClick={() => void review(index, "accept")}>
                            {reviewing === index ? "Saving…" : "Approve and add to LCR"}
                          </button>
                          <button type="button" disabled={reviewing !== null} onClick={() => void review(index, "reject")}>Reject</button>
                        </div>
                      </>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : null}
          <p className="daily-care-qwen__disclaimer">{result.notice || "No care fact was changed by generating this response."}</p>
        </div>
      ) : null}

      <style jsx>{`
        .daily-care-qwen { width: 100%; max-width: 48rem; margin: 0 auto 1rem; padding: 1rem; border: 1px solid #dce5e8; border-radius: 16px; background: #fff; color: #172b35; }
        .daily-care-qwen__eyebrow { margin: 0 0 .3rem; color: #52656d; font-size: .78rem; font-weight: 750; letter-spacing: .08em; }
        .daily-care-qwen h2 { margin: 0 0 .4rem; font-size: 1.25rem; line-height: 1.3; }
        .daily-care-qwen__heading p:not(.daily-care-qwen__eyebrow) { margin: 0 0 1rem; color: #52656d; line-height: 1.55; }
        .daily-care-qwen__form { display: grid; gap: .55rem; }
        .daily-care-qwen label { display: block; margin-top: .25rem; font-weight: 650; }
        .daily-care-qwen textarea, .daily-care-qwen input { width: 100%; min-width: 0; border: 1px solid #bdcbd0; border-radius: 9px; padding: .7rem .8rem; background: #fff; color: #172b35; font: inherit; font-size: 16px; line-height: 1.5; }
        .daily-care-qwen textarea { resize: vertical; }
        .daily-care-qwen button { min-height: 44px; padding: .65rem .9rem; border: 1px solid #b8cfca; border-radius: 9px; background: #e4efeb; color: #172b35; font: inherit; font-weight: 700; cursor: pointer; }
        .daily-care-qwen button:disabled { opacity: .55; cursor: not-allowed; }
        .daily-care-qwen__error { color: #8a2e2e; }
        .daily-care-qwen__feedback { padding: .7rem; border-radius: 8px; background: #f0f5f2; }
        .daily-care-qwen__result { margin-top: 1.2rem; padding-top: 1rem; border-top: 1px solid #dce5e8; overflow-wrap: anywhere; }
        .daily-care-qwen__result h3 { margin: 0 0 .5rem; font-size: 1.05rem; }
        .daily-care-qwen__answer { white-space: pre-wrap; line-height: 1.65; }
        .daily-care-qwen__scope, .daily-care-qwen__disclaimer { color: #52656d; font-size: .9rem; line-height: 1.55; }
        .daily-care-qwen__sources ul { list-style: none; margin: .5rem 0 1rem; padding: 0; display: grid; gap: .5rem; }
        .daily-care-qwen__sources li { display: grid; gap: .2rem; padding: .65rem; border: 1px solid #e0e7e8; border-radius: 8px; }
        .daily-care-qwen__sources span, .daily-care-qwen__sources code { color: #52656d; font-size: .82rem; overflow-wrap: anywhere; }
        .daily-care-qwen__proposal { margin: .7rem 0; padding: .8rem; border: 1px solid #dce5e8; border-radius: 10px; }
        .daily-care-qwen__proposal h4 { margin: 0 0 .6rem; font-size: 1rem; }
        .daily-care-qwen__proposal p { line-height: 1.5; overflow-wrap: anywhere; }
        .daily-care-qwen__status { font-weight: 700; text-transform: capitalize; }
        .daily-care-qwen__actions { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .65rem; }
        .daily-care-qwen__actions button { flex: 1 1 9rem; }
        @media (max-width: 420px) { .daily-care-qwen { padding: .75rem; border-radius: 12px; } .daily-care-qwen__actions { display: grid; grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}
