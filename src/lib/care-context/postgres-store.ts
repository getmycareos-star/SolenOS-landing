export class MemoryCareContextStore implements CareContextStore {
  isEnabled(): boolean {
    return true;
  }

  async get(careRecipientId: string): Promise<CareContext | null> {
    return memory.get(careRecipientId) || null;
  }

  async set(careRecipientId: string, context: CareContext): Promise<void> {
    const withUpdatedAt = { ...context, updatedAt: new Date().toISOString() };
    memory.set(careRecipientId, withUpdatedAt);
    writeDurableJson(
      livingCareRecordDataDir("care-context", `${sanitizeDurableCareKey(careRecipientId)}.json`),
      withUpdatedAt
    );
  }

  async delete(careRecipientId: string): Promise<void> {
    memory.delete(careRecipientId);
    deleteDurableFile(
      livingCareRecordDataDir("care-context", `${sanitizeDurableCareKey(careRecipientId)}.json`)
    );
  }

  async clear(): Promise<void> {
    memory.clear();
    clearDurableDirectory(livingCareRecordDataDir("care-context"));
  }
}