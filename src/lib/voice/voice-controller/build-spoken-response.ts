import { normalizeClarityEnvelope } from "@/lib/mvp-workspace";

/** Spoken response for Voice Conversation Mode — clarity fields, not raw transcript. */
export function buildVoiceSpokenResponse(raw: Record<string, unknown>): string {
  const envelope = normalizeClarityEnvelope(raw);
  const parts = [
    envelope.what_is_happening,
    `What matters now: ${envelope.what_matters_now}`,
    envelope.what_can_wait ? `What can wait: ${envelope.what_can_wait}` : "",
    envelope.what_to_ask_next
      ? `When you are ready, consider asking: ${envelope.what_to_ask_next}`
      : "",
  ].filter(Boolean);
  return parts.join(". ");
}

/** Short greeting when entering voice mode. */
export function buildVoiceModeGreeting(languageHint?: string): string {
  const lang = languageHint?.slice(0, 2) ?? "en";
  const greetings: Record<string, string> = {
    en: "I am listening. Tell me what is happening.",
    es: "Estoy escuchando. Cuéntame qué está pasando.",
    zh: "我在听。告诉我发生了什么。",
    tl: "Nakikinig ako. Sabihin mo sa akin ang nangyayari.",
    vi: "Tôi đang lắng nghe. Hãy cho tôi biết chuyện gì đang xảy ra.",
    ko: "듣고 있습니다. 무슨 일이 일어나고 있는지 말씀해 주세요.",
    fa: "گوش می‌دهم. بگویید چه اتفاقی افتاده است.",
    ar: "أنا أستمع. أخبرني بما يحدث.",
    ru: "Я слушаю. Расскажите, что происходит.",
    hy: "Լսում եմ։ Ասեք, թե ինչ է տեղի ունենում։",
  };
  return greetings[lang] ?? greetings.en;
}
