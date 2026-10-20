# SolenOS Routine Moments Implementation

## Overview

This implementation provides a comprehensive Routine Moments system for SolenOS that allows tracking of recurring patterns of everyday care and daily functioning that become meaningful when they change over time.

The system enables SolenOS to recognize: _"This normally happens. Something about that pattern changed."_

## Design Principles

1. **Evidence-Based**: Baselines are only established from actual observations, not assumptions
2. **Longitudinal**: Tracks patterns over time, recognizing that routines can naturally change
3. **Privacy-Aware**: All data is stored securely and only accessible to authorized caregivers
4. **Non-Clinical**: Observes and reports patterns without making clinical interpretations
5. **Extensible**: Supports custom routine types beyond predefined categories
6. **Integrated**: Works with existing SolenOS systems like CareContext, Outcome Memory, etc.

## Data Model

The routine moments system consists of three core data structures:

### 1. Routine Moment Record (`RoutineMomentRecord`)
Represents a complete routine moment tracking record for a person and routine type.

### 2. Routine Moment Observation (`RoutineMomentObservation`)
Represents a specific observation of a routine moment occurrence or non-occurrence.

### 3. Routine Moment Change (`RoutineMomentChange`)
Represents a detected change in a routine moment pattern.

### 4. Routine Baseline (`RoutineBaseline`)
Represents the established understanding of what's "normal" for a routine moment.

## Key Features

### Baseline Establishment
- Baselines are established from actual observations using statistical analysis
- Requires sufficient evidence before being considered "established"
- Tracks frequency, timing, assistance levels, and participation patterns
- Includes confidence levels based on evidence quantity and consistency

### Change Detection
- Detects changes in frequency, timing, assistance level, participation, and consistency
- Distinguishes between temporary deviations and sustained changes
- Provides evidence-backed explanations for detected changes
- Marks changes as sustained only when they persist over time

### Observation Recording
- Supports recording occurrences, missed occurrences, and not observed states
- Captures contextual information, assistance levels, and participation levels
- Links to raw evidence and care events for provenance
- Supports custom metadata for extensibility

## Integration Points

The routine moments system integrates with other SolenOS components:

### CareContext
- Routine moment baselines and changes feed into CareContext
- Provides longitudinal understanding of care patterns
- Supports the "normal vs changed" assessment required for CareContext

### Outcome Memory
- Routine moment changes can be tracked as outcomes of interventions
- Enables answering: "Did the expected change in everyday routine actually occur?"

### Decision Memory
- Routine moment patterns provide context for past decisions
- Enables showing: "This decision was made in a context where this routine pattern had been documented."

### Two-Week Care Review
- Provides data for answering what changed, persisted, was temporary, and what's new
- Supports evidence-based review discussions

## Implementation Details

### Storage
- Uses Postgres for persistent storage
- Implements in-memory caching for performance
- Follows SolenOS's standard storage patterns

### API
- Provides RESTful API endpoints for creating and retrieving routine moments
- Supports filtering by person, routine type, and caregiver
- Includes proper error handling and validation

### Validation
- Includes comprehensive validation functions
- Ensures data integrity before persistence
- Provides meaningful error messages

## Usage Example

```typescript
import { createObservationFromInput, addObservationToRoutineMoment } from '@/lib/routine-moments/service';

// Create an observation
const observation = createObservationFromInput({
  person_id: 'person-001',
  routine_type: 'bathroom_toileting',
  observation_state: 'occurred',
  occurred_at: new Date().toISOString(),
  recorded_by: 'caregiver-001',
  assistance_level: 'supervised',
  context: 'Usual morning routine',
  metadata: {
    logged_via: 'mobile_app',
    timestamp: new Date().toISOString()
  }
});

// Add to routine moment record
const updatedRecord = await addObservationToRoutineMoment(
  'person-001',
  'bathroom_toileting',
  observation
);

// Check baseline and changes
console.log(`Baseline established: ${updatedRecord.baseline.is_established}`);
console.log(`Changes detected: ${updatedRecord.changes.length}`);
```

## Configuration

No special configuration is required beyond standard SolenOS setup. The system uses:
- Standard Postgres connection via `DATABASE_URL` environment variable
- In-memory caching with optional Postgres persistence
- Standard SolenOS logging and error handling

## Testing

The implementation includes a test script (`test.ts`) that verifies:
- Baseline establishment from observations
- Change detection capabilities
- Handling of insufficient data
- Proper confidence level assignment

Run the test with: `ts-node src/lib/routine-moments/test.ts`

## Future Enhancements

1. **Advanced Analytics**: More sophisticated change detection algorithms
2. **Predictive Indicators**: Early warning signals for potential changes
3. **Caregiver Insights**: Automated summaries and visualizations
4. **Integration Alerts**: Notifications for significant changes requiring attention
5. **Export/Import**: Ability to backup and restore routine moment data
6. **Machine Learning**: Pattern recognition for more subtle changes

## Compliance

This implementation follows the SolenOS specification for Routine Moments including:
- Evidence-based baseline establishment
- Longitudinal pattern tracking
- Clear distinction between occurrence states
- Support for custom routine types
- Integration with CareContext and other systems
- Privacy-aware design
- Non-clinical observation reporting