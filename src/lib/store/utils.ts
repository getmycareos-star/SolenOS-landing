export function checksum(payload: Record<string, unknown>): string {
  const str = JSON.stringify(payload, Object.keys(payload).sort());
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return `cs_${Math.abs(hash).toString(16)}`;
}

export function newId(prefix: string, sessionId: string, offset: number): string {
  return `${prefix}_${sessionId}_${offset}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function createAnonymousUserId(): string {
  return `usr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createSessionId(): string {
  return `ses_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}
