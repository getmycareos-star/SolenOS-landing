"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, MessageCircle, NotebookPen } from "lucide-react";
import { getJSON, postJSON, putJSON } from "@/api/client";
import { HelpImproveSolenos } from "@/components/mvp-workspace/HelpImproveSolenos";
import { useWorkspace } from "@/lib/workspace-context";

type CareProfile = {
  name?: string;
  relationship?: string;
  condition?: string | null;
  first_use_orientation_completed_at?: string | null;
};

type LoadState = "loading" | "ready" | "error";

const STARTING_POINTS = [
  {
    href: "/workspace/daily-care",
    title: "Add a care update",
    description: "Record something that happened or changed.",
    icon: NotebookPen,
  },
  {
    href: "/workspace/documents",
    title: "Upload a document",
    description: "Keep care documents together.",
    icon: FileText,
  },
  {
    href: "/workspace/companion",
    title: "Ask SolenOS a question",
    description: "Ask about information in the care record.",
    icon: MessageCircle,
  },
] as const;

/**
 * First-use orientation is an inline state of Today, not a separate route or
 * wizard. Completion is stored on the authenticated caregiver identity.
 */
export function FirstUseOrientation() {
  const router = useRouter();
  const { hasCareHistory, recordLoadError } = useWorkspace();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [profile, setProfile] = useState<CareProfile | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoadState("loading");
    setError("");
    try {
      const saved = await getJSON("/care-profile") as CareProfile;
      setProfile(saved);
      setRecipientName(
        saved.name && saved.name !== "Care recipient" ? saved.name : "",
      );
      setRelationship(saved.relationship ?? "");

      // Existing care history is stronger evidence of a returning caregiver
      // than a device-local first-visit flag. Persist the transition once.
      if (hasCareHistory && !saved.first_use_orientation_completed_at) {
        await postJSON("/care-profile/orientation-complete", {});
      }
      setLoadState("ready");
    } catch {
      setLoadState("error");
      setError("We couldn't check your saved care details. Your information has not been changed. Try again.");
    }
  }, [hasCareHistory]);

  useEffect(() => {
    void load();
  }, [load]);

  const completed = Boolean(profile?.first_use_orientation_completed_at) || hasCareHistory;

  const finish = useCallback(async (destination?: string) => {
    if (saving || !profile) return;
    setSaving(true);
    setError("");
    try {
      const name = recipientName.trim();
      const relation = relationship.trim();
      if (name || relation) {
        const saved = await putJSON("/care-profile", {
          name: name || profile.name || "Care recipient",
          relationship: relation,
          condition: profile.condition ?? null,
        }) as CareProfile;
        setProfile((current) => ({ ...current, ...saved }));
      }
      await postJSON("/care-profile/orientation-complete", {});
      setProfile((current) => ({
        ...current,
        first_use_orientation_completed_at: new Date().toISOString(),
      }));
      if (destination) {
        router.push(destination);
      }
    } catch {
      setError("We couldn't save that yet. Your details are still here. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }, [profile, recipientName, relationship, router, saving]);

  if (recordLoadError || loadState === "loading") return null;

  if (loadState === "error") {
    return (
      <section className="first-use-status" role="status" aria-live="polite">
        <p>{error}</p>
        <button type="button" className="workspace-secondary" onClick={() => void load()}>
          Try again
        </button>
      </section>
    );
  }

  if (completed) {
    return (
      <aside className="early-access-compact" aria-label="SolenOS early access">
        <div>
          <span className="early-access-badge">Early Access</span>
          <p>SolenOS is still being tested. Some features may change as we improve it with caregiver feedback.</p>
        </div>
        <HelpImproveSolenos compact />
      </aside>
    );
  }

  return (
    <section className="first-use-orientation panel panel-input" aria-labelledby="first-use-title">
      <header className="first-use-intro">
        <span className="first-use-brand">Welcome to SolenOS</span>
        <h2 id="first-use-title">The care journey, remembered.</h2>
        <p>
          Keep the important details about someone&apos;s care in one place.
          Record what happens, save documents, understand changes and prepare
          for the next conversation.
        </p>
      </header>

      <section className="first-use-early-access" aria-labelledby="first-use-early-access-title">
        <span className="early-access-badge">Early access · We&apos;re testing SolenOS</span>
        <h3 id="first-use-early-access-title">Help us make it more useful for caregivers.</h3>
        <p>
          SolenOS is still in its early stages. Some features may change, and
          you may encounter things that don&apos;t work as expected. Your
          experience and feedback will help us improve.
        </p>
        <p>Thank you for being among the first people to use SolenOS.</p>
        <HelpImproveSolenos compact />
      </section>

      <section className="first-use-recipient" aria-labelledby="first-use-recipient-title">
        <h3 id="first-use-recipient-title">Who is this care record for?</h3>
        <p>Start with the person you&apos;re caring for. You can add more details later.</p>
        <label htmlFor="first-use-recipient-name">Their name <span>(optional)</span></label>
        <input
          id="first-use-recipient-name"
          className="mobile-settings-input"
          value={recipientName}
          maxLength={160}
          autoComplete="off"
          onChange={(event) => setRecipientName(event.target.value)}
          placeholder="Name or the name you call them"
          disabled={saving}
        />
        <label htmlFor="first-use-relationship">Your relationship <span>(optional)</span></label>
        <input
          id="first-use-relationship"
          className="mobile-settings-input"
          value={relationship}
          maxLength={120}
          autoComplete="off"
          onChange={(event) => setRelationship(event.target.value)}
          placeholder="For example, daughter or spouse"
          disabled={saving}
        />
        <p className="first-use-hint">You can add or change these details later in Settings. You do not need to complete a medical questionnaire to continue.</p>
      </section>

      <section className="first-use-starting-points" aria-labelledby="first-use-start-title">
        <h3 id="first-use-start-title">You can start wherever you are.</h3>
        <div className="first-use-path-list">
          {STARTING_POINTS.map(({ href, title, description, icon: Icon }) => (
            <button
              type="button"
              className="first-use-path"
              key={href}
              disabled={saving}
              onClick={() => void finish(href)}
            >
              <Icon aria-hidden="true" size={20} />
              <span>
                <strong>{title}</strong>
                <small>{description}</small>
              </span>
            </button>
          ))}
        </div>
        <p className="first-use-hint">These are options, not required steps. You do not have to contribute anything before using Today.</p>
      </section>

      <section className="first-use-lcr-explainer" aria-labelledby="first-use-lcr-title">
        <h3 id="first-use-lcr-title">Your care information builds a continuing picture.</h3>
        <p>
          Updates and documents help build a record of what has happened, what
          is changing and what may need attention.
        </p>
        <ul>
          <li>Information can come from different sources.</li>
          <li>Some details may be incomplete, uncertain or conflicting.</li>
          <li>Corrections preserve the history of what was previously recorded.</li>
          <li>AI suggestions are not confirmed medical facts.</li>
        </ul>
        <p className="first-use-hint">
          SolenOS helps organize care information. It does not replace medical professionals.
        </p>
      </section>

      {error && <p className="first-use-error" role="alert">{error}</p>}
      <footer className="first-use-footer">
        <div>
          <h3>Your care record starts here.</h3>
          <p>You can add information whenever you&apos;re ready. You don&apos;t have to complete everything now.</p>
        </div>
        <button
          type="button"
          className="workspace-primary first-use-continue"
          disabled={saving}
          onClick={() => void finish()}
        >
          {saving ? "Saving…" : "Continue to Today"}
        </button>
        <p className="first-use-hint">
          By using SolenOS, you agree to the <Link href="/terms">Terms of Service</Link> and <Link href="/privacy">Privacy Policy</Link>. You can read them at any time.
        </p>
      </footer>
    </section>
  );
}
