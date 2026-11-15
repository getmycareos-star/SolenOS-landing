import assert from "node:assert/strict";
import fs from "node:fs";

const context = fs.readFileSync("src/lib/workspace-context.tsx", "utf8");
const selector = fs.readFileSync("src/components/language-selector/LanguagePreferenceSelect.tsx", "utf8");
const settings = fs.readFileSync("src/app/workspace/settings/page.tsx", "utf8");
const languageContract = fs.readFileSync("src/lib/language-preference.ts", "utf8");
const companion = fs.readFileSync("src/components/workflows/AICompanion.tsx", "utf8");
const onboarding = fs.readFileSync("src/components/onboarding/OnboardingGate.tsx", "utf8");
const consent = fs.readFileSync("src/components/public/EarlyAccessConsentForm.tsx", "utf8");
const appShell = fs.readFileSync("src/components/app-shell/AppShell.tsx", "utf8");
const languageProvider = fs.readFileSync("src/components/providers/LanguageProvider.tsx", "utf8");
const dailyCarePage = fs.readFileSync("src/app/workspace/daily-care/page.tsx", "utf8");
const changeHistory = fs.readFileSync("src/components/mvp-workspace/ChangeIntelligencePanel.tsx", "utf8");

assert.ok(context.includes('window.localStorage.getItem(LANGUAGE_STORAGE_KEY)'));
assert.ok(context.includes('coerceSolenOSUiLanguage(savedLanguage)'));
assert.ok(languageContract.includes('"en" | "es" | "fr"'));
for (const language of ['"en"', '"es"', '"fr"']) {
  assert.ok(languageContract.includes(language), `language contract must include ${language}`);
}
assert.ok(selector.includes("SOLENOS_UI_LANGUAGES.map"));
assert.ok(selector.includes("Español"));
assert.ok(selector.includes("Français"));
assert.ok(companion.includes('language: selectedLanguage'));
assert.ok(companion.includes('selectedLanguage === "en"'));
assert.ok(appShell.includes('useSolenOSTranslations'));
assert.ok(appShell.includes('t(`navigation.${label}`)'));
assert.ok(appShell.includes('t("navigation.searchHistory")'));
assert.ok(appShell.includes('t("navigation.settings")'));
assert.ok(languageProvider.includes("LanguageContext.Provider"));
assert.ok(languageProvider.includes("lookupTranslation"));
assert.ok(languageProvider.includes('window.addEventListener("solenos:language-change"'));
assert.ok(languageProvider.includes("document.documentElement.lang = next"));
assert.ok(dailyCarePage.includes('useSolenOSTranslations'));
assert.ok(dailyCarePage.includes('t("dailyCare.title")'));
assert.ok(dailyCarePage.includes('t("dailyCare.where")'));
assert.ok(dailyCarePage.includes('t("dailyCare.recentHistory")'));
assert.ok(changeHistory.includes('useSolenOSTranslations'));
assert.ok(changeHistory.includes('t("changeIntelligence.title")'));
assert.ok(changeHistory.includes('t("changeIntelligence.situations")'));

assert.ok(selector.includes('new CustomEvent("solenos:language-change"'));
assert.ok(onboarding.includes("<LanguagePreferenceSelect />"));
assert.ok(onboarding.includes("ONBOARDING_COPY[language].title"));
assert.ok(consent.includes("CONSENT_COPY[language]"));
assert.ok(consent.includes("{copy.whatFirst}"));
for (const locale of ["en", "es", "fr"]) {
  const translations = JSON.parse(fs.readFileSync(`src/lib/i18n/locales/${locale}/translation.json`, "utf8"));

  for (const key of ["title", "tagline", "intro", "where", "latest", "noCurrent", "documents", "followups", "openMatters", "careToday", "needsConfirmation", "recentHistory", "viewHistory", "noHistory", "longitudinalIncomplete"]) {
    assert.ok(translations.dailyCare?.[key], locale + " dailyCare." + key + " must be translated");
  }
  for (const key of ["eyebrow", "title", "historyMissing", "confirm", "dispute", "inconclusive", "situations", "disclaimer", "reportedStatus", "statusReason"]) {
    assert.ok(translations.changeIntelligence?.[key], locale + " changeIntelligence." + key + " must be translated");
  }
  for (const key of ["companion", "careRecord", "followUps", "dailyCare", "documents", "handoffs", "appointments", "searchHistory", "settings", "primary", "recentHistory"]) {
    assert.ok(translations.navigation?.[key], `${locale} navigation.${key} must be translated`);
  }
}

assert.ok(!context.includes('setLanguage("en")'));
assert.ok(!context.includes('window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "en")'));
assert.ok(context.includes('"solenos:language-change"'));

assert.ok(selector.includes('window.localStorage.setItem(STORAGE_KEY, next)'));
assert.ok(selector.includes('document.documentElement.lang = next'));
assert.ok(selector.includes('new CustomEvent("solenos:language-change"'));
assert.ok(settings.includes('id="settings-language"'));
assert.ok(settings.includes("<LanguagePreferenceSelect />"));

console.log("PASS language preference is retained across workspace visits and selectable in Settings");
