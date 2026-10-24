/**
 * Raw Evidence Store — dual persistence layer.
 *
 * Priority: memory cache (primary for in-process) → Postgres (when DATABASE_URL
 * set) → file-based local queue (offline resilience, spec §20).
 *
 * The local queue is always written so that evidence survives process
 * termination and can be synced to Postgres when a network connection
 * becomes available.
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
import type { Pool } from "pg";
import { createPostgresPool } from "../telemetry-persistence/postgres-store";
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
  const readable = validated.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 32) || "caregiver";
  const identityHash = createHash("sha256").update(validated).digest("hex").slice(0, 24);
  return join(process.cwd(), ".data", "raw-evidence-queue", `${readable}_${identityHash}`);
}

function queueFile(evidence: RawEvidence): string {
  return join(dataDir(evidence.caregiver_id), `${evidence.id}.json`);
}

export class RawEvidenceStore {
  private readonly memory = new Map<string, RawEvidence>();
  private readonly index = new Map<string, string[]>();
  private pool: Pool | null;
  private readonly now: () => Date;
  private readonly syncQueue: RawEvidence[] = [];

  constructor(options: { pool?: Pool | null; opts?: RawEvidenceStoreOptions }) {
    this.pool = options.pool ?? null;
    this.now = options.opts?.now ?? (() => new Date());
  }

  private async resolvePool(): Promise<Pool | null> {
    if (this.pool) return this.pool;
    if (!process.env.DATABASE_URL?.trim()) return null;
    this.pool = await createPostgresPool();
    return this.pool;
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
      captured_at: input.captured_at ?? nowISO({}),
      urgency_risk_level: urgency.risk_level as UrgencyRiskLevel,
      urgency_signals: [...urgency.critical_signals, ...urgency.high_signals],
      metadata: input.metadata ?? {},
    };

    this.memory.set(evidence.id, evidence);
    const ids = this.index.get(evidence.caregiver_id) ?? [];
    ids.push(evidence.id);
    this.index.set(evidence.caregiver_id, ids);

    let filePersisted = false;
    if (typeof writeFileSync === "function") {
      try {
        const dir = dataDir(evidence.caregiver_id);
        mkdirSync(dir, { recursive: true });
        writeFileSync(queueFile(evidence), JSON.stringify(evidence, null, 2), "utf8");
        filePersisted = true;
      } catch {
        // The caller receives memory_only unless PostgreSQL confirms the write.
      }
    }

    let serverPersisted = false;
    let persistence_error: string | undefined;
    let activePool: Pool | null = null;
    try {
      activePool = await this.resolvePool();
    } catch (error) {
      persistence_error = "PostgreSQL storage could not be confirmed.";
    }

    if (activePool) {
      try {
        await activePool.query(
          `INSERT INTO raw_evidence (
             id, caregiver_id, person_id, input_type, content, content_hash,
             ocr_confidence, document_id, document_name, captured_at,
             urgency_risk_level, urgency_signals, metadata
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT (id) DO NOTHING`,
          [
            evidence.id,
            evidence.caregiver_id,
            evidence.person_id,
            evidence.input_type,
            evidence.content,
            evidence.content_hash,
            evidence.ocr_confidence,
            evidence.document_id,
            evidence.document_name,
            evidence.captured_at,
            evidence.urgency_risk_level,
            evidence.urgency_signals,
            evidence.metadata,
          ],
        );
        serverPersisted = true;
        const queuedIndex = this.syncQueue.findIndex((queued) => queued.id === evidence.id);
        if (queuedIndex >= 0) this.syncQueue.splice(queuedIndex, 1);
        try {
          rmSync(queueFile(evidence), { force: true });
        } catch {
          // The database is confirmed; a stale local queue file is harmless because inserts are idempotent.
        }
      } catch (error) {
        persistence_error = "PostgreSQL storage could not be confirmed.";
        if (!this.syncQueue.some((queued) => queued.id === evidence.id)) this.syncQueue.push(evidence);
      }
    }

    const persistence_status = serverPersisted
      ? "server_persisted"
      : filePersisted
        ? "local_queued"
        : "memory_only";

    return {
      evidence,
      persisted: persistence_status !== "memory_only",
      persistence_status,
      ...(persistence_error ? { persistence_error } : {}),
    };
  }

  getById(caregiverId: string, id: string): RawEvidence | undefined {
    const scopedCaregiverId = requireCaregiverId(caregiverId);
    const cached = this.memory.get(id);
    if (cached) return cached.caregiver_id === scopedCaregiverId ? cached : undefined;

    try {
      const fullPath = join(dataDir(scopedCaregiverId), `${id}.json`);
      if (!existsSync(fullPath)) return undefined;
      const data = JSON.parse(readFileSync(fullPath, "utf8")) as RawEvidence;
      if (data.id !== id || data.caregiver_id !== scopedCaregiverId) return undefined;
      this.memory.set(data.id, data);
      return data;
    } catch {
      return undefined;
    }
  }

  listForCaregiver(caregiverId: string): RawEvidence[] {
    caregiverId = requireCaregiverId(caregiverId);
    const ids = this.index.get(caregiverId) ?? [];
    const items = ids
      .map((id) => this.memory.get(id))
      .filter((r): r is RawEvidence => r !== undefined && r.caregiver_id === caregiverId);

    if (items.length === 0) {
      // Try loading from file queue
      try {
        const dir = dataDir(caregiverId);
        if (existsSync(dir)) {
          const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
          for (const file of files) {
            const data = JSON.parse(readFileSync(join(dir, file), "utf8")) as RawEvidence;
            if (data.caregiver_id !== caregiverId) continue;
            this.memory.set(data.id, data);
            items.push(data);
          }
        }
      } catch {
        // ignore
      }
    }

    return items.sort((a, b) => (a.captured_at < b.captured_at ? 1 : -1));
  }

  /** Retry both in-memory failures and files left by a prior process. */
  async syncToPostgres(): Promise<{ synced: number; remaining: number }> {
    const pool = await this.resolvePool();
    if (!pool) return { synced: 0, remaining: this.syncQueue.length };

    const queuedById = new Map<string, RawEvidence>();
    for (const evidence of this.syncQueue) queuedById.set(evidence.id, evidence);

    const baseDir = join(process.cwd(), ".data", "raw-evidence-queue");
    if (existsSync(baseDir)) {
      for (const caregiverDir of readdirSync(baseDir)) {
        const fullDir = join(baseDir, caregiverDir);
        for (const file of readdirSync(fullDir).filter((name) => name.endsWith(".json"))) {
          const raw = readFileSync(join(fullDir, file), "utf8");
          const evidence = JSON.parse(raw) as RawEvidence;
          requireCaregiverId(evidence.caregiver_id);
          if (typeof evidence.id !== "string" || typeof evidence.content !== "string") {
            throw new Error("A raw-evidence recovery queue entry is malformed; it was not discarded.");
          }
          queuedById.set(evidence.id, evidence);
        }
      }
    }

    const failed: RawEvidence[] = [];
    let synced = 0;
    for (const evidence of queuedById.values()) {
      try {
        await pool.query(
          `INSERT INTO raw_evidence (
             id, caregiver_id, person_id, input_type, content, content_hash,
             ocr_confidence, document_id, document_name, captured_at,
             urgency_risk_level, urgency_signals, metadata
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT (id) DO NOTHING`,
          [
            evidence.id,
            evidence.caregiver_id,
            evidence.person_id,
            evidence.input_type,
            evidence.content,
            evidence.content_hash,
            evidence.ocr_confidence,
            evidence.document_id,
            evidence.document_name,
            evidence.captured_at,
            evidence.urgency_risk_level,
            evidence.urgency_signals,
            evidence.metadata,
          ],
        );
        synced++;
        try {
          rmSync(queueFile(evidence), { force: true });
        } catch {
          // Leave the file for a later idempotent retry if cleanup is unavailable.
        }
      } catch {
        failed.push(evidence);
      }
    }

    this.syncQueue.length = 0;
    this.syncQueue.push(...failed);
    return { synced, remaining: failed.length };
  }

  reset(): void {
    this.memory.clear();
    this.index.clear();
    this.syncQueue.length = 0;
  }
}

let globalStore: RawEvidenceStore | null = null;

export function getRawEvidenceStore(): RawEvidenceStore {
  if (!globalStore) {
    globalStore = new RawEvidenceStore({ pool: null });
  }
  return globalStore;
}

export function setRawEvidenceStore(store: RawEvidenceStore): void {
  globalStore = store;
}

export function resetRawEvidenceStore(): void {
  if (globalStore) {
    globalStore.reset();
  }
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
