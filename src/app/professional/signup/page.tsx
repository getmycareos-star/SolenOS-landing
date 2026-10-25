"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PublicShell } from "@/components/public/PublicShell";
import { Button } from "@/components/ui/Button";
import { registerProfessional } from "@/api/professionalAuth";

const fieldStyle: React.CSSProperties = {
  width: "100%", minHeight: 48, border: "1px solid #9aa99b", borderRadius: 10,
  padding: "0.75rem", font: "inherit", color: "#18251b", background: "#fff",
};

export default function ProfessionalSignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ full_name: "", email: "", password: "", professional_title: "", organization: "", credentials: "", specialties: "", biography: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      await registerProfessional({
        ...form,
        email: form.email.trim(),
        full_name: form.full_name.trim(),
        professional_title: form.professional_title.trim(),
      });
      router.replace("/professional/dashboard");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "SolenOS could not create your professional account.");
    } finally { setBusy(false); }
  }

  return (
    <PublicShell activeHref="/professional/signup">
      <section className="public-section" style={{ maxWidth: 680, margin: "0 auto", paddingTop: "3rem", paddingBottom: "4rem" }}>
        <p className="public-eyebrow">SolenOS · Professional community</p>
        <h1 className="public-section-title">Share your expertise with family caregivers</h1>
        <p className="public-prose">Create a professional profile to introduce your experience, qualifications, and areas of dementia-care expertise. This is a separate professional account; you do not need to create a caregiver account or a care recipient record.</p>
        <form onSubmit={submit} style={{ display: "grid", gap: "1rem", marginTop: "1.5rem" }}>
          <label style={{ display: "grid", gap: ".4rem" }}><span>Full name</span><input autoComplete="name" required minLength={2} maxLength={160} value={form.full_name} onChange={(e) => set("full_name", e.target.value)} style={fieldStyle} /></label>
          <label style={{ display: "grid", gap: ".4rem" }}><span>Professional email</span><input autoComplete="email" type="email" required maxLength={254} value={form.email} onChange={(e) => set("email", e.target.value)} style={fieldStyle} /></label>
          <label style={{ display: "grid", gap: ".4rem" }}><span>Password (at least 10 characters)</span><input autoComplete="new-password" type="password" required minLength={10} maxLength={128} value={form.password} onChange={(e) => set("password", e.target.value)} style={fieldStyle} /></label>
          <label style={{ display: "grid", gap: ".4rem" }}><span>Professional role or title</span><input required minLength={2} maxLength={160} placeholder="e.g. dementia-care educator, nurse, social worker" value={form.professional_title} onChange={(e) => set("professional_title", e.target.value)} style={fieldStyle} /></label>
          <label style={{ display: "grid", gap: ".4rem" }}><span>Organization (optional)</span><input maxLength={200} value={form.organization} onChange={(e) => set("organization", e.target.value)} style={fieldStyle} /></label>
          <label style={{ display: "grid", gap: ".4rem" }}><span>Credentials or qualifications (optional)</span><input maxLength={300} placeholder="List relevant credentials; do not include sensitive IDs" value={form.credentials} onChange={(e) => set("credentials", e.target.value)} style={fieldStyle} /></label>
          <label style={{ display: "grid", gap: ".4rem" }}><span>Areas of expertise (optional)</span><input maxLength={1000} placeholder="e.g. dementia, respite care, caregiver wellbeing" value={form.specialties} onChange={(e) => set("specialties", e.target.value)} style={fieldStyle} /></label>
          <label style={{ display: "grid", gap: ".4rem" }}><span>Short professional introduction (optional)</span><textarea maxLength={3000} rows={4} value={form.biography} onChange={(e) => set("biography", e.target.value)} style={fieldStyle} /></label>
          {error && <p role="alert" style={{ color: "#9b2424" }}>{error}</p>}
          <Button type="submit" loading={busy} disabled={busy}>{busy ? "Creating profile…" : "Create professional profile"}</Button>
        </form>
        <p className="public-prose" style={{ marginTop: "1.25rem" }}>Already registered? <Link href="/professional/login">Log in to your professional account</Link>.</p>
        <p className="public-prose">Profiles begin as pending review. Professional verification and community publishing are not automatic.</p>
      </section>
    </PublicShell>
  );
}
