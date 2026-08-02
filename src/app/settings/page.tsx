import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/PublicShell";
import { OpsPageView } from "@/components/ops/OpsPageView";
import { SettingsManager } from "@/components/settings/SettingsManager";
import { SUPPORT_EMAIL } from "@/lib/early-access-trust";

export const metadata: Metadata = {
  title: "Settings — SolenOS",
  description: "Manage your SolenOS profile, privacy, notifications, and account preferences.",
};

export default function SettingsPage() {
  return (
    <PublicShell activeHref="/settings">
      <OpsPageView page="/settings" />
      <section className="public-hero">
        <h1 className="public-hero-title">Settings</h1>
        <p className="public-hero-lede">
          Account, privacy, and preferences for your SolenOS experience.
        </p>
      </section>

      <section className="public-section" id="profile">
        <h2 className="public-section-title">Profile</h2>
        <p className="public-prose">
          Your SolenOS profile is tied to the care key stored in this browser. No separate
          username is required — you sign in with the email and password used during early access.
        </p>
        <ul className="public-quiet-list">
          <li>Email: the address used to create or restore your care record</li>
          <li>Account: managed through your durable care key and interaction session</li>
          <li>Identity: restored via login or signup on the entry page</li>
        </ul>
      </section>

      <section className="public-section" id="privacy">
        <h2 className="public-section-title">Privacy & Data</h2>
        <p className="public-prose">
          You control the information in your Living Care Record.
        </p>
        <ul className="public-quiet-list">
          <li>Data permissions — only information you choose to upload is stored</li>
          <li>Export my data — observations can be exported from the workspace</li>
          <li>Delete my data — contact support to request deletion as the platform grows</li>
          <li>Privacy controls — reviewed anytime via the{" "}
            <Link href="/privacy">Privacy Policy</Link></li>
        </ul>
      </section>

      <section className="public-section" id="security">
        <h2 className="public-section-title">Security</h2>
        <p className="public-prose">
          SolenOS uses email and password authentication to restore your care record across devices.
        </p>
        <ul className="public-quiet-list">
          <li>Password/security — managed during signup and login</li>
          <li>Session management — interaction sessions are temporary; your durable care key is
            preserved separately</li>
          <li>Access — if you notice unauthorized access, contact support immediately</li>
        </ul>
      </section>

      <section className="public-section" id="notifications">
        <h2 className="public-section-title">Notifications</h2>
        <p className="public-prose">
          SolenOS is designed to reduce noise, not add it.
        </p>
        <ul className="public-quiet-list">
          <li>Email preferences — product updates and research feedback are sent sparingly</li>
          <li>Product updates — you receive updates as SolenOS evolves during early access</li>
        </ul>
      </section>

      <section className="public-section" id="preferences">
        <h2 className="public-section-title">Live preferences</h2>
        <p className="public-prose">
          These controls connect to your SolenOS care record and save changes to your account.
        </p>
        <SettingsManager />
      </section>

      <section className="public-section public-legal" id="legal">
        <h2 className="public-section-title">Legal</h2>
        <p className="public-prose">
          Readable, always available.
        </p>
        <ul className="public-quiet-list">
          <li>
            <Link href="/terms">Terms of Service</Link>
          </li>
          <li>
            <Link href="/privacy">Privacy Policy</Link>
          </li>
        </ul>
      </section>

      <section className="public-section" id="about">
        <h2 className="public-section-title">About</h2>
        <p className="public-prose">
          SolenOS version 0.1.0
        </p>
        <p className="public-prose">
          <Link href="/contact">Contact support</Link> ·{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
        <p className="public-prose">
          <Link href="/about">About SolenOS</Link> ·{" "}
          <Link href="/why-solenos">Why SolenOS</Link> ·{" "}
          <Link href="/how-it-works">How It Works</Link>
        </p>
      </section>
    </PublicShell>
  );
}
