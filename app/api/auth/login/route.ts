import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()

    // Get password from environment variable
    const adminPassword = process.env.ADMIN_PASSWORD

    if (!adminPassword) {
      console.log('❌ ADMIN_PASSWORD not set in environment')
      return NextResponse.json(
        { success: false, error: 'Server misconfigured' },
        { status: 500 }
      )
    }

    console.log('🔐 Login attempt - checking password')
    
    // Verify password
    if (password === adminPassword) {
      console.log('✅ Login successful')
      return NextResponse.json({ success: true })
    } else {
      console.log('❌ Wrong password')
      return NextResponse.json(
        { success: false, error: 'Invalid password' },
        { status: 401 }
      )
    }
  } catch (error) {
    console.error('🔴 API Error:', error)
    return NextResponse.json(
      { success: false, error: 'Invalid request' },
      { status: 400 }
    )
  }
}
