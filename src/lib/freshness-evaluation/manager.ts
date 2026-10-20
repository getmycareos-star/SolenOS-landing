import type { FreshnessEvaluator } from './types';
import type { FreshnessAssessment, FreshnessEvaluationContext, FreshnessWrapper } from './types';

/**
 * Manager for coordinating freshness evaluations across domains.
 * This is the main entry point for the freshness system.
 */
export class FreshnessEvaluationManager {
  private evaluators: Map<string, FreshnessEvaluator<any>> = new Map();
  
  /**
   * Register a freshness evaluator for a specific domain.
   * 
   * @param domainName Identifier for the domain (e.g., 'medication', 'routine')
   * @param evaluator The evaluator implementation
   */
  registerEvaluator(domainName: string, evaluator: FreshnessEvaluator<any>): void {
    this.evaluators.set(domainName, evaluator);
  }
  
  /**
   * Get an evaluator for a specific domain.
   * 
   * @param domainName Identifier for the domain
   * @returns The evaluator if found, undefined otherwise
   */
  getEvaluator(domainName: string): FreshnessEvaluator<any> | undefined {
    return this.evaluators.get(domainName);
  }
  
  /**
   * Evaluate freshness for an item using the appropriate domain evaluator.
   * 
   * @param domainName The domain to evaluate for
   * @param item The item to evaluate
   * @param context Evaluation context
   * @returns Freshness assessment
   */
  async evaluateFreshness<T>(
    domainName: string,
    item: T,
    context: FreshnessEvaluationContext
  ): Promise<FreshnessAssessment> {
    const evaluator = this.evaluators.get(domainName);
    if (!evaluator) {
      throw new Error(`No freshness evaluator registered for domain: ${domainName}`);
    }
    
    return evaluator.evaluateFreshness(item, context);
  }
  
  /**
   * Evaluate freshness for multiple items of the same domain.
   * 
   * @param domainName The domain to evaluate for
   * @param items The items to evaluate
   * @param context Evaluation context
   * @returns Array of freshness wrappers
   */
  async evaluateBatch<T>(
    domainName: string,
    items: T[],
    context: FreshnessEvaluationContext
  ): Promise<FreshnessWrapper<T>[]> {
    const evaluator = this.evaluators.get(domainName);
    if (!evaluator) {
      throw new Error(`No freshness evaluator registered for domain: ${domainName}`);
    }
    
    const results: FreshnessWrapper<T>[] = [];
    for (const item of items) {
      const assessment = await evaluator.evaluateFreshness(item, context);
      results.push({ item, freshness: assessment });
    }
    
    return results;
  }
  
  /**
   * Get all registered domain names.
   */
  getRegisteredDomains(): string[] {
    return Array.from(this.evaluators.keys());
  }
  
  /**
   * Check if an evaluator is registered for a domain.
   * 
   * @param domainName The domain to check
   * @returns True if an evaluator is registered
   */
  hasEvaluator(domainName: string): boolean {
    return this.evaluators.has(domainName);
  }
}