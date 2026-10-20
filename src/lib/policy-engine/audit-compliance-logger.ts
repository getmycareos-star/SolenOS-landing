import type { PolicyAuditEntry } from "./types";

const auditLog: PolicyAuditEntry[] = [];

export function logPolicyAudit(entry: Omit<PolicyAuditEntry, "audit_id" | "timestamp">): PolicyAuditEntry {
  const record: PolicyAuditEntry = {
    ...entry,
    audit_id: `policy_audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
  };
  auditLog.push(record);
  return record;
}

export function getPolicyAuditLog(userId?: string): PolicyAuditEntry[] {
  if (!userId) return [...auditLog];
  return auditLog.filter((e) => e.user_id === userId);
}

export function resetPolicyAuditLog(): void {
  auditLog.length = 0;
}
