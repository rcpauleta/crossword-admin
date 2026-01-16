'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AdminLayout from '../components/AdminLayout'
import { useRouter } from 'next/navigation'

type GeneratedPuzzle = {
  id: number
  puzzle_config_id: number
  grid_JSON: string
  words_JSON: string
  grid_density: number
  theme_id: number
  language_id: string
  total_words: number
  created_at: string
  Theme: { name: string }
  Language: { name: string }
  PuzzleConfig: { 
    name: string
    grid_size: number
    difficulty_id: string
    Difficulty: { name: string }
  }
}

export default function GeneratedPuzzlesPage() {
  const router = useRouter()
  const [puzzles, setPuzzles] = useState<GeneratedPuzzle[]>([])
  const [themes, setThemes] = useState<any[]>([])
  const [languages, setLanguages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [filterTheme, setFilterTheme] = useState<string>('all')
  const [filterLanguage, setFilterLanguage] = useState<string>('all')

  useEffect(() => {
    fetchDropdownData()
    fetchPuzzles()
  }, [])

  async function fetchDropdownData() {
    const [themesRes, languagesRes] = await Promise.all([
      supabase.from('Theme').select('id, name').order('name'),
      supabase.from('Language').select('ISO, name').order('name')
    ])
    
    if (themesRes.data) setThemes(themesRes.data)
    if (languagesRes.data) setLanguages(languagesRes.data)
  }

  async function fetchPuzzles() {
    const { data, error } = await supabase
      .from('GeneratedPuzzle')
      .select(`
        *,
        Theme!inner(name),
        Language!inner(name),
        PuzzleConfig!inner(
          name,
          grid_size,
          difficulty_id,
          Difficulty!inner(name)
        )
      `)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching puzzles:', error)
    } else {
      setPuzzles(data || [])
    }
    setLoading(false)
  }

  const filteredPuzzles = puzzles.filter(puzzle => {
    if (searchTerm && !puzzle.PuzzleConfig.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !puzzle.Theme.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false
    }
    if (filterTheme !== 'all' && puzzle.theme_id.toString() !== filterTheme) return false
    if (filterLanguage !== 'all' && puzzle.language_id !== filterLanguage) return false
    return true
  })

  function handlePlayPuzzle(puzzle: GeneratedPuzzle) {
    router.push(`/puzzles/${puzzle.id}/play`)
  }

  if (loading) return <AdminLayout title="Generated Puzzles"><div className="text-gray-400">Loading puzzles...</div></AdminLayout>

  return (
    <AdminLayout title="Generated Puzzles">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-white">Generated Puzzles</h1>
          <button
            onClick={fetchPuzzles}
            className="bg-gray-700 text-white px-6 py-2 rounded-md hover:bg-gray-600 font-medium"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="bg-gray-800 p-4 rounded-lg mb-6 border border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <input
                type="text"
                placeholder="🔍 Search by config or theme..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-11 px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <select 
                value={filterTheme} 
                onChange={(e) => setFilterTheme(e.target.value)} 
                className="w-full h-11 px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
              >
                <option value="all">All Themes</option>
                {themes.map(theme => (
                  <option key={theme.id} value={theme.id}>{theme.name}</option>
                ))}
              </select>
            </div>
            <div>
              <select 
                value={filterLanguage} 
                onChange={(e) => setFilterLanguage(e.target.value)} 
                className="w-full h-11 px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
              >
                <option value="all">All Languages</option>
                {languages.map(lang => (
                  <option key={lang.ISO} value={lang.ISO}>{lang.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mb-4 text-sm text-gray-400">
          Showing {filteredPuzzles.length} of {puzzles.length} puzzles
        </div>

        {/* Puzzles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPuzzles.length === 0 ? (
            <div className="col-span-full p-12 text-center text-gray-400 bg-gray-800 rounded-lg border border-gray-700">
              {puzzles.length === 0 ? 'No puzzles generated yet. Create puzzle configs and generate puzzles.' : 'No puzzles match your filters.'}
            </div>
          ) : (
            filteredPuzzles.map((puzzle) => (
              <div
                key={puzzle.id}
                className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden hover:border-blue-500 transition-colors"
              >
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4">
                  <h3 className="text-lg font-bold text-white mb-1">
                    {puzzle.PuzzleConfig.name}
                  </h3>
                  <div className="text-sm text-blue-100">
                    Puzzle #{puzzle.id}
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400">🎨</span>
                    <span className="text-white">{puzzle.Theme.name}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400">🌍</span>
                    <span className="text-white">{puzzle.Language.name}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400">⚡</span>
                    <span className="text-white">{puzzle.PuzzleConfig.Difficulty.name}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-700">
                    <div>
                      <div className="text-xs text-gray-400">Grid Size</div>
                      <div className="text-lg font-semibold text-white">
                        {puzzle.PuzzleConfig.grid_size}×{puzzle.PuzzleConfig.grid_size}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Words</div>
                      <div className="text-lg font-semibold text-white">
                        {puzzle.total_words}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-400 mb-1">Grid Density</div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${Math.min(puzzle.grid_density, 100)}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {puzzle.grid_density.toFixed(1)}%
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 pt-2 border-t border-gray-700">
                    Created: {new Date(puzzle.created_at).toLocaleDateString()}
                  </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-750 border-t border-gray-700">
                  <button
                    onClick={() => handlePlayPuzzle(puzzle)}
                    className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 font-medium transition-colors"
                  >
                    🎮 Play Puzzle
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
