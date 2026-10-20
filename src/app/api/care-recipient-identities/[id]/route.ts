import { NextResponse } from 'next/server'
import { authenticate } from '../../../../src/lib/auth/middleware'
import { getCareRecipientIdentityStore } from '../../../../src/lib/care-recipient-identity'

// DELETE /api/care-recipient-identities/[id] - Delete a care recipient identity
async function deleteCareRecipientIdentityHandler(request: Request, { params }: { params: { id: string } }, user: any) {





  try {
    const { id } = params
    
    if (!id) {
      return NextResponse.json(
        { error: 'Missing care recipient identity ID' },
        { status: 400 }
      )
  

    // Validate ID format (UUID)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json(
        { error: 'Invalid care recipient identity ID format' },
        { status: 400 }
      )
  

    // Get the store
    const store = await getCareRecipientIdentityStore()
    
    // Delete by care_recipient_id (which is the id parameter)
    await store.deleteByCareRecipientId(id)

    return NextResponse.json({ success: true })
 catch (error) {
    console.error('Error deleting care recipient identity:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })

}

export const DELETE = withAuthentication(deleteCareRecipientIdentityHandler);
