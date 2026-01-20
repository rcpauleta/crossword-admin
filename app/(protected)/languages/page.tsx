'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/supabase'
import Link from 'next/link'

type Language = {
  ISO: string
  name: string
  flag_emoji?: string
  _count?: {
    Word: number
    Clues: {
      total: number
      easy: number
      medium: number
      hard: number
    }
  }
}

export default function LanguagesPage() {
  const [languages, setLanguages] = useState<Language[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [generatingClues, setGeneratingClues] = useState<string | null>(null)

  useEffect(() => {
    fetchLanguages()
  }, [])

  async function fetchLanguages() {
    try {
      const { data, error } = await supabase
        .from('Language')
        .select(`
          ISO,
          name,
          flag_emoji
        `)
        .order('name')

      if (error) throw error

      // Get word counts and clue counts for each language
      const languagesWithCounts = await Promise.all(
        (data || []).map(async (lang) => {
          // Get word count
          const { count: wordCount } = await supabase
            .from('Word')
            .select('*', { count: 'exact', head: true })
            .eq('language_id', lang.ISO)

          // Get word IDs for this language
          const { data: wordIds } = await supabase
            .from('Word')
            .select('id')
            .eq('language_id', lang.ISO)

          const wordIdArray = wordIds?.map(w => w.id) || []

          // Get clue counts by difficulty - HANDLE 1000+ CLUES
          const { count: totalClues } = await supabase
            .from('Clue')
            .select('*', { count: 'exact', head: true })
            .in('word_id', wordIdArray)

          // Get counts per difficulty using separate count queries
          const { count: easyCount } = await supabase
            .from('Clue')
            .select('*', { count: 'exact', head: true })
            .eq('difficulty_level', 'easy')
            .in('word_id', wordIdArray)

          const { count: mediumCount } = await supabase
            .from('Clue')
            .select('*', { count: 'exact', head: true })
            .eq('difficulty_level', 'medium')
            .in('word_id', wordIdArray)

          const { count: hardCount } = await supabase
            .from('Clue')
            .select('*', { count: 'exact', head: true })
            .eq('difficulty_level', 'hard')
            .in('word_id', wordIdArray)

          const clueStats = {
            total: totalClues || 0,
            easy: easyCount || 0,
            medium: mediumCount || 0,
            hard: hardCount || 0
          }
          
          return {
            ...lang,
            _count: {
              Word: wordCount || 0,
              Clues: clueStats
            }
          }
        })
      )

      setLanguages(languagesWithCounts)
    } catch (error) {
      console.error('Error fetching languages:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleImportWords(languageISO: string, languageName: string) {
    setImporting(languageISO)

    let totalImported = 0
    let batchCount = 0

    try {
      while (true) {
        batchCount++
        console.log(`Starting batch ${batchCount}...`)

        const response = await fetch('/api/words/import-from-dictionary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            languageISO,
            limit: 1000,
            minLength: 3,
            maxLength: 15
          })
        })

        const result = await response.json()

        if (!result.success) {
          alert('❌ Import failed: ' + result.error)
          break
        }

        totalImported += result.imported
        const stats = result.stats

        console.log(`Batch ${batchCount}: Imported ${result.imported} words. Total: ${stats.alreadyInDatabase}, Remaining: ${stats.remaining}`)

        if (batchCount % 5 === 0) {
          fetchLanguages()
        }

        if (stats.remaining === 0 || result.imported === 0) {
          alert(
            `✅ Complete! Imported all words for ${languageName}! 🎉\n\n` +
            `📥 Total imported this session: ${totalImported} words\n` +
            `📊 Total in database: ${stats.alreadyInDatabase}\n` +
            `📚 Dictionary size: ${stats.totalUniqueInDictionary} unique words\n` +
            `✓ Progress: ${stats.percentComplete}%\n` +
            `🔢 Batches processed: ${batchCount}`
          )
          break
        }

        await new Promise(resolve => setTimeout(resolve, 500))
      }

      fetchLanguages()
    } catch (error) {
      console.error('Error importing words:', error)
      alert(`❌ Error after ${batchCount} batches: ${String(error)}\n\nImported ${totalImported} words before error.`)
    } finally {
      setImporting(null)
    }
  }

  async function handleGenerateClues(languageISO: string) {
    setGeneratingClues(languageISO)

    let totalGenerated = 0
    let batchCount = 0
    const startTime = Date.now()

    try {
      while (true) {
        batchCount++

        const response = await fetch('/api/clues/generate-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            languageISO,
            batchSize: 100,
            difficulty: 'medium'
          })
        })

        const result = await response.json()
        totalGenerated += result.generated

        if (batchCount % 5 === 0) {
          const elapsed = (Date.now() - startTime) / 1000
          const avgPerBatch = elapsed / batchCount
          const remaining = ((result.stats?.totalWords - result.stats?.totalClues) / 100) * avgPerBatch
          console.log(`Generated ${totalGenerated} clues (${result.stats?.percentComplete}% complete)`)
          console.log(`Est. time remaining: ${Math.round(remaining / 60)} minutes`)
          fetchLanguages()
        }

        if (result.generated === 0) {
          alert(`✅ All done! Generated ${totalGenerated} total clues.\n\n${result.stats?.totalClues} / ${result.stats?.totalWords} words now have clues.`)
          break
        }

        await new Promise(resolve => setTimeout(resolve, 500))
      }

      fetchLanguages()
    } catch (error) {
      alert(`❌ Error after generating ${totalGenerated} clues:\n${String(error)}`)
    } finally {
      setGeneratingClues(null)
    }
  }

  const filteredLanguages = languages.filter(lang => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      lang.name.toLowerCase().includes(search) ||
      lang.ISO.toLowerCase().includes(search)
    )
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center">Loading languages...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">🌍 Languages</h1>
          <Link
            href="/languages/new"
            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-md font-medium transition-colors"
          >
            + Add Language
          </Link>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="🔍 Search languages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Stats */}
        <div className="mb-4 text-sm text-gray-400">
          Showing {filteredLanguages.length} of {languages.length} languages
        </div>

        {/* Languages Grid */}
        <div className="grid gap-4">
          {filteredLanguages.map((language) => {
            const isImporting = importing === language.ISO
            const isGenerating = generatingClues === language.ISO
            const wordCount = language._count?.Word || 0
            const clueStats = language._count?.Clues || { total: 0, easy: 0, medium: 0, hard: 0 }
            const cluePercentage = wordCount > 0 ? Math.round((clueStats.medium / wordCount) * 100) : 0

            return (
              <div
                key={language.ISO}
                className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-start gap-6">
                  {/* Language Info */}
                  <div className="flex items-center gap-4">
                    <div className="text-4xl">
                      {language.flag_emoji || '🏳️'}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-white">
                        {language.name}
                      </h3>
                      <div className="text-sm text-gray-400 mt-1">
                        ISO: {language.ISO}
                      </div>
                    </div>
                  </div>

                  {/* Stats Box */}
                  <div className="flex-1 grid grid-cols-2 gap-4">
                    {/* Words */}
                    <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                      <div className="text-xs text-gray-400 mb-1">📚 Words</div>
                      <div className="text-2xl font-bold text-blue-400">
                        {wordCount.toLocaleString()}
                      </div>
                    </div>

                    {/* Clues */}
                    <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                      <div className="text-xs text-gray-400 mb-1">💡 Clues (Medium)</div>
                      <div className="text-2xl font-bold text-purple-400">
                        {clueStats.medium.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {cluePercentage}% complete
                      </div>
                    </div>

                    {/* Clue Details */}
                    {clueStats.total > 0 && (
                      <div className="col-span-2 bg-gray-900 rounded-lg p-3 border border-gray-700">
                        <div className="text-xs text-gray-400 mb-2">Clues by Difficulty</div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <div className="text-sm font-semibold text-green-400">
                              {clueStats.easy.toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-500">Easy</div>
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-yellow-400">
                              {clueStats.medium.toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-500">Medium</div>
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-red-400">
                              {clueStats.hard.toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-500">Hard</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleImportWords(language.ISO, language.name)}
                      disabled={isImporting}
                      className={`px-6 py-3 rounded-md font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${isImporting
                        ? 'bg-blue-600 text-white cursor-wait'
                        : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                    >
                      {isImporting ? (
                        <>
                          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                          Importing...
                        </>
                      ) : (
                        <>📥 Import Words</>
                      )}
                    </button>

                    <button
                      onClick={() => handleGenerateClues(language.ISO)}
                      disabled={isGenerating}
                      className={`px-6 py-3 rounded-md font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${isGenerating
                        ? 'bg-purple-500 text-white cursor-wait'
                        : 'bg-purple-600 text-white hover:bg-purple-700'
                        }`}
                    >
                      {isGenerating ? (
                        <>
                          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                          Generating...
                        </>
                      ) : (
                        <>✨ Generate Clues</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {filteredLanguages.length === 0 && (
          <div className="text-center text-gray-400 mt-8">
            No languages found matching "{searchTerm}"
          </div>
        )}
      </div>
    </div>
  )
}
