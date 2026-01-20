'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/supabase'
import { useRouter } from 'next/navigation'
import PublicLayout from '../components/PublicLayout'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'

type DailyPuzzle = {
  daily_id: number
  daily_date: string
  puzzle_id: number
  language_id: string
}

type GameSession = {
  id: number
  user_id: string
  puzzle_id: number
  started_at: string
  completed_at: string | null
  time_seconds: number
  is_completed: boolean
  correct_cells: number
  total_cells: number
  score_percentage: number
  grid_state: any
}

export default function DailyPuzzlePage() {
  const [loading, setLoading] = useState(true)
  const [dailyPuzzle, setDailyPuzzle] = useState<DailyPuzzle | null>(null)
  const [userSession, setUserSession] = useState<GameSession | null>(null)
  const router = useRouter()
  const { user } = useAuth()
  const { selectedLanguage } = useLanguage()

  useEffect(() => {
    fetchDailyPuzzle()
  }, [user, selectedLanguage])

  async function fetchDailyPuzzle() {
    try {
      setLoading(true)

      // Get today's daily puzzle for selected language
      const { data: dailyData, error: dailyError } = await supabase
        .rpc('get_or_create_daily_puzzle', { lang_iso: selectedLanguage })
        .single()

      if (dailyError) {
        console.error('Daily puzzle error:', dailyError)
        // Don't throw, just set loading to false and show no puzzle message
        setDailyPuzzle(null)
        setLoading(false)
        return
      }

      setDailyPuzzle(dailyData as DailyPuzzle)

      // If user is logged in, check their session for today's puzzle
      if (user && dailyData) {
        const { data: sessionData } = await supabase
          .from('GameSession')
          .select('*')
          .eq('user_id', user.id)
          .eq('puzzle_id', (dailyData as DailyPuzzle).puzzle_id)
          .single()

        setUserSession(sessionData)
      }
    } catch (error) {
      console.error('Error fetching daily puzzle:', error)
    } finally {
      setLoading(false)
    }
  }

  function handlePlay() {
    if (dailyPuzzle) {
      router.push(`/puzzles/${dailyPuzzle.puzzle_id}`)
    }
  }

  if (loading) {
    return (
      <PublicLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-xl text-white">A carregar puzzle do dia...</div>
        </div>
      </PublicLayout>
    )
  }

  // Add this check
  if (!dailyPuzzle) {
    return (
      <PublicLayout>
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-3xl mx-auto text-center">
            <div className="text-6xl mb-4">😞</div>
            <h1 className="text-3xl font-bold text-white mb-4">
              Nenhum Puzzle Disponível
            </h1>
            <p className="text-gray-400 mb-6">
              Ainda não temos puzzles diários para este idioma.
            </p>
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-left">
              <h3 className="text-white font-semibold mb-3">Para adicionar puzzles:</h3>
              <ol className="space-y-2 text-gray-300 text-sm list-decimal list-inside">
                <li>Vá para a página de Languages e adicione palavras</li>
                <li>Gere pistas para as palavras</li>
                <li>Crie uma configuração de puzzle</li>
                <li>Gere puzzles a partir da configuração</li>
              </ol>
            </div>
          </div>
        </div>
      </PublicLayout>
    )
  }

  const today = new Date().toLocaleDateString('pt-PT', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-block bg-blue-900 bg-opacity-50 px-6 py-2 rounded-full mb-4">
              <span className="text-blue-300 text-sm font-semibold uppercase tracking-wide">
                Puzzle Diário
              </span>
            </div>
            <h1 className="text-5xl font-bold text-white mb-4">
              📅 Desafio de Hoje
            </h1>
            <p className="text-gray-400 text-lg capitalize">
              {today}
            </p>
          </div>

          {/* Puzzle Card */}
          <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden shadow-2xl">
            {/* Stats Banner */}
            {userSession && (
              <div className={`px-6 py-3 ${userSession.is_completed
                ? 'bg-green-900 border-b border-green-700'
                : 'bg-blue-900 border-b border-blue-700'
                }`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">
                    {userSession.is_completed ? '✅ Completado' : '⏳ Em Progresso'}
                  </span>
                  {userSession.is_completed && userSession.time_seconds && (
                    <span className="text-sm text-green-300">
                      {userSession.score_percentage}% • {Math.floor(userSession.time_seconds / 60)}m {userSession.time_seconds % 60}s
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="p-8">
              {/* Info Grid */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-gray-900 rounded-lg p-4 text-center">
                  <div className="text-3xl mb-2">🧩</div>
                  <div className="text-gray-400 text-sm">Todos jogam</div>
                  <div className="text-white font-semibold">o mesmo puzzle</div>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 text-center">
                  <div className="text-3xl mb-2">🏆</div>
                  <div className="text-gray-400 text-sm">Compete com</div>
                  <div className="text-white font-semibold">outros jogadores</div>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 text-center">
                  <div className="text-3xl mb-2">⏰</div>
                  <div className="text-gray-400 text-sm">Novo puzzle</div>
                  <div className="text-white font-semibold">amanhã</div>
                </div>
              </div>

              {/* CTA */}
              <button
                onClick={handlePlay}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-5 px-8 rounded-xl text-xl transition-all shadow-lg transform hover:scale-105"
              >
                {userSession?.is_completed
                  ? '🔄 Jogar Novamente'
                  : userSession
                    ? '▶️ Continuar'
                    : '🎮 Jogar Agora'}
              </button>

              {!user && (
                <p className="text-center text-gray-400 text-sm mt-4">
                  💡 <a href="/signup" className="text-blue-400 hover:text-blue-300">Crie uma conta</a> para guardar o seu progresso
                </p>
              )}
            </div>
          </div>

          {/* How it works */}
          <div className="mt-12 bg-gray-800 bg-opacity-50 rounded-lg p-6 border border-gray-700">
            <h3 className="text-white font-semibold mb-4">Como funciona o Puzzle Diário?</h3>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                Todos os dias, um novo puzzle é disponibilizado
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                Todos os jogadores resolvem o mesmo puzzle
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                O teu tempo e pontuação são guardados
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                Compete para ser o mais rápido do dia!
              </li>
            </ul>
          </div>
        </div>
      </div>
    </PublicLayout>
  )
}
