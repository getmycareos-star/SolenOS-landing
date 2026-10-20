import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'

export default function InvestorLogin() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)
    try {
      const response = await fetch('/investor/magic-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to send magic link')
      }
      // Success: show message
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ maxWidth: '480px', width: '100%', padding: '32px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <span style={{ fontSize: '48px', marginBottom: '16px', display: 'block' }}>📧</span>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text)' }}>
            Investor Magic Link
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', maxWidth: '400px', margin: '8px auto 0' }}>
            Enter your email to receive a magic link for investor access. If your email exists and is approved, a link will be sent.
          </p>
        </div>

        {error && (
          <div style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger)', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--danger)' }}>
              {error}
            </div>
          </div>
        )}

        {success && (
          <div style={{ background: 'var(--success-soft)', border: '1px solid var(--success)', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--success)' }}>
              If your email exists and is approved, a magic link has been sent to your inbox.
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label htmlFor="investor-email" style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text)', marginBottom: '4px' }}>
              Email address
            </label>
            <input
              id="investor-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              style={{
                width: '100%', padding: '12px 16px', borderRadius: '8px',
                border: '1px solid var(--border)', background: 'var(--bg)',
                fontSize: '14px', outline: 'none',
              }}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '12px 20px', borderRadius: '12px',
              border: 'none', background: 'var(--trust)', color: 'white',
              fontSize: '14px', fontWeight: 500, cursor: 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Sending...' : 'Send Magic Link'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <Link to="/login" style={{ fontSize: '12px', color: 'var(--text-secondary)', textDecoration: 'none' }}>
            Return to regular login
          </Link>
        </div>
      </div>
    </div>
  )
}