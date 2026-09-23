/** Semantic extraction — invokes Qwen via LLM provider, validates, normalizes. */

import { createLlmProvider } from "../llm-provider";
import type { LlmProvider } from "../llm-provider";
import type {
  ExtractionResult,
  SemanticExtraction,
} from "./types";
import { buildExtractionPrompt } from "./prompt";

const EXTRACTION_TIMEOUT_MS = 300000;

export class SemanticExtractor {
  private provider: LlmProvider | null = null;
  private providerPromise: Promise<LlmProvider> | null = null;

  private async getProvider(): Promise<LlmProvider> {
    if (this.provider) return this.provider;
    if (!this.providerPromise) {
      this.providerPromise = createLlmProvider({
        provider: "ollama",
        model: "qwen2.5-coder:1.5b",
        timeoutMs: EXTRACTION_TIMEOUT_MS,
        temperature: 0.1,
        maxTokens: 4096,
      });
    }
    this.provider = await this.providerPromise;
    return this.provider;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const provider = await this.getProvider();
      return await provider.isAvailable();
    } catch {
      return false;
    }
  }

  async extract(note: string): Promise<ExtractionResult> {
    const startTime = Date.now();
    let provider: LlmProvider | null = null;
    let durationMs = 0;

    try {
      provider = await this.getProvider();
    } catch (error) {
      return {
        success: false,
        extraction: null,
        raw_response: "",
        parsed_content: null,
        duration_ms: Date.now() - startTime,
        model: "qwen2.5-coder:1.5b",
        provider: "ollama",
        error: `Failed to initialize provider: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    const prompt = buildExtractionPrompt(note);
    const result = await provider.invoke({
      model: "qwen2.5-coder:1.5b",
      messages: [
        { role: "system", content: "You are a semantic extraction engine. Return ONLY valid JSON." },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      maxTokens: 4096,
      timeoutMs: EXTRACTION_TIMEOUT_MS,
      format: "json",
    });

    durationMs = result.durationMs;

    if (!result.success || !result.parsedContent) {
      return {
        success: false,
        extraction: null,
        raw_response: result.content,
        parsed_content: result.parsedContent,
        duration_ms: durationMs,
        model: result.model,
        provider: result.provider,
        error: result.error ?? "Extraction failed — no valid response from model",
      };
    }

    // Validate against schema
    const validated = validateExtraction(result.parsedContent);
    if (!validated.valid || !validated.extraction) {
      return {
        success: false,
        extraction: null,
        raw_response: result.content,
        parsed_content: result.parsedContent,
        duration_ms: durationMs,
        model: result.model,
        provider: result.provider,
        error: `Schema validation failed: ${validated.issues.join("; ")}`,
      };
    }

    return {
      success: true,
      extraction: validated.extraction,
      raw_response: result.content,
      parsed_content: result.parsedContent,
      duration_ms: durationMs,
      model: result.model,
      provider: result.provider,
    };
  }
}

function validateExtraction(data: unknown): { valid: boolean; extraction: SemanticExtraction | null; issues: string[] } {
  const issues: string[] = [];

  if (typeof data !== "object" || data === null) {
    return { valid: false, extraction: null, issues: ["Response is not a JSON object"] };
  }

  const obj = data as Record<string, unknown>;

  // Check required top-level fields
  if (obj.schema_version !== "1.0.0") {
    issues.push(`schema_version must be "1.0.0", got: ${obj.schema_version}`);
  }

  // Validate arrays
  const arrayFields: (keyof SemanticExtraction)[] = [
    "observations", "measurements", "medications", "temporal_facts",
    "attributions", "contradictions", "uncertainties", "questions", "appointments",
  ];

  for (const field of arrayFields) {
    if (obj[field] !== undefined && !Array.isArray(obj[field])) {
      issues.push(`${String(field)} must be an array`);
    }
  }

  // Validate extraction_confidence
  if (typeof obj.extraction_confidence !== "number" || obj.extraction_confidence < 0 || obj.extraction_confidence > 1) {
    issues.push("extraction_confidence must be a number between 0 and 1");
  }

  if (issues.length > 0) {
    return { valid: false, extraction: null, issues };
  }

  // Build normalized extraction
  const extraction: SemanticExtraction = {
    schema_version: "1.0.0",
    observations: Array.isArray(obj.observations) ? obj.observations as SemanticExtraction["observations"] : [],
    measurements: Array.isArray(obj.measurements) ? obj.measurements as SemanticExtraction["measurements"] : [],
    medications: Array.isArray(obj.medications) ? obj.medications as SemanticExtraction["medications"] : [],
    temporal_facts: Array.isArray(obj.temporal_facts) ? obj.temporal_facts as SemanticExtraction["temporal_facts"] : [],
    attributions: Array.isArray(obj.attributions) ? obj.attributions as SemanticExtraction["attributions"] : [],
    contradictions: Array.isArray(obj.contradictions) ? obj.contradictions as SemanticExtraction["contradictions"] : [],
    uncertainties: Array.isArray(obj.uncertainties) ? obj.uncertainties as SemanticExtraction["uncertainties"] : [],
    questions: Array.isArray(obj.questions) ? obj.questions as SemanticExtraction["questions"] : [],
    appointments: Array.isArray(obj.appointments) ? obj.appointments as SemanticExtraction["appointments"] : [],
    extraction_confidence: typeof obj.extraction_confidence === "number" ? obj.extraction_confidence : 0.5,
    extraction_notes: typeof obj.extraction_notes === "string" ? obj.extraction_notes : null,
  };

  return { valid: true, extraction, issues: [] };
}

export function createSemanticExtractor(): SemanticExtractor {
  return new SemanticExtractor();
}