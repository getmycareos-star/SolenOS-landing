"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PublicShell } from "@/components/public/PublicShell";
import { Button } from "@/components/ui/Button";
import {
  createProfessionalContribution,
  deleteProfessionalAccount,
  getProfessionalContributions,
  getProfessionalProfile,
  logoutProfessional,
  ProfessionalContribution,
  ProfessionalProfile,
} from "@/api/professionalAuth";

const fieldStyle: React.CSSProperties = {
  width: "100%", minHeight: 48, border: "1px solid #9aa99b", borderRadius: 10,
  padding: "0.75rem", font: "inherit", color: "#18251b", background: "#fff",
};

export default function ProfessionalDashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [contributions, setContributions] = useState<ProfessionalContribution[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [contributionType, setContributionType] = useState<"knowledge" | "service">("knowledge");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    getProfessionalProfile().then((value) => {
      if (!active) return;
      setProfile(value);
      return getProfessionalContributions().then((items) => {
        if (active) setContributions(items);
      });
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Could not load your professional account.");
    });
    return () => { active = false; };
  }, []);

  async function submitContribution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      await createProfessionalContribution({ title: title.trim(), body: body.trim(), contribution_type: contributionType });
      setTitle(""); setBody("");
      setContributions(await getProfessionalContributions());
      setNotice("Your contribution was published to the Community. It has not been added to any caregiver's Living Care Record.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your contribution could not be confirmed by SolenOS.");
    } finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true);
    try { await logoutProfessional(); router.replace("/professional/login"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not end this session."); }
    finally { setBusy(false); }
  }

  async function removeAccount() {
    if (!window.confirm("Delete your SolenOS professional account, profile, sessions, and published professional contributions? This cannot be undone.")) return;
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
        {notice && <p role="status" style={{ border: "1px solid #d8e2d9", borderRadius: 10, padding: ".8rem" }}>{notice}</p>}
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
          {profile.status !== "verified" ? (
            <p className="public-prose" style={{ marginTop: "1rem" }}>SolenOS has not verified this professional profile yet. Publishing knowledge and service offers will become available after review. Signup alone does not verify qualifications.</p>
          ) : (
            <section style={{ marginTop: "2rem" }}>
              <h2>Share knowledge or offer a service</h2>
              <p className="public-prose">Contributions appear in the caregiver Community under your professional profile. They do not write to a caregiver's Living Care Record.</p>
              <form onSubmit={submitContribution} style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
                <label style={{ display: "grid", gap: ".4rem" }}>
                  <span>Contribution type</span>
                  <select value={contributionType} onChange={(e) => setContributionType(e.target.value as "knowledge" | "service")} style={fieldStyle}>
                    <option value="knowledge">Professional knowledge</option>
                    <option value="service">Professional service</option>
                  </select>
                </label>
                <label style={{ display: "grid", gap: ".4rem" }}><span>Title</span><input required minLength={5} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} style={fieldStyle} /></label>
                <label style={{ display: "grid", gap: ".4rem" }}><span>Details</span><textarea required minLength={20} maxLength={5000} rows={5} value={body} onChange={(e) => setBody(e.target.value)} style={fieldStyle} /></label>
                <Button type="submit" loading={busy} disabled={busy}>{busy ? "Publishing…" : "Publish to Community"}</Button>
              </form>
            </section>
          )}
          <section style={{ marginTop: "2rem" }}>
            <h2>Your Community contributions</h2>
            {contributions.length === 0 ? <p className="public-prose">No professional contributions have been published from this account.</p> : contributions.map((item) => (
              <article key={item.id} style={{ border: "1px solid #d8e2d9", borderRadius: 12, padding: "1rem", marginTop: ".75rem" }}>
                <p className="public-eyebrow">{item.contribution_type}</p>
                <h3>{item.title}</h3>
                <p className="public-prose">{item.body}</p>
                <p className="public-prose"><strong>Status:</strong> {item.status}</p>
              </article>
            ))}
          </section>
          <div style={{ display: "flex", flexWrap: "wrap", gap: ".75rem", marginTop: "1.5rem" }}>
            <Button variant="secondary" disabled={busy} onClick={() => void logout()}>{busy ? "Please wait…" : "Log out"}</Button>
            <Button variant="secondary" disabled={busy} onClick={() => void removeAccount()}>Delete professional account</Button>
          </div>
        </>}
      </section>
    </PublicShell>
  );
}
