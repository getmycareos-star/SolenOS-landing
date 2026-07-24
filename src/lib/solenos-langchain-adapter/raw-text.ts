/** Extract plain text from LangChain message content — no parsing or validation. */
export function extractRawLLMText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text: unknown }).text);
        }
        return "";
      })
      .join("");
  }

  if (content == null) {
    return "";
  }

  return String(content);
}
