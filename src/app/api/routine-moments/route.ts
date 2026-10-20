import { NextResponse } from 'next/server'
import { Pool } from 'pg'
import { getRoutineMomentsStore } from '@/lib/routine-moments/store'
import {
import { withAuthentication } from '@/lib/auth/middleware';
  createObservationFromInput,
  addObservationToRoutineMoment
} from '@/lib/routine-moments/service'

// Database connection pool
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
})

// GET /api/routine-moments - List routine moments
async function getRoutineMomentsHandler(request: Request, user: any) {
  try {
    const { searchParams } = new URL(request.url)
    const caregiverId = user.id
    const careRecipientId = user.id  // For now, we use the user's own care record
    const routineType = searchParams.get('routine_type')
    const personId = searchParams.get('person_id')

    // For now, we'll return data from the in-memory store
    // In a full implementation, we'd query the database
    const store = getRoutineMomentsStore()
    
    let results: any[] = []
    
    if (personId && routineType) {
      // Get specific person and routine type
      results = store.getForPersonAndType(personId, routineType as any)
    } else if (personId) {
      // Get all routine moments for a person
      results = store.getForPerson(personId)
    } else if (routineType) {
      // Get all routine moments of a specific type
      results = store.getByType(routineType as any)
    } else {
      // Get all routine moments (limited for performance)
      // In reality, we'd need to iterate over all persons and types
      // This is a simplified implementation
      const allPersons = store.getForPerson('') // This would need to be implemented differently
      results = []
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Error fetching routine moments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/routine-moments - Create a new routine moment observation
async function postRoutineMomentsHandler(request: Request, user: any) {
  try {
    const body = await request.json()
    const {
      person_id,
      routine_type,
      observation_state,
      occurred_at,
      recorded_by: user.id,  // Use authenticated user's ID
      source = 'user_input',
      context,
      assistance_level,
      participation_level,
      duration_minutes,
      raw_evidence_id,
      care_event_id,
      metadata
    } = body

    // Validate required fields
    if (!person_id || !routine_type || !observation_state || !recorded_by) {
      return NextResponse.json(
        { error: 'Missing required fields: person_id, routine_type, observation_state, recorded_by' },
        { status: 400 }
      )
    }

    // Validate observation_state
    const validStates = ['occurred', 'missed', 'not_observed'] as const
    if (!validStates.includes(observation_state as any)) {
      return NextResponse.json(
        { error: `Invalid observation_state. Must be one of: ${validStates.join(', ')}` },
        { status: 400 }
      )
    }

    // Create the observation
    const observation = createObservationFromInput({
      person_id,
      routine_type,
      observation_state,
      occurred_at: occurred_at ?? new Date().toISOString(),
      recorded_by: user.id,  // Use authenticated user's ID
      source,
      context,
      assistance_level,
      participation_level,
      duration_minutes,
      raw_evidence_id,
      care_event_id,
      metadata: metadata ?? {}
    })

    // Add the observation to the routine moment record
    const updatedRecord = await addObservationToRoutineMoment(
      person_id,
      routine_type as any,
      observation
    )

    return NextResponse.json(updatedRecord, { status: 201 })
  } catch (error) {
    console.error('Error creating routine moment observation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


export const GET = withAuthentication(getRoutineMomentsHandler);
export const POST = withAuthentication(postRoutineMomentsHandler);

