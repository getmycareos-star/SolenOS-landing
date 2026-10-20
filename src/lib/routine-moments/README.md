# Routine Moments Module

This module implements the Routine Moments feature for SolenOS, providing an evidence-based, longitudinal, privacy-aware system for detecting routine pattern changes.

## Overview

The routine moments feature allows caregivers to log observations of routines (e.g., morning routine, medication routine) and detect changes in those routines over time. The system reuses canonical models (Evidence and CareEvent) and stores routine moments in a dedicated table linked to persons and optionally to evidence or care events.

## Key Features

- **Evidence-based**: Each routine moment can be linked to source evidence.
- **Longitudinal**: Tracks observations over time to establish baselines and detect changes.
- **Privacy-aware**: All data is tied to a person and access-controlled.
- **Change detection**: Detects changes in frequency, timing, assistance level, participation level, and consistency.
- **Baseline establishment**: Learns patterns from observations to establish what is "normal" for a person's routine.

## Module Structure

- `types.ts` - TypeScript interfaces for routine moments, observations, changes, and baselines.
- `store.ts` - Abstract store interface with in-memory and API-backed implementations.
- `service.ts` - Business logic for baseline establishment and change detection.
- `builder.ts` - Factory functions and validation helpers for creating and validating routine moment objects.
- `index.ts` - Public exports of the module.

## Usage

### Store

```typescript
import { ApiRoutineMomentStore } from './src/lib/routine-moments';

const store = new ApiRoutineMomentStore();

// List routine moments for a person
const moments = await store.listByPerson('person-uuid');

// Create a new routine moment observation
const observation = {
  routine_name: 'Morning Routine',
  observation_text: 'Took medication at 8:00 AM',
  observed_at: new Date().toISOString(),
  person_id: 'person-uuid',
  observation_data: { time: '08:00', assistance_level: 'independent' },
};
const moment = await store.create(observation);
```

### Service

```typescript
import { establishBaseline, detectChanges } from './src/lib/routine-moments/service';

// Establish a baseline from observations
const baseline = establishBaseline(moments);

// Detect changes in recent observations compared to the baseline
const changes = detectChanges(recentMoments, baseline);
```

### Builder

```typescript
import { createRoutineMomentObservation } from './src/lib/routine-moments/builder';

const observation = createRoutineMomentObservation({
  routine_name: 'Morning Routine',
  observation_text: 'Took medication at 8:00 AM',
  observed_at: new Date().toISOString(),
  person_id: 'person-uuid',
  observation_data: { time: '08:00', assistance_level: 'independent' },
});
```