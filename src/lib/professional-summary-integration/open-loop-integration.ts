
import { OpenLoopService } from '../open-loop-service'
import { Pool } from 'pg'

export class ProfessionalSummaryOpenLoopIntegration {
  constructor(
    private openLoopService: OpenLoopService,
    private db: Pool
  ) {}

  async enhanceProfessionalSummaryWithOpenLoops(careRecipientId: string) {
    const openLoops = await this.openLoopService.getLoops({
      careRecipientId,
      status: 'open'
    });
    
    return {
      openLoops: openLoops,
      summary: Found  unresolved items
    };
  }
}

