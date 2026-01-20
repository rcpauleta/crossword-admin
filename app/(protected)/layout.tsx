'use client'

import { useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useRouter } from 'next/navigation'
import PublicLayout from '../components/PublicLayout'

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading, isAdmin } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    } else if (!loading && user && !isAdmin) {
      // User is logged in but not admin - redirect to play
      router.push('/play')
    }
  }, [user, loading, isAdmin, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (!isAdmin) {
    return (
      <PublicLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">🚫</div>
            <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
            <p className="text-gray-400 mb-6">You don't have permission to access this page.</p>
          </div>
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      {/* Admin Badge */}
      <div className="bg-yellow-900 border-b border-yellow-700">
        <div className="container mx-auto px-4 py-2">
          <p className="text-yellow-200 text-sm">
            🔧 <strong>Admin Panel</strong> - You have full access to manage languages, configs, and puzzles
          </p>
        </div>
      </div>

      {/* Page Content */}
      {children}
    </PublicLayout>
  )
}
