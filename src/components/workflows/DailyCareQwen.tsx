"use client";

import { useState } from "react";
import { getPersonId, postJSON } from "@/api/client";
import { caregiverSafeAssistantText, caregiverSafeErrorMessage, caregiverStatusLabel } from "@/lib/caregiver-language";

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
    records_retrieved?: number;
    records_omitted_from_model?: number;
    selection_truncated?: boolean;
    prompt_context_truncated?: boolean;
    oldest_record_at?: string | null;
    newest_record_at?: string | null;
    lcr_context?: {
      schema_status?: string;
      retrieval_scan_complete?: boolean;
      retrieval_projection_complete?: boolean;
      missing_required_sources?: string[];
      missing_optional_sources?: string[];
    };
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
        setFeedback(caregiverSafeAssistantText(response.answer) || "I could not safely display that response. Your saved care information has not been changed.");
      }
    } catch (cause) {
      setError(caregiverSafeErrorMessage());
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
      setFeedback(caregiverSafeAssistantText(response.message) || "Your review choice was saved.");
    } catch (cause) {
      setError(caregiverSafeErrorMessage());
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
          <p>SolenOS looks through the saved care history and shows the information behind its answer. Suggestions are not confirmed care facts.</p>
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
          {busy ? "Searching care history…" : "Ask about the care history"}
        </button>
      </form>

      {error ? <p className="daily-care-qwen__error" role="alert">{error}</p> : null}
      {feedback ? <p className="daily-care-qwen__feedback" role="status">{feedback}</p> : null}

      {result ? (
        <div className="daily-care-qwen__result" aria-live="polite">
          <h3>Care history response</h3>
          <p className="daily-care-qwen__answer">{caregiverSafeAssistantText(result.answer) || "I could not safely display that response. Your saved care information has not been changed."}</p>
          {result.history_scope ? (
            <p className="daily-care-qwen__scope">
              Found {result.history_scope.matched_records ?? 0} matching saved care updates.
              {result.history_scope.oldest_record_at
                ? ` Available history begins ${readableDate(result.history_scope.oldest_record_at)}`
                : ""}
              {result.history_scope.newest_record_at
                ? ` and extends to ${readableDate(result.history_scope.newest_record_at)}.`
                : "."}
              {result.history_scope.selection_truncated
                || result.history_scope.prompt_context_truncated
                || result.history_scope.lcr_context?.retrieval_scan_complete !== true
                || result.history_scope.lcr_context?.retrieval_projection_complete !== true
                || result.history_scope.lcr_context?.schema_status !== "complete"
                ? `This is a partial view. ${result.history_scope.records_omitted_from_model ?? 0} matching entries were not included in the answer, or some care sources could not be checked. Narrow the question or date range to review a smaller part of the history.`
                : "All matching entries found in the available care sources were included in this answer. Information that was never recorded is still unknown."}
            </p>
          ) : null}

          {result.source_records?.length ? (
            <div className="daily-care-qwen__sources">
              <h3>Information used</h3>
              <ul>
                {result.source_records.map((source) => (
                  <li key={`${source.source_type}:${source.source_id}`}>
                    <strong>{caregiverSafeAssistantText(source.title) || "Saved care information"}</strong>
                    <span>{readableDate(source.date)}</span>
                    
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.proposals?.length ? (
            <div className="daily-care-qwen__proposals">
              <h3>Suggested care record updates</h3>
              <p>Review each proposal against its original entries. Nothing below is saved to the LCR until you explicitly accept it.</p>
              {result.proposals.map((proposal, index) => {
                const final = ["accepted_by_caregiver", "rejected_by_caregiver"].includes(proposal.review_status);
                return (
                  <article className="daily-care-qwen__proposal" key={`${result.proposal_analysis_id}:${index}`}>
                    <h4>{caregiverSafeAssistantText(proposal.title) || "Suggested care update"}</h4>
                    <p><strong>Suggested update:</strong> {caregiverSafeAssistantText(proposal.proposed_value) || "A possible update is ready for review."}</p>
                    <p><strong>Why it may matter:</strong> {caregiverSafeAssistantText(proposal.reason) || "No explanation is available."}</p>
                    <p><strong>What is still unclear:</strong> {caregiverSafeAssistantText(proposal.uncertainty) || "This suggestion may need checking."}</p>
                    
                    <p className="daily-care-qwen__status">{caregiverStatusLabel(proposal.review_status) ?? "Review status unavailable"}</p>
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
          <p className="daily-care-qwen__disclaimer">{caregiverSafeAssistantText(result.notice) || "Generating this response did not change the care record."}</p>
        </div>
      ) : null}

      <style jsx>{`
        .daily-care-qwen { width: 100%; max-width: 48rem; margin: 0 auto 1rem; padding: 1rem; border: 1px solid var(--theme-panel-border); border-radius: 16px; background: var(--theme-panel-bg); color: var(--theme-panel-fg); }
        .daily-care-qwen__eyebrow { margin: 0 0 .3rem; color: var(--theme-panel-muted); font-size: .78rem; font-weight: 750; letter-spacing: .08em; }
        .daily-care-qwen h2 { margin: 0 0 .4rem; font-size: 1.25rem; line-height: 1.3; }
        .daily-care-qwen__heading p:not(.daily-care-qwen__eyebrow) { margin: 0 0 1rem; color: var(--theme-panel-muted); line-height: 1.55; }
        .daily-care-qwen__form { display: grid; gap: .55rem; }
        .daily-care-qwen label { display: block; margin-top: .25rem; font-weight: 650; }
        .daily-care-qwen textarea, .daily-care-qwen input { width: 100%; min-width: 0; border: 1px solid var(--theme-panel-border); border-radius: 9px; padding: .7rem .8rem; background: var(--theme-field-bg); color: var(--theme-field-fg); font: inherit; font-size: 16px; line-height: 1.5; }
        .daily-care-qwen textarea { resize: vertical; }
        .daily-care-qwen button { min-height: 44px; padding: .65rem .9rem; border: 1px solid var(--theme-action-border); border-radius: 9px; background: var(--theme-action-bg); color: var(--theme-action-fg); font: inherit; font-weight: 700; cursor: pointer; }
        .daily-care-qwen button:disabled { opacity: .55; cursor: not-allowed; }
        .daily-care-qwen__error { color: var(--theme-error-fg); }
        .daily-care-qwen__feedback { padding: .7rem; border-radius: 8px; background: var(--theme-subtle-bg); }
        .daily-care-qwen__result { margin-top: 1.2rem; padding-top: 1rem; border-top: 1px solid var(--theme-panel-border); overflow-wrap: anywhere; }
        .daily-care-qwen__result h3 { margin: 0 0 .5rem; font-size: 1.05rem; }
        .daily-care-qwen__answer { white-space: pre-wrap; line-height: 1.65; }
        .daily-care-qwen__scope, .daily-care-qwen__disclaimer { color: var(--theme-panel-muted); font-size: .9rem; line-height: 1.55; }
        .daily-care-qwen__sources ul { list-style: none; margin: .5rem 0 1rem; padding: 0; display: grid; gap: .5rem; }
        .daily-care-qwen__sources li { display: grid; gap: .2rem; padding: .65rem; border: 1px solid var(--theme-panel-border); border-radius: 8px; }
        .daily-care-qwen__sources span, .daily-care-qwen__sources code { color: var(--theme-panel-muted); font-size: .82rem; overflow-wrap: anywhere; }
        .daily-care-qwen__proposal { margin: .7rem 0; padding: .8rem; border: 1px solid var(--theme-panel-border); border-radius: 10px; }
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
