'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      console.log('📤 Sending login request...')

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })

      console.log('📥 Response status:', response.status)

      const result = await response.json()
      console.log('📥 Response:', result)

      if (result.success) {
        console.log('✅ Login successful, setting cookie and redirecting...')

        // Remove 'secure' flag - it only works on HTTPS
        document.cookie = 'admin-auth=true; path=/; max-age=604800; samesite=strict'

        // Wait for cookie to be set
        setTimeout(() => {
          console.log('🔄 Redirecting to home...')
          console.log('Cookie:', document.cookie)
          router.push('/')
        }, 500)
      }

      else {
        console.log('❌ Login failed:', result.error)
        setError(result.error || 'Invalid password')
      }
    } catch (err) {
      console.error('🔴 Error:', err)
      setError('An error occurred: ' + String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="bg-gray-800 p-8 rounded-lg border border-gray-700 max-w-md w-full shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">🧩 Crossword Admin</h1>
          <p className="text-gray-400">Secure Access Required</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-900 border border-red-700 rounded-md text-red-200 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-700">
          <p className="text-xs text-gray-500 text-center">
            Protected admin panel
          </p>
        </div>
      </div>
    </div>
  )
}
