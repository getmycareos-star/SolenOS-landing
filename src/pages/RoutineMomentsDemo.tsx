import React from 'react'
import { RoutineMomentLogger } from '../components/routine-moments/RoutineMomentLogger'
import { getPersonId } from '../api/client'

export const RoutineMomentsDemo: React.FC = () => {
  if (!import.meta.env.DEV) {
    return (
      <main role="status" style={{ padding: '24px', color: 'var(--text-secondary)' }}>
        This development-only page is disabled in production.
      </main>
    )
  }

  const personId = getPersonId()
  if (!personId) {
    return (
      <main role="alert" style={{ padding: '24px', color: 'var(--text-secondary)' }}>
        Select an authorized care record before testing routine-moment capture.
      </main>
    )
  }

  return (
    <main className="routine-moments-demo">
      <header>
        <h1>Routine Moments — development test</h1>
        <p>This development-only screen uses the selected care record. It does not contain seeded caregiver stories.</p>
      </header>
      <RoutineMomentLogger personId={personId} />
    </main>
  )
}

export default RoutineMomentsDemo
