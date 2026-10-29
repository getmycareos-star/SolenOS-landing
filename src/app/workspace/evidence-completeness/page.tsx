import EvidenceCompletenessPanel from "@/components/EvidenceCompletenessPanel";

export default function EvidenceCompletenessPage() {
  return (
    <main className="mobile-screen lcr-screen">
      <section className="lcr-home" aria-labelledby="evidence-completeness-page-title">
        <p className="lcr-eyebrow">LIVING CARE RECORD · EVIDENCE</p>
        <h1 id="evidence-completeness-page-title">Evidence completeness</h1>
        <p>Define a purpose-specific evidence checklist and assess source-link coverage without treating coverage as proof of truth.</p>
        <EvidenceCompletenessPanel />
      </section>
    </main>
  );
}
