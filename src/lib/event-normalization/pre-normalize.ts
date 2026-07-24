import type { PreNormalizedText } from "./types";

export function preNormalizeText(content: string, inputType: string): PreNormalizedText {
  const fixes: string[] = [];
  let text = content.trim();

  text = text.replace(/\s+/g, " ");
  if (text !== content.trim()) fixes.push("collapsed_whitespace");

  text = text.replace(/\[inaudible\]/gi, "");
  text = text.replace(/\?{2,}/g, "");
  if (inputType === "voice_transcript") fixes.push("voice_artifact_cleanup");

  text = text.replace(/([a-z])([A-Z])/g, "$1 $2");
  text = text.replace(/\s+([,.!?])/g, "$1");

  return { original: content, normalized: text.trim(), fixes_applied: fixes };
}
