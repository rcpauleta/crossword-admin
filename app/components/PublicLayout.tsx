'use client'

import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/supabase'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, signOut } = useAuth()
  const { selectedLanguage, setSelectedLanguage, availableLanguages, setAvailableLanguages } = useLanguage()
  const [showAdminMenu, setShowAdminMenu] = useState(false)
  const [showLangMenu, setShowLangMenu] = useState(false)

  // Fetch available languages
  useEffect(() => {
    fetchLanguages()
  }, [])

  async function fetchLanguages() {
    const { data } = await supabase
      .from('Language')
      .select('ISO, name, flag_emoji')
      .order('name')

    if (data) {
      setAvailableLanguages(data)
    }
  }

  const currentLang = availableLanguages.find(l => l.ISO === selectedLanguage)

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Navigation */}
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Left side - Logo & Main links */}
            <div className="flex items-center gap-6">
              <Link href="/" className="text-xl font-bold text-white hover:text-blue-400 transition-colors">
                🧩 Crossword
              </Link>
              <div className="hidden md:flex gap-4">
                <Link
                  href="/daily"
                  className="text-gray-300 hover:text-white transition-colors font-semibold"
                >
                  📅 Daily
                </Link>
                <Link
                  href="/play"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  Puzzles
                </Link>
                <Link href="/playground" className="...">
                  🎮 Playground
                </Link>
                <Link href="/playground/my-puzzles" className="...">
                  📚 Os Meus Puzzles
                </Link>
              </div>
            </div>

            {/* Right side - Language & User menu */}
            <div className="flex items-center gap-4">
              {/* Language Selector */}
              <div className="relative">
                <button
                  onClick={() => setShowLangMenu(!showLangMenu)}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors flex items-center gap-2"
                >
                  {currentLang?.flag_emoji || '🌍'} {currentLang?.name || selectedLanguage}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showLangMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowLangMenu(false)}
                    />

                    <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-xl border border-gray-700 py-2 z-20">
                      {availableLanguages.map(lang => (
                        <button
                          key={lang.ISO}
                          onClick={() => {
                            setSelectedLanguage(lang.ISO)
                            setShowLangMenu(false)
                          }}
                          className={`w-full text-left px-4 py-2 transition-colors ${selectedLanguage === lang.ISO
                            ? 'bg-blue-900 text-white'
                            : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                            }`}
                        >
                          {lang.flag_emoji} {lang.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Admin Menu */}
              {isAdmin && (
                <div className="relative">
                  <button
                    onClick={() => setShowAdminMenu(!showAdminMenu)}
                    className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm transition-colors flex items-center gap-2"
                  >
                    👑 Admin
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showAdminMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowAdminMenu(false)}
                      />

                      <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-xl border border-gray-700 py-2 z-20">
                        <Link
                          href="/languages"
                          className="block px-4 py-2 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                          onClick={() => setShowAdminMenu(false)}
                        >
                          📚 Languages
                        </Link>
                        <Link
                          href="/puzzle-configs"
                          className="block px-4 py-2 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                          onClick={() => setShowAdminMenu(false)}
                        >
                          ⚙️ Puzzle Configs
                        </Link>
                        <div className="border-t border-gray-700 my-2"></div>
                        <Link
                          href="/play"
                          className="block px-4 py-2 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                          onClick={() => setShowAdminMenu(false)}
                        >
                          👀 View as User
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* User Info / Auth Buttons */}
              {user ? (
                <div className="flex items-center gap-4">
                  <span className="text-gray-300 text-sm hidden md:block">
                    {user.email}
                  </span>
                  <button
                    onClick={() => signOut()}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
                  >
                    Sair
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Link
                    href="/login"
                    className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                  >
                    Entrar
                  </Link>
                  <Link
                    href="/signup"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                  >
                    Criar Conta
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      {children}
    </div>
  )
}
