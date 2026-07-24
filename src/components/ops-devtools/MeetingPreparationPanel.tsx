"use client";

import { useCallback, useEffect, useState } from "react";

import {
  MEETING_TYPE_LABELS,
  type CaregivingMeeting,
  type PreparationPack,
} from "@/lib/meeting-preparation";

type Props = {
  className?: string;
};

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function PreparationPackView({ pack }: { pack: PreparationPack }) {
  return (
    <div className="prep-pack">
      {pack.what_changed.length > 0 && (
        <section>
          <h4>What has changed</h4>
          <ul>
            {pack.what_changed.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      {pack.timeline_since_last_meeting.length > 0 && (
        <section>
          <h4>Timeline since last meeting</h4>
          <ul>
            {pack.timeline_since_last_meeting.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      {pack.outstanding_followups.length > 0 && (
        <section>
          <h4>Outstanding follow-ups</h4>
          <ul>
            {pack.outstanding_followups.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      {pack.unanswered_questions.length > 0 && (
        <section>
          <h4>Questions still unanswered</h4>
          <ul>
            {pack.unanswered_questions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      {pack.items_being_monitored.length > 0 && (
        <section>
          <h4>Items being monitored</h4>
          <ul>
            {pack.items_being_monitored.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      {pack.decisions_made.length > 0 && (
        <section>
          <h4>Decisions made since last meeting</h4>
          <ul>
            {pack.decisions_made.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      {pack.suggested_discussion_topics.length > 0 && (
        <section>
          <h4>Suggested discussion topics</h4>
          <ul>
            {pack.suggested_discussion_topics.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function MeetingPreparationPanel({ className }: Props) {
  const [meetings, setMeetings] = useState<CaregivingMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [datetime, setDatetime] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/meetings?trigger=1");
      const data = (await res.json()) as { meetings?: CaregivingMeeting[] };
      setMeetings(data.meetings ?? []);
    } catch {
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !datetime) return;
    setCreating(true);
    try {
      await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), datetime: new Date(datetime).toISOString() }),
      });
      setTitle("");
      setDatetime("");
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function confirmProposed(meetingId: string) {
    await fetch("/api/meetings/prepare", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meeting_id: meetingId }),
    });
    await load();
  }

  const upcoming = meetings.filter(
    (m) => m.status === "scheduled" || m.status === "proposed_meeting",
  );

  return (
    <section
      className={`meeting-prep-panel${className ? ` ${className}` : ""}`}
      aria-label="Meeting preparation"
    >
      <h3 className="meeting-prep-title">Before your next conversation</h3>
      <p className="meeting-prep-note">
        solenos remembers your care journey — you should not have to reconstruct it before a meeting.
      </p>

      <form className="meeting-prep-create" onSubmit={(e) => void handleCreate(e)}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Neurology follow-up, insurance call, family meeting…"
          aria-label="Meeting title"
        />
        <input
          type="datetime-local"
          value={datetime}
          onChange={(e) => setDatetime(e.target.value)}
          aria-label="Meeting date and time"
        />
        <button type="submit" disabled={creating || !title.trim() || !datetime}>
          Schedule
        </button>
      </form>

      {loading && <p className="meeting-prep-muted">Loading…</p>}

      {!loading && upcoming.length === 0 && (
        <p className="meeting-prep-muted">
          Schedule a meeting to receive a preparation pack from your care journey.
        </p>
      )}

      <ul className="meeting-prep-list">
        {upcoming.map((meeting) => (
          <li key={meeting.id} className={`meeting-prep-item status-${meeting.status}`}>
            <header>
              <strong>{meeting.title}</strong>
              <span className="meeting-type">{MEETING_TYPE_LABELS[meeting.type]}</span>
            </header>
            <time dateTime={meeting.datetime}>{formatDateTime(meeting.datetime)}</time>

            {meeting.status === "proposed_meeting" && (
              <div className="meeting-proposed">
                <p>Suggested from a document — confirm to schedule.</p>
                <button type="button" onClick={() => void confirmProposed(meeting.id)}>
                  Confirm meeting
                </button>
              </div>
            )}

            {meeting.preparation_pack && (
              <PreparationPackView pack={meeting.preparation_pack} />
            )}

            {meeting.status === "scheduled" && !meeting.preparation_generated && (
              <p className="meeting-prep-muted">
                Preparation pack will generate within {meeting.preparation_window_hours} hours of
                the meeting.
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
