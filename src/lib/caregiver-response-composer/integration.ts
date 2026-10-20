import { OpenLoopService } from '../open-loop-service'

/**
 * Integration between Open Loop System and Caregiver Response Composer
 * 
 * This integration enables the Caregiver Response Composer to surface relevant
 * unresolved open loops in the caregiver's response, fulfilling Directive #30:
 * \"Open Loops must be part of caregiver handoff context.\"
 */
export class CaregiverResponseOpenLoopIntegration {
  constructor(private openLoopService: OpenLoopService) {}

  /**
   * Get open loops for inclusion in caregiver handoff/response
   * 
   * @param careRecipientId The ID of the care recipient
   * @param caregiverId The ID of the current/new caregiver
   * @returns Open loop information formatted for caregiver handoff
   */
  async getOpenLoopsForCaregiverHandoff(
    careRecipientId: string,
    caregiverId: string
  ) {
    // Get loops where either the caregiver is assigned or where ownership is unknown
    const assignedLoops = await this.openLoopService.getLoops({
      careRecipientId,
      caregiverId,
      status: 'open'
    });
    
    const unassignedLoops = await this.openLoopService.getLoops({
      careRecipientId,
      status: 'open'
    }).then(loops => 
      loops.filter(loop => !loop.caregiver_id) // Loops without assigned caregiver
    );
    
    // Combine and deduplicate
    const allLoops = [...assignedLoops, ...unassignedLoops];
    const uniqueLoops = Array.from(new Map(allLoops.map(loop => 
      [loop.id, loop]
    )).values());
    
    return {
      assignedLoops: assignedLoops,
      unassignedLoops: unassignedLoops,
      allLoops: uniqueLoops,
      summary: this.formatLoopsForCaregiverHandoff(uniqueLoops)
    };
  }
  
  /**
   * Format open loops for caregiver handoff context
   * 
   * @param loops Array of open loops to format
   * @returns Formatted string suitable for caregiver handoff context
   */
  formatLoopsForCaregiverHandoff(loops: any[]): string {
    if (loops.length === 0) {
      return 'No unresolved items require attention in the care record.';
    }
    
    // Separate by ownership status
    const assignedLoops = loops.filter(loop => loop.caregiver_id);
    const unassignedLoops = loops.filter(loop => !loop.caregiver_id);
    
    const lines: string[] = [];
    
    if (assignedLoops.length > 0) {
      lines.push('\nUnresolved Items (Assigned to You):');
      assignedLoops.forEach((loop, index) => {
        lines.push(
            . 
        );
        lines.push(
               Type: 
        );
        lines.push(
               Identified: 
        );
        lines.push(
               Confidence: %
        );
        if (loop.evidence) {
          const evidencePreview = loop.evidence.length > 100 
            ? loop.evidence.substring(0, 100) + '...' 
            : loop.evidence;
          lines.push(
                 Evidence: \"\"
          );
        }
        lines.push(''); // Empty line for readability
      });
    }
    
    if (unassignedLoops.length > 0) {
      lines.push('\nUnresolved Items (Ownership Unknown):');
      unassignedLoops.forEach((loop, index) => {
        lines.push(
            . 
        );
        lines.push(
               Type: 
        );
        lines.push(
               Identified: 
        );
        lines.push(
               Confidence: %
        );
        if (loop.evidence) {
          const evidencePreview = loop.evidence.length > 100 
            ? loop.evidence.substring(0, 100) + '...' 
            : loop.evidence;
          lines.push(
                 Evidence: \"\"
          );
        }
        lines.push(''); // Empty line for readability
      });
    }
    
    return lines.join('\n');
  }
  
  private formatCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      'unanswered_question': 'Unanswered Question',
      'pending_referral': 'Pending Referral',
      'pending_appointment': 'Pending Appointment',
      'pending_test': 'Pending Test',
      'pending_document': 'Pending Document',
      'unresolved_medication_question': 'Unresolved Medication Question',
      'missing_outcome': 'Missing Outcome',
      'missing_responsibility': 'Missing Responsibility',
      'unverified_information': 'Unverified Information',
      'conflicting_information': 'Conflicting Information'
    };
    
    return labels[category] || category;
  }
}
