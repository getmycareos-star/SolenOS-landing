import { TASK_INTENT_PATTERNS } from "./contract-constants";
import type { ExtractedTask, ProcessTaskExtractionInput, TaskExtractionResult } from "./types";
import type { TimelineEvent } from "../care-timeline-engine/types";
import {
  TASK_EXTRACTION_DEFINING_PRINCIPLE,
  TASK_EXTRACTION_IDENTITY,
  TASK_EXTRACTION_RULES,
} from "./contract-constants";

function createTaskId(eventId: string, index: number): string {
  return `task_${eventId}_${index}`;
}

function inferDueDate(text: string): string | null {
  if (/\btomorrow\b/i.test(text)) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  if (/\bnext week\b/i.test(text)) {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }
  const dateMatch = text.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/);
  return dateMatch ? dateMatch[1]! : null;
}

function extractTasksFromEvent(event: TimelineEvent): ExtractedTask[] {
  const text = event.source.raw_text;
  const tasks: ExtractedTask[] = [];
  let idx = 0;

  for (const { pattern, kind } of TASK_INTENT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      tasks.push({
        id: createTaskId(event.id, idx++),
        description: match[0].trim().charAt(0).toUpperCase() + match[0].trim().slice(1),
        owner: null,
        due_date: inferDueDate(text),
        source_event: event.id,
        status: "open",
        kind,
      });
    }
  }

  if (event.type === "appointment" && tasks.length === 0) {
    tasks.push({
      id: createTaskId(event.id, 0),
      description: "Confirm or attend scheduled appointment",
      owner: null,
      due_date: inferDueDate(text),
      source_event: event.id,
      status: "open",
      kind: "appointment",
    });
  }

  if (event.type === "medication_started" && tasks.length === 0) {
    tasks.push({
      id: createTaskId(event.id, 0),
      description: `Confirm new medication regimen: ${event.abstract_label}`,
      owner: null,
      due_date: null,
      source_event: event.id,
      status: "open",
      kind: "medication_confirmation",
    });
  }

  return tasks;
}

export function processTaskExtraction(input: ProcessTaskExtractionInput): TaskExtractionResult {
  const events = [...input.timeline_events];
  const byId = new Map(events.map((e) => [e.id, e]));
  for (const e of input.events_created) {
    byId.set(e.id, e);
  }

  const allTasks: ExtractedTask[] = [];
  for (const event of byId.values()) {
    allTasks.push(...extractTasksFromEvent(event));
  }

  const deduped = [...new Map(allTasks.map((t) => [t.description.toLowerCase(), t])).values()];

  return {
    active: true,
    tasks: deduped,
    open_tasks: deduped.filter((t) => t.status === "open"),
    rules_upheld: [...TASK_EXTRACTION_RULES],
    defining_principle: TASK_EXTRACTION_DEFINING_PRINCIPLE,
  };
}

export { TASK_EXTRACTION_IDENTITY };
