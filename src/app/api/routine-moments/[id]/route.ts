import { NextResponse } from 'next/server'
import { authenticate } from '../../../../src/lib/auth/middleware'
import { getRoutineMomentsStore } from '../../../../src/lib/routine-moments/store'

// DELETE /api/routine-moments/[id] - Delete a routine moment
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  // Authenticate the request
  const authResult = await authenticate(request)
  if (!authResult.authenticated) {
    return authResult.response
  }

  try {
    const { id } = params
    
    if (!id) {
      return NextResponse.json(
        { error: 'Missing routine moment ID' },
        { status: 400 }
      )
    }

    // Validate ID format (UUID)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json(
        { error: 'Invalid routine moment ID format' },
        { status: 400 }
      )
    }

    // Get the store
    const store = getRoutineMomentsStore()
    
    // Delete the routine moment
    const success = store.delete(id)
    
    if (!success) {
      return NextResponse.json(
        { error: 'Routine moment not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting routine moment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}