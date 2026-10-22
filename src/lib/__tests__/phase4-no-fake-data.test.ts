import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { normalizeCommunityPost } from '../../pages/Community'

function sourceFiles(dir: string): string[] {
  return readdirSync(resolve(process.cwd(), dir), { withFileTypes: true }).flatMap((entry) => {
    const relativePath = `${dir}/${entry.name}`
    if (entry.isDirectory()) return sourceFiles(relativePath)
    return /\.(ts|tsx|js|jsx)$/.test(entry.name) ? [relativePath] : []
  })
}

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
    const community = source('src/pages/Community.tsx')
    expect(community).toContain('zero reactions were not inferred')
    expect(community).toContain('empty tag list was not inferred')
    expect(community).not.toContain("typeof counts?.support === 'number' && counts.support >= 0 ? counts.support : 0")
    expect(community).not.toContain(['SAMPLE', '_POSTS'].join(''))
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
    expect(source('src/pages/StructuredDailyCapture.tsx')).not.toContain(['vital_type:', "'bp_systolic'"].join(' '))
    expect(source('src/pages/StructuredDailyCapture.tsx')).not.toContain(['axis:', "'mood'"].join(' '))
    expect(source('src/pages/StructuredDailyCapture.tsx')).toContain("value={vitalForm.value || ''}")
    expect(source('src/pages/StructuredDailyCapture.tsx')).toContain("value={scaleForm.score || ''}")
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

  it('removes canned clinical scenarios from legacy prototype inputs too', () => {
    const legacyInputs = [
      'src/app/workspace/settings/page.tsx',
      'src/components/ops-devtools/RealMomentPanel.tsx',
      'src/components/ops-devtools/DementiaCareRecordPanel.tsx',
      'src/components/ops-devtools/MemoryReconstructionPanel.tsx',
      'src/components/ops-devtools/CareRecordTimelinePanel.tsx',
    ]
    const forbiddenExamples = [
      ['mom', 'confused', 'again'].join(' '),
      ['Tried to leave', 'house at 8pm'].join(' '),
      ['Unknown caller', 'requested account details'].join(' '),
      ['Last fall?', 'Medication changes?'].join(' '),
      ['Mom, Dad, Mary'].join(''),
      ['early-stage', 'dementia'].join(' '),
    ]
    for (const path of legacyInputs) {
      for (const example of forbiddenExamples) {
        expect(source(path)).not.toContain(example)
      }
    }
    expect(() => source('src/pages/AccessibilityDemo.tsx')).toThrow()
    expect(() => source('src/pages/RoutineMomentsDemo.tsx')).toThrow()
  })

  it('does not turn ops database failures into zero or empty metrics', () => {
    const queries = source('src/lib/ops-console/queries.ts')
    expect(queries).toContain('An operational database query failed; metrics cannot be verified.')
    expect(queries).not.toContain('totalRegistered || totalUsersEvent')
    expect(queries).not.toContain('casesActive || careCasesEvent')
    expect(queries).not.toContain('totalEvents || mem.length')
    expect(queries).not.toContain('rawTotal || mem.length')
    const page = source('src/app/ops/page.tsx')
    expect(page).toContain('Operational dashboard unavailable')
    expect(page).toContain('!data || !data.system.db_connected')
  })


  it('never imports illustrative fixtures into the production source tree', () => {
    for (const path of sourceFiles('src')) {
      expect(source(path)).not.toMatch(/(?:from\s*|import\s*\()\s*["'][^"']*(?:scripts|tests)\/fixtures/)
    }
  })

  it('keeps illustrative care fixtures outside the production source tree', () => {
    expect(source('scripts/fixtures/README.md')).toContain('must not be imported by `src/` application code')
    expect(() => source('src/data/sample-care-context.ts')).toThrow()
    expect(() => source('src/data/sample-care-logs.ts')).toThrow()
    expect(source('src/App.tsx')).not.toMatch(/AccessibilityDemo|RoutineMomentsDemo|sample-care-context|sample-care-logs/)
  })

})


  it('rejects shared caregiver fallbacks across identity-sensitive production modules', () => {
    const identitySensitiveSources = [
      'src/lib/capacity-self/process-session.ts',
      'src/lib/capacity-self/caregiver-profile/store.ts',
      'src/lib/cognitive-relief/ingest-entry.ts',
      'src/lib/cognitive-relief/care-recipient-profile/store.ts',
      'src/lib/care-contexts/dementia/operations.ts',
      'src/lib/observation-intelligence/index.ts',
      'src/lib/care-journey/store.ts',
      'src/lib/care-journey/postgres-store.ts',
      'src/lib/continuity-graph/pipeline.ts',
      'src/lib/care-journey-graph/pipeline.ts',
      'src/lib/care-journey-graph/structure-event.ts',
      'src/lib/care-journey-graph/graph-store.ts',
      'src/lib/memory-reconstruction-engine/reconstruct.ts',
      'src/lib/care-events/store.ts',
      'src/lib/care-events/record-care-event.ts',
      'src/lib/living-care-record-persistence/fs-store.ts',
      'src/lib/meeting-preparation/meeting-store.ts',
      'src/lib/universal-knowledge-extraction/store.ts',
      'src/lib/care-identity/durable-care-key.ts',
      'src/lib/multi-caregiver-context-model/store.ts',
      'src/app/api/situation/route.ts',
      'src/components/mvp-workspace/CognitiveWorkspace.tsx',
      'src/components/ops-devtools/MemoryEpisodePanel.tsx',
    ]
    for (const path of identitySensitiveSources) {
      const text = source(path)
      expect(text).not.toMatch(/\?\?\s*["']default_caregiver["']/)
      expect(text).not.toMatch(/\|\|\s*["']default_caregiver["']/)
      expect(text).not.toMatch(/(?:caregiver(?:Id|_id)|contributorId)\s*[:=]\s*["']default_caregiver["']/)
      expect(text).not.toMatch(/DEFAULT_CAREGIVER_ID|DEFAULT_CARE_RECIPIENT_ID/)
      expect(text).not.toMatch(/(?:\?\?|\|\|)\s*["']default_care_recipient["']/)
    }
  })


it('rejects a Community post when any reaction count is missing instead of inventing zero', () => {
  const validPost = {
    id: 'post-test-1',
    author_type: 'peer_caregiver',
    author_label: 'Caregiver',
    content: 'A real API-provided community post.',
    visibility: 'public',
    care_stage: 'early',
    tags: [],
    created_at: '2026-10-22T10:00:00Z',
    reaction_counts: { support: 2, helpful: 1, relate: 0, heart: 0 },
    user_reaction: null,
  }

  expect(normalizeCommunityPost(validPost).reaction_counts).toEqual({
    support: 2, helpful: 1, relate: 0, heart: 0,
  })
  expect(() => normalizeCommunityPost({
    ...validPost,
    reaction_counts: { support: 2, helpful: 1, relate: 0 },
  })).toThrow(/heart reaction count; zero was not inferred/i)
})
