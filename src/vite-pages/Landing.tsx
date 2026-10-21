import { Link } from 'react-router-dom'

const sections = [
  {
    title: 'Capture',
    description: 'Record a note, an observation, a document, or a moment from everyday care.',
  },
  {
    title: 'Understand',
    description: "Keep care information connected so it is easier to understand what happened and what changed.",
  },
  {
    title: 'See change',
    description: 'Review what is known, what is uncertain, what is missing, and what may need follow-up.',
  },
  {
    title: 'Share',
    description: 'Prepare relevant information for a family member, professional caregiver, or appointment.',
  },
]

export default function Landing() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg, #f8faf9)', color: 'var(--text, #172321)' }}>
      <header style={{ maxWidth: 1120, margin: '0 auto', padding: '24px clamp(20px, 5vw, 56px)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <Link to="/" aria-label="SolenOS home" style={{ color: 'inherit', textDecoration: 'none', fontWeight: 750, letterSpacing: '0.08em' }}>SOLENOS</Link>
        <nav aria-label="Main navigation" style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <a href="#how-it-works" style={{ color: 'inherit', textDecoration: 'none', fontSize: 14 }}>How it works</a>
          <Link to="/login" style={{ color: 'inherit', textDecoration: 'none', fontSize: 14 }}>Sign in</Link>
          <Link to="/workspace?enter=1" style={{ display: 'inline-block', padding: '10px 16px', borderRadius: 10, background: 'var(--trust, #285b50)', color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 650 }}>Enter SolenOS</Link>
        </nav>
      </header>

      <section style={{ maxWidth: 1120, margin: '0 auto', padding: 'clamp(48px, 9vw, 104px) clamp(20px, 5vw, 56px) 72px' }}>
        <p style={{ textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: 12, fontWeight: 700, color: 'var(--trust, #285b50)' }}>Living Care Record</p>
        <h1 style={{ maxWidth: 780, fontSize: 'clamp(38px, 6.5vw, 72px)', lineHeight: 1.05, letterSpacing: '-0.045em', margin: '18px 0 22px' }}>
          When you’re caring for someone, you shouldn’t have to remember everything.
        </h1>
        <p style={{ maxWidth: 680, fontSize: 'clamp(17px, 2vw, 21px)', lineHeight: 1.7, color: 'var(--text-secondary, #53615d)' }}>
          SolenOS brings scattered care information together so families can understand what happened, what changed, what matters now, and what still needs attention.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 30 }}>
          <Link to="/workspace?enter=1" style={{ padding: '13px 19px', borderRadius: 10, background: 'var(--trust, #285b50)', color: '#fff', textDecoration: 'none', fontWeight: 650 }}>Enter SolenOS</Link>
          <a href="#how-it-works" style={{ padding: '13px 19px', borderRadius: 10, border: '1px solid var(--border, #d5ded9)', color: 'inherit', textDecoration: 'none', fontWeight: 600 }}>How it works</a>
        </div>
      </section>

      <section style={{ borderTop: '1px solid var(--border, #d5ded9)', borderBottom: '1px solid var(--border, #d5ded9)', background: 'var(--surface, #fff)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '54px clamp(20px, 5vw, 56px)' }}>
          <h2 style={{ fontSize: 'clamp(26px, 4vw, 42px)', letterSpacing: '-0.03em', margin: '0 0 16px' }}>Care doesn’t happen in one place.</h2>
          <p style={{ maxWidth: 760, lineHeight: 1.75, color: 'var(--text-secondary, #53615d)' }}>
            It happens across appointments, medications, conversations, documents, observations, and ordinary days. When something changes, families need a clearer picture—not another disconnected folder.
          </p>
          <div id="how-it-works" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 16, marginTop: 30 }}>
            {sections.map((section) => (
              <article key={section.title} style={{ border: '1px solid var(--border, #d5ded9)', borderRadius: 14, padding: 22 }}>
                <h3 style={{ margin: '0 0 10px', fontSize: 18 }}>{section.title}</h3>
                <p style={{ margin: 0, lineHeight: 1.65, color: 'var(--text-secondary, #53615d)', fontSize: 14 }}>{section.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '64px clamp(20px, 5vw, 56px)' }}>
        <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', letterSpacing: '-0.03em', margin: '0 0 18px' }}>A living record of someone’s care.</h2>
        <ul style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 12, padding: 0, listStyle: 'none' }}>
          {['What changed.', 'What matters now.', 'What we know.', 'What remains uncertain.', 'What needs follow-up.'].map((item) => (
            <li key={item} style={{ padding: 16, borderLeft: '3px solid var(--trust, #285b50)', background: 'var(--surface, #fff)' }}>{item}</li>
          ))}
        </ul>
        <p style={{ maxWidth: 720, marginTop: 24, lineHeight: 1.75, color: 'var(--text-secondary, #53615d)' }}>
          SolenOS is designed to support care continuity. It does not replace a clinician or emergency services; important decisions should be confirmed with the appropriate healthcare professional.
        </p>
      </section>

      <footer style={{ borderTop: '1px solid var(--border, #d5ded9)', padding: '24px clamp(20px, 5vw, 56px)', fontSize: 13, color: 'var(--text-secondary, #53615d)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <span>SolenOS · Living Care Record</span>
          <span>The care journey, remembered.</span>
        </div>
      </footer>
    </main>
  )
}
