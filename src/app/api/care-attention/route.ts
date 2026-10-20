import { NextResponse } from 'next/server'
import { Pool } from 'pg'
import { CareAttentionService } from '../../../../src/lib/care-attention'
import { authenticate } from '../../../../src/lib/auth/middleware'
import { withGetTelemetry, withPostTelemetry, withPutTelemetry, withDeleteTelemetry } from '../../../../src/lib/telemetry/api.wrapper'

// Database connection pool
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
})

// Initialize service
const careAttentionService = new CareAttentionService(pool)

// GET /api/care-attention - Get what matters for a caregiver/care recipient pair
export const GET = withGetTelemetry(withAuthentication(async (request: Request, user: any) => {
  // Authenticate the request
  const authResult = await authenticate(request)
  if (!authResult.authenticated) {
    return authResult.response
  }

  try {
    const { searchParams } = new URL(request.url)
    const caregiverId = searchParams.get('caregiver_id')
    const careRecipientId = searchParams.get('care_recipient_id')

    // Validate required parameters
    if (!caregiverId || !careRecipientId) {
      return NextResponse.json(
        { error: 'Missing required parameters: caregiver_id and care_recipient_id' },
        { status: 400 }
      )
    }

    // Determine what matters now
    // In a real implementation, we would validate that the caregiverId matches the authenticated user
    const result = await careAttentionService.determineWhatMatters(careRecipientId, caregiverId)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching care attention data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

// POST /api/care-attention - Create a new attention item
export const POST = withPostTelemetry(async (request: Request) => {
  // Authenticate the request
  const authResult = await authenticate(request)
  if (!authResult.authenticated) {
    return authResult.response
  }

  try {
    const body = await request.json()
    const {
      care_recipient_id,
      caregiver_id,
      attention_reason,
      attention_state,
      user_importance,
      current_status,
      uncertainty,
      evidence,
      related_objects,
      provenance,
      priority,
      dependencies,
      resolution_state,
      effective_date,
      review_date,
      confirmation_state,
      professional_followup_state
    } = body

    // Validate required fields
    if (!care_recipient_id || !caregiver_id || !attention_reason) {
      return NextResponse.json(
        { error: 'Missing required fields: care_recipient_id, caregiver_id, attention_reason' },
        { status: 400 }
      )
    }

    // In a real implementation, we would validate that the caregiver_id matches the authenticated user
    // For now, we'll just check that it's a valid UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(caregiver_id)) {
      return NextResponse.json(
        { error: 'Invalid caregiver_id format' },
        { status: 400 }
      )
    }

    // Create attention item
    const result = await careAttentionService.createAttentionItem({
      care_recipient_id,
      caregiver_id,
      attention_reason,
      attention_state,
      user_importance,
      current_status,
      uncertainty,
      evidence,
      related_objects,
      provenance,
      priority,
      dependencies,
      resolution_state,
      effective_date,
      review_date,
      confirmation_state,
      professional_followup_state
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to create attention item' },
        { status: 400 }
      )
    }

    return NextResponse.json(result.item, { status: 201 })
  } catch (error) {
    console.error('Error creating attention item:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

// PUT /api/care-attention/[id] - Update an existing attention item
export const PUT = withPutTelemetry(async (request: Request, { params }: { params: { id: string } }) => {
  // Authenticate the request
  const authResult = await authenticate(request)
  if (!authResult.authenticated) {
    return authResult.response
  }

  try {
    const { id } = params
    
    if (!id) {
      return NextResponse.json(
        { error: 'Missing attention item ID' },
        { status: 400 }
      )
    }

    // Validate ID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json(
        { error: 'Invalid attention item ID format' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      attention_reason,
      attention_state,
      user_importance,
      current_status,
      uncertainty,
      evidence,
      related_objects,
      provenance,
      priority,
      dependencies,
      resolution_state,
      effective_date,
      review_date,
      confirmation_state,
      professional_followup_state
    } = body

    // Update attention item
    const result = await careAttentionService.updateAttentionItem(id, {
      attention_reason,
      attention_state,
      user_importance,
      current_status,
      uncertainty,
      evidence,
      related_objects,
      provenance,
      priority,
      dependencies,
      resolution_state,
      effective_date,
      review_date,
      confirmation_state,
      professional_followup_state
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to update attention item' },
        { status: 400 }
      )
    }

    return NextResponse.json(result.item)
  } catch (error) {
    console.error('Error updating attention item:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

// DELETE /api/care-attention/[id] - Delete/resolve an attention item
export const DELETE = withDeleteTelemetry(async (request: Request, { params }: { params: { id: string } }) => {
  // Authenticate the request
  const authResult = await authenticate(request)
  if (!authResult.authenticated) {
    return authResult.response
  }

  try {
    const { id } = params
    
    if (!id) {
      return NextResponse.json(
        { error: 'Missing attention item ID' },
        { status: 400 }
      )
    }

    // Validate ID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json(
        { error: 'Invalid attention item ID format' },
        { status: 400 }
      )
    }

    const success = await careAttentionService.deleteAttentionItem(id)
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete attention item' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting attention item:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})


