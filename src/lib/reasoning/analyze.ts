import type { SolenOSOutput } from "../output-contract/types";
import { analyzeRawText } from "../engine/pipeline";
import { DEFAULT_SOLENOS_LANGUAGE, makeLanguageAwarePrompt } from "../multilingual-execution";
import type { SolenOSLanguage } from "../multilingual-execution/types";

/**
 * AI layer entry — uses care_analysis_tool (state engine).
 * Gemini enhancement optional; pipeline is source of truth for structure.
 */
export async function analyze(
  input: string,
  userLanguage: SolenOSLanguage = DEFAULT_SOLENOS_LANGUAGE,
): Promise<SolenOSOutput> {
  if (process.env.GEMINI_API_KEY) {
    try {
      const gemini = await analyzeWithGemini(input, userLanguage);
      return gemini;
    } catch {
      // fall through to state engine
    }
  }
  return analyzeRawText(input).clarity.output;
}

async function analyzeWithGemini(
  input: string,
  userLanguage: SolenOSLanguage,
): Promise<SolenOSOutput> {
  const apiKey = process.env.GEMINI_API_KEY!;
  const pipeline = analyzeRawText(input);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;

  const systemPrompt = `You are SolenOS care_analysis_tool. Transform caregiver input into structured cognitive relief.

RULES: Simplify. Prioritize urgency. Surface uncertainty. NO diagnosis. NO prescriptions. NO motivational language.
Return ONLY JSON matching CareOutput schema with these exact fields:
what_is_happening, what_matters_now, what_to_ask_next, risk_level (low|medium|high), what_can_wait, follow_up_items (array).

Context from state engine:
- Load level: ${pipeline.trace.cognitive_load.load_level}
- Priority: ${pipeline.trace.priority.classification}
- Uncertain: ${pipeline.trace.interpreted.uncertain_elements}`;

  const wrappedPrompt = makeLanguageAwarePrompt(
    `${systemPrompt}\n\nInput:\n${input}`,
    userLanguage,
  );

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: wrappedPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) throw new Error("Gemini request failed");

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty Gemini response");

  const { validateOutput } = await import("../output-contract/validate");
  return validateOutput(JSON.parse(text));
}
