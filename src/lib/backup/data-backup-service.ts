// Data backup service for SolenOS frontend persistence
// IMPORTANT: Backup execution is BLOCKED by default for safety

export const BACKUP_ENABLED = false;

export function createDataBackup(): Promise<any> {
  console.warn('Data backup execution is BLOCKED. Set BACKUP_ENABLED=true to allow execution.');
  return Promise.resolve(null);
}

export function restoreDataFromBackup(backupId: string): Promise<boolean> {
  console.warn('Data restoration execution is BLOCKED. Set BACKUP_ENABLED=true to allow execution.');
  return Promise.resolve(false);
}

export function listAvailableBackups(): Promise<any[]> {
  return Promise.resolve([]);
}

export function startAutomatedBackups(): NodeJS.Timeout | null {
  console.warn('Automated backups are BLOCKED. Set BACKUP_ENABLED=true to allow scheduling.');
  return null;
}

export function stopAutomatedBackups(timerId: NodeJS.Timeout | null): void {
  // No-op when blocked
}
