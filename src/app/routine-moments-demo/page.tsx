import RoutineMomentLogger from '@/components/routine-moments/RoutineMomentLogger'
import '@/app/routine-moments-demo/page.css'

export default function RoutineMomentsDemoPage() {
  return (
    <div className="routine-moments-demo">
      <header className="demo-header">
        <h1>SolenOS Routine Moments Demo</h1>
        <p>
          This demo shows how to log routine moment observations that can be used to
          establish baselines and detect changes in daily care patterns over time.
        </p>
      </header>
      
      <main className="demo-content">
        <section className="demo-section">
          <h2>How Routine Moments Work</h2>
          <p>
            Routine Moments represent recurring patterns of everyday care and daily functioning
            that become meaningful when they change over time. The system allows SolenOS to
            recognize: "<em>This normally happens. Something about that pattern changed.</em>"
          </p>
          
          <div className="demo-examples">
            <h3>Examples of Routine Moments:</h3>
            <ul>
              <li>Bathroom/toileting routine</li>
              <li>Eating patterns</li>
              <li>Drinking habits</li>
              <li>Sleeping/waking cycles</li>
              <li>Mobility levels</li>
              <li>Morning and evening routines</li>
              <li>Bathing and dressing assistance needs</li>
              <li>Communication patterns</li>
              <li>Social interaction frequency</li>
              <li>Home environment changes</li>
              <li>Caregiver availability</li>
            </ul>
          </div>
        </section>
        
        <section className="demo-section">
          <h2>Log a Routine Moment Observation</h2>
          <p>
            Use the form below to log an observation of a routine moment. The system will:
          </p>
          <ul>
            <li>Store the observation as evidence</li>
            <li>Establish or update baselines for what's "normal"</li>
            <li>Detect changes in patterns over time</li>
            <li>Feed this information into CareContext for longitudinal understanding</li>
          </ul>
          <RoutineMomentLogger />
        </section>
        
        <section className="demo-section">
          <h2>Understanding the Results</h2>
          <div className="result-explanation">
            <h3>When you submit an observation:</h3>
            <ol>
              <li>
                <strong>Baseline Establishment:</strong> The system analyzes all observations
                for this person and routine type to establish what's "normal"
              </li>
              <li>
                <strong>Change Detection:</strong> The system compares recent observations
                against the established baseline to detect meaningful changes
              </li>
              <li>
                <strong>Confidence Levels:</strong> Each assessment includes a confidence
                level based on the quantity and consistency of evidence
              </li>
              <li>
                <strong>Longitudinal Tracking:</strong> All observations are preserved
                for future analysis and care planning
              </li>
            </ol>
          </div>
          
          <div className="important-notes">
            <h3>Important Notes:</h3>
            <ul>
              <li><em>Evidence-Based:</strong> Baselines are only established from actual observations, not assumptions</li>
              <li><em>Longitudinal Perspective:</strong> The system tracks patterns over time, recognizing that routines can naturally change</li>
              <li><em>Privacy-Aware:</strong> All data is stored securely and only accessible to authorized caregivers</li>
              <li><em>Non-Clinical:</strong> The system observes and reports patterns without making clinical interpretations</li>
            </ul>
          </div>
        </section>
      </main>
      
      <footer className="demo-footer">
        <p>
          Routine Moments are a core part of SolenOS's longitudinal care understanding system,
          working alongside Outcome Memory, Decision Memory, and Two-Week Care Review to
          provide a complete picture of care over time.
        </p>
      </footer>
    </div>
  )
}