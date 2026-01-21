'use client'

import PublicLayout from './components/PublicLayout'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/supabase'

export default function LandingPage() {
  const [topPlayerToday, setTopPlayerToday] = useState<any>(null)

  useEffect(() => {
    async function fetchTopPlayer() {
      const { data } = await supabase
        .rpc('get_leaderboard', {
          time_period: 'today',
          limit_count: 1
        })

      if (data && data.length > 0) {
        setTopPlayerToday(data[0])
      }
    }
    fetchTopPlayer()
  }, [])

  return (
    <PublicLayout>
      <div className="bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
        {/* Hero Section */}
        <div className="container mx-auto px-4 py-16">
          <div className="text-center max-w-4xl mx-auto">
            {/* Logo/Title */}
            <div className="mb-8">
              <h1 className="text-6xl md:text-7xl font-bold text-white mb-4">
                🧩 Crossword
              </h1>
              <p className="text-xl md:text-2xl text-gray-300">
                Desafie a sua mente com palavras cruzadas em Português
              </p>
            </div>

            {/* CTA Buttons with Glassmorphism */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link
                href="/daily"
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-lg text-lg transition-all shadow-lg hover:scale-105 hover:shadow-xl"
              >
                🎮 Jogar Agora
              </Link>
              <Link
                href="/play"
                className="bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 text-white font-bold py-4 px-8 rounded-lg text-lg transition-all shadow-lg hover:scale-105"
              >
                📚 Ver Puzzles
              </Link>
            </div>

            {/* Top Player Today Widget */}
            {topPlayerToday && (
              <div className="mt-8 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-xl p-6 backdrop-blur-sm">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-center sm:text-left">
                    <p className="text-sm text-gray-400 mb-1">🏆 Top Jogador Hoje</p>
                    <p className="text-2xl font-bold">{topPlayerToday.username}</p>
                    <p className="text-sm text-blue-400">
                      {topPlayerToday.total_puzzles} puzzles • {topPlayerToday.total_clean_runs} clean runs
                    </p>
                  </div>
                  <Link
                    href="/leaderboard"
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-all hover:scale-105 text-sm whitespace-nowrap"
                  >
                    Ver Leaderboard →
                  </Link>
                </div>
              </div>
            )}

            {/* Features */}
            <div className="grid md:grid-cols-3 gap-8 mt-16">
              <div className="bg-white/5 backdrop-blur-md p-6 rounded-lg border border-white/10 hover:bg-white/10 transition-all hover:scale-105">
                <div className="text-4xl mb-4">🇵🇹</div>
                <h3 className="text-xl font-bold text-white mb-2">Em Português</h3>
                <p className="text-gray-300">
                  Milhares de palavras e pistas criativas em Português
                </p>
              </div>

              <div className="bg-white/5 backdrop-blur-md p-6 rounded-lg border border-white/10 hover:bg-white/10 transition-all hover:scale-105">
                <div className="text-4xl mb-4">🎯</div>
                <h3 className="text-xl font-bold text-white mb-2">Vários Níveis</h3>
                <p className="text-gray-300">
                  De iniciante a expert, temos puzzles para todos
                </p>
              </div>

              <div className="bg-white/5 backdrop-blur-md p-6 rounded-lg border border-white/10 hover:bg-white/10 transition-all hover:scale-105">
                <div className="text-4xl mb-4">📱</div>
                <h3 className="text-xl font-bold text-white mb-2">Responsive</h3>
                <p className="text-gray-300">
                  Jogue no computador, tablet ou smartphone
                </p>
              </div>
            </div>

            {/* Stats - Bento Grid Style */}
            <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-600/20 to-blue-500/10 backdrop-blur-md p-6 rounded-xl border border-blue-500/20 hover:scale-105 transition-all">
                <div className="text-4xl font-bold text-blue-400">27K+</div>
                <div className="text-gray-300 text-sm mt-1">Palavras</div>
              </div>
              <div className="bg-gradient-to-br from-purple-600/20 to-purple-500/10 backdrop-blur-md p-6 rounded-xl border border-purple-500/20 hover:scale-105 transition-all">
                <div className="text-4xl font-bold text-purple-400">27K+</div>
                <div className="text-gray-300 text-sm mt-1">Pistas</div>
              </div>
              <div className="bg-gradient-to-br from-green-600/20 to-green-500/10 backdrop-blur-md p-6 rounded-xl border border-green-500/20 hover:scale-105 transition-all">
                <div className="text-4xl font-bold text-green-400">∞</div>
                <div className="text-gray-300 text-sm mt-1">Puzzles</div>
              </div>
              <div className="bg-gradient-to-br from-yellow-600/20 to-yellow-500/10 backdrop-blur-md p-6 rounded-xl border border-yellow-500/20 hover:scale-105 transition-all">
                <div className="text-4xl font-bold text-yellow-400">100%</div>
                <div className="text-gray-300 text-sm mt-1">Grátis</div>
              </div>
            </div>

            {/* How to Play */}
            <div className="mt-16 text-left bg-white/5 backdrop-blur-md p-8 rounded-xl border border-white/10">
              <h2 className="text-3xl font-bold text-white mb-8 text-center">
                Como Jogar
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-start gap-3 mb-6">
                    <span className="bg-gradient-to-br from-blue-600 to-blue-500 text-white rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0 font-bold text-lg shadow-lg">
                      1
                    </span>
                    <div>
                      <h4 className="text-white font-semibold mb-1 text-lg">Escolha um Puzzle</h4>
                      <p className="text-gray-300 text-sm">
                        Navegue pelos puzzles disponíveis e escolha o tamanho e dificuldade
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="bg-gradient-to-br from-blue-600 to-blue-500 text-white rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0 font-bold text-lg shadow-lg">
                      2
                    </span>
                    <div>
                      <h4 className="text-white font-semibold mb-1 text-lg">Leia as Pistas</h4>
                      <p className="text-gray-300 text-sm">
                        Clique nas pistas para destacar as palavras no grid
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-start gap-3 mb-6">
                    <span className="bg-gradient-to-br from-blue-600 to-blue-500 text-white rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0 font-bold text-lg shadow-lg">
                      3
                    </span>
                    <div>
                      <h4 className="text-white font-semibold mb-1 text-lg">Preencha as Palavras</h4>
                      <p className="text-gray-300 text-sm">
                        Use o teclado para escrever. Setas para navegar
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="bg-gradient-to-br from-blue-600 to-blue-500 text-white rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0 font-bold text-lg shadow-lg">
                      4
                    </span>
                    <div>
                      <h4 className="text-white font-semibold mb-1 text-lg">Verifique e Complete</h4>
                      <p className="text-gray-300 text-sm">
                        Clique em "Check" para ver o seu progresso
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer CTA */}
            <div className="mt-16">
              <Link
                href="/daily"
                className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-5 px-12 rounded-full text-xl transition-all shadow-2xl transform hover:scale-110"
              >
                Começar a Jogar 🎯
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-white/10 py-8 mt-16">
          <div className="container mx-auto px-4 text-center text-gray-400">
            <p>© 2026 Crossword. Feito com ❤️ para amantes de palavras cruzadas.</p>
          </div>
        </footer>
      </div>
    </PublicLayout>
  )
}
