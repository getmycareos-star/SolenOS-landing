import Link from "next/link";

const panel: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e4e9e4",
  borderRadius: 18,
  padding: 20,
  boxShadow: "0 4px 18px rgba(24, 44, 30, 0.04)",
};
const muted: React.CSSProperties = { color: "#657268", lineHeight: 1.55 };
const action: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  minHeight: 46, padding: "0 18px", borderRadius: 12, fontWeight: 650,
  textDecoration: "none", background: "#dcebdc", color: "#17251a",
  border: "1px solid #c7ddc8",
};

export default function ReturningCaregiverPreviewPage() {
  return (
    <main className="mobile-screen feature-page solenos-lcr-home" style={{ maxWidth: 920, margin: "0 auto", padding: "24px 18px 56px", color: "#1d2921", background: "#f8faf8", minHeight: "100vh" }}>
      <div role="note" aria-label="Preview notice" style={{ border: "1px solid #c9d9c9", background: "#edf5ed", color: "#29452e", borderRadius: 12, padding: "11px 14px", marginBottom: 22, fontSize: 13 }}>
        <strong>Illustrative preview only.</strong> This screen uses fictional example content, not a real caregiver or care record. It is read-only and does not connect to or change production data.
      </div>

      <header className="solenos-workspace-page-heading" style={{ marginBottom: 22 }}>
        <p className="solenos-home-eyebrow">THE CARE JOURNEY, REMEMBERED</p>
        <h1 style={{ fontSize: "clamp(30px, 5vw, 42px)", lineHeight: 1.12, margin: "8px 0 10px" }}>Welcome back.</h1>
        <p style={{ ...muted, maxWidth: 650, margin: 0 }}>Your care information is brought together here, so you can pick up where you left off without starting again.</p>
      </header>

      <section style={{ ...panel, marginBottom: 16 }} aria-labelledby="current-picture-heading">
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <div>
            <p className="solenos-home-eyebrow" style={{ margin: "0 0 6px" }}>CURRENT PICTURE</p>
            <h2 id="current-picture-heading" style={{ margin: 0, fontSize: 22 }}>Your care record at a glance</h2>
          </div>
          <span style={{ fontSize: 12, borderRadius: 99, padding: "6px 10px", background: "#eef2ed", color: "#526253" }}>Example record · Read-only</span>
        </div>
        <p style={{ ...muted, margin: "12px 0 16px" }}>A short view of what has been shared and what still needs checking.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <div style={{ background: "#f5f8f5", borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 12, ...muted }}>Saved updates</div><strong style={{ display: "block", fontSize: 25, marginTop: 4 }}>6</strong><span style={{ fontSize: 12, ...muted }}>Example entries</span>
          </div>
          <div style={{ background: "#f5f8f5", borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 12, ...muted }}>Needs a follow-up</div><strong style={{ display: "block", fontSize: 25, marginTop: 4 }}>2</strong><span style={{ fontSize: 12, ...muted }}>Example open items</span>
          </div>
          <div style={{ background: "#f5f8f5", borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 12, ...muted }}>Last updated</div><strong style={{ display: "block", fontSize: 17, marginTop: 8 }}>Yesterday</strong><span style={{ fontSize: 12, ...muted }}>Illustrative date</span>
          </div>
        </div>
      </section>

      <section style={{ ...panel, marginBottom: 16 }} aria-labelledby="recent-update-heading">
        <p className="solenos-home-eyebrow" style={{ margin: "0 0 6px" }}>LATEST UPDATE</p>
        <h2 id="recent-update-heading" style={{ margin: "0 0 8px", fontSize: 21 }}>A family update was saved</h2>
        <p style={{ ...muted, margin: 0 }}>Example note: “The afternoon routine went as planned.”</p>
        <div style={{ borderTop: "1px solid #e8ede8", marginTop: 15, paddingTop: 12, display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12, color: "#657268" }}>
          <span>Source: Family caregiver</span><span aria-hidden="true">·</span><span>Status: Reported information</span>
        </div>
      </section>

      <section style={{ ...panel, marginBottom: 16 }} aria-labelledby="follow-up-heading">
        <p className="solenos-home-eyebrow" style={{ margin: "0 0 6px" }}>OPEN LOOP</p>
        <h2 id="follow-up-heading" style={{ margin: "0 0 12px", fontSize: 21 }}>One thing to come back to</h2>
        <div style={{ borderLeft: "3px solid #b8cfb9", paddingLeft: 14 }}>
          <strong>Confirm the next appointment details</strong>
          <p style={{ ...muted, margin: "5px 0 0" }}>Example follow-up · The date and time have not been confirmed in this preview.</p>
        </div>
      </section>

      <section style={{ ...panel, marginBottom: 16 }} aria-labelledby="continue-heading">
        <h2 id="continue-heading" style={{ margin: "0 0 7px", fontSize: 21 }}>Where would you like to pick up?</h2>
        <p style={{ ...muted, margin: "0 0 16px" }}>Continue with a new update or ask about information already saved.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <Link href="/workspace/daily-care" style={action}>Add a care update</Link>
          <Link href="/workspace/companion" style={{ ...action, background: "#fff", borderColor: "#dce4dc" }}>Ask SolenOS</Link>
        </div>
      </section>

      <details style={{ ...panel }}>
        <summary style={{ cursor: "pointer", fontWeight: 650 }}>Explore your care record</summary>
        <nav aria-label="More care information" style={{ display: "grid", gap: 14, marginTop: 16 }}>
          <Link href="/workspace/open-loops" style={{ color: "#294b31" }}><strong>Follow-ups</strong><span style={{ display: "block", ...muted }}>Questions, decisions and agreed next steps.</span></Link>
          <Link href="/workspace/timeline" style={{ color: "#294b31" }}><strong>Care Timeline</strong><span style={{ display: "block", ...muted }}>Earlier updates and corrections.</span></Link>
          <Link href="/workspace/documents" style={{ color: "#294b31" }}><strong>Documents</strong><span style={{ display: "block", ...muted }}>Original care files and saved details.</span></Link>
          <Link href="/workspace/companion" style={{ color: "#294b31" }}><strong>Care Assistant</strong><span style={{ display: "block", ...muted }}>Questions about saved care information.</span></Link>
        </nav>
      </details>
      <p style={{ ...muted, fontSize: 12, textAlign: "center", marginTop: 22 }}>Preview content is fictional and is not evidence about a real person.</p>
    </main>
  );
}
