/**
 * Output isolation — strict JSON.parse only. No repair, extraction, or coercion.
 */
export function strictParseModelJson(rawOutput: string): unknown {
  return JSON.parse(rawOutput);
}
