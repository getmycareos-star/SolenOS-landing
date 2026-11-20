/**
 * Legacy raw-capture recovery queue.
 *
 * This module is not a care-record database. It can hold a local recovery copy
 * and can only report server_persisted when an explicit writer confirms the
 * canonical SolenOS backend write with the same evidence ID.
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import { requireCaregiverId } from "../care-identity/durable-care-key";
import { detectUrgencyLevel } from "../urgency-detection";
import type {
  RawEvidence,
  SaveRawEvidenceInput,
  RawEvidenceStoreOptions,
  SaveRawEvidenceResult,
  RawEvidenceInputType,
  UrgencyRiskLevel,
} from "./types";

export type CanonicalEvidenceWriter = (
  evidence: RawEvidence,
) => Promise<{ evidence_id: string; persisted: true }>;

function nowISO(opts: RawEvidenceStoreOptions): string {
  return (opts.now ?? (() => new Date()))().toISOString();
}

function createEvidenceId(): string {
  return `ev_${Date.now().toString(36)}_${createHash("sha1").update(Math.random().toString()).digest("hex").slice(0, 8)}`;
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function dataDir(caregiverId: string): string {
  const validated = requireCaregiverId(caregiverId);
  const cleaned = validated.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  if (!cleaned) throw new Error("A valid caregiver identity is required for the raw-evidence queue.");
  return join(process.cwd(), ".data", "raw-evidence-queue", cleaned);
}

function queueFile(evidence: RawEvidence): string {
  return join(dataDir(evidence.caregiver_id), `${evidence.id}.json`);
}

function sameImmutableEvidence(left: RawEvidence, right: RawEvidence): boolean {
  return (
    left.id === right.id &&
    left.caregiver_id === right.caregiver_id &&
    left.person_id === right.person_id &&
    left.content_hash === right.content_hash
  );
}

export class RawEvidenceStore {
  private readonly memory = new Map<string, RawEvidence>();
  private readonly index = new Map<string, string[]>();
  private readonly now: () => Date;
  private readonly persistCanonical?: CanonicalEvidenceWriter;

  constructor(options: {
    opts?: RawEvidenceStoreOptions;
    persistCanonical?: CanonicalEvidenceWriter;
  } = {}) {
    this.now = options.opts?.now ?? (() => new Date());
    this.persistCanonical = options.persistCanonical;
  }

  private assertNoIdentityCollision(evidence: RawEvidence): void {
    const cached = this.memory.get(evidence.id);
    if (cached && !sameImmutableEvidence(cached, evidence)) {
      throw new Error("Raw evidence ID already exists with different content or ownership.");
    }
    try {
      const path = queueFile(evidence);
      if (existsSync(path)) {
        const existing = JSON.parse(readFileSync(path, "utf8")) as RawEvidence;
        if (!sameImmutableEvidence(existing, evidence)) {
          throw new Error("Raw evidence ID already exists with different content or ownership.");
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("different content or ownership")) throw error;
      // An unreadable queue file is not permission to overwrite it.
      if (existsSync(queueFile(evidence))) {
        throw new Error("An existing raw-evidence recovery entry could not be verified; it was not overwritten.");
      }
    }
  }

  async save(input: SaveRawEvidenceInput): Promise<SaveRawEvidenceResult> {
    const caregiverId = requireCaregiverId(input.caregiver_id);
    const content = input.content.trim();
    if (content.length === 0) {
      throw new Error("raw evidence content must not be empty");
    }

    const urgency = detectUrgencyLevel(content);
    const evidence: RawEvidence = {
      id: input.id ?? createEvidenceId(),
      caregiver_id: caregiverId,
      person_id: input.person_id ?? null,
      input_type: (input.input_type ?? "text") as RawEvidenceInputType,
      content,
      content_hash: hashContent(content),
      ocr_confidence: input.ocr_confidence ?? null,
      document_id: input.document_id ?? null,
      document_name: input.document_name ?? null,
      captured_at: input.captured_at ?? nowISO({ now: this.now }),
      urgency_risk_level: urgency.risk_level as UrgencyRiskLevel,
      urgency_signals: [...urgency.critical_signals, ...urgency.high_signals],
      metadata: input.metadata ?? {},
    };

    this.assertNoIdentityCollision(evidence);
    this.memory.set(evidence.id, evidence);
    const ids = this.index.get(evidence.caregiver_id) ?? [];
    if (!ids.includes(evidence.id)) ids.push(evidence.id);
    this.index.set(evidence.caregiver_id, ids);

    let filePersisted = false;
    try {
      const dir = dataDir(evidence.caregiver_id);
      mkdirSync(dir, { recursive: true });
      writeFileSync(queueFile(evidence), JSON.stringify(evidence, null, 2), "utf8");
      filePersisted = true;
    } catch {
      // Local filesystem state is never represented as canonical persistence.
    }

    let serverPersisted = false;
    let persistence_error: string | undefined;
    if (this.persistCanonical) {
      try {
        const result = await this.persistCanonical(evidence);
        if (result.persisted !== true || result.evidence_id !== evidence.id) {
          throw new Error("Canonical backend did not confirm the same evidence identifier.");
        }
        serverPersisted = true;
        try {
          rmSync(queueFile(evidence), { force: true });
        } catch {
          // A stale local copy is harmless after the canonical write is confirmed.
        }
      } catch {
        persistence_error = "Canonical backend persistence could not be confirmed.";
      }
    }

    const persistence_status = serverPersisted
      ? "server_persisted"
      : filePersisted
        ? "local_queued"
        : "memory_only";

    return {
      evidence,
      // A local queue is recoverable input, not a saved care-record entry.
      persisted: serverPersisted,
      persistence_status,
      ...(persistence_error ? { persistence_error } : {}),
    };
  }

  getById(id: string): RawEvidence | undefined {
    const cached = this.memory.get(id);
    if (cached) return cached;
    try {
      const baseDir = join(process.cwd(), ".data", "raw-evidence-queue");
      for (const dir of readdirSync(baseDir)) {
        const fullPath = join(baseDir, dir, `${id}.json`);
        if (existsSync(fullPath)) {
          const data = JSON.parse(readFileSync(fullPath, "utf8")) as RawEvidence;
          this.memory.set(data.id, data);
          return data;
        }
      }
    } catch {
      // Missing or unavailable local queue is not a canonical read.
    }
    return undefined;
  }

  listForCaregiver(caregiverId: string): RawEvidence[] {
    const validated = requireCaregiverId(caregiverId);
    const ids = this.index.get(validated) ?? [];
    const items = ids
      .map((id) => this.memory.get(id))
      .filter((row): row is RawEvidence => row !== undefined);

    try {
      const dir = dataDir(validated);
      if (existsSync(dir)) {
        const known = new Set(items.map((item) => item.id));
        for (const file of readdirSync(dir).filter((name) => name.endsWith(".json"))) {
          const data = JSON.parse(readFileSync(join(dir, file), "utf8")) as RawEvidence;
          if (data.caregiver_id !== validated) continue;
          this.memory.set(data.id, data);
          if (!known.has(data.id)) items.push(data);
        }
      }
    } catch {
      // Local queue reads are best-effort and never substitute for backend history.
    }

    return items.sort((a, b) => (a.captured_at < b.captured_at ? 1 : -1));
  }

  /** Synchronize only through an explicitly injected canonical backend writer. */
  async syncToCanonicalBackend(): Promise<{ synced: number; remaining: number }> {
    if (!this.persistCanonical) {
      return { synced: 0, remaining: this.listAllQueued().length };
    }

    let synced = 0;
    const queued = this.listAllQueued();
    for (const evidence of queued) {
      try {
        const result = await this.persistCanonical(evidence);
        if (result.persisted !== true || result.evidence_id !== evidence.id) {
          throw new Error("Canonical backend did not confirm the same evidence identifier.");
        }
        synced += 1;
        try {
          rmSync(queueFile(evidence), { force: true });
        } catch {
          // Leave the stale local copy for an idempotent later cleanup.
        }
      } catch {
        // Keep the queue item for a later retry with the same stable evidence ID.
      }
    }
    return { synced, remaining: this.listAllQueued().length };
  }

  private listAllQueued(): RawEvidence[] {
    const baseDir = join(process.cwd(), ".data", "raw-evidence-queue");
    const queued = new Map<string, RawEvidence>();
    try {
      if (!existsSync(baseDir)) return [];
      for (const caregiverDir of readdirSync(baseDir)) {
        const fullDir = join(baseDir, caregiverDir);
        for (const file of readdirSync(fullDir).filter((name) => name.endsWith(".json"))) {
          const evidence = JSON.parse(readFileSync(join(fullDir, file), "utf8")) as RawEvidence;
          requireCaregiverId(evidence.caregiver_id);
          if (typeof evidence.id !== "string" || typeof evidence.content !== "string") {
            throw new Error("A raw-evidence recovery queue entry is malformed; it was not discarded.");
          }
          queued.set(evidence.id, evidence);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("malformed")) throw error;
    }
    return [...queued.values()];
  }

  reset(): void {
    this.memory.clear();
    this.index.clear();
  }
}

let globalStore: RawEvidenceStore | null = null;

export function getRawEvidenceStore(): RawEvidenceStore {
  if (!globalStore) globalStore = new RawEvidenceStore();
  return globalStore;
}

export function setRawEvidenceStore(store: RawEvidenceStore): void {
  globalStore = store;
}

export function resetRawEvidenceStore(): void {
  if (globalStore) globalStore.reset();
  try {
    const baseDir = join(process.cwd(), ".data", "raw-evidence-queue");
    if (existsSync(baseDir)) {
      for (const dir of readdirSync(baseDir)) {
        rmSync(join(baseDir, dir), { recursive: true, force: true });
      }
    }
  } catch {
    // ignore
  }
}
