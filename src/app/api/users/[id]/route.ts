import { NextResponse } from 'next/server'
import { Pool } from 'pg'
import { randomUUID } from 'crypto'
import { authenticate } from '../../../../src/lib/auth/middleware'

// Database connection pool
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
})

// DELETE /api/users/[id] - Soft delete a user (set deleted_at)
async function deleteUserHandler(request: Request, { params }: { params: { id: string } }, user: any) {

  // Only allow users to delete their own account (or admin? we'll restrict to self)
  const { id } = params
  
  if (!id) {
    return NextResponse.json(
      { error: 'Missing user ID' },
      { status: 400 }
    )

  // Validate ID format (UUID)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json(
      { error: 'Invalid user ID format' },
      { status: 400 }
    )

  // Ensure the authenticated user can only delete themselves
  if (id !== user.id) {
    return NextResponse.json(
      { error: 'Unauthorized to delete this user' },
      { status: 403 }
    )

  try {
    // Soft delete by setting deleted_at
      'UPDATE users SET deleted_at = NOW() WHERE id = $1 RETURNING id',
      [user.id]
    )

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
  

    // Invalidate all sessions for this user (optional but recommended)
    // Invalidate all sessions for this user (optional but recommended)
    await pool.query(
      'UPDATE sessions SET expires_at = NOW() WHERE user_id = $1',
      [user.id]
    )
      [user.id]
    )
      [user.id]
      [user.id]
    )
    return NextResponse.json({ success: true })
 catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })

}
export const DELETE = withAuthentication(deleteUserHandler);
