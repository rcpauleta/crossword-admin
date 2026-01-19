'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

type AuthContextType = {
  isAuthenticated: boolean
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({ isAuthenticated: false, loading: true })

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Check if user has auth cookie
    const cookie = document.cookie.split('; ').find(row => row.startsWith('admin-auth='))
    const authenticated = cookie?.split('=')[1] === 'true'
    setIsAuthenticated(authenticated)
    setLoading(false)

    // Redirect to login if not authenticated and not on login page
    if (!authenticated && pathname !== '/login') {
      router.push('/login')
    }
  }, [pathname, router])

  return (
    <AuthContext.Provider value={{ isAuthenticated, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
