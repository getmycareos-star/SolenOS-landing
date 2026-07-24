import { daysBetween } from "./compute-decay";

import type { CanonicalCareEvent } from "../situation-entry/types";

import type { ExpectedFollowUp } from "./types";



type FollowUpSchedule = {

  pattern: RegExp;

  checks: number[];

  label: string;

};



const SCHEDULES: FollowUpSchedule[] = [

  {

    pattern: /\b(medication|med|pill|prescription|dose)\b/i,

    checks: [2, 7, 30],

    label: "Medication follow-up",

  },

  {

    pattern: /\b(fell|fall|on\s+the\s+floor)\b/i,

    checks: [1, 7],

    label: "Fall follow-up",

  },

  {

    pattern: /\b(hospital|discharge|er\s+visit|emergency)\b/i,

    checks: [2, 14],

    label: "Hospital/discharge follow-up",

  },

  {

    pattern: /\b(sleep|night\s+wander|insomnia)\b/i,

    checks: [3, 7],

    label: "Sleep pattern follow-up",

  },

];



function hasConfirmationEvent(

  events: CanonicalCareEvent[],

  sourceId: string,

  afterDays: number,

  sourceTime: string,

): boolean {

  const dueMs = new Date(sourceTime).getTime() + afterDays * 24 * 60 * 60 * 1000;

  return events.some((e) => {

    if (e.id === sourceId) return false;

    if (e.status === "invalidated" || e.status === "superseded") return false;

    const ingested = new Date(e.ingestion_time).getTime();

    if (ingested < dueMs) return false;

    return (

      /\b(confirm|update|check|going\s+well|no\s+change|improved|worse|resolved)\b/i.test(

        e.raw_input,

      ) || e.extracted_type === "follow_up"

    );

  });

}



export function deriveExpectedFollowUps(

  events: CanonicalCareEvent[],

  asOf: string,

): ExpectedFollowUp[] {

  const followUps: ExpectedFollowUp[] = [];

  const active = events.filter((e) => e.status !== "invalidated" && e.status !== "superseded");



  for (const event of active) {

    const text = `${event.raw_input} ${event.attributes.source_situation_text ?? ""}`;

    for (const schedule of SCHEDULES) {

      if (!schedule.pattern.test(text)) continue;

      for (const checkDays of schedule.checks) {

        const dueAt = new Date(

          new Date(event.ingestion_time).getTime() + checkDays * 24 * 60 * 60 * 1000,

        ).toISOString();

        const confirmed = hasConfirmationEvent(active, event.id, checkDays, event.ingestion_time);

        const overdueDays = confirmed

          ? null

          : daysBetween(dueAt, asOf) > 0

            ? Math.round(daysBetween(dueAt, asOf) * 10) / 10

            : null;



        followUps.push({

          source_event_id: event.id,

          label: `${schedule.label} (${checkDays}d)`,

          check_after_days: checkDays,

          due_at: dueAt,

          confirmed,

          overdue_days: overdueDays,

        });

      }

    }

  }



  return followUps;

}


