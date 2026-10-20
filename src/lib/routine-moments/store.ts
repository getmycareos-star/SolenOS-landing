// src/lib/routine-moments/store.ts
import { RoutineMomentRecord, RoutineMomentObservation } from './types';
import { getJSON, postJSON, patchJSON } from '../../api/client';

/**
 * Abstract store for routine moments.
 */
export abstract class RoutineMomentStore {
  abstract listByPerson(personId: string, limit?: number, offset?: number): Promise<RoutineMomentRecord[]>;
  abstract listByPersonAndRoutine(personId: string, routineName: string, limit?: number, offset?: number): Promise<RoutineMomentRecord[]>;
  abstract create(observation: RoutineMomentObservation): Promise<RoutineMomentRecord>;
  abstract update(id: string, updates: Partial<RoutineMomentObservation>): Promise<RoutineMomentRecord>;
  abstract delete(id: string): Promise<void>;
}

/**
 * In-memory store for routine moments (for testing or offline use).
 */
export class InMemoryRoutineMomentStore extends RoutineMomentStore {
  private moments: Map<string, RoutineMomentRecord> = new Map();
  private versionMap: Map<string, number> = new Map();

  async listByPerson(personId: string, limit: number = 100, offset: number = 0): Promise<RoutineMomentRecord[]> {
    const moments = Array.from(this.moments.values())
      .filter(m => m.person_id === personId)
      .sort((a, b) => new Date(b.observed_at).getTime() - new Date(a.observed_at).getTime());
    return moments.slice(offset, offset + limit);
  }

  async listByPersonAndRoutine(personId: string, routineName: string, limit: number = 100, offset: number = 0): Promise<RoutineMomentRecord[]> {
    const moments = Array.from(this.moments.values())
      .filter(m => m.person_id === personId && m.routine_name === routineName)
      .sort((a, b) => new Date(b.observed_at).getTime() - new Date(a.observed_at).getTime());
    return moments.slice(offset, offset + limit);
  }

  async create(observation: RoutineMomentObservation): Promise<RoutineMomentRecord> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
     const moment: RoutineMomentRecord = {
       id,
       version: 1,
       person_id: observation.person_id,
       routine_name: observation.routine_name,
       observation_text: observation.observation_text,
       observation_data: observation.observation_data,
       observed_at: observation.observed_at,
       evidence_id: observation.evidence_id,
       care_event_id: observation.care_event_id,
       confidence: observation.confidence,
      status: 'active',
      created_at: now,
      updated_at: now,
      created_by_caregiver_id: '', // TODO: get from auth context
    };
    this.moments.set(id, moment);
    this.versionMap.set(id, 1);
    return moment;
  }

  async update(id: string, updates: Partial<RoutineMomentObservation>): Promise<RoutineMomentRecord> {
    const moment = this.moments.get(id);
    if (!moment) {
      throw new Error(`Routine moment not found: ${id}`);
    }
    const updated = { ...moment, ...updates, updated_at: new Date().toISOString() };
    this.moments.set(id, updated);
    this.versionMap.set(id, (this.versionMap.get(id) ?? 0) + 1);
    return updated;
  }

  async delete(id: string): Promise<void> {
    if (!this.moments.delete(id)) {
      throw new Error(`Routine moment not found: ${id}`);
    }
    this.versionMap.delete(id);
  }
}

/**
 * API-backed store for routine moments (communicates with the backend).
 */
export class ApiRoutineMomentStore extends RoutineMomentStore {
  private readonly basePath = '/routine-moments';

  async listByPerson(personId: string, limit: number = 100, offset: number = 0): Promise<RoutineMomentRecord[]> {
    const path = `${this.basePath}?person_id=${encodeURIComponent(personId)}&limit=${limit}&offset=${offset}`;
    const data = await getJSON(path);
    return data as RoutineMomentRecord[];
  }

  async listByPersonAndRoutine(personId: string, routineName: string, limit: number = 100, offset: number = 0): Promise<RoutineMomentRecord[]> {
    const path = `${this.basePath}?person_id=${encodeURIComponent(personId)}&routine_name=${encodeURIComponent(routineName)}&limit=${limit}&offset=${offset}`;
    const data = await getJSON(path);
    return data as RoutineMomentRecord[];
  }

   async create(observation: RoutineMomentObservation): Promise<RoutineMomentRecord> {
     // We need to get the person_id from context; for now, we assume it's in observation.
     // In practice, we'll get the person_id from the current user context.
     const body = {
       ...observation,
     };
     const data = await postJSON(this.basePath, body);
     return data as RoutineMomentRecord;
   }

  async update(id: string, updates: Partial<RoutineMomentObservation>): Promise<RoutineMomentRecord> {
    const path = `${this.basePath}/${id}`;
    const data = await patchJSON(path, updates);
    return data as RoutineMomentRecord;
  }

   async delete(id: string): Promise<void> {
     // The delete endpoint returns 204 No Content, so we don't expect JSON.
     // We'll use the API client for consistency.
     const path = `${this.basePath}/${id}`;
     await deleteJSON(path);
   }
}