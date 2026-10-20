import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'

export default function InvestorVerify() {
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Read token from URL query param on mount
  useEffect(() => {
    const urlToken = searchParams.get('token')
    if (urlToken) {
      setToken(urlToken)
    }
  }, [searchParams])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/investor/magic-link/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Invalid or expired token')
      }
      // Success: redirect to investor dashboard
      navigate('/investor/dashboard')
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
          <span style={{ fontSize: '48px', marginBottom: '16px', display: 'block' }}>ðŸ“§</span>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text)' }}>
            Verify Investor Access
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', maxWidth: '400px', margin: '8px auto 0' }}>
            Enter the magic link token sent to your email to verify your investor access.
          </p>
        </div>

        {error && (
          <div style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger)', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--danger)' }}>
              {error}
            </div>
          </div>
        )}

        <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label htmlFor="investor-token" style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text)', marginBottom: '4px' }}>
              Magic Link Token
            </label>
            <input
              id="investor-token"
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Enter token"
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
            {loading ? 'Verifying...' : 'Verify Token'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <Link to="/investor/login" style={{ fontSize: '12px', color: 'var(--text-secondary)', textDecoration: 'none' }}>
            Return to investor login
          </Link>
        </div>
      </div>
    </div>
  )
}