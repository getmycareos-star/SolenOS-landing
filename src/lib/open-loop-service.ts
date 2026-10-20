import { Pool } from 'pg'
import { v4 as uuidv4 } from 'uuid'
import { 
  OpenLoop, 
  OpenLoopCategory, 
  OpenLoopStatus, 
  CreateLoopInput, 
  UpdateLoopInput 
} from './open-loop-manager/types'

/**
 * Open Loop Service - Core business logic for managing open loops
 * 
 * Implements evidence-based loop detection, creation, and lifecycle management
 * following SolenOS directives for non-inventive care coordination.
 */
export class OpenLoopService {
  constructor(private db: Pool) {}

  /**
   * Detect open loops from appointment notes or conversations
   * 
   * Per Directive #14-16: AI may assist in identifying candidate loops
   * from actual evidence but MUST NOT invent missing information.
   * 
   * @param text The appointment note or conversation text
   * @param context Additional context (caregiver, care recipient, source event)
   * @returns Candidate open loops with evidence and confidence scores
   */
  async detectFromText(
    text: string, 
    context: { 
      caregiverId: string; 
      careRecipientId: string; 
      sourceEventId?: string;
      source?: string;
    }
  ): Promise<{ loop: OpenLoop; evidence: string; confidence: number }[]> {
    const candidates: { loop: OpenLoop; evidence: string; confidence: number }[] = []
    
    // Question detection patterns (non-exhaustive, evidence-based)
    const questionPatterns = [
      { pattern: /\b(what|when|where|why|how|who|can you|could you|did you|have you|are you|is it)\b.*\?/gi, 
        category: 'unanswered_question' as OpenLoopCategory,
        confidence: 0.8 },
      { pattern: /\b(unsure|uncertain|don'"'"'t know|not sure|unclear)\b/gi,
        category: 'unanswered_question' as OpenLoopCategory,
        confidence: 0.7 },
      { pattern: /\b(need to know|require information|question about)\b/gi,
        category: 'unanswered_question' as OpenLoopCategory,
        confidence: 0.75 }
    ]
    
    // Pending referral patterns
    const referralPatterns = [
      { pattern: /\b(referral|refer|consult|see.*specialist|appointment with.*doctor)\b.*\b(pending|scheduled|ordered|recommended|needed)\b/gi,
        category: 'pending_referral' as OpenLoopCategory,
        confidence: 0.85 },
      { pattern: /\b(should see|ought to consult|would benefit from.*specialist)\b/gi,
        category: 'pending_referral' as OpenLoopCategory,
        confidence: 0.7 }
    ]
    
    // Pending appointment patterns
    const appointmentPatterns = [
      { pattern: /\b(appointment|visit|follow.?up|check.?up).*\b(pending|scheduled|booked|needed|required)\b/gi,
        category: 'pending_appointment' as OpenLoopCategory,
        confidence: 0.8 },
      { pattern: /\b(need to see|should schedule|ought to book).*\b(doctor|provider|clinician)\b/gi,
        category: 'pending_appointment' as OpenLoopCategory,
        confidence: 0.75 }
    ]
    
    // Medication question patterns
    const medicationPatterns = [
      { pattern: /\b(medication|medicine|drug|prescription|dose|dosage).*\b(change|changed|stop|stopped|start|started|unsure|uncertain)\b/gi,
        category: 'unresolved_medication_question' as OpenLoopCategory,
        confidence: 0.85 },
      { pattern: /\b(whether|if).*\b(taking|using|still on).*\b(medication|medicine|drug)\b/gi,
        category: 'unresolved_medication_question' as OpenLoopCategory,
        confidence: 0.8 }
    ]
    
    // Missing document patterns
    const documentPatterns = [
      { pattern: /\b(discharge summary|test result|report|note|document).*\b(pending|needed|required|expected|awaited)\b/gi,
        category: 'pending_document' as OpenLoopCategory,
        confidence: 0.8 },
      { pattern: /\b(need.*copy|request.*copy|missing).*\b(record|report|summary|document)\b/gi,
        category: 'pending_document' as OpenLoopCategory,
        confidence: 0.75 }
    ]
    
    // Combine all patterns
    const allPatterns = [
      ...questionPatterns,
      ...referralPatterns,
      ...appointmentPatterns,
      ...medicationPatterns,
      ...documentPatterns
    ]
    
    // Process text for each pattern
    for (const patternInfo of allPatterns) {
      const matches = text.matchAll(patternInfo.pattern)
      for (const match of matches) {
        // Extract evidence context (surrounding text)
        const start = Math.max(0, match.index - 50)
        const end = Math.min(text.length, match.index + match[0].length + 50)
        const evidence = text.slice(start, end).trim()
        
        // Create loop candidate
        const loop: OpenLoop = {
          id: uuidv4(),
          category: patternInfo.category,
          description: match[0].trim(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: 'open',
          priority: this.calculateInitialPriority(patternInfo.category),
          caregiver_id: context.caregiverId,
          care_recipient_id: context.careRecipientId,
          source_event_id: context.sourceEventId ?? null,
          resolved_by_event_id: null,
          resolution: null,
          tags: [],
          source: context.source ?? 'user_input',
          provenance: { detectionMethod: 'pattern-matching', patternUsed: patternInfo.pattern.source }
        }
        
        candidates.push({ loop, evidence, confidence: patternInfo.confidence })
      }
    }
    
    // Remove duplicates based on similarity (basic implementation)
    return this.deduplicateCandidates(candidates)
  }
  
  /**
   * Calculate initial priority based on category and evidence
   * Per Directive #27: Prioritization should be evidence-based
   */
  private calculateInitialPriority(category: OpenLoopCategory): number {
    const basePriorities: Record<OpenLoopCategory, number> = {
      'unanswered_question': 20,
      'pending_decision': 25,
      'monitoring_item': 15,
      'revisit_topic': 10,
      'continuity_hook': 15,
      'unresolved_uncertainty': 20,
      'pending_referral': 25,
      'pending_appointment': 20,
      'pending_test': 20,
      'pending_document': 15,
      'unresolved_medication_question': 30, // Higher priority for medication safety
      'missing_outcome': 25,
      'missing_responsibility': 20,
      'unverified_information': 20,
      'conflicting_information': 25
    }
    
    return basePriorities[category] ?? 15
  }
  
  /**
   * Basic deduplication of candidates (to be enhanced with semantic matching)
   * Per Directive #17: Detect duplicates before creating loops
   */
  private deduplicateCandidates(
    candidates: { loop: OpenLoop; evidence: string; confidence: number }[]
  ): { loop: OpenLoop; evidence: string; confidence: number }[] {
    const unique: { loop: OpenLoop; evidence: string; confidence: number }[] = []
    const seenDescriptions = new Set<string>()
    
    for (const candidate of candidates) {
      // Simple deduplication by description (can be enhanced with semantic similarity)
      const normalizedDesc = candidate.loop.description
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
      
      if (!seenDescriptions.has(normalizedDesc)) {
        seenDescriptions.add(normalizedDesc)
        unique.push(candidate)
      }
    }
    
    return unique
  }
  
  /**
   * Create a new open loop after duplicate checking
   * Per Directive #17: Update existing loop where appropriate
   */
  async createLoop(input: CreateLoopInput): Promise<OpenLoop | null> {
    // First check for potential duplicates
    const potentialDuplicates = await this.findPotentialDuplicates({
      caregiverId: input.caregiver_id,
      careRecipientId: input.care_recipient_id,
      description: input.description,
      category: input.category
    })
    
    if (potentialDuplicates.length > 0) {
      // Per Directive #17: Update existing loop where appropriate
      return await this.updateExistingLoop(potentialDuplicates[0], input)
    }
    
    // Create new loop
    const loop: OpenLoop = {
      id: uuidv4(),
      category: input.category,
      description: input.description,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'open',
      priority: input.priority ?? this.calculateInitialPriority(input.category),
      caregiver_id: input.caregiver_id,
      care_recipient_id: input.care_recipient_id,
      source_event_id: input.source_event_id ?? null,
      resolved_by_event_id: null,
      resolution: input.resolution ?? null,
      tags: input.tags ?? [],
      source: input.source ?? 'user_input',
      provenance: input.provenance ?? { creationMethod: 'manual' }
    }
    
    // Save to database
    const result = await this.db.query(
      `
        INSERT INTO open_loops (
          id, category, description, caregiver_id, care_recipient_id, priority,
          source_event_id, resolved_by_event_id, resolution, tags, source, provenance, status
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        ) RETURNING *
      `,
      [
        loop.id,
        loop.category,
        loop.description,
        loop.caregiver_id,
        loop.care_recipient_id,
        loop.priority,
        loop.source_event_id,
        loop.resolved_by_event_id,
        loop.resolution,
        loop.tags,
        loop.source,
        JSON.stringify(loop.provenance),
        loop.status
      ]
    )
    
    return result.rows[0]
  }
  
  /**
   * Find potential duplicate loops based on evidence and context
   * Per Directive #17: Search existing loops, compare related entity/evidence, semantic subject, temporal context
   */
  async findPotentialDuplicates(
    criteria: {
      caregiverId: string;
      careRecipientId: string;
      description: string;
      category: OpenLoopCategory;
      timeWindowHours?: number; // Optional temporal context
    }
  ): Promise<OpenLoop[]> {
    let query = `
      SELECT * FROM open_loops 
      WHERE caregiver_id = $1 
        AND care_recipient_id = $2 
        AND category = $3
        AND status IN ('open', 'reconnected')
    `
    const params: any[] = [
      criteria.caregiverId,
      criteria.careRecipientId,
      criteria.category
    ]
    let paramIndex = 4
    
    // Add temporal context if provided (Directive #25: understand when issue originated)
    if (criteria.timeWindowHours) {
      query += ` AND created_at >= NOW() - INTERVAL '${criteria.timeWindowHours} hours'`
    }
    
    const result = await this.db.query(query, params)
    const potentialDuplicates = result.rows
    
    // Further filter by semantic similarity of description (basic implementation)
    // In production, this would use embeddings or more sophisticated NLP
    const inputWords = new Set(
      criteria.description
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3)
    )
    
    return potentialDuplicates.filter(existing => {
      const existingWords = new Set(
        existing.description
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .split(/\s+/)
          .filter(w => w.length > 3)
      )
      
      // Calculate Jaccard similarity
      const intersection = new Set([...inputWords].filter(x => existingWords.has(x)))
      const union = new Set([...inputWords, ...existingWords])
      const similarity = intersection.size / union.size
      
      // Return if similarity > 0.7 (configurable threshold)
      return similarity > 0.7
    })
  }
  
  /**
   * Update an existing loop with new information (instead of creating duplicate)
   * Per Directive #17: Update the existing loop where appropriate
   */
  private async updateExistingLoop(
    existing: OpenLoop,
    input: CreateLoopInput
  ): Promise<OpenLoop> {
    // Build update fields based on what's new in input
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1
    
    // Only update if new information is provided and different
    if (input.description && input.description !== existing.description) {
      updates.push(`description = $${paramIndex++}`)
      values.push(input.description)
    }
    
    if (input.priority !== undefined && input.priority !== existing.priority) {
      updates.push(`priority = $${paramIndex++}`)
      values.push(input.priority)
    }
    
    if (input.tags) {
      // Merge tags, avoiding duplicates
      const mergedTags = Array.from(new Set([
        ...(existing.tags || []),
        ...(input.tags || [])
      ]))
      updates.push(`tags = $${paramIndex++}`)
      values.push(mergedTags)
    }
    
    // Update provenance to reflect new evidence
    if (input.provenance) {
      const updatedProvenance = {
        ...(existing.provenance || {}),
        ...input.provenance,
        lastUpdated: new Date().toISOString(),
        updateReason: 'duplicate_prevention_merge'
      }
      updates.push(`provenance = $${paramIndex++}`)
      values.push(JSON.stringify(updatedProvenance))
    }
    
    // Always update the updated_at timestamp
    updates.push(`updated_at = NOW()`)
    
    // Add WHERE clause value
    values.push(existing.id)
    
    if (updates.length === 0) {
      // No actual updates needed
      return existing
    }
    
    const query = `
      UPDATE open_loops
      SET ${updates.join(', ')}
      WHERE id = $${values.length}
      RETURNING *
    `
    
    const result = await this.db.query(query, values)
    return result.rows[0]
  }
  
  /**
   * Assign owner to loop based on evidence (Directive #18)
   * Never invent ownership - only assign from explicit evidence
   */
  async assignOwnerFromEvidence(
    loopId: string,
    evidenceList: Array<{ text: string; source: string; timestamp: Date }>
  ): Promise<{ ownerId: string | null; confidence: number; sourceEvidence: string }> {
    // Owner assignment patterns from evidence
    const ownershipPatterns = [
      // Explicit assignment patterns
      { 
        pattern: /\b(\w+(?:\s+\w+)*)\b\s+(?:will|shall|is going to|has agreed to|responsible for)\s+(?:schedule|arrange|handle|take care of|follow up on)/i,
        extractRole: (match: string) => match.trim(),
        confidence: 0.9
      },
      { 
        pattern: /\b(?:please|kindly)\s+(?:ask|have|tell)\s+(\w+(?:\s+\w+)*)\b\s+to\s+(?:schedule|arrange|handle)/i,
        extractRole: (match: string) => match.trim(),
        confidence: 0.85
      },
      // Role-based patterns (when explicit person mentioned with role)
      { 
        pattern: /\b(daughter|son|spouse|wife|husband|mother|father|family member|caregiver|professional|care coordinator)\s+(\w+(?:\s+\w+)*)\b/i,
        extractRole: (match: string) => {
          // Return the person name, not just the role
          const parts = match.split(/\s+/)
          return parts.slice(1).join(' ') // Skip the role word
        },
        confidence: 0.8
      }
    ]
    
    let bestMatch: { ownerId: string | null; confidence: number; sourceEvidence: string } = {
      ownerId: null,
      confidence: 0,
      sourceEvidence: ''
    }
    
    // Search through evidence for ownership clues
    for (const evidence of evidenceList) {
      for (const pattern of ownershipPatterns) {
        const matches = evidence.text.matchAll(pattern.pattern)
        for (const match of matches) {
          const potentialOwner = pattern.extractRole(match[0])
          if (potentialOwner && potentialOwner.length > 0) {
            // In a real system, we would map this name to a person ID
            // For now, we'll return the name as ownerId (would be resolved to UUID in practice)
            if (pattern.confidence > bestMatch.confidence) {
              bestMatch = {
                ownerId: potentialOwner, // Would be resolved to person ID in full implementation
                confidence: pattern.confidence,
                sourceEvidence: evidence.text.substring(
                  Math.max(0, match.index - 20),
                  Math.min(evidence.text.length, match.index + match[0].length + 20)
                )
              }
            }
          }
        }
      }
    }
    
    // If we found a candidate with sufficient confidence, update the loop
    if (bestMatch.ownerId && bestMatch.confidence > 0.7) {
      await this.db.query(
        `UPDATE open_loops SET caregiver_id = $1 WHERE id = $2`,
        [bestMatch.ownerId, loopId]
      )
    }
    
    return bestMatch
  }
  
  /**
   * Update loop progress based on new evidence (Directive #20)
   * Progress must be evidence-backed - never mark progress because user opened screen
   */
  async updateProgressFromEvidence(
    loopId: string,
    newEvidence: Array<{ text: string; type: string; timestamp: Date }>
  ): Promise<OpenLoop | null> {
    // Determine new status based on evidence
    const { newStatus, progressDescription } = this.determineProgressFromEvidence(newEvidence)
    
    if (!newStatus) {
      // No clear progress indicated by evidence
      return null
    }
    
    // Update the loop
    const result = await this.db.query(
      `
        UPDATE open_loops
        SET status = $1, 
            updated_at = NOW(),
            -- In a full implementation, we might track progress history
        WHERE id = $2
        RETURNING *
      `,
      [newStatus, loopId]
    )
    
    return result.rows[0] || null
  }
  
  /**
   * Determine progress status from evidence (Directive #20 examples)
   * Examples: "Referral submitted.", "Appointment scheduled.", "Document received."
   */
  private determineProgressFromEvidence(
    evidenceList: Array<{ text: string; type: string; timestamp: Date }>
  ): { newStatus: OpenLoopStatus | null; progressDescription: string | null } {
    const combinedText = evidenceList.map(e => e.text.toLowerCase()).join(' ')
    
    // Referral progress indicators
    if (/\b(referral|referral sent|referral submitted|referral filed)\b/.test(combinedText)) {
      return { newStatus: 'open', progressDescription: 'Referral submitted' } // Still open but progressing
    }
    
    if (/\b(referral scheduled|appointment made with specialist)\b/.test(combinedText)) {
      return { newStatus: 'open', progressDescription: 'Referral scheduled' }
    }
    
    // Appointment progress indicators
    if (/\b(appointment scheduled|appointment booked|visit scheduled)/.test(combinedText)) {
      return { newStatus: 'open', progressDescription: 'Appointment scheduled' }
    }
    
    if (/\b(appointment completed|visit occurred|saw specialist|had appointment)/.test(combinedText)) {
      return { newStatus: 'open', progressDescription: 'Appointment completed' } // Still awaiting outcome
    }
    
    // Test progress indicators
    if (/\b(test ordered|lab ordered|test scheduled)/.test(combinedText)) {
      return { newStatus: 'open', progressDescription: 'Test ordered' }
    }
    
    if (/\b(test completed|test done|labs back|results available)/.test(combinedText)) {
      return { newStatus: 'open', progressDescription: 'Test completed - awaiting results' }
    }
    
    if (/\b(results received|results available|test results back)/.test(combinedText)) {
      return { newStatus: 'open', progressDescription: 'Test results received - awaiting interpretation' }
    }
    
    // Document progress indicators
    if (/\b(document received|report received|discharge summary obtained)/.test(combinedText)) {
      return { newStatus: 'open', progressDescription: 'Document received - awaiting review' }
    }
    
    // Medication progress indicators
    if (/\b(medication clarified|dose confirmed|pharmacist verified)/.test(combinedText)) {
      return { newStatus: 'resolved', progressDescription: 'Medication question resolved' }
    }
    
    // Responsibility progress indicators
    if (/\b(responsibility assigned|owner confirmed|clear responsibility)/.test(combinedText)) {
      return { newStatus: 'open', progressDescription: 'Responsibility assigned' }
    }
    
    // General resolution indicators (only when uncertainty is actually resolved)
    if (/\b(question answered|issue resolved|uncertainty resolved|conflict resolved)/.test(combinedText)) {
      return { newStatus: 'resolved', progressDescription: 'Issue resolved based on evidence' }
    }
    
    // No clear progress indicated
    return { null, null }
  }
  
  /**
   * Resolve loop when underlying uncertainty is actually resolved (Directive #21)
   * Per Directive #22: Do NOT delete original uncertainty - preserve history
   */
  async resolveLoop(
    loopId: string,
    resolutionEvidence: Array<{ text: string; source: string; timestamp: Date }>,
    resolutionDescription: string
  ): Promise<OpenLoop | null> {
    // Per Directive #22: Preserve original uncertainty
    // We don't delete or modify the original loop description/status
    // Instead, we mark it as resolved and preserve the resolution evidence
    
    const result = await this.db.query(
      `
        UPDATE open_loops
        SET status = 'resolved',
            resolution = $1,
            resolved_by_event_id = $2, -- Would link to care_events table in full implementation
            updated_at = NOW(),
            -- Provenance gets updated to reflect resolution
            provenance = jsonb_set(
              COALESCE(provenance, '{}'::jsonb),
              '{resolution}',
              to_jsonb($3::text) - '{null}'::text[],
              true
            )
        WHERE id = $4
        RETURNING *
      `,
      [
        resolutionDescription,
        null, // In full implementation, this would be the UUID of the resolving care event
        JSON.stringify({
          resolutionEvidence: resolutionEvidence.map(e => ({
            text: e.text,
            source: e.source,
            timestamp: e.timestamp.toISOString()
          })),
          resolutionTimestamp: new Date().toISOString(),
          resolutionMethod: 'evidence_based'
        }),
        loopId
      ]
    )
    
    return result.rows[0] || null
  }
  
  /**
   * Get loops for a caregiver/care recipient pair with filtering
   * Mirrors the API but for service-layer use
   */
  async getLoops(
    filters: {
      caregiverId?: string;
      careRecipientId?: string;
      status?: OpenLoopStatus;
      category?: OpenLoopCategory;
      limit?: number;
      offset?: number;
    }
  ): Promise<OpenLoop[]> {
    let query = 'SELECT * FROM open_loops WHERE 1=1'
    const params: any[] = []
    let paramIndex = 1
    
    if (filters.caregiverId) {
      query += ` AND caregiver_id = $${paramIndex++}`
      params.push(filters.caregiverId)
    }
    if (filters.careRecipientId) {
      query += ` AND care_recipient_id = $${paramIndex++}`
      params.push(filters.careRecipientId)
    }
    if (filters.status) {
      query += ` AND status = $${paramIndex++}`
      params.push(filters.status)
    }
    if (filters.category) {
      query += ` AND category = $${paramIndex++}`
      params.push(filters.category)
    }
    
    query += ` ORDER BY created_at DESC`
    
    if (filters.limit !== undefined) {
      query += ` LIMIT $${paramIndex++}`
      params.push(filters.limit)
    }
    if (filters.offset !== undefined) {
      query += ` OFFSET $${paramIndex++}`
      params.push(filters.offset)
    }
    
    const result = await this.db.query(query, params)
    return result.rows
  }
  
  /**
   * Get unresolved loops (open or reconnected) - Directive #20, #30
   */
  async getUnresolvedLoops(
    caregiverId: string,
    careRecipientId: string
  ): Promise<OpenLoop[]> {
    return this.getLoops({
      caregiverId,
      careRecipientId,
      status: 'open' // In practice, would also include 'reconnected'
    })
  }
  
  /**
   * Per Directive #25: Detect stale unresolved items
   * But note: "stale ? resolved" - only flag if no resolution evidence exists
   */
  async getStaleLoops(
    careRecipientId: string,
    maxAgeDays: number = 30,
    minPriority: number = 20
  ): Promise<OpenLoop[]> {
    const result = await this.db.query(
      `
        SELECT * FROM open_loops
        WHERE care_recipient_id = $1
          AND status IN ('open', 'reconnected')
          AND priority >= $2
          AND created_at < NOW() - INTERVAL '$3 days'
          -- Additional staleness criteria could be added here
          -- For example, no recent updates on high-priority items
        ORDER BY created_at ASC
      `,
      [careRecipientId, minPriority, maxAgeDays]
    )
    
    return result.rows
  }
}
