// src/components/routine-moments/RoutineMomentLogger.tsx
import React, { useState, useEffect } from 'react';
import { ApiRoutineMomentStore } from '../../lib/routine-moments/store';
import { createRoutineMomentObservation } from '../../lib/routine-moments/builder';
import { establishBaseline, detectChanges } from '../../lib/routine-moments/service';
import { RoutineMomentRecord } from '../../lib/routine-moments/types';

interface RoutineMomentLoggerProps {
  personId: string;
}

export const RoutineMomentLogger: React.FC<RoutineMomentLoggerProps> = ({ personId }) => {
  const store = new ApiRoutineMomentStore();
  const [observation, setObservation] = useState({
    routine_name: '',
    observation_text: '',
    observed_at: new Date().toISOString(),
    observation_data: {},
  });
  const [moments, setMoments] = useState<RoutineMomentRecord[]>([]);
  const [baseline, setBaseline] = useState<any>(null);
  const [changes, setChanges] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load moments for the person when the component mounts or personId changes
  useEffect(() => {
    loadMoments();
  }, [personId, store]);

  const loadMoments = async () => {
    setLoading(true);
    setError(null);
    try {
      const loadedMoments = await store.listByPerson(personId, 100);
      setMoments(loadedMoments);
      // If we have enough moments, establish a baseline
      if (loadedMoments.length >= 3) {
        const newBaseline = establishBaseline(loadedMoments);
        setBaseline(newBaseline);
        // Detect changes in the last 20% of observations
        const splitIndex = Math.floor(loadedMoments.length * 0.8);
        const recentMoments = loadedMoments.slice(splitIndex);
        const detectedChanges = detectChanges(recentMoments, newBaseline);
        setChanges(detectedChanges);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Failed to load routine moments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // Create the observation object
      const obs = createRoutineMomentObservation({
        routine_name: observation.routine_name,
        observation_text: observation.observation_text,
        observed_at: observation.observed_at,
        person_id: personId,
        observation_data: observation.observation_data,
      });
      // Store the observation via the API
      const moment = await store.create(obs);
      // Add to local state
      setMoments(prev => [moment, ...prev]);
      // Reset form
      setObservation({
        routine_name: '',
        observation_text: '',
        observed_at: new Date().toISOString(),
        observation_data: {},
      });
      // Reload moments to update baseline and changes
      await loadMoments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Failed to create routine moment:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="routine-moment-logger">
      <h2>Routine Moment Logger</h2>
      <form onSubmit={handleSubmit} className="observation-form">
        <div>
          <label htmlFor="routine_name">Routine Name:</label>
          <input
            id="routine_name"
            type="text"
            value={observation.routine_name}
            onChange={(e) => setObservation(prev => ({ ...prev, routine_name: e.target.value }))}
            required
          />
        </div>
        <div>
          <label htmlFor="observation_text">Observation:</label>
          <input
            id="observation_text"
            type="text"
            value={observation.observation_text}
            onChange={(e) => setObservation(prev => ({ ...prev, observation_text: e.target.value }))}
            required
          />
        </div>
        <div>
          <label htmlFor="observed_at">Observed At:</label>
          <input
            id="observed_at"
            type="datetime-local"
            value={observation.observed_at.slice(0, 16)} // Remove seconds for datetime-local
            onChange={(e) => {
              const value = e.target.value;
              // Convert to ISO string with seconds and timezone
              const date = new Date(value + ':00Z');
              setObservation(prev => ({ ...prev, observed_at: date.toISOString() }));
            }}
            required
          />
        </div>
        <div>
          <label htmlFor="assistance_level">Assistance Level:</label>
          <select
            id="assistance_level"
            onChange={(e) => {
              setObservation(prev => ({
                ...prev,
                observation_data: {
                  ...prev.observation_data,
                  assistance_level: e.target.value,
                },
              }));
            }}
          >
            <option value="">None</option>
            <option value="independent">Independent</option>
            <option value="assisted">Assisted</option>
            <option value="dependent">Dependent</option>
          </select>
        </div>
        <div>
          <label htmlFor="participation_level">Participation Level:</label>
          <select
            id="participation_level"
            onChange={(e) => {
              setObservation(prev => ({
                ...prev,
                observation_data: {
                  ...prev.observation_data,
                  participation_level: e.target.value,
                },
              }));
            }}
          >
            <option value="">None</option>
            <option value="full">Full</option>
            <option value="partial">Partial</option>
            <option value="minimal">Minimal</option>
          </select>
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Logging...' : 'Log Observation'}
        </button>
      </form>

      {error && <div className="error">{error}</div>}

      {/* Display baseline if available */}
      {baseline && (
        <div className="baseline">
          <h3>Baseline for {baseline.routine_name}</h3>
          <p>Frequency: {baseline.frequency_per_week.toFixed(1)} times per week</p>
          <p>Average Time of Day: {baseline.average_time_of_day}</p>
          <p>Assistance Level Distribution: {JSON.stringify(baseline.assistance_level_distribution)}</p>
          <p>Participation Level Distribution: {JSON.stringify(baseline.participation_level_distribution)}</p>
          <p>Consistency Score: {baseline.consistency_score.toFixed(2)}</p>
          <p>Sample Size: {baseline.sample_size}</p>
          <p>Last Updated: {new Date(baseline.last_updated).toLocaleString()}</p>
        </div>
      )}

      {/* Display changes if any */}
      {changes.length > 0 && (
        <div className="changes">
          <h3>Detected Changes</h3>
          <ul>
            {changes.map((change, index) => (
              <li key={index}>
                <strong>{change.field}</strong>: changed from {change.previous_value} to {change.current_value} (
                  {change.change_type}
                ) [Confidence: {change.confidence.toFixed(2)}]
                <br />
                Detected at: {new Date(change.detected_at).toLocaleString()}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Display recent moments */}
      <div className="recent-moments">
        <h3>Recent Moments</h3>
        {moments.length === 0 ? (
          <p>No moments logged yet.</p>
        ) : (
          <ul>
            {moments.slice(0, 10).map((moment) => (
              <li key={moment.id}>
                <strong>{moment.routine_name}</strong>: {moment.observation_text} (
                  {new Date(moment.observed_at).toLocaleString()}
                )
                {moment.observation_data && (
                  <span> - {JSON.stringify(moment.observation_data)}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};