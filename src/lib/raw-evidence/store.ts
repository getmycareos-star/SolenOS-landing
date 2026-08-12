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
import { detectUrgencyLevel } from "../urgency-detection";
import type {
  RawEvidence,
  SaveRawEvidenceInput,
  RawEvidenceStoreOptions,
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
  const cleaned = caregiverId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "default";
  return join(process.cwd(), ".data", "raw-evidence-queue", cleaned);
}

function queueFile(evidence: RawEvidence): string {
  return join(dataDir(evidence.caregiver_id), `${evidence.id}.json`);
}

export class RawEvidenceStore {
  private readonly memory = new Map<string, RawEvidence>();
  private readonly index = new Map<string, string[]>();
  private readonly pool: Pool | null;
  private readonly now: () => Date;
  private readonly syncQueue: RawEvidence[] = [];

  constructor(options: { pool?: Pool | null; opts?: RawEvidenceStoreOptions }) {
    this.pool = options.pool ?? null;
    this.now = options.opts?.now ?? (() => new Date());
  }

  async save(input: SaveRawEvidenceInput): Promise<{ evidence: RawEvidence; persisted: boolean }> {
    const content = input.content.trim();
    if (content.length === 0) {
      throw new Error("raw evidence content must not be empty");
    }

    const urgency = detectUrgencyLevel(content);

    const evidence: RawEvidence = {
      id: input.id ?? createEvidenceId(),
      caregiver_id: input.caregiver_id,
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

    if (typeof writeFileSync === "function") {
      try {
        const dir = dataDir(evidence.caregiver_id);
        mkdirSync(dir, { recursive: true });
        writeFileSync(queueFile(evidence), JSON.stringify(evidence, null, 2), "utf8");
      } catch {
        // File failure is non-fatal — memory cache remains source of truth for this process
      }
    }

    let persisted = false;
    if (this.pool) {
      try {
        await this.pool.query(
          `INSERT INTO raw_evidence (
             id, caregiver_id, person_id, input_type, content, content_hash,
             ocr_confidence, document_id, document_name, captured_at,
             urgency_risk_level, urgency_signals, metadata
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
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
        persisted = true;
      } catch (err) {
        this.syncQueue.push(evidence);
      }
    }

    return { evidence, persisted: persisted || true };
  }

  getById(id: string): RawEvidence | undefined {
    const cached = this.memory.get(id);
    if (cached) return cached;

    try {
      for (const dir of readdirSync(join(process.cwd(), ".data", "raw-evidence-queue"))) {
        const fullPath = join(process.cwd(), ".data", "raw-evidence-queue", dir, `${id}.json`);
        if (existsSync(fullPath)) {
          const data = JSON.parse(readFileSync(fullPath, "utf8"));
          this.memory.set(data.id, data);
          return data;
        }
      }
    } catch {
      // ignore
    }
    return undefined;
  }

  listForCaregiver(caregiverId: string): RawEvidence[] {
    const ids = this.index.get(caregiverId) ?? [];
    const items = ids
      .map((id) => this.memory.get(id))
      .filter((r): r is RawEvidence => r !== undefined);

    if (items.length === 0) {
      // Try loading from file queue
      try {
        const dir = dataDir(caregiverId);
        if (existsSync(dir)) {
          const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
          for (const file of files) {
            const data = JSON.parse(readFileSync(join(dir, file), "utf8")) as RawEvidence;
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

  /** Retry queued items that failed to sync to Postgres. */
  async syncToPostgres(): Promise<{ synced: number; remaining: number }> {
    if (!this.pool) return { synced: 0, remaining: 0 };
    const failed: RawEvidence[] = [];
    let synced = 0;

    for (const evidence of this.syncQueue) {
      try {
        await this.pool.query(
          `INSERT INTO raw_evidence (
             id, caregiver_id, person_id, input_type, content, content_hash,
             ocr_confidence, document_id, document_name, captured_at,
             urgency_risk_level, urgency_signals, metadata
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
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
