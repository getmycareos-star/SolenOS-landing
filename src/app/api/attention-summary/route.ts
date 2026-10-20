import { NextResponse } from 'next/server'
import { authenticate } from '../../../../src/lib/auth/middleware'
import { CareAttentionService } from '../../../../src/lib/care-attention/service'
import { Pool } from 'pg'
// Database connection pool
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
})
// Initialize care-attention service
const careAttentionService = new CareAttentionService(pool)
/**
 * GET /api/attention-summary - Get summary of attention items for a caregiver/recipient
 * Query parameters: caregiver_id, care_recipient_id
 */
async function getAttentionSummaryHandler(request: Request, user: any) {
  try {
    const { searchParams } = new URL(request.url)
    const caregiverId = searchParams.get('caregiver_id') ?? user.id;
    const careRecipientId = searchParams.get('care_recipient_id')
    
    if (!careRecipientId) {
      return NextResponse.json(
        { error: 'Missing care_recipient_id parameter' },
        { status: 400 }
      )
  
    // Get attention items from the care-attention service
    const attentionItemsResponse = await careAttentionService.determineWhatMatters(
      careRecipientId,
      caregiverId
    )
    // Create summary
    const summary = {
      caregiver_id: caregiverId,
      care_recipient_id: careRecipientId,
      timestamp: new Date().toISOString(),
      counts: {
        needs_attention: attentionItemsResponse.needsAttention.length,
        awaiting_confirmation: attentionItemsResponse.awaitingConfirmation.length,
        professional_follow_up: attentionItemsResponse.professionalFollowUp.length,
        upcoming: attentionItemsResponse.upcoming.length,
        important_context: attentionItemsResponse.importantContext.length,
        can_wait: attentionItemsResponse.canWait.length,
        unknowns: attentionItemsResponse.unknowns.length,
        conflicts: attentionItemsResponse.conflicts.length,
        recent_changes: attentionItemsResponse.recentChanges.length
    ,
      highest_priority_items: [
        ...attentionItemsResponse.needsAttention.slice(0, 3),
        ...attentionItemsResponse.awaitingConfirmation.slice(0, 2)
      ].map(item => ({
        id: item.id,
        reason: item.attentionReason,
        state: item.attentionState,
        priority: item.priority,
        domain: item.provenance.metadata.detectionReason?.split(':')[0] || 'unknown'
    ))
  
    return NextResponse.json(summary)
 catch (error) {
    console.error('Error fetching attention summary:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
}
export const GET = withAuthentication(getAttentionSummaryHandler);
