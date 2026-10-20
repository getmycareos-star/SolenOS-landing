import { NextResponse } from 'next/server'
import { Pool } from 'pg'
import { randomUUID } from 'crypto'
import bcrypt from 'bcrypt'

// Database connection pool
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
})

// Type definitions for our identity API
type IdentityLoginRequest = {
  email: string
  password: string
  care_session_id?: string
}

type IdentityLoginResponse = {
  user_id: string
  care_session_id: string
  session_token: string  // For client-side storage
  identity_flags: {
    is_new_user: boolean
    has_profile: boolean
  }
}

// POST /api/identity/login - Log in a user
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as IdentityLoginRequest
    const {
      email,
      password,
      care_session_id
    } = body

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields: email, password' },
        { status: 400 }
      )
    }

    // Find the user by email
    const userResult = await pool.query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [email.toLowerCase()]
    )

    if (userResult.rows.length === 0) {
      // Don't reveal whether the email exists for security
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    const user = userResult.rows[0]

    // Verify the password
    const passwordValid = await bcrypt.compare(password, user.password_hash)
    if (!passwordValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Create a session for the user
    const sessionToken = randomUUID()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30) // 30 days from now

    // Start a transaction to ensure consistency
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Create the session
      const sessionResult = await client.query(
        `
        INSERT INTO sessions (
          id, user_id, session_token, expires_at
        ) VALUES (
          $1, $2, $3, $4
        ) RETURNING id, session_token, expires_at
        `,
        [
          randomUUID(),
          user.id,
          sessionToken,
          expiresAt
        ]
      )

      // Update last sign-in time for the user
      await client.query(
        'UPDATE users SET last_sign_in_at = NOW() WHERE id = $1',
        [user.id]
      )

      await client.query('COMMIT')

      return NextResponse.json({
        user_id: user.id,
        care_session_id: care_session_id || randomUUID(), // Use provided or generate new
        session_token: sessionResult.rows[0].session_token,
        identity_flags: {
          is_new_user: false, // Existing user logging in
          has_profile: false // Would be true if we had profile info
        }
      }, { status: 200 })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error during login:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/identity/session - Validate a session
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionToken = searchParams.get('session_token')

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Missing session_token parameter' },
        { status: 400 }
      )
    }

    // Find the session and validate it's not expired
    const sessionResult = await pool.query(
      `
      SELECT s.id, s.user_id, s.expires_at, u.email, u.telemetry_user_id
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.session_token = $1 AND s.expires_at > NOW()
      `,
      [sessionToken]
    )

    if (sessionResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      )
    }

    const session = sessionResult.rows[0]

    return NextResponse.json({
      valid: true,
      user_id: session.user_id,
      email: session.email,
      telemetry_user_id: session.telemetry_user_id?.toString() || null,
      expires_at: session.expires_at.toISOString()
    }, { status: 200 })
  } catch (error) {
    console.error('Error validating session:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}