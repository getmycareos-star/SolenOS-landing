/**
 * Open Loop Manager — track, resolve, reconnect, and archive open loops.
 *
 * Open loops are unresolved care threads that require follow-up:
 * unanswered questions, pending decisions, monitoring items, and
 * topics to revisit. This module ensures nothing is forgotten.
 *
 * Integration points:
 * - `processMemoryLayers()` in pipeline.ts surfaces unknowns → open loops
 * - `ingestActiveCareObservation()` detects reconnection when new input
 *   references a previously open loop
 * - `buildCareReasoning()` ← `reasonMemory()` identifies open loops
 */

import type {
  OpenLoop,
  OpenLoopCategory,
  OpenLoopStatus,
  TrackOpenLoopInput,
  ResolveOpenLoopInput,
  ReconnectOpenLoopInput,
  OpenLoopManagerResult,
} from "./types";
import {
  getOpenLoops,
  getOpenLoopById,
  saveOpenLoops,
  getOpenLoopsByCategory,
} from "./store";

let loopCounter = 0;

function nextLoopId(): string {
  loopCounter += 1;
  return `loop_${Date.now()}_${loopCounter}`;
}

/**
 * Track a new open loop.
 * Creates a loop entry and adds it to the open loops list.
 */
export function trackOpenLoop(input: TrackOpenLoopInput): OpenLoop {
  const now = new Date().toISOString();
  const loop: OpenLoop = {
    id: nextLoopId(),
    category: input.category,
    description: input.description,
    created_at: now,
    updated_at: now,
    status: "open",
    priority: input.priority ?? 1,
    caregiver_id: input.caregiver_id,
    care_recipient_id: input.care_recipient_id,
    source_event_id: input.source_event_id ?? null,
    resolved_by_event_id: null,
    resolution: null,
    tags: input.tags ?? [],
  };

  const existing = getOpenLoops(input.caregiver_id, input.care_recipient_id);
  existing.push(loop);
  saveOpenLoops(input.caregiver_id, input.care_recipient_id, existing);

  return loop;
}

/**
 * Track multiple open loops at once.
 */
export function trackOpenLoops(inputs: TrackOpenLoopInput[]): OpenLoop[] {
  return inputs.map(trackOpenLoop);
}

/**
 * Resolve an open loop.
 * Marks it as resolved with the resolution details.
 */
export function resolveOpenLoop(input: ResolveOpenLoopInput): OpenLoop | null {
  const loop = getOpenLoopById(input.loop_id);
  if (!loop) return null;
  if (loop.status === "archived") return null;

  loop.status = "resolved";
  loop.resolved_by_event_id = input.resolved_by_event_id;
  loop.resolution = input.resolution;
  loop.updated_at = new Date().toISOString();

  const existing = getOpenLoops(loop.caregiver_id, loop.care_recipient_id);
  const idx = existing.findIndex((l) => l.id === loop.id);
  if (idx >= 0) {
    existing[idx] = loop;
    saveOpenLoops(loop.caregiver_id, loop.care_recipient_id, existing);
  }

  return loop;
}

/**
 * Reconnect an open loop — re-open a previously resolved or archived loop
 * when new input indicates the issue is still relevant.
 */
export function reconnectOpenLoop(input: ReconnectOpenLoopInput): OpenLoop | null {
  const loop = getOpenLoopById(input.loop_id);
  if (!loop) return null;

  loop.status = "reconnected";
  loop.updated_at = new Date().toISOString();
  loop.source_event_id = input.source_event_id;
  loop.tags = [...new Set([...loop.tags, "reconnected"])];

  const existing = getOpenLoops(loop.caregiver_id, loop.care_recipient_id);
  const idx = existing.findIndex((l) => l.id === loop.id);
  if (idx >= 0) {
    existing[idx] = loop;
    saveOpenLoops(loop.caregiver_id, loop.care_recipient_id, existing);
  }

  return loop;
}

/**
 * Archive an open loop — moves it to historical state.
 * Unlike resolve, archive means the loop is no longer relevant.
 */
export function archiveOpenLoop(loopId: string): OpenLoop | null {
  const loop = getOpenLoopById(loopId);
  if (!loop) return null;

  loop.status = "archived";
  loop.updated_at = new Date().toISOString();

  const existing = getOpenLoops(loop.caregiver_id, loop.care_recipient_id);
  const idx = existing.findIndex((l) => l.id === loop.id);
  if (idx >= 0) {
    existing[idx] = loop;
    saveOpenLoops(loop.caregiver_id, loop.care_recipient_id, existing);
  }

  return loop;
}

/**
 * Detect reconnection — check if a new input's text references any
 * open loops. Returns the reconnected loops.
 */
export function detectReconnection(params: {
  caregiver_id: string;
  care_recipient_id: string;
  raw_text: string;
}): OpenLoop[] {
  const { caregiver_id, care_recipient_id, raw_text } = params;
  const openLoops = getOpenLoops(caregiver_id, care_recipient_id).filter(
    (l) => l.status === "open" || l.status === "reconnected",
  );

  const reconnected: OpenLoop[] = [];
  const lowerText = raw_text.toLowerCase();

  for (const loop of openLoops) {
    // Check if the raw text references the loop description
    const keywords = loop.description
      .toLowerCase()
      .split(/[^a-z0-9']+/)
      .filter((w) => w.length > 4);

    const matchCount = keywords.filter((kw) => lowerText.includes(kw)).length;
    const matchRatio = keywords.length > 0 ? matchCount / keywords.length : 0;

    if (matchRatio >= 0.3) {
      reconnected.push(loop);
    }
  }

  return reconnected;
}

/**
 * Get all open loops for a caregiver/recipient pair.
 */
export function getOpenLoopsFor(
  caregiverId: string,
  careRecipientId: string,
): OpenLoop[] {
  return getOpenLoops(caregiverId, careRecipientId);
}

/**
 * Get unresolved open loops (open + reconnected).
 */
export function getUnresolvedLoopsFor(
  caregiverId: string,
  careRecipientId: string,
): OpenLoop[] {
  return getOpenLoops(caregiverId, careRecipientId).filter(
    (l) => l.status === "open" || l.status === "reconnected",
  );
}

/**
 * Get open loops of a specific category.
 */
export function getLoopsByCategory(
  caregiverId: string,
  careRecipientId: string,
  category: OpenLoopCategory,
): OpenLoop[] {
  return getOpenLoopsByCategory(caregiverId, careRecipientId, category);
}

/**
 * Build the complete OpenLoopManagerResult for a caregiver/recipient pair.
 */
export function buildOpenLoopManagerResult(
  caregiverId: string,
  careRecipientId: string,
): OpenLoopManagerResult {
  const allLoops = getOpenLoops(caregiverId, careRecipientId);

  const openLoops = allLoops.filter((l) => l.status === "open");
  const resolvedLoops = allLoops.filter((l) => l.status === "resolved");
  const reconnectedLoops = allLoops.filter((l) => l.status === "reconnected");
  const archivedLoops = allLoops.filter((l) => l.status === "archived");

  return {
    active: allLoops.length > 0,
    open_loops: openLoops,
    resolved_loops: resolvedLoops,
    reconnected_loops: reconnectedLoops,
    archived_loops: archivedLoops,
    total_count: allLoops.length,
    open_count: openLoops.length + reconnectedLoops.length,
    resolved_count: resolvedLoops.length,
    reconnection_detected: reconnectedLoops.length > 0,
    reconnection_details:
      reconnectedLoops.length > 0
        ? `${reconnectedLoops.length} loop(s) reconnected this session`
        : null,
  };
}

export { resetOpenLoopStore } from "./store";
