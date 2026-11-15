import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/PublicShell";

export const metadata: Metadata = {
  title: "Share into SolenOS",
  description:
    "Send WhatsApp messages, emails, photos, and PDFs to your Care Record.",
};

export default function ShareHelpPage() {
  return (
    <PublicShell activeHref="/share">
      <section className="public-hero">
        <p className="public-eyebrow">Share</p>
        <h1 className="public-hero-title">Send care details from other apps</h1>
        <p className="public-hero-lede">
          From WhatsApp, Email, Photos, or Files — choose Share → SolenOS when the app is installed.
          Shared content is added to your Care Record alongside scans, photos, uploads, and notes.
        </p>
      </section>
      <section className="public-section">
        <p className="public-prose">
          You choose the easiest way to provide evidence. SolenOS builds understanding — without a
          separate workflow for each app.
        </p>
        <p className="public-prose">
          <Link href="/workspace?enter=1">Open your Care Record</Link>
          {" · "}
          <Link href="/how-it-works">How it works</Link>
        </p>
      </section>
    </PublicShell>
  );
}
