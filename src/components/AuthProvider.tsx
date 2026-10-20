import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useNavigate, useLocation, Outlet, Navigate } from 'react-router-dom'
import { checkAuthState, subscribeToAuthState, startTokenRefresh, stopTokenRefresh } from '../api/client'

interface SessionInfo {
  authenticated: boolean
  account_id: string | null
  session_type: string
  authorized_person_ids: string[]
  caregiver_roles: Record<string, string>
  professional_roles: Record<string, string>
  anonymous_session_id: string | null
  expires_at: string
  mfa_verified: boolean
}

interface AuthContextType {
  authenticated: boolean
  sessionInfo: SessionInfo | null
  loading: boolean
  refreshAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false)
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    let mounted = true

    const initAuth = async () => {
      const { authenticated: auth, sessionInfo: info } = await checkAuthState()
      if (mounted) {
        setAuthenticated(auth)
        setSessionInfo(info)
        setLoading(false)
        if (auth) startTokenRefresh()
      }
    }

    initAuth()

    const unsubscribe = subscribeToAuthState((auth, info) => {
      if (mounted) {
        setAuthenticated(auth)
        setSessionInfo(info)
        if (auth) startTokenRefresh()
        else stopTokenRefresh()
      }
    })

    return () => {
      mounted = false
      unsubscribe()
      stopTokenRefresh()
    }
  }, [])

  const refreshAuth = async () => {
    const { authenticated: auth, sessionInfo: info } = await checkAuthState()
    setAuthenticated(auth)
    setSessionInfo(info)
  }

  return (
    <AuthContext.Provider value={{ authenticated, sessionInfo, loading, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

// Protected route - requires authentication
export function RequireAuth({ children }: { children: ReactNode }) {
  const { authenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Loading...</div>
      </div>
    )
  }

  if (!authenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

// Anonymous-friendly route - works with or without auth
export function AnonymousAllowed({ children }: { children: ReactNode }) {
  const { loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Loading...</div>
      </div>
    )
  }

  return <>{children}</>
}

// Route that redirects authenticated users away (e.g., login page)
export function GuestOnly({ children }: { children: ReactNode }) {
  const { authenticated, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Loading...</div>
      </div>
    )
  }

  if (authenticated) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}