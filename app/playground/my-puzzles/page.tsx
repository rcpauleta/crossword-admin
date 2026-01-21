// app/playground/my-puzzles/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/supabase'
import Link from 'next/link'
import PublicLayout from '@/app/components/PublicLayout'
import { useAuth } from '@/app/contexts/AuthContext'
import { useLanguage } from '@/app/contexts/LanguageContext'

type PlaygroundPuzzle = {
  id: number
  created_at: string
  custom_grid_size: number
  custom_word_count: number
  custom_difficulty: string
  total_words: number
  grid_density: number
  completed?: boolean
  completion_time?: number
  is_clean_run?: boolean
}

export default function MyPlaygroundPuzzles() {
  const [myPuzzles, setMyPuzzles] = useState<PlaygroundPuzzle[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const { selectedLanguage } = useLanguage()

  useEffect(() => {
    if (user) {
      fetchMyPuzzles()
    }
  }, [user, selectedLanguage])

  async function fetchMyPuzzles() {
    try {
      // Get puzzles created by this user
      const { data: puzzles, error } = await supabase
        .from('GeneratedPuzzle')
        .select(`
          id,
          created_at,
          created_by,
          custom_grid_size,
          custom_word_count,
          custom_difficulty,
          total_words,
          grid_density,
          PuzzleConfig:puzzle_config_id (
            config_type
          )
        `)
        .or(user ? `created_by.eq.${user.id},created_by.is.null` : 'created_by.is.null')
        .eq('language_id', selectedLanguage)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      // Filter to playground puzzles only
      const playgroundPuzzles = (puzzles || []).filter(p => {
        const config = Array.isArray(p.PuzzleConfig) ? p.PuzzleConfig[0] : p.PuzzleConfig
        return config?.config_type === 'playground'
      })

      // Check completion status
      if (user) {
        const puzzleIds = playgroundPuzzles.map(p => p.id)
        const { data: sessions } = await supabase
          .from('GameSession')
          .select('puzzle_id, completion_time, is_clean_run, completed_at')
          .eq('user_id', user.id)
          .in('puzzle_id', puzzleIds)

        const puzzlesWithStatus = playgroundPuzzles.map(puzzle => {
          const session = sessions?.find(s => s.puzzle_id === puzzle.id)
          return {
            ...puzzle,
            completed: !!session?.completed_at,
            completion_time: session?.completion_time,
            is_clean_run: session?.is_clean_run
          }
        })

        setMyPuzzles(puzzlesWithStatus)
      } else {
        setMyPuzzles(playgroundPuzzles)
      }
    } catch (error) {
      console.error('Error fetching playground puzzles:', error)
    } finally {
      setLoading(false)
    }
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

  if (!user) {
    return (
      <PublicLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-xl text-white mb-4">Faz login para ver os teus puzzles</p>
            <Link href="/login" className="text-blue-400 hover:text-blue-300">
              Ir para Login →
            </Link>
          </div>
        </div>
      </PublicLayout>
    )
  }

  if (loading) {
    return (
      <PublicLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-xl text-white">A carregar os teus puzzles...</div>
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Os Meus Puzzles</h1>
              <p className="text-gray-400">
                {myPuzzles.length} puzzle{myPuzzles.length !== 1 ? 's' : ''} criado{myPuzzles.length !== 1 ? 's' : ''}
              </p>
            </div>
            <Link
              href="/playground"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-all hover:scale-105"
            >
              + Criar Novo
            </Link>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-gray-800 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-blue-400">{myPuzzles.length}</p>
              <p className="text-sm text-gray-400">Total Criados</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-green-400">
                {myPuzzles.filter(p => p.completed).length}
              </p>
              <p className="text-sm text-gray-400">Completados</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-purple-400">
                {myPuzzles.filter(p => p.is_clean_run).length}
              </p>
              <p className="text-sm text-gray-400">Clean Runs</p>
            </div>
          </div>

          {/* Puzzle List */}
          <div className="grid gap-4">
            {myPuzzles.map((puzzle) => {
              const config = difficultyConfig[puzzle.custom_difficulty as keyof typeof difficultyConfig]

              return (
                <Link
                  key={puzzle.id}
                  href={`/puzzles/${puzzle.id}`}
                  className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-blue-500 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-4xl">{config.emoji}</div>
                      <div>
                        <h3 className="text-xl font-semibold text-white group-hover:text-blue-400 transition-colors">
                          {puzzle.custom_grid_size}×{puzzle.custom_grid_size} - {config.label}
                        </h3>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                          <span>📝 {puzzle.total_words} palavras</span>
                          <span>📊 {puzzle.grid_density.toFixed(0)}% densidade</span>
                          <span>📅 {new Date(puzzle.created_at).toLocaleDateString('pt-PT')}</span>
                        </div>
                        {puzzle.completed && (
                          <div className="flex items-center gap-3 mt-2 text-sm">
                            <span className="text-green-400 font-medium">✓ Completo</span>
                            <span className="text-gray-400">{formatTime(puzzle.completion_time)}</span>
                            {puzzle.is_clean_run && (
                              <span className="bg-green-600 px-2 py-1 rounded text-xs">999 Dicas</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-blue-400 group-hover:translate-x-1 transition-transform text-2xl">
                      →
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>

          {myPuzzles.length === 0 && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🎮</div>
              <p className="text-gray-400 mb-6">Ainda não criaste nenhum puzzle</p>
              <Link
                href="/playground"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition-all hover:scale-105"
              >
                Criar o Meu Primeiro Puzzle
              </Link>
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  )
}
