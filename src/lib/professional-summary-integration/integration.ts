
import { OpenLoopService } from '../open-loop-service'

/**
 * Integration between Open Loop System and Professional Summary Generation
 * 
 * This integration enables the Professional Summary system to surface relevant
 * unresolved open loops as part of the summary generation process.
 */
export class ProfessionalSummaryOpenLoopIntegration {
  constructor(private openLoopService: OpenLoopService) {}

  /**
   * Get unresolved open loops for inclusion in a professional summary
   * 
   * @param careRecipientId The ID of the care recipient
   * @returns Array of open loops with relevant information for the summary
   */
  async getOpenLoopsForProfessionalSummary(careRecipientId: string) {
    return await this.openLoopService.getLoops({
      careRecipientId,
      status: 'open',
      limit: 10
    });
  }
  
  /**
   * Format open loops for inclusion in a professional summary
   * 
   * @param loops Array of open loops to format
   * @returns Formatted string suitable for professional summary
   */
  formatOpenLoopsForSummary(loops: any[]): string {
    if (loops.length === 0) {
      return 'No unresolved items were identified in the care record.';
    }
    
    // Group by category and format for readability
    const groups: Record<string, string[]> = {};
    loops.forEach(loop => {
      if (!groups[loop.category]) {
        groups[loop.category] = [];
      }
      groups[loop.category].push('\ (\% confidence)');
    });
    
    const lines: string[] = [];
    for (const [category, descriptions] of Object.entries(groups)) {
      lines.push('\\\n\:');
      descriptions.forEach((desc, index) => {
        lines.push('  \. \');
      });
    }
    
    return lines.join('\n');
  }
  
  private formatCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      'unanswered_question': 'Unanswered Questions',
      'pending_referral': 'Pending Referrals',
      'pending_appointment': 'Pending Appointments',
      'pending_test': 'Pending Tests',
      'pending_document': 'Pending Documents',
      'unresolved_medication_question': 'Unresolved Medication Questions',
      'missing_outcome': 'Missing Outcomes',
      'missing_responsibility': 'Missing Responsibility Assignments',
      'unverified_information': 'Unverified Information',
      'conflicting_information': 'Conflicting Information'
    };
    
    return labels[category] || category;
  }
}

