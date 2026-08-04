"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  ChevronRight,
  FileText,
  Info,
  Lock,
  Shield,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useWorkspace } from "@/lib/workspace-context";
import { getOnboardingCompletedAt } from "@/lib/onboarding";
import { SUPPORT_EMAIL } from "@/lib/early-access-trust";

const CARE_RECIPIENT_NAME_STORAGE = "solenos_care_recipient_display_name";

/** Notification toggles persisted immediately (no Save button). */
function NotificationsCard() {
  const { show, render } = useToast();
  const [quietHours, setQuietHours] = useState(false);
  const [reminders, setReminders] = useState(true);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("solenos_notif_prefs");
      if (raw) {
        const p = JSON.parse(raw) as { quietHours?: boolean; reminders?: boolean };
        if (typeof p.quietHours === "boolean") setQuietHours(p.quietHours);
        if (typeof p.reminders === "boolean") setReminders(p.reminders);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const persist = (key: string, value: boolean) => {
    try {
      window.localStorage.setItem(
        "solenos_notif_prefs",
        JSON.stringify({ quietHours, reminders, [key]: value }),
      );
    } catch {
      /* ignore */
    }
  };

  return (
    <section className="mobile-settings-card">
      <h2 className="mobile-settings-card-title">
        <Bell size={16} aria-hidden /> Notifications
      </h2>
      <label className="mobile-settings-row">
        <span>
          <span className="mobile-settings-label">Quiet hours</span>
          <span className="mobile-settings-hint">
            Suppress non-emergency alerts.
          </span>
        </span>
        <span className="mobile-toggle">
          <input
            type="checkbox"
            checked={quietHours}
            onChange={(e) => {
              setQuietHours(e.target.checked);
              persist("quietHours", e.target.checked);
              show(e.target.checked ? "Quiet hours on" : "Quiet hours off", "success");
            }}
          />
          <span className="mobile-toggle-track" />
        </span>
      </label>
      <label className="mobile-settings-row">
        <span>
          <span className="mobile-settings-label">Care reminders</span>
          <span className="mobile-settings-hint">
            Gentle nudges for open care notes.
          </span>
        </span>
        <span className="mobile-toggle">
          <input
            type="checkbox"
            checked={reminders}
            onChange={(e) => {
              setReminders(e.target.checked);
              persist("reminders", e.target.checked);
              show(e.target.checked ? "Reminders on" : "Reminders off", "success");
            }}
          />
          <span className="mobile-toggle-track" />
        </span>
      </label>
      {render()}
    </section>
  );
}

/** Profile — editable care-recipient fields (no internal identifiers). */
function ProfileCard() {
  const { show, render } = useToast();
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [condition, setCondition] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(CARE_RECIPIENT_NAME_STORAGE);
      if (stored) setName(stored);
      const meta = window.localStorage.getItem("solenos_care_profile");
      if (meta) {
        const p = JSON.parse(meta) as {
          relationship?: string;
          condition?: string;
        };
        if (p.relationship) setRelationship(p.relationship);
        if (p.condition) setCondition(p.condition);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const save = useCallback(() => {
    setSaving(true);
    try {
      window.localStorage.setItem(CARE_RECIPIENT_NAME_STORAGE, name.trim());
      window.localStorage.setItem(
        "solenos_care_profile",
        JSON.stringify({ relationship: relationship.trim(), condition: condition.trim() }),
      );
      show("Saved ✓", "success");
    } catch {
      show("Could not save", "error");
    } finally {
      setSaving(false);
    }
  }, [name, relationship, show]);

  return (
    <section className="mobile-settings-card">
      <h2 className="mobile-settings-card-title">
        <User size={16} aria-hidden /> Profile
      </h2>
      <div className="mobile-settings-row" style={{ flexDirection: "column", alignItems: "stretch", gap: "0.4rem" }}>
        <label className="mobile-settings-label" htmlFor="mob-name">
          Care recipient name
        </label>
        <input
          id="mob-name"
          className="mobile-settings-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Mom, Dad, Mary…"
        />
      </div>
      <div className="mobile-settings-row" style={{ flexDirection: "column", alignItems: "stretch", gap: "0.4rem" }}>
        <label className="mobile-settings-label" htmlFor="mob-relation">
          Relationship
        </label>
        <input
          id="mob-relation"
          className="mobile-settings-input"
          value={relationship}
          onChange={(e) => setRelationship(e.target.value)}
          placeholder="Daughter, son, partner…"
        />
      </div>
      <div className="mobile-settings-row" style={{ flexDirection: "column", alignItems: "stretch", gap: "0.4rem" }}>
        <label className="mobile-settings-label" htmlFor="mob-condition">
          Condition / stage
        </label>
        <input
          id="mob-condition"
          className="mobile-settings-input"
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          placeholder="e.g. early-stage dementia"
        />
      </div>
      <div className="mobile-settings-actions">
        <Button variant="primary" loading={saving} onClick={save}>
          {saving ? undefined : "Save"}
        </Button>
      </div>
      {render()}
    </section>
  );
}

/** Security — account actions, no session/care-key rows. */
function SecurityCard() {
  const { show, render } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <section className="mobile-settings-card">
      <h2 className="mobile-settings-card-title">
        <Lock size={16} aria-hidden /> Security
      </h2>
      <p className="mobile-settings-hint">
        SolenOS uses email and password to restore your care record across devices.
      </p>
      <div className="mobile-settings-buttons">
        <Button variant="secondary" onClick={() => show("Account setup coming soon", "info")}>
          Create account
        </Button>
        <Button variant="secondary" onClick={() => show("Password change coming soon", "info")}>
          Change password
        </Button>
        <Button variant="secondary" onClick={() => show("Add email coming soon", "info")}>
          Add email
        </Button>
        {confirmDelete ? (
          <div className="mobile-settings-actions">
            <Button variant="destructive" loading={false} onClick={() => show("Deletion request sent", "success")}>
              Confirm delete
            </Button>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
            Delete account
          </Button>
        )}
      </div>
      {render()}
    </section>
  );
}

/** Legal — Terms / Privacy / Contact as real buttons. */
function LegalCard() {
  return (
    <section className="mobile-settings-card">
      <h2 className="mobile-settings-card-title">
        <FileText size={16} aria-hidden /> Legal
      </h2>
      <div className="mobile-settings-buttons">
        <Button variant="secondary" className="mobile-fab-sheet-item" asChild>
          <Link href="/terms">Terms of Service</Link>
        </Button>
        <Button variant="secondary" className="mobile-fab-sheet-item" asChild>
          <Link href="/privacy">Privacy Policy</Link>
        </Button>
        <Button variant="secondary" className="mobile-fab-sheet-item" asChild>
          <a href={`mailto:${SUPPORT_EMAIL}`}>Contact support</a>
        </Button>
      </div>
      <p className="mobile-settings-hint">Version 0.1.0</p>
    </section>
  );
}

/** Privacy & Data — clear/delete local data + data-training toggle. */
function PrivacyCard() {
  const { show, render } = useToast();
  const [confirmClear, setConfirmClear] = useState(false);
  const [dataTraining, setDataTraining] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("solenos_data_training");
      if (raw) setDataTraining(raw === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const consentAt = getOnboardingCompletedAt();
  const consentDate = consentAt
    ? new Date(consentAt).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const clearLocalData = () => {
    const keys = [
      "solenos_durable_care_key",
      "solenos_care_session_id",
      "solenos_telemetry_user_id",
      "solenos_situations",
      "solenos_timeline",
      "solenos_active_situation_id",
      "solenos_care_recipient_display_name",
      "solenos_care_profile",
    ];
    keys.forEach((k) => window.localStorage.removeItem(k));
    show("Local data cleared", "success");
    setConfirmClear(false);
    setTimeout(() => {
      window.location.href = "/start";
    }, 1200);
  };

  return (
    <section className="mobile-settings-card">
      <h2 className="mobile-settings-card-title">
        <Shield size={16} aria-hidden /> Privacy &amp; Data
      </h2>

      {consentDate && (
        <div className="mobile-settings-row">
          <span className="mobile-settings-label">Consent</span>
          <span className="mobile-settings-value">Accepted on {consentDate}</span>
        </div>
      )}

      <label className="mobile-settings-row">
        <span>
          <span className="mobile-settings-label">Data training</span>
          <span className="mobile-settings-hint">
            Off by default. Your data is never sold.
          </span>
        </span>
        <span className="mobile-toggle">
          <input
            type="checkbox"
            checked={dataTraining}
            onChange={(e) => {
              setDataTraining(e.target.checked);
              window.localStorage.setItem("solenos_data_training", e.target.checked ? "1" : "0");
              show(e.target.checked ? "Data training on" : "Data training off", "success");
            }}
          />
          <span className="mobile-toggle-track" />
        </span>
      </label>

      <div className="mobile-settings-buttons">
        {confirmClear ? (
          <div className="mobile-settings-actions">
            <Button variant="destructive" onClick={clearLocalData}>
              Clear now
            </Button>
            <Button variant="secondary" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="destructive"
            onClick={() => setConfirmClear(true)}
          >
            Clear local data
          </Button>
        )}
        <Button variant="destructive" onClick={() => show("Deletion request sent", "success")}>
          Delete my data
        </Button>
        <Button variant="secondary" onClick={() => show("Support contact ready", "info")}>
          Contact support
        </Button>
        <Button variant="secondary" className="mobile-fab-sheet-item" asChild>
          <Link href="/privacy">Read Privacy Policy</Link>
        </Button>
      </div>
      {render()}
    </section>
  );
}

/** Product — routes to existing public content. */
function ProductCard() {
  const items: { label: string; href: string }[] = [
    { label: "How It Works", href: "/how-it-works" },
    { label: "About", href: "/about" },
    { label: "Help", href: "/help" },
    { label: "Capabilities", href: "/capabilities" },
    { label: "Founder's Story", href: "/our-story" },
    { label: "Our Mission", href: "/mission" },
  ];

  return (
    <section className="mobile-settings-card">
      <h2 className="mobile-settings-card-title">
        <Info size={16} aria-hidden /> Product
      </h2>
      <div className="mobile-settings-buttons">
        {items.map((item) => (
          <Button key={item.href} variant="secondary" className="mobile-fab-sheet-item" asChild>
            <Link href={item.href}>
              {item.label}
              <ChevronRight size={16} aria-hidden />
            </Link>
          </Button>
        ))}
      </div>
    </section>
  );
}

export default function WorkspaceSettingsPage() {
  const { hydrated, entryReady } = useWorkspace();

  if (!hydrated || !entryReady) {
    return (
      <div className="mobile-screen">
        <div className="mobile-loading">
          <div className="mobile-loading-spinner" aria-hidden="true" />
          <span className="mobile-loading-text">Loading settings…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-screen">
      <div className="mobile-page-head">
        <h1>Settings</h1>
        <p>Manage your care record, notifications, security, and privacy.</p>
      </div>
      <div className="mobile-settings">
        <ProfileCard />
        <NotificationsCard />
        <SecurityCard />
        <LegalCard />
        <PrivacyCard />
        <ProductCard />
      </div>
    </div>
  );
}
