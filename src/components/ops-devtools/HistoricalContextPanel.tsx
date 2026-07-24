"use client";

import type { HistoricalContextResult } from "@/lib/care-record";

type Props = {
  context: HistoricalContextResult | null;
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function HistoricalContextPanel({ context }: Props) {
  if (!context?.matches.length) return null;

  return (
    <section className="historical-context" aria-label="Related care history">
      <h3>From your care record</h3>
      <p className="historical-context-note">
        Evidence from past events — not a guess.
      </p>
      <ul>
        {context.matches.map((match) => (
          <li key={match.event_id}>
            <header>
              <strong>{match.event_type.replace(/_/g, " ")}</strong>
              <time dateTime={match.date}>{formatDate(match.date)}</time>
            </header>
            <p>{match.summary}</p>
            <p className="historical-context-relevance">{match.relevance_note}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
