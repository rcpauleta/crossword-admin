'use client'

import { ReactNode, useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type AdminLayoutProps = {
  children: ReactNode
  title: string
}

export default function AdminLayout({ children, title }: AdminLayoutProps) {
  const pathname = usePathname()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false) // Changed to false by default

  // Close sidebar on mobile when route changes
  useEffect(() => {
    setIsSidebarOpen(false)
  }, [pathname])

  const navigation = [
    { name: 'Dashboard', href: '/', icon: '📊' },
    { name: 'Themes', href: '/themes', icon: '🎨' },
    { name: 'Languages', href: '/languages', icon: '🌍' },
    { name: 'Difficulties', href: '/difficulties', icon: '⚡' },
    { name: 'Words', href: '/words', icon: '📝' },
    { name: 'Puzzle Configs', href: '/puzzle-configs', icon: '⚙️' },
    { name: 'Generated Puzzles', href: '/puzzles', icon: '🧩' },
    { name: 'Harvest Jobs', href: '/harvest-jobs', icon: '🌾' },
  ]

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Top Bar */}
      <header className="bg-gray-800 border-b border-gray-700 fixed top-0 left-0 right-0 z-30">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="text-gray-400 hover:text-white"
            >
              ☰
            </button>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Crossword Admin</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs sm:text-sm text-gray-600 hidden sm:block">Admin User</span>
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium">
              A
            </div>
          </div>
        </div>
      </header>

      <div className="flex pt-16">
        {/* Sidebar */}
        <aside
          className={`
            fixed left-0 top-16 bottom-0 w-64 bg-gray-800 border-r border-gray-700 
            transition-transform duration-300 z-20
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          <nav className="p-4 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium
                    transition-colors
                    ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }
                  `}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 transition-all duration-300">
          {children}
        </main>
      </div>

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-10"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  )
}
