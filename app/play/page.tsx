'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/supabase'
import Link from 'next/link'
import PublicLayout from '../components/PublicLayout'
import { useLanguage } from '../contexts/LanguageContext'
import GlobalLeaderboard from '../components/GlobalLeaderboard'

type Puzzle = {
  id: number
  created_at: string
  PuzzleConfig: {
    name: string
    grid_size: number
    language_id: string
  }
}

export default function PublicPuzzleListPage() {
  const [puzzles, setPuzzles] = useState<Puzzle[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | '15' | '20'>('all')
  const { selectedLanguage } = useLanguage()

  useEffect(() => {
    fetchPuzzles()
  }, [selectedLanguage])

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
            language_id
          )
        `)
        .eq('PuzzleConfig.language_id', selectedLanguage)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      // Transform the data to match our Puzzle type (Supabase returns PuzzleConfig as array)
      const transformedData = (data || []).map(item => ({
        ...item,
        PuzzleConfig: Array.isArray(item.PuzzleConfig) ? item.PuzzleConfig[0] : item.PuzzleConfig
      }))

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
          <h1 className="text-4xl font-bold text-white mb-2">Escolha um Puzzle</h1>
          <p className="text-gray-400 mb-8">
            {filteredPuzzles.length} puzzles disponíveis
          </p>

          {/* Global Leaderboard */}
          <div className="mb-12">
            <GlobalLeaderboard />
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
              <p className="text-gray-400">Nenhum puzzle encontrado para este idioma</p>
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  )
}
