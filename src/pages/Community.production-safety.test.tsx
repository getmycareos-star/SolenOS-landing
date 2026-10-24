import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Community from './Community'
import { computePoolRunway } from '../lib/cognitive-relief/modules/runway'
import { DEFAULT_PROFILE } from '../lib/cognitive-relief/types'
import { ensureClientDurableCareKey, requireCareKeyFromRequest, resolveDurableCareKey } from '../lib/care-identity/durable-care-key'
import { classifyCaregiverDemand } from '../lib/product-north-star/classify-demand'
import { classifyFailureFromQuestion } from '../lib/continuity-properties/failure-map'
import { interpretQuestion } from '../lib/care-context/interpret-question'

jest.mock('../api/client', () => ({
  getJSON: jest.fn(),
  postJSON: jest.fn(),
  getCaregiverId: jest.fn(() => 'caregiver-from-local-storage'),
  checkAuthState: jest.fn(async () => ({ authenticated: false, sessionInfo: null })),
}))

import { getJSON, postJSON } from '../api/client'

const mockedGetJSON = getJSON as jest.Mock
const mockedPostJSON = postJSON as jest.Mock

describe('Community production data integrity', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows a distinct load error and never substitutes invented posts when the API fails', async () => {
    mockedGetJSON.mockRejectedValue(new Error('API unavailable'))

    render(<MemoryRouter><Community /></MemoryRouter>)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Community posts could not be loaded',
    )
    expect(screen.queryByText(/M\. Johnson|sample caregiver|sample post|DEMO_/i)).not.toBeInTheDocument()
    expect(mockedPostJSON).not.toHaveBeenCalled()
  })

  it('blocks community posting when the session is not authenticated and preserves the draft', async () => {
    mockedGetJSON.mockRejectedValue(new Error('API unavailable'))

    render(<MemoryRouter><Community /></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: /share what worked/i }))
    const draft = 'A real draft that must not be discarded'
    fireEvent.change(screen.getByPlaceholderText(/share a tip, routine/i), {
      target: { value: draft },
    })
    fireEvent.click(screen.getByRole('button', { name: /^share$/i }))

    expect(await screen.findByText(/cannot verify an authenticated caregiver session/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue(draft)).toBeInTheDocument()
    expect(mockedPostJSON).not.toHaveBeenCalled()
  })
})

describe('Care-finance estimates remain evidence-bound', () => {
  it('does not infer money or caregiver-time depletion from keywords', () => {
    const result = computePoolRunway(DEFAULT_PROFILE, 2400, ['property tax due', 'roof repair', 'no backup'])
    expect(result.runways).toHaveLength(2)
    expect(result.runways.every((entry) => entry.estimated_depletion_window.toLowerCase().includes('unknown'))).toBe(true)
    expect(result.runways.every((entry) => entry.assumptions_used.length > 0)).toBe(true)
    expect(JSON.stringify(result)).not.toMatch(/\$150|\$200|\$300|around early fall|moderate — monitor/i)
  })

  it('does not invent a budget when none was provided', () => {
    const result = computePoolRunway(DEFAULT_PROFILE, null)
    expect(result.optional_budget).toBeNull()
    expect(result.runways[0].estimated_depletion_window).toContain('no caregiver-entered budget')
  })
})

describe('Care identity isolation', () => {
  it('rejects missing, session-only, and shared-placeholder identities', () => {
    expect(() => resolveDurableCareKey({})).toThrow(/durable care key is required/i)
    expect(() => resolveDurableCareKey({ care_session_id: 'sess_example' })).toThrow(/durable care key is required/i)
    expect(requireCareKeyFromRequest({ caregiver_id: 'default_caregiver' }).ok).toBe(false)
  })

  it('replaces a legacy shared browser key with a per-browser key', () => {
    const key = ensureClientDurableCareKey('default_caregiver')
    expect(key).not.toBe('default_caregiver')
    expect(key.startsWith('care_')).toBe(true)
  })
})

describe('Keyword heuristics are disabled unless explicitly opted into in development', () => {
  const originalFlag = process.env.SOLENOS_DEV_KEYWORD_HEURISTICS

  beforeEach(() => {
    delete process.env.SOLENOS_DEV_KEYWORD_HEURISTICS
  })

  afterAll(() => {
    if (originalFlag === undefined) delete process.env.SOLENOS_DEV_KEYWORD_HEURISTICS
    else process.env.SOLENOS_DEV_KEYWORD_HEURISTICS = originalFlag
  })

  it('does not infer product demand or failures from a sample-like sentence', () => {
    const demand = classifyCaregiverDemand('Dad has started wandering at night. Is it time for professional care?')
    expect(demand.demand_type).toBe('unknown')
    expect(demand.matched_themes).toEqual([])
    expect(demand.build_engines_not_answers).toEqual([])
    expect(classifyFailureFromQuestion('I cannot remember what happened at the last appointment.')).toBeNull()
  })



  it('enables legacy heuristic inspection only with explicit development opt-in', () => {
    const previousNodeEnv = process.env.NODE_ENV
    const previousFlag = process.env.SOLENOS_DEV_KEYWORD_HEURISTICS
    process.env.NODE_ENV = 'development'
    process.env.SOLENOS_DEV_KEYWORD_HEURISTICS = 'true'
    try {
      expect(classifyCaregiverDemand('Dad has started wandering at night. Is it time for professional care?').demand_type).not.toBe('unknown')
      expect(classifyFailureFromQuestion('Does Medicare cover dementia care?')).not.toBeNull()
      expect(interpretQuestion('Dad has started wandering at night.').demandType).not.toBe('unknown')
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = previousNodeEnv
      if (previousFlag === undefined) delete process.env.SOLENOS_DEV_KEYWORD_HEURISTICS
      else process.env.SOLENOS_DEV_KEYWORD_HEURISTICS = previousFlag
    }
  })

  it('never enables keyword inference in production even when the development flag is set', () => {
    const previousNodeEnv = process.env.NODE_ENV
    const previousFlag = process.env.SOLENOS_DEV_KEYWORD_HEURISTICS
    process.env.NODE_ENV = 'production'
    process.env.SOLENOS_DEV_KEYWORD_HEURISTICS = 'true'
    try {
      expect(classifyCaregiverDemand('Is it time for professional care?').demand_type).toBe('unknown')
      expect(classifyFailureFromQuestion('Is it time for professional care?')).toBeNull()
      const interpretation = interpretQuestion('Dad has started wandering at night.')
      expect(interpretation.demandType).toBe('unknown')
      expect(interpretation.proposedEvents).toEqual([])
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = previousNodeEnv
      if (previousFlag === undefined) delete process.env.SOLENOS_DEV_KEYWORD_HEURISTICS
      else process.env.SOLENOS_DEV_KEYWORD_HEURISTICS = previousFlag
    }
  })

  it('does not convert a question into care events or inferred themes without a validated classifier', () => {
    const interpretation = interpretQuestion('Dad has started wandering at night. Is it time for professional care?')
    expect(interpretation.demandType).toBe('unknown')
    expect(interpretation.signalThemes).toEqual([])
    expect(interpretation.proposedEvents).toEqual([])
    expect(interpretation.engineActions).toEqual([])
    expect(interpretation.uncertainties[0]).toMatch(/no validated evidence-grounded classifier/i)
  })
})

describe('Community Qwen fallback integrity', () => {
  it('does not call the legacy literal-search endpoint when the Qwen endpoint returns 404', async () => {
    mockedGetJSON.mockResolvedValue({ posts: [] })
    mockedPostJSON.mockRejectedValue(new Error('API 404: endpoint not found'))

    render(<MemoryRouter><Community /></MemoryRouter>)
    fireEvent.change(screen.getByPlaceholderText(/wandering overnight/i), {
      target: { value: 'night wandering' },
    })
    fireEvent.click(screen.getByRole('button', { name: /find wisdom/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/Qwen assistance could not be confirmed/i)
    expect(mockedPostJSON).toHaveBeenCalledTimes(1)
    expect(mockedPostJSON).toHaveBeenCalledWith('/community/experience/summary', {
      observation: 'night wandering',
    })
  })
})
