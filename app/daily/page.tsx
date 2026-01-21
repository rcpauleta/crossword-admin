'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/supabase'
import { useRouter } from 'next/navigation'
import PublicLayout from '../components/PublicLayout'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'

type DailyPuzzle = {
  id: number
  date: string
  puzzle_id: number
  difficulty_level: string
  completed?: boolean
  completion_time?: number
  is_clean_run?: boolean
}

export default function DailyPuzzlesPage() {
  const [puzzles, setPuzzles] = useState<DailyPuzzle[]>([])
  const [loading, setLoading] = useState(true)
  const [streak, setStreak] = useState(0)
  const { selectedLanguage } = useLanguage()
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    fetchDailyPuzzles()
    if (user) fetchStreak()
  }, [selectedLanguage, user])

  async function fetchDailyPuzzles() {
    try {
      const today = new Date().toISOString().split('T')[0]

      // Fetch all 3 daily puzzles for today
      const { data: dailyPuzzles, error } = await supabase
        .from('DailyPuzzle')
        .select('*')
        .eq('date', today)
        .eq('language_id', selectedLanguage)
        .order('difficulty_level', { ascending: true })

      if (error) throw error

      // If puzzles don't exist, generate them
      if (!dailyPuzzles || dailyPuzzles.length === 0) {
        await generateAllDailyPuzzles()
        return fetchDailyPuzzles() // Retry
      }

      // Check completion status for logged-in users
      let puzzlesWithStatus = dailyPuzzles
      if (user) {
        const puzzleIds = dailyPuzzles.map(p => p.puzzle_id)
        const { data: sessions } = await supabase
          .from('GameSession')
          .select('puzzle_id, completion_time, is_clean_run, completed_at')
          .eq('user_id', user.id)
          .in('puzzle_id', puzzleIds)

        puzzlesWithStatus = dailyPuzzles.map(puzzle => {
          const session = sessions?.find(s => s.puzzle_id === puzzle.puzzle_id)
          return {
            ...puzzle,
            completed: !!session?.completed_at,
            completion_time: session?.completion_time,
            is_clean_run: session?.is_clean_run
          }
        })
      }

      setPuzzles(puzzlesWithStatus)
    } catch (error) {
      console.error('Error fetching daily puzzles:', error)
    } finally {
      setLoading(false)
    }
  }

  async function generateAllDailyPuzzles() {
    const difficulties = ['easy', 'medium', 'hard']
    for (const diff of difficulties) {
      await fetch('/api/daily-puzzle/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          languageId: selectedLanguage,
          difficulty: diff
        })
      })
    }
  }

  async function fetchStreak() {
    // Calculate consecutive days with at least 1 completed puzzle
    const { data: sessions } = await supabase
      .from('GameSession')
      .select('completed_at')
      .eq('user_id', user!.id)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(100)

    if (!sessions || sessions.length === 0) {
      setStreak(0)
      return
    }

    // Count consecutive days
    let currentStreak = 0
    let lastDate: Date | null = null

    for (const session of sessions) {
      const sessionDate = new Date(session.completed_at!)
      sessionDate.setHours(0, 0, 0, 0)

      if (!lastDate) {
        lastDate = sessionDate
        currentStreak = 1
        continue
      }

      const dayDiff = Math.floor((lastDate.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24))
      
      if (dayDiff === 1) {
        currentStreak++
        lastDate = sessionDate
      } else if (dayDiff > 1) {
        break
      }
    }

    setStreak(currentStreak)
  }

  function formatTime(seconds?: number) {
    if (!seconds) return '--'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const difficultyConfig = {
    easy: { emoji: '😊', color: 'green', label: 'Fácil' },
    medium: { emoji: '😐', color: 'yellow', label: 'Médio' },
    hard: { emoji: '😤', color: 'red', label: 'Difícil' }
  }

  if (loading) {
    return (
      <PublicLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-xl text-white">A carregar puzzles diários...</div>
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-white mb-4">
              📅 Puzzles Diários
            </h1>
            <p className="text-xl text-gray-300 mb-4">
              {new Date().toLocaleDateString('pt-PT', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
            
            {user && streak > 0 && (
              <div className="inline-block bg-gradient-to-r from-orange-600/20 to-red-600/20 border border-orange-500/30 rounded-lg px-6 py-3">
                <p className="text-2xl font-bold">
                  🔥 {streak} dia{streak !== 1 ? 's' : ''} de streak!
                </p>
              </div>
            )}
          </div>

          {/* Daily Puzzles Grid */}
          <div className="grid gap-6 mb-8">
            {puzzles.map((puzzle) => {
              const config = difficultyConfig[puzzle.difficulty_level as keyof typeof difficultyConfig]
              
              return (
                <div
                  key={puzzle.id}
                  className={`bg-gradient-to-r from-${config.color}-600/10 to-${config.color}-500/5 border border-${config.color}-500/30 rounded-xl p-6 transition-all hover:scale-[1.02] ${
                    puzzle.completed ? 'opacity-75' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-5xl">{config.emoji}</div>
                      <div>
                        <h3 className="text-2xl font-bold text-white mb-1">
                          {config.label}
                        </h3>
                        {puzzle.completed ? (
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-green-400 font-medium">✓ Completo</span>
                            <span className="text-gray-400">
                              {formatTime(puzzle.completion_time)}
                            </span>
                            {puzzle.is_clean_run && (
                              <span className="bg-green-600 px-2 py-1 rounded text-xs">
                                999 Dicas
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-gray-400">Completa o desafio de hoje</p>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => router.push(`/puzzles/${puzzle.puzzle_id}`)}
                      className={`px-8 py-4 rounded-lg font-bold text-lg transition-all ${
                        puzzle.completed
                          ? 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                          : `bg-${config.color}-600 hover:bg-${config.color}-700 text-white shadow-lg hover:scale-105`
                      }`}
                    >
                      {puzzle.completed ? 'Jogar Novamente' : 'Jogar →'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Browse More Link */}
          <div className="text-center">
            <a
              href="/play"
              className="inline-block text-blue-400 hover:text-blue-300 font-medium text-lg"
            >
              📚 Ver Todos os Puzzles →
            </a>
          </div>
        </div>
      </div>
    </PublicLayout>
  )
}
