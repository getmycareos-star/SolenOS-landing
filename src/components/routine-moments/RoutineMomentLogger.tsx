import { useState } from 'react'

/**
 * Routine Moment Logger - A simple component for logging routine moment observations.
 * 
 * This component demonstrates how caregivers can record routine moment observations
 * that will be used to establish baselines and detect changes over time.
 */
export default function RoutineMomentLogger() {
  const [personId, setPersonId] = useState('person-001')
  const [routineType, setRoutineType] = useState('bathroom_toileting')
  const [observationState, setObservationState] = useState('occurred')
  const [recordedBy, setRecordedBy] = useState('caregiver-001')
  const [context, setContext] = useState('')
  const [assistanceLevel, setAssistanceLevel] = useState('')
  const [participationLevel, setParticipationLevel] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastResult, setLastResult] = useState(null)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    
    try {
      const response = await fetch('/api/routine-moments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          person_id: personId,
          routine_type: routineType,
          observation_state: observationState,
          occurred_at: new Date().toISOString(),
          recorded_by: recordedBy,
          context: context || undefined,
          assistance_level: assistanceLevel || undefined,
          participation_level: participationLevel || undefined,
          duration_minutes: durationMinutes ? parseInt(durationMinutes, 10) : undefined,
          metadata: {
            logged_via: 'web_interface',
            timestamp: new Date().toISOString()
          }
        }),
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      setLastResult(result)
    } catch (err) {
      setError(err.message || 'Unknown error')
      console.error('Error submitting routine moment observation:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="routine-moment-logger">
      <h2>Log Routine Moment Observation</h2>
      <form onSubmit={handleSubmit} className="routine-moment-form">
        <div className="form-group">
          <label htmlFor="personId">Person ID:</label>
          <input
            type="text"
            id="personId"
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="routineType">Routine Type:</label>
          <select
            id="routineType"
            value={routineType}
            onChange={(e) => setRoutineType(e.target.value)}
            required
          >
            <option value="">Select a routine type</option>
            <option value="bathroom_toileting">Bathroom/Toileting</option>
            <option value="eating">Eating</option>
            <option value="drinking">Drinking</option>
            <option value="sleeping">Sleeping</option>
            <option value="waking">Waking</option>
            <option value="mobility">Mobility</option>
            <option value="morning_routine">Morning Routine</option>
            <option value="evening_routine">Evening Routine</option>
            <option value="bathing">Bathing</option>
            <option value="dressing">Dressing</option>
            <option value="feeding">Feeding</option>
            <option value="exercise_physical_therapy">Exercise/Physical Therapy</option>
            <option value="communication">Communication</option>
            <option value="social_interaction">Social Interaction</option>
            <option value="home_environment">Home Environment</option>
            <option value="caregiver_availability">Caregiver Availability</option>
            <option value="custom">Custom Routine</option>
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="observationState">Observation:</label>
          <select
            id="observationState"
            value={observationState}
            onChange={(e) => setObservationState(e.target.value)}
            required
          >
            <option value="occurred">Occurred</option>
            <option value="missed">Missed</option>
            <option value="not_observed">Not Observed</option>
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="recordedBy">Recorded By (Caregiver ID):</label>
          <input
            type="text"
            id="recordedBy"
            value={recordedBy}
            onChange={(e) => setRecordedBy(e.target.value)}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="context">Context (optional):</label>
          <textarea
            id="context"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows="3"
            placeholder="Additional context about the observation..."
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="assistanceLevel">Assistance Level (if applicable):</label>
          <select
            id="assistanceLevel"
            value={assistanceLevel}
            onChange={(e) => setAssistanceLevel(e.target.value)}
          >
            <option value="">Not applicable</option>
            <option value="independent">Independent</option>
            <option value="supervised">Supervised</option>
            <option value="partial_assistance">Partial Assistance</option>
            <option value="full_assistance">Full Assistance</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="participationLevel">Participation Level (if applicable):</label>
          <select
            id="participationLevel"
            value={participationLevel}
            onChange={(e) => setParticipationLevel(e.target.value)}
          >
            <option value="">Not applicable</option>
            <option value="independent_participation">Independent Participation</option>
            <option value="assisted_participation">Assisted Participation</option>
            <option value="non_participation">Non Participation</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="durationMinutes">Duration in minutes (if applicable):</label>
          <input
            type="number"
            id="durationMinutes"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            min="0"
            placeholder="e.g., 30 for 30 minutes"
          />
        </div>
        
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : 'Log Observation'}
        </button>
      </form>
      
      {error && (
        <div className="error-message">
          Error: {error}
        </div>
      )}
      
      {lastResult && (
        <div className="result-message">
          <h3>Observation Logged Successfully!</h3>
          <p>Routine Moment ID: {lastResult.id}</p>
          <p>
            <strong>Baseline Status:</strong> 
            {lastResult.baseline.is_established ? 'Established' : 'Not yet established'}
          </p>
          <p>
            <strong>Baseline Confidence:</strong> {lastResult.baseline.confidence}
          </p>
          <p>
            <strong>Total Observations:</strong> {lastResult.observations.length}
          </p>
          <p>
            <strong>Changes Detected:</strong> {lastResult.changes.length}
          </p>
        </div>
      )}
      
      {lastResult && lastResult.changes.length > 0 && (
        <div className="changes-notice">
          <h3>Changes Detected!</h3>
          <ul>
            {lastResult.changes.map((change, index) => (
              <li key={index}>
                <strong>{change.change_description}</strong> 
                ({change.confidence} confidence)
              </li>
            ))}
          </ul>
          <p className="note">
            Note: This indicates a change in the normal pattern of this routine moment.
          </p>
        </div>
      )}
    </div>
  )
}