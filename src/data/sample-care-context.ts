import type { CareContext } from "../lib/care-context";

/** Rich sample context for architecture directive demos. */
export const SAMPLE_CARE_CONTEXT: CareContext = {
  identity: {
    patientName: "Robert Chen",
    contextLabel: "Family Care",
  },
  timeline: [
    {
      id: "evt_1",
      date: "2026-06-15",
      dateLabel: "2026-06-15 (Monday)",
      description: "Dad seemed stable, managing daily routines independently.",
      type: "observation",
      source: "note",
      recordedAt: "2026-06-15T10:00:00",
    },
    {
      id: "evt_2",
      date: "2026-07-01",
      dateLabel: "2026-07-01 (Wednesday)",
      description: "Missed evening medication once.",
      type: "medication",
      source: "note",
      recordedAt: "2026-07-01T20:00:00",
    },
    {
      id: "evt_3",
      date: "2026-07-05",
      dateLabel: "2026-07-05 (Sunday)",
      description: "Unsteady walking noticed in the hallway.",
      type: "observation",
      source: "note",
      recordedAt: "2026-07-05T14:00:00",
    },
    {
      id: "evt_4",
      date: "2026-07-08",
      dateLabel: "2026-07-08 (Wednesday)",
      description: "Wandering at night — found in the kitchen at 2am.",
      type: "observation",
      source: "note",
      recordedAt: "2026-07-08T06:00:00",
    },
    {
      id: "evt_5",
      date: "2026-07-10",
      dateLabel: "2026-07-10 (Friday)",
      description: "Second nighttime wandering incident this week.",
      type: "observation",
      source: "note",
      recordedAt: "2026-07-10T07:00:00",
    },
    {
      id: "evt_6",
      date: "2026-07-11",
      dateLabel: "2026-07-11 (Saturday)",
      description: "I'm exhausted. Not sleeping due to nighttime checks.",
      type: "observation",
      source: "note",
      recordedAt: "2026-07-11T08:00:00",
    },
    {
      id: "evt_7",
      date: "2026-07-12",
      dateLabel: "2026-07-12 (Sunday)",
      description: "Medication changed by doctor — new evening dose added.",
      type: "medication",
      source: "note",
      recordedAt: "2026-07-12T16:00:00",
    },
  ],
  recentChanges: [],
  uncertainties: [
    "Care level threshold cannot be determined without more nighttime observation data.",
    "Rate of cognitive change requires professional assessment.",
  ],
  prioritizedActions: [],
  updatedAt: "2026-07-13T09:00:00",
};

export const HIRE_HELP_QUESTION = "Should I hire professional help?";
