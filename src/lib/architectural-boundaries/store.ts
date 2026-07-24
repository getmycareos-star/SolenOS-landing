type BoundaryAudit = {
  violations_count: number;
  rules_satisfied: number;
  captured_at: string;
};

const audits: BoundaryAudit[] = [];

export function recordBoundaryAudit(entry: Omit<BoundaryAudit, "captured_at">): void {
  audits.push({ ...entry, captured_at: new Date().toISOString() });
  if (audits.length > 100) audits.shift();
}

export function resetArchitecturalBoundariesStore(): void {
  audits.length = 0;
}
