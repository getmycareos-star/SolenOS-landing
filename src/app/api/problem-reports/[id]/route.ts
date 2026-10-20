import { NextResponse } from 'next/server'
import { Pool } from 'pg'
import { randomUUID } from 'crypto'
import { authenticate } from '../../../../src/lib/auth/middleware'

// Database connection pool
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
})

// DELETE /api/problem-reports/[id] - Delete a problem report
async function deleteProblemReportHandler(request: Request, { params }: { params: { id: string } }, user: any) {

  try {
    const { id } = params
    
    if (!id) {
      return NextResponse.json(
        { error: 'Missing problem report ID' },
        { status: 400 }
      )
  

    // Validate ID format (UUID)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json(
        { error: 'Invalid problem report ID format' },
        { status: 400 }
      )
  

    // Delete the problem report
    const result = await pool.query(
      'DELETE FROM problem_reports WHERE id = $1 RETURNING id',
      [id]
    )
    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Problem report not found' },
        { status: 404 }
      )
  

    return NextResponse.json({ success: true })
 catch (error) {
    console.error('Error deleting problem report:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })

}
export const DELETE = withAuthentication(deleteProblemReportHandler);
