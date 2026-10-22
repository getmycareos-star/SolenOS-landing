import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('Phase 4 production data-integrity guardrails', () => {
  it('does not contain demo care-recipient IDs in active care views or the API client', () => {
    const paths = [
      'src/api/client.ts',
      'src/pages/Dashboard.tsx',
      'src/pages/Record.tsx',
      'src/pages/Memory.tsx',
      'src/pages/Timeline.tsx',
      'src/pages/Insights.tsx',
      'src/components/PersonSelector.tsx',
      'src/pages/DailyCare.tsx',
      'src/pages/StructuredDailyCapture.tsx',
      'src/pages/Community.tsx',
      'src/pages/TeamDashboard.tsx',
      'src/pages/CareCircle.tsx',
      'src/pages/Appointments.tsx',
      'src/pages/Companion.tsx',
      'src/pages/ProfessionalDashboard.tsx',
      'src/pages/InvestorDashboard.tsx',
    ]
    for (const path of paths) {
      expect(source(path)).not.toContain(['demo', 'person', 'id'].join('-'))
      expect(source(path)).not.toContain(['demo', 'caregiver'].join('-'))
    }
  })

  it('does not ship hardcoded sample Community posts or team risk reports', () => {
    expect(source('src/pages/Community.tsx')).not.toContain(['SAMPLE', '_POSTS'].join(''))
    expect(source('src/pages/Community.tsx')).not.toMatch(/sample caregiver story/i)
    const forbiddenDashboardMarkers = [
      ['DEMO', '_RISK'].join(''),
      ['DEMO', '_REVIEW'].join(''),
      ['DEMO', '_REPORT'].join(''),
      ['M.', 'Johnson'].join(' '),
      ['R.', 'Chen'].join(' '),
      ['A.', 'Rodriguez'].join(' '),
    ]
    for (const marker of forbiddenDashboardMarkers) {
      expect(source('src/pages/TeamDashboard.tsx')).not.toContain(marker)
    }
  })

  it('does not send placeholder identities or render fabricated clinical capture defaults', () => {
    const files = [
      'src/components/CareCapture.tsx',
      'src/pages/DailyCare.tsx',
      'src/pages/StructuredDailyCapture.tsx',
    ]
    for (const path of files) {
      const text = source(path)
      expect(text).not.toContain(['current', 'user', 'id'].join('-'))
      expect(text).not.toContain(['Dad', 'wandered', 'at', '2 AM'].join(' '))
    }
    expect(source('src/pages/DailyCare.tsx')).not.toContain(['mood_scale:', '3'].join(' '))
    expect(source('src/pages/DailyCare.tsx')).not.toContain(['agitation_level:', "'None'"].join(' '))
    expect(source('src/pages/DailyCare.tsx')).not.toContain(['wellbeing_stress:', '3'].join(' '))
    expect(source('src/pages/StructuredDailyCapture.tsx')).not.toContain(['status:', "'given'"].join(' '))
    expect(source('src/pages/StructuredDailyCapture.tsx')).not.toContain(['score:', '3'].join(' '))
  })
  it('keeps unavailable record views distinct from confirmed empty states', () => {
    expect(source('src/pages/Record.tsx')).toContain('!loadError && items.length === 0')
    expect(source('src/pages/Memory.tsx')).toContain('!loading && !loadError')
    expect(source('src/pages/Timeline.tsx')).toContain('!loading && !loadError && events.length === 0')
    expect(source('src/pages/Insights.tsx')).toContain('!loading && !loadError && insights.length === 0')
    expect(source('src/pages/Evidence.tsx')).toContain('!loading && !listError && items.length === 0')
    expect(source('src/pages/Appointments.tsx')).toContain('appointmentsLoadError ?')
    expect(source('src/pages/TeamDashboard.tsx')).toContain('Moderation queue unavailable. No empty-queue state is inferred.')
  })

  it('does not ship canned clinical scenarios or synthetic routine metrics', () => {
    const removedScenarios = [
      ['wandering', 'overnight'].join(' '),
      ['evening', 'agitation'].join(' '),
      ['medication', 'refusal'].join(' '),
      ['refused', 'medication'].join(' '),
      ['new', 'confusion'].join(' '),
    ]
    for (const scenario of removedScenarios) {
      expect(source('src/pages/DailyCare.tsx')).not.toContain(scenario)
      expect(source('src/pages/Community.tsx')).not.toContain(scenario)
    }
    expect(source('src/pages/Community.tsx')).not.toContain(['const', 'TAG_COLORS:'].join(' '))
    expect(source('src/lib/routine-moments/service.ts')).not.toContain('consistencyScore = 0.5')
    expect(source('src/lib/routine-moments/builder.ts')).not.toContain("average_time_of_day: '00:00'")
    expect(source('src/lib/routine-moments/builder.ts')).toContain('consistency_score: null')
  })

  it('keeps illustrative care fixtures outside the production source tree', () => {
    expect(source('scripts/fixtures/README.md')).toContain('must not be imported by `src/` application code')
    expect(() => source('src/data/sample-care-context.ts')).toThrow()
    expect(() => source('src/data/sample-care-logs.ts')).toThrow()
    expect(source('src/App.tsx')).not.toMatch(/AccessibilityDemo|RoutineMomentsDemo|sample-care-context|sample-care-logs/)
  })

})
