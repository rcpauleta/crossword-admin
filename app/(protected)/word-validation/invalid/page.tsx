'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/supabase'

type InvalidWord = {
    word_id: number
    issue_type: string | null
    suggested_normalized_fix: string | null
    Word: {
        id: number
        normalized_text: string
        display_text: string
        language_id: string
        Language: {
            ISO: string
            name: string
        }
    }
    themes: string[]
}

export default function InvalidWordsPage() {
    const [words, setWords] = useState<InvalidWord[]>([])
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState<number | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterLanguage, setFilterLanguage] = useState<string>('all')
    const [languages, setLanguages] = useState<string[]>([])

    useEffect(() => {
        fetchInvalidWords()
    }, [])

    async function fetchInvalidWords() {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('WordValidationQueue')
                .select(`
                word_id,
                issue_type,
                suggested_normalized_fix,
                Word!inner(
                    id,
                    normalized_text,
                    display_text,
                    language_id,
                    Language!inner(ISO, name),
                    Word_Theme(
                        Theme(name)
                    )
                )
            `)
                .eq('status_id', 'Invalid')
                .order('word_id')

            if (error) {
                throw error
            }

            if (!data || data.length === 0) {
                setWords([])
                setLanguages([])
                setLoading(false)
                return
            }

            // Process and flatten the data
            const processed = (data as any[]).map(item => {
                const themeNames = item.Word?.Word_Theme?.map((wt: any) => wt?.Theme?.name).filter(Boolean) || []
                return {
                    word_id: item.word_id,
                    issue_type: item.issue_type,
                    suggested_normalized_fix: item.suggested_normalized_fix,
                    Word: {
                        id: item.Word.id,
                        normalized_text: item.Word.normalized_text,
                        display_text: item.Word.display_text,
                        language_id: item.Word.language_id,
                        Language: item.Word.Language
                    },
                    themes: [...new Set(themeNames)] as string[]
                }
            })

            setWords(processed)

            // Get unique languages
            const uniqueLangs = [...new Set(processed.map(w => w.Word.Language.name))]
            setLanguages(uniqueLangs)

        } catch (error) {
            console.error('Error fetching invalid words:', error)
            alert('Error loading invalid words: ' + String(error))
        } finally {
            setLoading(false)
        }
    }

    async function handleMarkFixed(wordId: number) {
        setProcessing(wordId)

        try {
            const response = await fetch('/api/word-validation/review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wordId, action: 'mark_fixed' })
            })

            const result = await response.json()

            if (result.success) {
                // Remove from local state immediately - no refresh needed!
                setWords(prevWords => prevWords.filter(w => w.word_id !== wordId))
            } else {
                alert('Error: ' + result.error)
            }
        } catch (error) {
            console.error('Error marking as fixed:', error)
            alert('Error: ' + String(error))
        } finally {
            setProcessing(null)
        }
    }

    async function handleWontFix(wordId: number) {
        if (!confirm('Mark this word as "Won\'t Fix"? It will remain invalid but be removed from this review list.')) {
            return
        }

        setProcessing(wordId)

        try {
            const response = await fetch('/api/word-validation/review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wordId, action: 'wont_fix' })
            })

            const result = await response.json()

            if (result.success) {
                // Remove from local state immediately
                setWords(prevWords => prevWords.filter(w => w.word_id !== wordId))
            } else {
                alert('Error: ' + result.error)
            }
        } catch (error) {
            console.error('Error marking as won\'t fix:', error)
            alert('Error: ' + String(error))
        } finally {
            setProcessing(null)
        }
    }

    async function handleAcceptSuggestion(wordId: number, suggestion: string) {
        if (!confirm(`Accept suggestion and update normalized text to: ${suggestion}?`)) {
            return
        }

        setProcessing(wordId)

        try {
            const response = await fetch('/api/word-validation/review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wordId,
                    action: 'accept_suggestion',
                    suggestedNormalized: suggestion
                })
            })

            const result = await response.json()

            if (result.success) {
                alert(`Suggestion accepted! Word normalized text updated to: ${result.newNormalized}`)
                fetchInvalidWords()
            } else {
                if (result.error === 'duplicate') {
                    alert(`Cannot apply suggestion:\n\n${result.message}\n\nThis word will remain invalid.`)
                } else {
                    alert('Error: ' + result.error)
                }
            }
        } catch (error) {
            console.error('Error accepting suggestion:', error)
            alert('Error: ' + String(error))
        } finally {
            setProcessing(null)
        }
    }

    const filteredWords = words.filter(word => {
        if (filterLanguage !== 'all' && word.Word.Language.name !== filterLanguage) {
            return false
        }
        if (searchTerm) {
            const search = searchTerm.toLowerCase()
            return word.Word.display_text.toLowerCase().includes(search) ||
                word.Word.normalized_text.toLowerCase().includes(search) ||
                word.themes.some(t => t.toLowerCase().includes(search))
        }
        return true
    })

    if (loading) return <div className="p-8 text-gray-400">Loading invalid words...</div>
    return (
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-white">Invalid Words Review</h1>
                <button
                    onClick={fetchInvalidWords}
                    className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 font-medium"
                >
                    🔄 Refresh
                </button>
            </div>

            {/* Filters */}
            <div className="bg-gray-800 p-4 rounded-lg mb-6 border border-gray-700">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <input
                            type="text"
                            placeholder="🔍 Search by word or theme..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-11 px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <select
                            value={filterLanguage}
                            onChange={(e) => setFilterLanguage(e.target.value)}
                            className="w-full h-11 px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                        >
                            <option value="all">All Languages</option>
                            {languages.map(lang => (
                                <option key={lang} value={lang}>{lang}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="mb-4 text-sm text-gray-400">
                Showing {filteredWords.length} invalid words
            </div>

            {/* Invalid Words List */}
            <div className="space-y-3">
                {filteredWords.length === 0 ? (
                    <div className="p-12 text-center text-gray-400 bg-gray-800 rounded-lg border border-gray-700">
                        {words.length === 0 ? '🎉 No invalid words to review!' : 'No words match your filters.'}
                    </div>
                ) : (
                    filteredWords.map((word) => (
                        <div
                            key={word.word_id}
                            className="bg-gray-800 border border-red-700/50 rounded-lg p-4 hover:border-red-600/70 transition-colors"
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Left: Word Info */}
                                <div>
                                    <div className="flex items-start gap-3 mb-3">
                                        <div className="flex-1">
                                            <div className="text-lg font-semibold text-white mb-3">
                                                Word ID: {word.Word.id}
                                            </div>

                                            {/* Display Text vs Normalized Comparison */}
                                            <div className="bg-gray-900/50 p-3 rounded-lg space-y-2 mb-2">
                                                <div className="grid grid-cols-2 gap-2 text-sm">
                                                    <div className="text-gray-400">Display Text:</div>
                                                    <div className="font-mono text-blue-400">{word.Word.display_text}</div>

                                                    <div className="text-gray-400">Current Normalized:</div>
                                                    <div className="font-mono text-yellow-400">{word.Word.normalized_text}</div>

                                                    {word.suggested_normalized_fix && (
                                                        <>
                                                            <div className="text-gray-400">AI Suggestion:</div>
                                                            <div className="font-mono text-green-400">{word.suggested_normalized_fix}</div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="px-3 py-1 bg-red-900/50 text-red-300 rounded-full text-xs font-medium whitespace-nowrap">
                                            {word.issue_type || 'INVALID'}
                                        </div>
                                    </div>

                                    <div className="flex gap-2 text-xs text-gray-500">
                                        <span>🌍 {word.Word.Language.name}</span>
                                        <span>•</span>
                                        <span>ID: {word.Word.id}</span>
                                    </div>

                                    {word.themes.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {word.themes.map((theme, idx) => (
                                                <span key={idx} className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">
                                                    {theme}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Right: Actions */}
                                <div className="flex flex-col gap-2 justify-center">
                                    {word.suggested_normalized_fix && (
                                        <button
                                            onClick={() => handleAcceptSuggestion(word.word_id, word.suggested_normalized_fix!)}
                                            disabled={processing === word.word_id}
                                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed font-medium transition-colors flex items-center justify-center gap-2"
                                        >
                                            {processing === word.word_id ? (
                                                <>
                                                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                                                    Processing...
                                                </>
                                            ) : (
                                                <>✓ Accept AI Suggestion</>
                                            )}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleMarkFixed(word.word_id)}
                                        disabled={processing === word.word_id}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed font-medium transition-colors flex items-center justify-center gap-2"
                                    >
                                        {processing === word.word_id ? (
                                            <>
                                                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                                                Processing...
                                            </>
                                        ) : (
                                            <>👍 Mark as Valid (Ignore AI)</>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => handleWontFix(word.word_id)}
                                        disabled={processing === word.word_id}
                                        className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:bg-gray-500 disabled:cursor-not-allowed font-medium transition-colors flex items-center justify-center gap-2"
                                    >
                                        {processing === word.word_id ? (
                                            <>
                                                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                                                Processing...
                                            </>
                                        ) : (
                                            <>🚫 Won't Fix (Keep Invalid)</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
