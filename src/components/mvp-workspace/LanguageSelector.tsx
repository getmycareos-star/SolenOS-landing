"use client";

import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "@/lib/api-url";
import { SOLENOS_LANGUAGES } from "@/lib/multilingual-execution";
import type { SolenOSLanguage } from "@/lib/multilingual-execution";

const LANGUAGE_LABELS: Record<SolenOSLanguage, string> = {
  en: "English",
  es: "Español",
  zh: "中文",
  ar: "العربية",
  hi: "हिन्दी",
};

const TELEMETRY_USER_STORAGE_KEY = "solenos_telemetry_user_id";

/**
 * The caregiver's language.
 *
 * solenos should answer in the language someone is using without making them
 * ask. This loads the saved preference when the workspace opens and saves the
 * moment they choose a different one, so it holds from then on.
 */
export function LanguageSelector({ userId }: { userId?: string | null }) {
  const [language, setLanguage] = useState<SolenOSLanguage | null>(null);
  const [saving, setSaving] = useState(false);

  const resolvedUserId =
    userId?.trim() ||
    (typeof window === "undefined"
      ? null
      : window.localStorage.getItem(TELEMETRY_USER_STORAGE_KEY));

  useEffect(() => {
    if (!resolvedUserId) return;
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch(
          apiUrl(`/api/user/language?user_id=${encodeURIComponent(resolvedUserId)}`),
        );
        if (!res.ok) return;
        const data = (await res.json()) as { language_preference?: SolenOSLanguage };
        if (!cancelled && data.language_preference) {
          setLanguage(data.language_preference);
        }
      } catch {
        // A missing preference simply leaves the default in place.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [resolvedUserId]);

  const choose = useCallback(
    async (next: SolenOSLanguage) => {
      if (saving || !resolvedUserId) return;
      setSaving(true);
      setLanguage(next);
      try {
        await fetch(apiUrl("/api/user/language"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: resolvedUserId, language_preference: next }),
        });
      } catch {
        // The choice still applies to this session even if it could not be saved.
      } finally {
        setSaving(false);
      }
    },
    [resolvedUserId, saving],
  );

  if (!resolvedUserId) return null;

  return (
    <label className="language-selector">
      <span className="language-selector-label">Language</span>
      <select
        value={language ?? "en"}
        disabled={saving}
        onChange={(event) => void choose(event.target.value as SolenOSLanguage)}
        aria-label="Language"
      >
        {SOLENOS_LANGUAGES.map((code) => (
          <option key={code} value={code}>
            {LANGUAGE_LABELS[code] ?? code}
          </option>
        ))}
      </select>
    </label>
  );
}
