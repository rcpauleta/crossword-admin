'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/supabase'
import Link from 'next/link'
import PublicLayout from '../components/PublicLayout'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'

type Puzzle = {
  id: number
  created_at: string
  PuzzleConfig: {
    name: string
    grid_size: number
    language_id: string
  }
}

type Stats = {
  totalSolved: number
  activeToday: number
  yourBestTime: string | null
}

export default function PublicPuzzleListPage() {
  const [puzzles, setPuzzles] = useState<Puzzle[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | '15' | '20'>('all')
  const [stats, setStats] = useState<Stats>({
    totalSolved: 0,
    activeToday: 0,
    yourBestTime: null
  })
  const { selectedLanguage } = useLanguage()
  const { user } = useAuth()

  useEffect(() => {
    fetchPuzzles()
    fetchStats()
  }, [selectedLanguage])

  async function fetchStats() {
    try {
      // Total puzzles solved (completed)
      const { count: totalSolved } = await supabase
        .from('GameSession')
        .select('*', { count: 'exact', head: true })
        .not('completed_at', 'is', null)

      // Active players today
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const { data: activePlayers } = await supabase
        .from('GameSession')
        .select('user_id')
        .gte('updated_at', today.toISOString())

      const uniquePlayers = new Set(activePlayers?.map(p => p.user_id) || [])

      // Your best time (if logged in)
      let yourBestTime = null
      if (user) {
        const { data: userSessions } = await supabase
          .from('GameSession')
          .select('completion_time')
          .eq('user_id', user.id)
          .not('completed_at', 'is', null)
          .order('completion_time', { ascending: true })
          .limit(1)

        if (userSessions && userSessions.length > 0) {
          const seconds = userSessions[0].completion_time
          const mins = Math.floor(seconds / 60)
          const secs = seconds % 60
          yourBestTime = `${mins}:${secs.toString().padStart(2, '0')}`
        }
      }

      setStats({
        totalSolved: totalSolved || 0,
        activeToday: uniquePlayers.size,
        yourBestTime
      })

    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  async function fetchPuzzles() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('GeneratedPuzzle')
        .select(`
        id, 
        created_at,
        puzzle_config_id,
        PuzzleConfig:puzzle_config_id (
          name, 
          grid_size, 
          language_id,
          config_type
        )
      `)
        .eq('PuzzleConfig.language_id', selectedLanguage)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      // Transform the data and filter out playground puzzles
      const transformedData = (data || [])
        .map(item => ({
          ...item,
          PuzzleConfig: Array.isArray(item.PuzzleConfig) ? item.PuzzleConfig[0] : item.PuzzleConfig
        }))
        .filter(item => item.PuzzleConfig?.config_type !== 'playground') // Exclude playground

      setPuzzles(transformedData)
    } catch (error) {
      console.error('Error fetching puzzles:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredPuzzles = puzzles.filter(p => {
    if (filter === 'all') return true
    return p.PuzzleConfig.grid_size.toString() === filter
  })

  if (loading) {
    return (
      <PublicLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-xl text-white">A carregar puzzles...</div>
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Stats Summary Bar */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-gray-800 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-blue-400">{stats.totalSolved}</p>
              <p className="text-sm text-gray-400">Puzzles Resolvidos</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-green-400">{stats.activeToday}</p>
              <p className="text-sm text-gray-400">Jogadores Ativos Hoje</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-purple-400">{stats.yourBestTime || '--'}</p>
              <p className="text-sm text-gray-400">Teu Melhor Tempo</p>
            </div>
          </div>

          {/* Header with Leaderboard Link */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Escolha um Puzzle</h1>
              <p className="text-gray-400">
                {filteredPuzzles.length} puzzles disponíveis
              </p>
            </div>
            <Link
              href="/leaderboard"
              className="text-blue-400 hover:text-blue-300 font-medium flex items-center gap-2 transition-colors"
            >
              🏆 Ver Leaderboard →
            </Link>
          </div>

          {/* Filter */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilter('15')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === '15'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
            >
              15×15
            </button>
            <button
              onClick={() => setFilter('20')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === '20'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
            >
              20×20
            </button>
          </div>

          {/* Puzzle Grid */}
          <div className="grid gap-4">
            {filteredPuzzles.map((puzzle) => (
              <Link
                key={puzzle.id}
                href={`/puzzles/${puzzle.id}`}
                className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-blue-500 hover:bg-gray-750 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-white group-hover:text-blue-400 transition-colors">
                      {puzzle.PuzzleConfig.name}
                    </h3>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                      <span>📏 {puzzle.PuzzleConfig.grid_size}×{puzzle.PuzzleConfig.grid_size}</span>
                      <span>📅 {new Date(puzzle.created_at).toLocaleDateString('pt-PT')}</span>
                    </div>
                  </div>
                  <div className="text-blue-400 group-hover:translate-x-1 transition-transform">
                    →
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {filteredPuzzles.length === 0 && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🤔</div>
              <p className="text-gray-400">Nenhum puzzle encontrado</p>
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  )
}
