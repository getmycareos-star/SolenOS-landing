import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getJSON } from '../api/client';

const HandoffReview: React.FC = () => {
  const { handoffId } = useParams<{ handoffId: string }>();
  const navigate = useNavigate();
  const [handoff, setHandoff] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHandoff = async () => {
      if (!handoffId) {
        navigate('/');
        return;
      }

      try {
        setLoading(true);
        const data = await getJSON('/continuity/handoff/' + handoffId);
        setHandoff(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load handoff');
        console.error('Error loading handoff:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHandoff();
  }, [handoffId, navigate]);

  if (loading) {
    return (
      <div className='page-loading'>
        <div className='loading-spinner'></div>
        <p>Loading handoff details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className='page-error'>
        <h2>Error Loading Handoff</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/')} className='btn btn-secondary'>
          Go Back
        </button>
      </div>
    );
  }

  if (!handoff) {
    return (
      <div className='page-error'>
        <h2>Handoff Not Found</h2>
        <p>The requested handoff could not be found.</p>
        <button onClick={() => navigate('/')} className='btn btn-secondary'>
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className='handoff-review-page'>
      <header className='page-header'>
        <h1>Care Responsibility Handoff Review</h1>
        <p className='handoff-meta'>
          Handoff ID: {handoff.id} &bull; 
          Created: {new Date(handoff.created_at).toLocaleString()}
        </p>
      </header>

      <section className='review-section'>
        <h2>What You Need to Know Right Now</h2>
        <div className='info-card'>
          {handoff.person_in_brief && (
            <>
              <h3>Current Situation</h3>
              <p>{handoff.person_in_brief}</p>
            </>
          )}
          {!handoff.person_in_brief && (
            <p>No current situation information available.</p>
          )}
        </div>
      </section>

      <section className='review-section'>
        <h2>Recent Changes</h2>
        {handoff.whats_changed && handoff.whats_changed.length > 0 ? (
          <>
            <h3>What Changed Recently</h3>
            <ul>
              {handoff.whats_changed.map((change: any, index: number) => (
                <li key={index}>
                  <strong>{change.statement || change.title || 'Update'}:</strong>
                  {change.at ? ' (' + new Date(change.at).toLocaleString() + ')' : ''}
                  {change.evidence_ids && change.evidence_ids.length > 0 && (
                    <span className='evidence-badge'>({change.evidence_ids.length} evidence)</span>
                  )}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>No recent changes detected.</p>
        )}
      </section>

      <section className='review-section'>
        <h2>What You Should Watch</h2>
        {handoff.open_threads && handoff.open_threads.length > 0 ? (
          <>
            <h3>Ongoing Observations</h3>
            <ul>
              {handoff.open_threads.map((thread: string, index: number) => (
                <li key={index}>{thread}</li>
              ))}
            </ul>
          </>
        ) : (
          <p>No ongoing observations requiring monitoring.</p>
        )}
        
        {handoff.first_24_hours && handoff.first_24_hours.length > 0 ? (
          <>
            <h3>First 24 Hours Guidance</h3>
            <ol>
              {handoff.first_24_hours.map((hour: string, index: number) => (
                <li key={index}>{hour}</li>
              ))}
            </ol>
          </>
        ) : (
          <p>No specific guidance for the first 24 hours.</p>
        )}
      </section>

      <section className='review-section'>
        <h2>What Happens Next</h2>
        {handoff.what_will_matter_next && handoff.what_will_matter_next.length > 0 ? (
          <>
            <h3>Upcoming Needs and Actions</h3>
            <ul>
              {handoff.what_will_matter_next.map((item: any, index: number) => (
                <li key={index}>
                  <strong>{item.statement || item.title || 'Upcoming item'}:</strong>
                  {item.evidence_ids && item.evidence_ids.length > 0 && (
                    <>
                    <br/>
                    <span className='evidence-badge'>({item.evidence_ids.length} supporting evidence)</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>No specific upcoming actions identified.</p>
        )}
        
        {handoff.gap_days !== null && handoff.gap_days > 0 && (
          <div className='info-card warning-card'>
            <h3>Important Note About Information Completeness</h3>
            <p>
              There has been a {handoff.gap_days}-day gap in recorded observations. 
              This means the recent entries may not show everything that has been happening.
            </p>
          </div>
        )}
      </section>

      <section className='review-section'>
        <h2>What Remains Uncertain</h2>
        {handoff.gaps && handoff.gaps.length > 0 ? (
          <>
            <h3>Uncertainties and Open Questions</h3>
            <ul>
              {handoff.gaps.map((gap: any, index: number) => (
                <li key={index}>
                  <strong>{gap.description || 'Uncertainty identified'}</strong>
                  {gap.risk_of_ignoring && (
                    <>
                    <br/>
                    <em>Risk:</em> {gap.risk_of_ignoring}
                    </>
                  )}
                  {gap.since && (
                    <>
                    <br/>
                    <span>Since: {new Date(gap.since).toLocaleString()}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>No significant uncertainties identified in the current record.</p>
        )}
      </section>

      {handoff.possible_context && (
        <section className='review-section context-section'>
          <h2>Additional Context</h2>
          <div className='info-card'>
            <p>{handoff.possible_context}</p>
            {handoff.confidence !== null && (
              <p className='confidence-level'>
                Confidence level: {Math.round(handoff.confidence * 100)}%
              </p>
            )}
          </div>
        </section>
      )}

      <footer className='page-footer'>
        <div className='footer-actions'>
          <button 
            onClick={() => navigate('/')} 
            className='btn btn-outline'
          >
            Return to Dashboard
          </button>
        </div>
      </footer>
    </div>
  );
};

export default HandoffReview;

