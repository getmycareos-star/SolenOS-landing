import { NextResponse } from 'next/server'
import { Pool } from 'pg'

// Database connection pool
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
})

// GET /api/open-loops/:id - Get a specific open loop
export async GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params

    const result = await pool.query(
      'SELECT * FROM open_loops WHERE id = $1',
      [id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Open loop not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error fetching open loop:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/open-loops/:id - Update an open loop
export async PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const body = await request.json()
    const {
      category,
      description,
      priority,
      status,
      source_event_id,
      resolved_by_event_id,
      resolution,
      tags,
      source,
      provenance,
    } = body

    // Build the update query dynamically based on provided fields
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (category !== undefined) {
      updates.push(`category = $${paramIndex++}`)
      values.push(category)
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`)
      values.push(description)
    }
    if (priority !== undefined) {
      updates.push(`priority = $${paramIndex++}`)
      values.push(priority)
    }
    if (status !== undefined) {
      // Validate status
      const validStatuses = ['open', 'resolved', 'reconnected', 'archived']
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: 'Invalid status. Must be one of: open, resolved, reconnected, archived' },
          { status: 400 }
        )
      }
      updates.push(`status = $${paramIndex++}`)
      values.push(status)
    }
    if (source_event_id !== undefined) {
      updates.push(`source_event_id = $${paramIndex++}`)
      values.push(source_event_id ?? null)
    }
    if (resolved_by_event_id !== undefined) {
      updates.push(`resolved_by_event_id = $${paramIndex++}`)
      values.push(resolved_by_event_id ?? null)
    }
    if (resolution !== undefined) {
      updates.push(`resolution = $${paramIndex++}`)
      values.push(resolution ?? null)
    }
    if (tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`)
      values.push(tags)
    }
    if (source !== undefined) {
      // Validate source
      const validSources = ['user_input', 'document', 'observation', 'provider_note', 'caregiver_report', 'inferred', 'assumed']
      if (!validSources.includes(source)) {
        return NextResponse.json(
          { error: 'Invalid source. Must be one of: user_input, document, observation, provider_note, caregiver_report, inferred, assumed' },
          { status: 400 }
        )
      }
      updates.push(`source = $${paramIndex++}`)
      values.push(source)
    }
    if (provenance !== undefined) {
      updates.push(`provenance = $${paramIndex++}`)
      values.push(provenance)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    // Add updated_at timestamp
    updates.push(`updated_at = NOW()`)
    values.push(id) // for the WHERE clause

    const query = `
      UPDATE open_loops
      SET ${updates.join(', ')}
      WHERE id = $${values.length}
      RETURNING *
    `

    const result = await pool.query(query, values)

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Open loop not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error updating open loop:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/open-loops/:id - Delete an open loop
export async DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params

    const result = await pool.query(
      'DELETE FROM open_loops WHERE id = $1 RETURNING *',
      [id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Open loop not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Open loop deleted successfully' })
  } catch (error) {
    console.error('Error deleting open loop:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
