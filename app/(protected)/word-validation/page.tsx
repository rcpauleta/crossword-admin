'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type ValidationStats = {
    theme_id: number
    language_id: string
    theme_name: string
    language_name: string
    total_words: number
    pending: number
    inprogress: number
    valid: number
    invalid: number
    fixed: number
    last_checked: string | null
}

export default function WordValidationPage() {
    const [stats, setStats] = useState<ValidationStats[]>([])
    const [loading, setLoading] = useState(true)
    const [populating, setPopulating] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [isValidatingAll, setIsValidatingAll] = useState(false)

    useEffect(() => {
        fetchStats()
        const interval = setInterval(fetchStats, 5000)
        return () => clearInterval(interval)
    }, [])

    async function fetchStats() {
        try {
            // Get all validation queue items with word details
            const { data, error } = await supabase
                .from('WordValidationQueue')
                .select(`
                    word_id,
                    status_id,
                    last_checked_at,
                    Word!inner(
                        id,
                        language_id,
                        Language!inner(ISO, name),
                        Word_Theme!inner(
                            theme_id,
                            Theme!inner(id, name)
                        )
                    )
                `)

            if (error) throw error

            // Flatten and group by theme + language
            const grouped: Record<string, ValidationStats> = {}

            for (const item of (data as any[])) {
                // Handle multiple themes per word
                for (const wt of item.Word.Word_Theme) {
                    const key = `${wt.theme_id}_${item.Word.language_id}`

                    if (!grouped[key]) {
                        grouped[key] = {
                            theme_id: wt.theme_id,
                            language_id: item.Word.language_id,
                            theme_name: wt.Theme.name,
                            language_name: item.Word.Language.name,
                            total_words: 0,
                            pending: 0,
                            inprogress: 0,
                            valid: 0,
                            invalid: 0,
                            fixed: 0,
                            last_checked: null
                        }
                    }

                    grouped[key].total_words++

                    const status = item.status_id.toLowerCase()
                    if (status === 'pending') grouped[key].pending++
                    else if (status === 'inprogress') grouped[key].inprogress++
                    else if (status === 'valid') grouped[key].valid++
                    else if (status === 'invalid') grouped[key].invalid++
                    else if (status === 'fixed') grouped[key].fixed++

                    if (item.last_checked_at) {
                        if (!grouped[key].last_checked || item.last_checked_at > grouped[key].last_checked) {
                            grouped[key].last_checked = item.last_checked_at
                        }
                    }
                }
            }

            setStats(Object.values(grouped))
        } catch (error) {
            console.error('Error fetching validation stats:', error)
        } finally {
            setLoading(false)
        }
    }

    async function handleValidateQueue(themeId: number, languageId: string, themeName: string, langName: string) {
        const key = `${themeId}_${languageId}`
        setPopulating(key) // Reusing this state for the loading indicator

        try {
            const response = await fetch('/api/word-validation/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ themeId, languageId })
            })

            const result = await response.json()

            if (result.success) {
                alert(`Validation completed for ${themeName} (${langName})!\n\n✓ ${result.validated} words validated\n✓ ${result.valid} valid\n✗ ${result.invalid} invalid`)
                fetchStats()
            } else {
                alert('Validation failed: ' + result.error)
            }
        } catch (error) {
            console.error('Error validating queue:', error)
            alert('Error: ' + String(error))
        } finally {
            setPopulating(null)
        }
    }

    async function handleStartAllValidations() {
        const pendingCount = stats.reduce((sum, stat) => sum + stat.pending, 0)

        if (pendingCount === 0) {
            alert('No pending validations to process')
            return
        }

        const comboCount = stats.filter(s => s.pending > 0).length

        if (!confirm(`Start validation for ${comboCount} theme/language combinations?\n\nThis will validate ${pendingCount} words and may take a while.`)) {
            return
        }

        setIsValidatingAll(true)

        try {
            const response = await fetch('/api/word-validation/auto', {
                method: 'POST',
            })

            const result = await response.json()

            if (result.success) {
                alert(
                    `Batch validation completed!\n\n` +
                    `✓ ${result.validated} words validated\n` +
                    `✓ ${result.valid} valid\n` +
                    `✗ ${result.invalid} invalid\n` +
                    (result.failures > 0 ? `⚠ ${result.failures} failures` : '')
                )
                fetchStats()
            } else {
                alert('Batch validation failed: ' + result.error)
            }
        } catch (error) {
            console.error('Error starting batch validation:', error)
            alert('Error: ' + String(error))
        } finally {
            setIsValidatingAll(false)
        }
    }

    const filteredStats = stats.filter(stat => {
        if (!searchTerm) return true
        const search = searchTerm.toLowerCase()
        return stat.theme_name.toLowerCase().includes(search) ||
            stat.language_name.toLowerCase().includes(search)
    })

    function getProgressPercentage(stat: ValidationStats): number {
        if (stat.total_words === 0) return 0
        const completed = stat.valid + stat.invalid + stat.fixed
        return (completed / stat.total_words) * 100
    }

    if (loading) return <div className="p-8 text-gray-400">Loading validation queue...</div>
    return (
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-white">Word Validation Queue</h1>
                <div className="flex gap-3">
                    <a
                        href="/word-validation/invalid"
                        className="px-6 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium transition-colors flex items-center gap-2"
                    >
                        ⚠️ Review Invalid Words ({stats.reduce((sum, s) => sum + s.invalid, 0)})
                    </a>
                    <button
                        onClick={handleStartAllValidations}
                        disabled={isValidatingAll || stats.reduce((sum, s) => sum + s.pending, 0) === 0}
                        className={`px-6 py-3 rounded-md font-medium transition-colors ${isValidatingAll || stats.reduce((sum, s) => sum + s.pending, 0) === 0
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-green-600 text-white hover:bg-green-700'
                            }`}
                    >
                        {isValidatingAll ? (
                            <>
                                <svg className="animate-spin inline-block w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Validating All...
                            </>
                        ) : (
                            <>🚀 Start All Validations ({stats.reduce((sum, s) => sum + s.pending, 0)})</>
                        )}
                    </button>
                    <button
                        onClick={fetchStats}
                        className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 font-medium"
                    >
                        🔄 Refresh
                    </button>
                </div>
            </div>

            {/* Search Filter */}
            <div className="bg-gray-800 p-4 rounded-lg mb-6 border border-gray-700">
                <input
                    type="text"
                    placeholder="🔍 Search by theme or language..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full h-11 px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            <div className="mb-4 text-sm text-gray-400">
                Showing {filteredStats.length} theme/language combinations
            </div>

            {/* Stats Grid */}
            <div className="space-y-4">
                {filteredStats.length === 0 ? (
                    <div className="p-12 text-center text-gray-400 bg-gray-800 rounded-lg border border-gray-700">
                        No validation queue data yet. Populate the queue from harvested words.
                    </div>
                ) : (
                    filteredStats.map((stat) => {
                        const progress = getProgressPercentage(stat)
                        const key = `${stat.theme_id}_${stat.language_id}`
                        const isPopulating = populating === key

                        return (
                            <div
                                key={key}
                                className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
                            >
                                {/* Header */}
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="text-lg font-semibold text-white">
                                            {stat.theme_name}
                                        </h3>
                                        <div className="text-sm text-gray-400 mt-1">
                                            🌍 {stat.language_name}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-bold text-white">
                                            {stat.total_words}
                                        </div>
                                        <div className="text-xs text-gray-400">Total Words</div>
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="mb-3">
                                    <div className="flex justify-between text-sm text-gray-400 mb-1">
                                        <span>Validation Progress</span>
                                        <span className="font-medium text-white">
                                            {stat.valid + stat.invalid + stat.fixed} / {stat.total_words}
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-700 rounded-full h-2">
                                        <div
                                            className="h-2 rounded-full transition-all duration-300 bg-blue-500"
                                            style={{ width: `${progress}%` }}
                                        ></div>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {progress.toFixed(0)}% complete
                                    </div>
                                </div>

                                {/* Stats Grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm mb-3">
                                    <div className="bg-yellow-900/30 p-2 rounded border border-yellow-700/50">
                                        <div className="text-yellow-400">Pending</div>
                                        <div className="text-white font-semibold">{stat.pending}</div>
                                    </div>
                                    <div className="bg-blue-900/30 p-2 rounded border border-blue-700/50">
                                        <div className="text-blue-400">In Progress</div>
                                        <div className="text-white font-semibold">{stat.inprogress}</div>
                                    </div>
                                    <div className="bg-green-900/30 p-2 rounded border border-green-700/50">
                                        <div className="text-green-400">Valid</div>
                                        <div className="text-white font-semibold">{stat.valid}</div>
                                    </div>
                                    <div className="bg-red-900/30 p-2 rounded border border-red-700/50">
                                        <div className="text-red-400">Invalid</div>
                                        <div className="text-white font-semibold">{stat.invalid}</div>
                                    </div>
                                    <div className="bg-purple-900/30 p-2 rounded border border-purple-700/50">
                                        <div className="text-purple-400">Fixed</div>
                                        <div className="text-white font-semibold">{stat.fixed}</div>
                                    </div>
                                </div>

                                {/* Last Checked */}
                                {stat.last_checked && (
                                    <div className="text-xs text-gray-500 mb-3">
                                        Last checked: {new Date(stat.last_checked).toLocaleString()}
                                    </div>
                                )}

                                {/* Action Button */}
                                <button
                                    onClick={() => handleValidateQueue(stat.theme_id, stat.language_id, stat.theme_name, stat.language_name)}
                                    disabled={populating === key || stat.pending === 0}
                                    className={`w-full px-4 py-2 rounded-md font-medium transition-colors flex items-center justify-center gap-2 ${stat.pending === 0
                                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                        : populating === key
                                            ? 'bg-blue-600 text-white cursor-wait'
                                            : 'bg-green-600 text-white hover:bg-green-700'
                                        }`}
                                >
                                    {populating === key ? (
                                        <>
                                            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                                            Validating...
                                        </>
                                    ) : (
                                        <>▶️ Validate ({stat.pending} pending)</>
                                    )}
                                </button>

                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
