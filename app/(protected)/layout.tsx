'use client'

import { useAuth } from '@/app/context/AuthContext'
import AdminLayout from '@/app/components/AdminLayout'
import { ReactNode } from 'react'

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>
  }

  if (!isAuthenticated) {
    return null // Will redirect to login
  }

  return <AdminLayout title="">{children}</AdminLayout>
}
