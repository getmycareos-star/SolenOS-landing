/**
 * SolenOS TTS SSML envelope — calm, professional readback.
 * Slow rate, low-medium pitch, 300ms breaks around text.
 */

export const TTS_PROSODY_RATE = "slow";
export const TTS_PROSODY_PITCH = "low";
export const TTS_BREAK_MS = 300;

export function escapeSsmlText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Wrap plain text in SolenOS calm-read SSML.
 */
export function buildCalmSsml(text: string): string {
  const safe = escapeSsmlText(text.trim());
  return (
    `<speak>` +
    `<break time="${TTS_BREAK_MS}ms"/>` +
    `<prosody rate="${TTS_PROSODY_RATE}" pitch="${TTS_PROSODY_PITCH}">${safe}</prosody>` +
    `<break time="${TTS_BREAK_MS}ms"/>` +
    `</speak>`
  );
}
