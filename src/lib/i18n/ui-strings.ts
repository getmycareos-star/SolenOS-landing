import type { SolenOSLanguage } from "@/lib/multilingual-execution";

export interface UiStrings {
  tagline: string;
  inputLabel: string;
  inputPlaceholder: string;
  submitIdle: string;
  submitLoading: string;
  languageLabel: string;
  continuitySaveAction: string;
  continuityLoginAction: string;
  continuityDismiss: string;
  continuityEmailLabel: string;
  continuityPasswordLabel: string;
  continuitySaving: string;
}

const CONTINUITY_STRINGS = {
  continuitySaveAction: "Save this care situation",
  continuityLoginAction: "Continue saved care",
  continuityDismiss: "Not now",
  continuityEmailLabel: "Email",
  continuityPasswordLabel: "Password",
  continuitySaving: "Saving...",
} as const;

export const UI_STRINGS: Record<SolenOSLanguage, UiStrings> = {
  en: {
    tagline: "The care journey, remembered.",
    inputLabel: "Describe your caregiving situation",
    inputPlaceholder:
      "Discharge notes, medication confusion, what the doctor said, what's overwhelming you...",
    submitIdle: "Get clarity",
    submitLoading: "Analyzing...",
    languageLabel: "Language",
    ...CONTINUITY_STRINGS,
  },
  es: {
    tagline: "Menos carga. Más claridad ahora.",
    inputLabel: "Describe tu situación de cuidado",
    inputPlaceholder:
      "Notas de alta, confusión con medicamentos, lo que dijo el doctor, lo que te abruma...",
    submitIdle: "Obtener claridad",
    submitLoading: "Analizando...",
    languageLabel: "Idioma",
    ...CONTINUITY_STRINGS,
  },
  zh: {
    tagline: "负担更少，此刻更清晰。",
    inputLabel: "描述您的照护情况",
    inputPlaceholder: "出院说明、用药困惑、医生说了什么、让您感到压力的内容……",
    submitIdle: "获得清晰指引",
    submitLoading: "分析中……",
    languageLabel: "语言",
    ...CONTINUITY_STRINGS,
  },
  tl: {
    tagline: "Mas kaunting pasanin. Mas malinaw ngayon.",
    inputLabel: "Ilarawan ang iyong sitwasyon sa pag-aalaga",
    inputPlaceholder:
      "Mga discharge note, pagkalito sa gamot, sinabi ng doktor, kung ano ang nakakabigat sa iyo...",
    submitIdle: "Kumuha ng linaw",
    submitLoading: "Sinusuri...",
    languageLabel: "Wika",
    ...CONTINUITY_STRINGS,
  },
  vi: {
    tagline: "Ít gánh nặng hơn. Rõ ràng hơn ngay bây giờ.",
    inputLabel: "Mô tả tình huống chăm sóc của bạn",
    inputPlaceholder:
      "Giấy ra viện, nhầm lẫn thuốc, lời bác sĩ, điều gì đang khiến bạn quá tải...",
    submitIdle: "Nhận sự rõ ràng",
    submitLoading: "Đang phân tích...",
    languageLabel: "Ngôn ngữ",
    ...CONTINUITY_STRINGS,
  },
  ko: {
    tagline: "덜 짊어지고, 지금 더 분명하게.",
    inputLabel: "돌봄 상황을 설명해 주세요",
    inputPlaceholder:
      "퇴원 안내, 약물 혼란, 의사의 말, 지금 버거운 점...",
    submitIdle: "명확함 얻기",
    submitLoading: "분석 중...",
    languageLabel: "언어",
    ...CONTINUITY_STRINGS,
  },
  fa: {
    tagline: "بار کمتر. وضوح بیشتر همین حالا.",
    inputLabel: "وضعیت مراقبتی خود را توضیح دهید",
    inputPlaceholder:
      "یادداشت ترخیص، سردرگمی دارویی، حرف پزشک، آنچه شما را تحت فشار قرار می‌دهد...",
    submitIdle: "دریافت وضوح",
    submitLoading: "در حال تحلیل...",
    languageLabel: "زبان",
    ...CONTINUITY_STRINGS,
  },
  ar: {
    tagline: "عبء أقل. وضوح أكثر الآن.",
    inputLabel: "صف وضع رعايتك",
    inputPlaceholder:
      "ملاحظات الخروج، ارتباك الأدوية، ما قاله الطبيب، ما يثقل عليك...",
    submitIdle: "احصل على وضوح",
    submitLoading: "جارٍ التحليل...",
    languageLabel: "اللغة",
    ...CONTINUITY_STRINGS,
  },
  ru: {
    tagline: "Меньше нагрузки. Яснее прямо сейчас.",
    inputLabel: "Опишите вашу ситуацию ухода",
    inputPlaceholder:
      "Выписка, путаница с лекарствами, слова врача, что вас перегружает...",
    submitIdle: "Получить ясность",
    submitLoading: "Анализ...",
    languageLabel: "Язык",
    ...CONTINUITY_STRINGS,
  },
  hy: {
    tagline: "Պակաս բեռ. Ավելի պարզ հիմա.",
    inputLabel: "Նկարագրեք ձեր խնամքի իրավիճակը",
    inputPlaceholder:
      "Դուրսգրման նշումներ, դեղերի շփոթություն, բժշկի ասածը, ինչն է ձեզ ծանրացնում...",
    submitIdle: "Ստանալ պարզություն",
    submitLoading: "Վերլուծում...",
    languageLabel: "Լեզու",
    ...CONTINUITY_STRINGS,
  },
};

export function getUiStrings(language: SolenOSLanguage): UiStrings {
  return UI_STRINGS[language] ?? UI_STRINGS.en;
}

export { SOLENOS_LANGUAGES, SOLENOS_LANGUAGE_NAMES } from "@/lib/multilingual-execution";
