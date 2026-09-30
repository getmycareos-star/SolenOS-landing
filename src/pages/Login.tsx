import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'

type UserRole = 'caregiver' | 'professional' | 'team'

export default function Login() {
  const [role, setRole] = useState<UserRole>('caregiver')
  const [identifier, setIdentifier] = useState('')
  const navigate = useNavigate()

  const handleLogin = () => {
    localStorage.setItem('solenos_user_role', role)
    if (identifier) {
      localStorage.setItem('solenos_identifier', identifier)
    }
    if (role === 'caregiver') navigate('/')
    else if (role === 'professional') navigate('/professional')
    else navigate('/team')
  }

  const roleInfo: Record<UserRole, { emoji: string; label: string; desc: string }> = {
    caregiver: { emoji: '❤️', label: 'Caregiver Login', desc: 'Access your Living Care Record, daily care, appointments, and community.' },
    professional: { emoji: '👩‍⚕️', label: 'Professional Login', desc: 'Access your professional dashboard: help requests, office hours, and impact metrics.' },
    team: { emoji: '🛡️', label: 'SolenOS Team Login', desc: 'Access Mission Control: community health, moderation center, and State of Dementia Care reports.' },
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ maxWidth: '480px', width: '100%', padding: '32px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <span style={{ fontSize: '48px', marginBottom: '16px', display: 'block' }}>🏠</span>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text)' }}>
            SolenOS — Three Login Paths
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>
            Select your role to enter SolenOS.
          </p>
        </div>

        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '16px', padding: '24px'
        }}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
            {(['caregiver', 'professional', 'team'] as UserRole[]).map((r) => {
              const info = roleInfo[r]
              const selected = role === r
              return (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  style={{
                    flex: 1,
                    background: selected ? 'var(--accent-soft)' : 'var(--bg)',
                    border: `2px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: '12px', padding: '16px 12px',
                    cursor: 'pointer', textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '28px', marginBottom: '6px' }}>{info.emoji}</div>
                  <div style={{ fontSize: '13px', fontWeight: selected ? 600 : 500, color: selected ? 'var(--text)' : 'var(--text-secondary)' }}>
                    {info.label}
                  </div>
                </button>
              )
            })}
          </div>

          <div style={{
            background: roleInfo[role].emoji === '🏥' ? 'var(--trust-soft)' : 'var(--accent-soft)',
            borderRadius: '8px', padding: '12px 16px', marginBottom: '20px'
          }}>
            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>{roleInfo[role].label}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{roleInfo[role].desc}</div>
          </div>

          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder={role === 'professional' ? 'Professional ID or email' : role === 'team' ? 'Team access key' : 'Person ID'}
            style={{
              width: '100%', padding: '12px 16px', borderRadius: '8px',
              border: '1px solid var(--border)', background: 'var(--bg)',
              fontSize: '14px', outline: 'none', marginBottom: '20px',
            }}
          />

          <button
            onClick={handleLogin}
            style={{
              width: '100%', padding: '12px 20px', borderRadius: '12px',
              border: 'none', background: 'var(--trust)', color: 'white',
              fontSize: '14px', fontWeight: 500, cursor: 'pointer',
            }}
          >
            Enter SolenOS as {roleInfo[role].label.split(' ')[0]}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <Link to="/" style={{ fontSize: '12px', color: 'var(--text-secondary)', textDecoration: 'none' }}>
            Continue as caregiver (default) →
          </Link>
        </div>
      </div>
    </div>
  )
}
