/**
 * In-memory share-target intake — evidence only; same pipeline after claim.
 * Server route stores; workspace claims into AddSituationPanel.
 */

export type SharedIntakePayload = {
  id: string;
  title?: string;
  text?: string;
  url?: string;
  files: Array<{
    name: string;
    mimeType: string;
    /** base64 of file bytes for client rehydration */
    base64: string;
  }>;
  created_at: string;
  entry_method: "share";
};

const store = new Map<string, SharedIntakePayload>();
const TTL_MS = 15 * 60 * 1000;

function prune(): void {
  const now = Date.now();
  for (const [id, payload] of store) {
    if (now - Date.parse(payload.created_at) > TTL_MS) {
      store.delete(id);
    }
  }
}

export function putSharedIntake(
  payload: Omit<SharedIntakePayload, "id" | "created_at" | "entry_method">,
): SharedIntakePayload {
  prune();
  const id = `share_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const full: SharedIntakePayload = {
    ...payload,
    id,
    created_at: new Date().toISOString(),
    entry_method: "share",
  };
  store.set(id, full);
  return full;
}

export function claimSharedIntake(id: string): SharedIntakePayload | null {
  prune();
  const payload = store.get(id) ?? null;
  if (payload) store.delete(id);
  return payload;
}

export function peekSharedIntake(id: string): SharedIntakePayload | null {
  prune();
  return store.get(id) ?? null;
}
