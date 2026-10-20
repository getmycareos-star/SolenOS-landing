
import { NextResponse } from 'next/server'
import { Pool } from 'pg'
import { withAuthentication } from '@/lib/auth/middleware';

// Database connection pool
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
})

// GET /api/open-loops - List open loops
async function getOpenLoopsHandler(request: Request, user: any) {
  try {
    const { searchParams } = new URL(request.url)
    const caregiverId = user.id
    const careRecipientId = user.id  // For now, we use the user's own care record
    const status = searchParams.get('status')
    const category = searchParams.get('category')

    let query = 'SELECT * FROM open_loops WHERE 1=1'
    const params: any[] = []
    let paramIndex = 1

    if (caregiverId) {
      query += ' AND caregiver_id = ' + paramIndex++
      params.push(caregiverId)
    }

    if (careRecipientId) {
      query += ' AND care_recipient_id = ' + paramIndex++
      params.push(careRecipientId)
    }

    if (status) {
      query += ' AND status = ' + paramIndex++
      params.push(status)
    }

    if (category) {
      query += ' AND category = ' + paramIndex++
      params.push(category)
    }

    query += ' ORDER BY created_at DESC'

    const result = await pool.query(query, params)
    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching open loops:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/open-loops - Create a new open loop
async function postOpenLoopsHandler(request: Request, user: any) {
  try {
    const body = await request.json()
    const {
      category,
      description,
      caregiver_id,
      care_recipient_id,
      priority = 1,
      source_event_id,
      tags = [],
      source = 'user_input',
      provenance = null,
    } = body

    // Validate required fields
    if (!category || !description || !caregiver_id || !care_recipient_id) {
      return NextResponse.json(
        { error: 'Missing required fields: category, description, caregiver_id, care_recipient_id' },
        { status: 400 }
      )
    }

    // Validate status if provided (though status is not in the input for creation, it defaults to 'open')
    // We'll set status to 'open' for new loops
    const status = 'open'

    const result = await pool.query(
      
        INSERT INTO open_loops (
          category, description, caregiver_id, care_recipient_id, priority, 
          source_event_id, tags, source, provenance, status
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        ) RETURNING *
      ,
      [
        category,
        description,
        caregiver_id,
        care_recipient_id,
        priority,
        source_event_id ?? null,
        tags,
        source,
        provenance,
        status,
      ]
    )

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    console.error('Error creating open loop:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}




export const GET = withAuthentication(getOpenLoopsHandler);
export const POST = withAuthentication(postOpenLoopsHandler);


