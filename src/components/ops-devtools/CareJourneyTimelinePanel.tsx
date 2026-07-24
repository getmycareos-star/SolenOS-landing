"use client";



import { useCallback, useEffect, useMemo, useState } from "react";



import { CATEGORY_LABELS, type CareJourneyTimelineEntry } from "@/lib/care-journey";

import {

  EVENT_TYPE_LABELS,

  type CareJourneyGraph,

  type JourneyRelationship,

} from "@/lib/care-journey-graph";



type Props = {

  className?: string;

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



function relationshipsForEvent(

  eventId: string,

  graph: CareJourneyGraph | null,

): JourneyRelationship[] {

  if (!graph) return [];

  return graph.relationships.filter(

    (r) => r.from_event_id === eventId || r.to_event_id === eventId,

  );

}



function relatedEventTitle(

  rel: JourneyRelationship,

  eventId: string,

  graph: CareJourneyGraph | null,

): string {

  const otherId = rel.from_event_id === eventId ? rel.to_event_id : rel.from_event_id;

  const other = graph?.events.find((e) => e.id === otherId);

  if (!other) return otherId;

  return other.title || EVENT_TYPE_LABELS[other.event_type];

}



export function CareJourneyTimelinePanel({ className }: Props) {

  const [timeline, setTimeline] = useState<CareJourneyTimelineEntry[]>([]);

  const [graph, setGraph] = useState<CareJourneyGraph | null>(null);

  const [query, setQuery] = useState("");

  const [loading, setLoading] = useState(true);



  const graphEventByDescription = useMemo(() => {

    const map = new Map<string, string>();

    if (!graph) return map;

    for (const event of graph.events) {

      map.set(event.description.trim().toLowerCase(), event.id);

    }

    return map;

  }, [graph]);



  const load = useCallback(async (searchQuery?: string) => {

    setLoading(true);

    try {

      const qs = searchQuery?.trim()

        ? `?q=${encodeURIComponent(searchQuery.trim())}`

        : "";

      const [timelineRes, graphRes] = await Promise.all([

        fetch(`/api/care-journey/timeline${qs}`),

        fetch("/api/care-journey/graph"),

      ]);

      const timelineData = (await timelineRes.json()) as {

        timeline?: CareJourneyTimelineEntry[];

        matches?: CareJourneyTimelineEntry[];

      };

      const graphData = (await graphRes.json()) as { graph?: CareJourneyGraph };

      setTimeline(timelineData.matches ?? timelineData.timeline ?? []);

      setGraph(graphData.graph ?? null);

    } catch {

      setTimeline([]);

      setGraph(null);

    } finally {

      setLoading(false);

    }

  }, []);



  useEffect(() => {

    void load();

  }, [load]);



  return (

    <section

      className={`care-journey-panel${className ? ` ${className}` : ""}`}

      aria-label="Care journey graph"

    >

      <h3 className="care-journey-title">Care journey</h3>

      <p className="care-journey-note">

        Events linked by cause, continuation, and change — not just chronology.

      </p>



      <form

        className="care-journey-search"

        onSubmit={(e) => {

          e.preventDefault();

          void load(query);

        }}

      >

        <input

          type="search"

          value={query}

          onChange={(e) => setQuery(e.target.value)}

          placeholder="Power of attorney, falls, medication changes, family meetings…"

          aria-label="Search care journey"

        />

        <button type="submit" disabled={loading}>

          Search

        </button>

      </form>



      {loading && <p className="care-journey-muted">Loading…</p>}



      {!loading && timeline.length === 0 && (

        <p className="care-journey-muted">

          Your care journey builds here — every event connected to what came before.

        </p>

      )}



      <ol className="care-journey-timeline">

        {timeline.map((entry) => {

          const graphEventId =

            graphEventByDescription.get(entry.description.trim().toLowerCase()) ?? null;

          const rels = graphEventId ? relationshipsForEvent(graphEventId, graph) : [];



          return (

            <li key={entry.event_id} className={`care-journey-entry cat-${entry.category}`}>

              <header>

                <time dateTime={entry.event_date}>{formatDate(entry.event_date)}</time>

                <span className={`care-journey-category cat-${entry.category}`}>

                  {CATEGORY_LABELS[entry.category]}

                </span>

              </header>

              <p className="care-journey-event-title">{entry.title}</p>

              <p className="care-journey-description">{entry.description}</p>



              {rels.length > 0 && (

                <ul className="care-journey-relationships" aria-label="Event relationships">

                  {rels.map((rel) => (

                    <li key={rel.id}>

                      <span className="rel-type">{rel.relationship_type.replace(/_/g, " ")}</span>

                      {" → "}

                      {graphEventId && relatedEventTitle(rel, graphEventId, graph)}

                      {rel.note && <span className="rel-note"> — {rel.note}</span>}

                    </li>

                  ))}

                </ul>

              )}



              {entry.attachments.length > 0 && (

                <p className="care-journey-meta">

                  Attachments: {entry.attachments.map((a) => a.name).join(", ")}

                </p>

              )}

            </li>

          );

        })}

      </ol>

    </section>

  );

}

