import { NextResponse } from 'next/server'
import { getRoutineMomentsStore } from '@/lib/routine-moments/store'

// GET /api/routine-moments/[id] - Get a specific routine moment
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    
    const store = getRoutineMomentsStore()
    const record = store.getById(id)
    
    if (!record) {
      return NextResponse.json({ error: 'Routine moment not found' }, { status: 404 })
    }
    
    return NextResponse.json(record)
  } catch (error) {
    console.error('Error fetching routine moment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/routine-moments/[id] - Update a routine moment
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    
    const store = getRoutineMomentsStore()
    const existingRecord = store.getById(id)
    
    if (!existingRecord) {
      return NextResponse.json({ error: 'Routine moment not found' }, { status: 404 })
    }
    
    // Update the record with new data
    const updatedRecord = {
      ...existingRecord,
      ...body,
      updated_at: new Date().toISOString()
    }
    
    // In a full implementation, we would validate the updated record
    // For now, we'll skip validation in this example
    
    // Save the updated record
    await store.save(updatedRecord)
    
    return NextResponse.json(updatedRecord)
  } catch (error) {
    console.error('Error updating routine moment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/routine-moments/[id] - Delete a routine moment
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    
    const store = getRoutineMomentsStore()
    const result = store.delete(id)
    
    if (!result) {
      return NextResponse.json({ error: 'Routine moment not found' }, { status: 404 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting routine moment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}