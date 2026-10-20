import type { Conflict, ConflictRegistry, ConflictStatus } from "./types";

const registries = new Map<string, ConflictRegistry>();

export function createEmptyConflictRegistry(): ConflictRegistry {
  return {
    openConflicts: [],
    resolvedConflicts: [],
    ignoredConflicts: [],
  };
}

export function resetConflictRegistryStore(): void {
  registries.clear();
}

export function getConflictRegistry(scopeId: string): ConflictRegistry {
  const existing = registries.get(scopeId);
  if (existing) return cloneRegistry(existing);
  const empty = createEmptyConflictRegistry();
  registries.set(scopeId, empty);
  return cloneRegistry(empty);
}

export function setConflictRegistry(
  scopeId: string,
  registry: ConflictRegistry,
): ConflictRegistry {
  const next = cloneRegistry(registry);
  registries.set(scopeId, next);
  return cloneRegistry(next);
}

function cloneRegistry(r: ConflictRegistry): ConflictRegistry {
  return {
    openConflicts: r.openConflicts.map((c) => ({ ...c })),
    resolvedConflicts: r.resolvedConflicts.map((c) => ({ ...c })),
    ignoredConflicts: r.ignoredConflicts.map((c) => ({ ...c })),
  };
}

function conflictKey(c: Pick<Conflict, "type" | "statementA" | "statementB">): string {
  const a = c.statementA.trim().toLowerCase();
  const b = c.statementB.trim().toLowerCase();
  const [left, right] = a < b ? [a, b] : [b, a];
  return `${c.type}|${left}|${right}`;
}

/** Upsert into open set; skip duplicates already open/resolved/ignored. */
export function registerConflicts(
  registry: ConflictRegistry,
  incoming: readonly Conflict[],
): ConflictRegistry {
  const known = new Set<string>();
  for (const c of [
    ...registry.openConflicts,
    ...registry.resolvedConflicts,
    ...registry.ignoredConflicts,
  ]) {
    known.add(conflictKey(c));
  }

  const open = [...registry.openConflicts];
  for (const c of incoming) {
    if (c.status !== "open") continue;
    const key = conflictKey(c);
    if (known.has(key)) continue;
    known.add(key);
    open.push({ ...c });
  }

  return {
    openConflicts: open,
    resolvedConflicts: [...registry.resolvedConflicts],
    ignoredConflicts: [...registry.ignoredConflicts],
  };
}

export function transitionConflictStatus(
  registry: ConflictRegistry,
  conflictId: string,
  status: ConflictStatus,
  options?: { resolutionNote?: string; nowIso?: string },
): ConflictRegistry {
  const nowIso = options?.nowIso ?? new Date().toISOString();
  const fromOpen = registry.openConflicts.find((c) => c.id === conflictId);
  const fromResolved = registry.resolvedConflicts.find((c) => c.id === conflictId);
  const fromIgnored = registry.ignoredConflicts.find((c) => c.id === conflictId);
  const found = fromOpen ?? fromResolved ?? fromIgnored;
  if (!found) return cloneRegistry(registry);

  const updated: Conflict = {
    ...found,
    status,
    resolvedAt: status === "resolved" ? nowIso : found.resolvedAt,
    resolutionNote: options?.resolutionNote ?? found.resolutionNote,
  };

  const without = (list: Conflict[]) => list.filter((c) => c.id !== conflictId);

  return {
    openConflicts:
      status === "open" ? [...without(registry.openConflicts), updated] : without(registry.openConflicts),
    resolvedConflicts:
      status === "resolved"
        ? [...without(registry.resolvedConflicts), updated]
        : without(registry.resolvedConflicts),
    ignoredConflicts:
      status === "ignored"
        ? [...without(registry.ignoredConflicts), updated]
        : without(registry.ignoredConflicts),
  };
}

export function listOpenConflicts(registry: ConflictRegistry): readonly Conflict[] {
  return registry.openConflicts.filter((c) => c.status === "open");
}
