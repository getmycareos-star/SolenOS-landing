"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PublicShell } from "@/components/public/PublicShell";
import { Button } from "@/components/ui/Button";
import { deleteProfessionalAccount, getProfessionalProfile, logoutProfessional, ProfessionalProfile } from "@/api/professionalAuth";

export default function ProfessionalDashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    getProfessionalProfile().then((value) => { if (active) setProfile(value); })
      .catch((cause) => { if (active) { setError(cause instanceof Error ? cause.message : "Could not load your profile."); } });
    return () => { active = false; };
  }, []);
  async function logout() {
    setBusy(true);
    try { await logoutProfessional(); router.replace("/professional/login"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not end this session."); }
    finally { setBusy(false); }
  }
  async function removeAccount() {
    if (!window.confirm("Delete your SolenOS professional account and profile? This cannot be undone.")) return;
    setBusy(true);
    try { await deleteProfessionalAccount(); router.replace("/professional/signup"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete the account."); }
    finally { setBusy(false); }
  }
  return (
    <PublicShell activeHref="/professional/dashboard">
      <section className="public-section" style={{ maxWidth: 760, margin: "0 auto", paddingTop: "3rem", paddingBottom: "4rem" }}>
        <p className="public-eyebrow">SolenOS · Professional workspace</p>
        <h1 className="public-section-title">Your professional dashboard</h1>
        {error && <p role="alert" style={{ color: "#9b2424" }}>{error} <Link href="/professional/login">Return to professional login</Link></p>}
        {!profile && !error && <p className="public-prose">Loading your account from SolenOS…</p>}
        {profile && <>
          <div style={{ border: "1px solid #d8e2d9", borderRadius: 14, padding: "1.25rem", marginTop: "1rem" }}>
            <h2>{profile.full_name}</h2>
            <p className="public-prose">{profile.professional_title}</p>
            <p className="public-prose">{profile.email}</p>
            {profile.organization && <p className="public-prose">{profile.organization}</p>}
            {profile.credentials && <p className="public-prose">Credentials: {profile.credentials}</p>}
            {profile.specialties && <p className="public-prose">Expertise: {profile.specialties}</p>}
            {profile.biography && <p className="public-prose">{profile.biography}</p>}
            <p className="public-prose"><strong>Profile status:</strong> {profile.status === "pending_review" ? "Pending review" : profile.status}</p>
          </div>
          {profile.status === "pending_review" && <p className="public-prose" style={{ marginTop: "1rem" }}>Your profile has been saved. SolenOS has not verified your qualifications yet, so professional publishing and service features are not enabled.</p>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: ".75rem", marginTop: "1.5rem" }}>
            <Button variant="secondary" disabled={busy} onClick={() => void logout()}>{busy ? "Please wait…" : "Log out"}</Button>
            <Button variant="secondary" disabled={busy} onClick={() => void removeAccount()}>Delete professional account</Button>
          </div>
        </>}
      </section>
    </PublicShell>
  );
}
