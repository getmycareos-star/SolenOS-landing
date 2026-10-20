import { NextResponse } from 'next/server'
import { Pool } from 'pg'
import { randomUUID } from 'crypto'
import { tryDeleteCareEventForCaregiver } from '../../../../src/lib/care-events/postgres-store'
import { authenticate } from '../../../../src/lib/auth/middleware'

// Database connection pool
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
})

// DELETE /api/care-events/[id] - Delete a care event
async function deleteCareEventHandler(request: Request, { params }: { params: { id: string } }, user: any) {

  try {
    const { id } = params
    
    if (!id) {
      return NextResponse.json(
        { error: 'Missing care event ID' },
        { status: 400 }
      )
  

    // Validate ID format (UUID)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json(
        { error: 'Invalid care event ID format' },
        { status: 400 }
      )
  

    // Delete the care event (ensuring it belongs to the authenticated user)
    const success = await tryDeleteCareEventForCaregiver(id, user.id)
    
    if (!success) {
      return NextResponse.json(
        { error: 'Care event not found or unauthorized' },
        { status: 404 }
      )
  

    return NextResponse.json({ success: true })
 catch (error) {
    console.error('Error deleting care event:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })

}

export const DELETE = withAuthentication(deleteCareEventHandler);

