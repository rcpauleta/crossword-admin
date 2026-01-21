'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/supabase'

type Language = {
  ISO: string
  name: string
  flag_emoji: string
  _count: {
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
  const [generatingClues, setGeneratingClues] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)

  useEffect(() => {
    fetchLanguages()
  }, [])

  async function fetchLanguages() {
    try {
      const { data, error } = await supabase
        .from('Language')
        .select('*')

      if (error) throw error

      const languagesWithCounts = await Promise.all(
        (data || []).map(async (lang) => {
          // Get word count
          const { count: wordCount } = await supabase
            .from('Word')
            .select('*', { count: 'exact', head: true })
            .eq('language_id', lang.ISO)

          // Get clue counts by difficulty using language_id filter
          const { count: totalClues } = await supabase
            .from('Clue')
            .select('*', { count: 'exact', head: true })
            .eq('language_id', lang.ISO)

          const { count: easyCount } = await supabase
            .from('Clue')
            .select('*', { count: 'exact', head: true })
            .eq('difficulty_level', 'easy')
            .eq('language_id', lang.ISO)

          const { count: mediumCount } = await supabase
            .from('Clue')
            .select('*', { count: 'exact', head: true })
            .eq('difficulty_level', 'medium')
            .eq('language_id', lang.ISO)

          const { count: hardCount } = await supabase
            .from('Clue')
            .select('*', { count: 'exact', head: true })
            .eq('difficulty_level', 'hard')
            .eq('language_id', lang.ISO)

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

  async function generateClues(lang: Language, difficulty: string) {
    setGeneratingClues(`${lang.ISO}-${difficulty}`)

    const totalWords = lang._count.Word
    const existingClues = lang._count.Clues[difficulty as 'easy' | 'medium' | 'hard']
    const remaining = totalWords - existingClues

    if (remaining <= 0) {
      alert('All words already have clues for this difficulty!')
      setGeneratingClues(null)
      return
    }

    setProgress({ current: 0, total: remaining })

    try {
      let currentProgress = 0
      const batchSize = 100

      // Generate in batches until complete
      while (currentProgress < remaining) {
        const response = await fetch('/api/clues/generate-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            languageId: lang.ISO,
            difficulty,
            batchSize
          })
        })

        const result = await response.json()

        if (!result.success) {
          if (result.allComplete) {
            console.log('All clues generated!')
            break
          }
          console.error('Batch failed:', result.error)
          // Continue anyway to try next batch
        } else {
          currentProgress += result.cluesGenerated || 0
          setProgress({ current: Math.min(currentProgress, remaining), total: remaining })
        }

        // Small delay between batches to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      alert(`Successfully generated ${currentProgress} clues for ${lang.name} (${difficulty})!`)
      fetchLanguages() // Refresh counts

    } catch (error: any) {
      console.error('Clue generation error:', error)
      alert('Failed to generate clues: ' + error.message)
    } finally {
      setGeneratingClues(null)
      setProgress(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-6xl mx-auto">
          <p>Loading languages...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Languages</h1>

        <div className="space-y-6">
          {languages.map(lang => {
            const wordCount = lang._count.Word
            const totalClues = lang._count.Clues.total
            const completionPercent = wordCount > 0
              ? Math.round((totalClues / (wordCount * 3)) * 100)
              : 0

            return (
              <div key={lang.ISO} className="bg-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">{lang.flag_emoji}</span>
                    <div>
                      <h2 className="text-2xl font-bold">{lang.name}</h2>
                      <p className="text-gray-400">{lang.ISO}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold">{wordCount.toLocaleString()}</p>
                    <p className="text-gray-400">words</p>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Overall Progress</span>
                    <span className="font-bold">{completionPercent}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-3">
                    <div
                      className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(completionPercent, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="bg-gray-700 rounded p-3">
                    <p className="text-green-400 font-bold text-xl">{lang._count.Clues.easy.toLocaleString()}</p>
                    <p className="text-gray-400 text-sm">Easy clues</p>
                  </div>
                  <div className="bg-gray-700 rounded p-3">
                    <p className="text-yellow-400 font-bold text-xl">{lang._count.Clues.medium.toLocaleString()}</p>
                    <p className="text-gray-400 text-sm">Medium clues</p>
                  </div>
                  <div className="bg-gray-700 rounded p-3">
                    <p className="text-red-400 font-bold text-xl">{lang._count.Clues.hard.toLocaleString()}</p>
                    <p className="text-gray-400 text-sm">Hard clues</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  {['easy', 'medium', 'hard'].map(difficulty => {
                    const isGenerating = generatingClues === `${lang.ISO}-${difficulty}`
                    const clueCount = lang._count.Clues[difficulty as 'easy' | 'medium' | 'hard']
                    const remaining = wordCount - clueCount

                    return (
                      <button
                        key={difficulty}
                        onClick={() => generateClues(lang, difficulty)}
                        disabled={!!generatingClues || remaining === 0}
                        className={`flex-1 px-4 py-2 rounded font-medium transition-colors ${remaining === 0
                            ? 'bg-green-600 text-white cursor-not-allowed'
                            : isGenerating
                              ? 'bg-blue-600 text-white cursor-wait'
                              : 'bg-blue-500 hover:bg-blue-600 text-white'
                          }`}
                      >
                        {isGenerating ? (
                          <div className="flex flex-col items-center gap-1">
                            <span>Generating {difficulty}...</span>
                            {progress && (
                              <span className="text-xs">
                                {progress.current.toLocaleString()} / {progress.total.toLocaleString()} ({Math.round((progress.current / progress.total) * 100)}%)
                              </span>
                            )}
                          </div>
                        ) : remaining === 0 ? (
                          `✓ ${difficulty} complete`
                        ) : (
                          `Generate ${difficulty} (${remaining.toLocaleString()} left)`
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
