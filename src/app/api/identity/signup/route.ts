import { NextResponse } from 'next/server'
import { Pool } from 'pg'
import { randomUUID } from 'crypto'
import bcrypt from 'bcrypt'

// Database connection pool
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
})

// Type definitions for our identity API
type IdentitySignupRequest = {
  care_session_id: string
  email: string
  password: string  // Should be at least 8 characters
  telemetry_user_id?: string
}

type IdentitySignupResponse = {
  user_id: string
  care_session_id: string
  identity_flags: {
    is_new_user: boolean
    has_profile: boolean
  }
}

// POST /api/identity/signup - Sign up a new user
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as IdentitySignupRequest
    const {
      care_session_id,
      email,
      password,
      telemetry_user_id
    } = body

    // Validate required fields
    if (!email || !password || !care_session_id) {
      return NextResponse.json(
        { error: 'Missing required fields: email, password, care_session_id' },
        { status: 400 }
      )
    }

    // Validate password length
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUserResult = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    )

    if (existingUserResult.rows.length > 0) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      )
    }

    // Hash the password with bcrypt (cost factor of 12)
    const passwordHash = await bcrypt.hash(password, 12)

    // Start a transaction to ensure consistency
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Create the user
      const userResult = await client.query(
        `
        INSERT INTO users (
          id, email, password_hash, telemetry_user_id
        ) VALUES (
          $1, $2, $3, $4
        ) RETURNING id, email, telemetry_user_id, created_at
        `,
        [
          randomUUID(),
          email.toLowerCase(),
          passwordHash,
          telemetry_user_id ? randomUUID() : null  // Generate a UUID for telemetry if provided
        ]
      )

      const user = userResult.rows[0]

      // TODO: In a full implementation, we would also:
      // 1. Link the ephemeral care session to this persistent user
      // 2. Migrate any ephemeral data to persistent storage tied to the user
      // 3. Set up the care recipient identity if needed

      await client.query('COMMIT')

      return NextResponse.json({
        user_id: user.id,
        care_session_id: care_session_id, // In a full implementation, we might generate a new one
        identity_flags: {
          is_new_user: true,
          has_profile: false // Would be true if we collected profile info during signup
        }
      }, { status: 201 })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error during signup:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}