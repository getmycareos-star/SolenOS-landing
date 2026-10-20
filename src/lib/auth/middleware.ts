import { NextResponse } from 'next/server'
import { Pool } from 'pg'

// Database connection pool
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
})

/**
 * Middleware to authenticate requests using session tokens
 * Supports both header-based (X-Session-Token) and query-param-based (session_token) tokens
 */
export async function authenticate(request: Request) {
  // Try to get session token from header first
  let sessionToken = request.headers.get('X-Session-Token')
   
  // If not in header, try query parameter
  if (!sessionToken) {
    const { searchParams } = new URL(request.url)
    sessionToken = searchParams.get('session_token')
  }

  // If no token found, return unauthorized
  if (!sessionToken) {
    return {
      authenticated: false,
      response: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
  }

  try {
    // Validate the session
    const sessionResult = await pool.query(
      `
      SELECT s.id, s.user_id, s.expires_at, u.email, u.telemetry_user_id
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.session_token = $1 AND s.expires_at > NOW() AND u.deleted_at IS NULL
      `,
      [sessionToken]
    )

    if (sessionResult.rows.length === 0) {
      return {
        authenticated: false,
        response: NextResponse.json(
          { error: 'Invalid or expired session' },
          { status: 401 }
        )
      }
    }

    const session = sessionResult.rows[0]

    // Update last accessed time for the session
    await pool.query(
      'UPDATE sessions SET last_accessed_at = NOW() WHERE id = $1',
      [session.id]
    )

    // Return the authenticated user info
    return {
      authenticated: true,
      user: {
        id: session.user_id,
        email: session.email,
        telemetry_user_id: session.telemetry_user_id?.toString() || null
      }
    }
  } catch (error) {
    console.error('Error during authentication:', error)
    return {
      authenticated: false,
      response: NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}

/**
 * Higher-order function to wrap API route handlers with authentication
 */
export function withAuthentication(handler: (request: Request, user: any) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    const authResult = await authenticate(request)
    
    if (!authResult.authenticated) {
      return authResult.response
    }
    
    return handler(request, authResult.user)
  }
}