/**
 * Shared Gemini env resolution for API routes.
 * Next.js loads `.env`, `.env.local`, and mode-specific variants at startup.
 * Restart `npm run dev` after changing any of those files.
 */
export function getGeminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY?.trim() || undefined;
}

export const GEMINI_ENV_MISSING_MESSAGE =
  "GEMINI_API_KEY not configured. Add it to `.env` or `.env.local`, then restart the dev server.";
