'use client';

import { useWorkspace } from '@/lib/workspace-context';
import { useState } from 'react';
import { 
  createMeeting, 
  generatePreparationPack, 
  listMeetingsForCaregiver,
  type CaregivingMeeting,
  type PreparationPack
} from '@/lib/meeting-preparation';

export default function AppointmentPreparationPage() {
  const { runtime, careKey, sessionId, caregiverId } = useWorkspace();
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [preparationPack, setPreparationPack] = useState<PreparationPack | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extract appointment timeline entries
  const appointmentEntries = runtime.timeline.entries.filter(
    (entry) => entry.type === 'appointment'
  );

  const handleGeneratePreparation = async (entry: any) => {
    setLoading(true);
    setError(null);
    try {
      // Find or create a meeting for this appointment entry
      const meetings = listMeetingsForCaregiver(caregiverId);
      let meeting = meetings.find((m) => m.title === entry.summary);
      
      if (!meeting) {
        // Create a new meeting
        meeting = createMeeting({
          title: entry.summary,
          type: 'medical', // assuming medical appointment
          datetime: entry.timestamp, // timeline entry timestamp
          caregiver_id: caregiverId, // using actual caregiver's person id
          case_id: null, // we don't have a case id in this context
          source: 'manual',
          linked_events: [], // we could link to the care event id if we had it
        });
      }

      // Generate preparation pack
      const pack = generatePreparationPack(meeting);
      setPreparationPack(pack);
      setSelectedAppointment(entry);
    } catch (err: any) {
      console.error('Failed to generate preparation pack:', err);
      setError(err.message || 'Failed to generate preparation pack');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='appointment-preparation'>
      <h1>Appointment Preparation</h1>
      <div className='appointments-list'>
        <h2>Upcoming Appointments</h2>
        {appointmentEntries.length > 0 ? (
          <ul>
            {appointmentEntries.map((entry) => (
              <li key={entry.id} onClick={() => handleGeneratePreparation(entry)} style={{ cursor: 'pointer', padding: '10px', borderBottom: '1px solid #eee' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <strong>{entry.summary}</strong>
                  </div>
                  <div style={{ fontSize: '0.8em', color: '#666' }}>
                    {new Date(entry.timestamp).toLocaleString()}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>No upcoming appointments found.</p>
        )}
      </div>
      {loading && <p>Generating preparation pack...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {selectedAppointment && preparationPack && (
        <div className='preparation-pack' style={{ marginTop: '30px' }}>
          <h2>Preparation Pack for: {selectedAppointment.summary}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
            <div>
              <h3>What Changed</h3>
              <ul style={{ listStyleType: 'none', padding: 0 }}>
                {preparationPack.what_changed.map((item: string, index: number) => (
                  <li key={index} style={{ padding: '5px 0', borderBottom: '1px solid #f0f0f0' }}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Timeline Since Last Meeting</h3>
              <ul style={{ listStyleType: 'none', padding: 0 }}>
                {preparationPack.timeline_since_last_meeting.map((item: string, index: number) => (
                  <li key={index} style={{ padding: '5px 0', borderBottom: '1px solid #f0f0f0' }}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Outstanding Followups</h3>
              <ul style={{ listStyleType: 'none', padding: 0 }}>
                {preparationPack.outstanding_followups.map((item: string, index: number) => (
                  <li key={index} style={{ padding: '5px 0', borderBottom: '1px solid #f0f0f0' }}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Unanswered Questions</h3>
              <ul style={{ listStyleType: 'none', padding: 0 }}>
                {preparationPack.unanswered_questions.map((item: string, index: number) => (
                  <li key={index} style={{ padding: '5px 0', borderBottom: '1px solid #f0f0f0' }}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Items Being Monitored</h3>
              <ul style={{ listStyleType: 'none', padding: 0 }}>
                {preparationPack.items_being_monitored.map((item: string, index: number) => (
                  <li key={index} style={{ padding: '5px 0', borderBottom: '1px solid #f0f0f0' }}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Decisions Made</h3>
              <ul style={{ listStyleType: 'none', padding: 0 }}>
                {preparationPack.decisions_made.map((item: string, index: number) => (
                  <li key={index} style={{ padding: '5px 0', borderBottom: '1px solid #f0f0f0' }}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Suggested Discussion Topics</h3>
              <ul style={{ listStyleType: 'none', padding: 0 }}>
                {preparationPack.suggested_discussion_topics.map((item: string, index: number) => (
                  <li key={index} style={{ padding: '5px 0', borderBottom: '1px solid #f0f0f0' }}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
'
