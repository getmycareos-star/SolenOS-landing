
import { NextResponse } from 'next/server'
import { Pool } from 'pg'
import { randomUUID } from 'crypto'
import { withAuthentication } from '@/lib/auth/middleware';

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

// Type definitions for our report problem API
type ReportProblemRequest = {
  care_key: string
  category: string
  details?: string | null
  situation_id?: string | null
  ai_content: string
  raw_input_excerpt?: string | null
}

type ReportProblemResponse = {
  id: string
  care_key: string
  category: string
  details: string | null
  situation_id: string | null
  ai_content: string
  raw_input_excerpt: string | null
  created_at: string
}

// POST /api/report-problem - Submit a problem report
async function postReportProblemHandler(request: Request, user: any) {
  try {
    const body = (await request.json()) as ReportProblemRequest
    const {
      care_key: user.id,  // Use authenticated user's ID
      category,
      details,
      situation_id,
      ai_content,
      raw_input_excerpt
    } = body

    // Validate required fields
    if (!care_key || !category || !ai_content) {
      return NextResponse.json(
        { error: 'Missing required fields: care_key, category, ai_content' },
        { status: 400 }
      )
    }

    // Validate category
    const validCategories = [
      'incorrect-fact',
      'missing-context',
      'misleading-interpretation',
      'unsupported-claim',
      'privacy-access-concern',
      'potentially-unsafe-output',
      'other'
    ]
    
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: 'Invalid category' },
        { status: 400 }
      )
    }
// Generate a unique ID for the report
    const id = randomUUID();
    const createdAt = new Date().toISOString()

    // Store the report in the database
    const result = await pool.query(
      `
      INSERT INTO problem_reports (
        id, care_key, category, details, situation_id, ai_content, 
        raw_input_excerpt, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8
      ) RETURNING *
      `,
      [
        id,
        care_key: user.id,  // Use authenticated user's ID
        category,
        details ?? null,
        situation_id ?? null,
        ai_content,
        raw_input_excerpt ?? null,
        createdAt
      ]
    )

    const report = result.rows[0]

    return NextResponse.json(report, { status: 201 })
  } catch (error) {
    console.error('Error submitting problem report:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}




export const POST = withAuthentication(postReportProblemHandler);

