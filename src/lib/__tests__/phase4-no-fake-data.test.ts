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
      expect(source(path)).not.toContain('demo-person-id')
      expect(source(path)).not.toContain('demo-caregiver')
    }
  })

  it('does not ship hardcoded sample Community posts or team risk reports', () => {
    expect(source('src/pages/Community.tsx')).not.toMatch(/SAMPLE_POSTS|sample caregiver story/i)
    expect(source('src/pages/TeamDashboard.tsx')).not.toMatch(/DEMO_RISK|DEMO_REVIEW|DEMO_REPORT|M\. Johnson|R\. Chen|A\. Rodriguez/)
  })

  it('does not send placeholder identities or render fabricated clinical capture defaults', () => {
    const files = [
      'src/components/CareCapture.tsx',
      'src/pages/DailyCare.tsx',
      'src/pages/StructuredDailyCapture.tsx',
    ]
    for (const path of files) {
      const text = source(path)
      expect(text).not.toContain('current-user-id')
      expect(text).not.toContain('Dad wandered at 2 AM')
    }
    expect(source('src/pages/DailyCare.tsx')).not.toMatch(/mood_scale:\s*3|agitation_level:\s*'None'|wellbeing_stress:\s*3/)
    expect(source('src/pages/StructuredDailyCapture.tsx')).not.toMatch(/status:\s*'given'|score:\s*3/)
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
    expect(source('src/pages/DailyCare.tsx')).not.toMatch(/Examples?:\s*refused medication|wandering overnight|new confusion/i)
    expect(source('src/pages/Community.tsx')).not.toMatch(/wandering overnight|evening agitation|medication refusal|const TAG_COLORS:/i)
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
