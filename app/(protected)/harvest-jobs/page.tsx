'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/supabase'

type HarvestJob = {
    id: number
    theme_id: number
    language_id: string
    difficulty_id: string
    status_id: string
    current_word_count: number | null
    consecutive_duplicates: number | null
    last_run_at: string | null
    created_at: string
    Theme: {
        id: number
        name: string
        target_word_count: number | null
    }
    Language: {
        ISO: string
        name: string
    }
    Difficulty: {
        id: string
        name: string
    }
}

export default function HarvestJobsPage() {
    const [jobs, setJobs] = useState<HarvestJob[]>([])
    const [loading, setLoading] = useState(true)
    const [harvestingJobId, setHarvestingJobId] = useState<number | null>(null)
    const [autoRefresh, setAutoRefresh] = useState(true)
    const [isStartingAll, setIsStartingAll] = useState(false)
    const [isPopulatingAll, setIsPopulatingAll] = useState(false)

    // Filter states
    const [searchTerm, setSearchTerm] = useState('')
    const [filterStatus, setFilterStatus] = useState<string>('all')
    const [statuses, setStatuses] = useState<string[]>([])

    useEffect(() => {
        fetchStatuses()
        fetchJobs()

        // Auto-refresh every 3 seconds if there are running jobs
        const interval = setInterval(() => {
            if (autoRefresh) {
                fetchJobs()
            }
        }, 3000)

        return () => clearInterval(interval)
    }, [autoRefresh])

    async function fetchStatuses() {
        const { data } = await supabase
            .from('HarvestStatus')
            .select('name')
            .order('name')

        if (data) {
            setStatuses(data.map(s => s.name))
        }
    }

    async function fetchJobs() {
        try {
            const { data, error } = await supabase
                .from('HarvestJob')
                .select(`
                *,
                Theme!inner(id, name, target_word_count),
                Language!inner(ISO, name),
                Difficulty!inner(id, name)
            `)
                .order('created_at', { ascending: false })

            if (error) throw error
            setJobs((data as HarvestJob[]) || [])
        } catch (error) {
            console.error('Error fetching harvest jobs:', error)
        } finally {
            setLoading(false)
        }
    }

    function getProgressPercentage(job: HarvestJob): number {
        if (!job.Theme.target_word_count || job.Theme.target_word_count === 0) return 0
        const current = job.current_word_count || 0
        return Math.min(100, (current / job.Theme.target_word_count) * 100)
    }

    const filteredJobs = jobs.filter(job => {
        if (searchTerm) {
            const search = searchTerm.toLowerCase()
            if (!job.Theme.name.toLowerCase().includes(search) &&
                !job.Language.name.toLowerCase().includes(search) &&
                !job.Difficulty.name.toLowerCase().includes(search)) {
                return false
            }
        }
        if (filterStatus !== 'all' && job.status_id !== filterStatus) {
            return false
        }
        return true
    })

    async function handleStartHarvest(job: HarvestJob) {
        if (!confirm(`Start harvest for:\n${job.Theme.name} (${job.Language.name} - ${job.Difficulty.name})?`)) {
            return
        }

        setHarvestingJobId(job.id)
        setAutoRefresh(true)

        try {
            const response = await fetch('/api/harvest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobId: job.id })
            })

            const result = await response.json()

            if (result.success) {
                // Automatically populate validation queue for new words
                try {
                    await fetch('/api/word-validation/populate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            themeId: job.theme_id,
                            languageId: job.language_id
                        })
                    })
                } catch (validationError) {
                    console.error('Error auto-populating validation queue:', validationError)
                    // Don't fail the harvest if validation population fails
                }

                alert(
                    `Harvest completed!\n\n` +
                    `New words: ${result.stats.newWords}\n` +
                    `Duplicates: ${result.stats.duplicates}\n` +
                    `Duplicate ratio: ${result.stats.duplicateRatio}\n` +
                    `Total: ${result.stats.totalWords}/${result.stats.targetWords}\n` +
                    (result.stats.stopReason ? `Stopped: ${result.stats.stopReason}` : '') +
                    `\n\n✓ Words added to validation queue`
                )
                fetchJobs()
            } else {
                alert(`Harvest failed:\n${result.error}`)
                fetchJobs()
            }
        } catch (error: any) {
            alert(`Error starting harvest: ${error.message}`)
        } finally {
            setHarvestingJobId(null)
        }
    }

    async function handleStartAllPending() {
        const pendingJobs = jobs.filter(j => j.status_id === 'Pending')

        if (pendingJobs.length === 0) {
            alert('No pending harvest jobs to start')
            return
        }

        if (!confirm(`Start ALL ${pendingJobs.length} pending harvest jobs?\n\nThis will process them sequentially and may take a while.`)) {
            return
        }

        setIsStartingAll(true)

        try {
            const response = await fetch('/api/harvest/auto', {
                method: 'POST',
            })

            const result = await response.json()

            if (result.success) {
                alert(`Batch harvest completed!\n\n✓ ${result.completedCount} completed\n⏸ ${result.pausedCount} paused\n✗ ${result.failedCount} failed`)
                fetchJobs()
            } else {
                alert('Batch harvest failed: ' + (result.error || 'Unknown error'))
            }
        } catch (error) {
            console.error('Error starting batch harvest:', error)
            alert('Error starting batch harvest: ' + String(error))
        } finally {
            setIsStartingAll(false)
        }
    }

    async function handlePopulateAllValidation() {
        const completedJobs = jobs.filter(j => j.status_id === 'Completed')

        if (completedJobs.length === 0) {
            alert('No completed harvest jobs to populate')
            return
        }

        // Get unique theme/language combinations
        const uniqueCombos = new Map<string, { themeId: number, languageId: string, themeName: string, langName: string }>()
        for (const job of completedJobs) {
            const key = `${job.theme_id}_${job.language_id}`
            if (!uniqueCombos.has(key)) {
                uniqueCombos.set(key, {
                    themeId: job.theme_id,
                    languageId: job.language_id,
                    themeName: job.Theme.name,
                    langName: job.Language.name
                })
            }
        }

        if (!confirm(`Populate validation queue for ${uniqueCombos.size} theme/language combinations?`)) {
            return
        }

        setIsPopulatingAll(true)
        let totalQueued = 0
        let totalSkipped = 0
        let errors = 0

        try {
            for (const combo of uniqueCombos.values()) {
                try {
                    const response = await fetch('/api/word-validation/populate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            themeId: combo.themeId,
                            languageId: combo.languageId
                        })
                    })

                    const result = await response.json()
                    if (result.success) {
                        totalQueued += result.queued
                        totalSkipped += result.skipped
                    } else {
                        errors++
                    }
                } catch (error) {
                    console.error(`Error populating ${combo.themeName} - ${combo.langName}:`, error)
                    errors++
                }
            }

            alert(`Validation queue population complete!\n\n✓ ${totalQueued} words queued\n↷ ${totalSkipped} already queued\n${errors > 0 ? `✗ ${errors} errors` : ''}`)
        } catch (error) {
            console.error('Error during batch populate:', error)
            alert('Error: ' + String(error))
        } finally {
            setIsPopulatingAll(false)
        }
    }

    function getStatusColor(status: string) {
        switch (status.toLowerCase()) {
            case 'pending': return 'bg-yellow-600 text-yellow-200'
            case 'running': return 'bg-blue-600 text-blue-200'
            case 'completed': return 'bg-green-600 text-green-200'
            case 'failed': return 'bg-red-600 text-red-200'
            default: return 'bg-gray-600 text-gray-200'
        }
    }

    if (loading) return <div className="p-8 text-gray-400">Loading harvest jobs...</div>

    return (
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-white">Harvest Jobs</h1>
                <div className="flex gap-3">
                    <button
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${autoRefresh
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                    >
                        {autoRefresh ? '🔄 Auto-Refresh ON' : '🔄 Auto-Refresh OFF'}
                    </button>
                    <button
                        onClick={fetchJobs}
                        className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 font-medium"
                    >
                        🔄 Refresh Now
                    </button>
                </div>
            </div>

            {/* Start All & Populate All Buttons */}
            <div className="mb-6 flex gap-3">
                <button
                    onClick={handleStartAllPending}
                    disabled={isStartingAll || jobs.filter(j => j.status_id === 'Pending').length === 0}
                    className={`flex-1 px-6 py-3 rounded-md font-medium transition-colors ${isStartingAll || jobs.filter(j => j.status_id === 'Pending').length === 0
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                >
                    {isStartingAll ? (
                        <>
                            <svg className="animate-spin inline-block w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Processing All Jobs...
                        </>
                    ) : (
                        <>🚀 Start All Pending Harvests ({jobs.filter(j => j.status_id === 'Pending').length})</>
                    )}
                </button>

                <button
                    onClick={handlePopulateAllValidation}
                    disabled={isPopulatingAll || jobs.filter(j => j.status_id === 'Completed').length === 0}
                    className={`flex-1 px-6 py-3 rounded-md font-medium transition-colors ${isPopulatingAll || jobs.filter(j => j.status_id === 'Completed').length === 0
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-purple-600 text-white hover:bg-purple-700'
                        }`}
                >
                    {isPopulatingAll ? (
                        <>
                            <svg className="animate-spin inline-block w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Populating Validation...
                        </>
                    ) : (
                        <>✓ Populate All Validation Queues</>
                    )}
                </button>
            </div>

            {/* Filters */}
            <div className="bg-gray-800 p-4 rounded-lg mb-6 border border-gray-700">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <input
                            type="text"
                            placeholder="🔍 Search by theme, language, or difficulty..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-11 px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="w-full h-11 px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                        >
                            <option value="all">All Statuses</option>
                            {statuses.map(status => (
                                <option key={status} value={status}>{status}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="mb-4 text-sm text-gray-400">
                Showing {filteredJobs.length} of {jobs.length} jobs
            </div>

            {/* Jobs List */}
            <div className="space-y-4">
                {filteredJobs.length === 0 ? (
                    <div className="p-12 text-center text-gray-400 bg-gray-800 rounded-lg border border-gray-700">
                        {jobs.length === 0 ? 'No harvest jobs yet. Create jobs from the Themes page.' : 'No jobs match your filters.'}
                    </div>
                ) : (
                    filteredJobs.map((job) => {
                        const progress = getProgressPercentage(job)
                        const isRunning = job.status_id === 'Running'
                        const isHarvesting = harvestingJobId === job.id

                        return (
                            <div
                                key={job.id}
                                className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
                            >
                                {/* Header */}
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="text-lg font-semibold text-white">
                                            {job.Theme.name}
                                        </h3>
                                        <div className="flex gap-2 text-sm text-gray-400 mt-1">
                                            <span>🌍 {job.Language.name}</span>
                                            <span>⚡ {job.Difficulty.name}</span>
                                        </div>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(job.status_id)}`}>
                                        {isRunning && <span className="animate-pulse">● </span>}
                                        {job.status_id}
                                    </span>
                                </div>

                                {/* Progress Bar */}
                                <div className="mb-3">
                                    <div className="flex justify-between text-sm text-gray-400 mb-1">
                                        <span>Words Collected</span>
                                        <span className="font-medium text-white">
                                            {job.current_word_count || 0} / {job.Theme.target_word_count || 0}
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-700 rounded-full h-2">
                                        <div
                                            className={`h-2 rounded-full transition-all duration-300 ${job.status_id === 'Completed' ? 'bg-green-500' :
                                                isRunning ? 'bg-blue-500' :
                                                    job.status_id === 'Failed' ? 'bg-red-500' : 'bg-orange-500'
                                                }`}
                                            style={{ width: `${progress}%` }}
                                        ></div>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {progress.toFixed(0)}% complete
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm mb-3">
                                    <div className="bg-gray-750 p-2 rounded">
                                        <div className="text-gray-400">Duplicates</div>
                                        <div className="text-white font-semibold">{job.consecutive_duplicates || 0}</div>
                                    </div>
                                    <div className="bg-gray-750 p-2 rounded">
                                        <div className="text-gray-400">Last Run</div>
                                        <div className="text-white font-semibold text-xs">
                                            {job.last_run_at ? new Date(job.last_run_at).toLocaleTimeString() : 'Never'}
                                        </div>
                                    </div>
                                    <div className="bg-gray-750 p-2 rounded">
                                        <div className="text-gray-400">Job ID</div>
                                        <div className="text-white font-semibold">#{job.id}</div>
                                    </div>
                                    <div className="bg-gray-750 p-2 rounded">
                                        <div className="text-gray-400">Created</div>
                                        <div className="text-white font-semibold text-xs">
                                            {new Date(job.created_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>

                                {/* Action Button */}
                                <div className="flex gap-2">
                                    {job.status_id === 'Pending' && (
                                        <button
                                            onClick={() => handleStartHarvest(job)}
                                            disabled={isHarvesting}
                                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed font-medium transition-colors flex items-center justify-center gap-2"
                                        >
                                            {isHarvesting ? (
                                                <>
                                                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                                                    Harvesting...
                                                </>
                                            ) : (
                                                <>▶️ Start Harvest</>
                                            )}
                                        </button>
                                    )}
                                    {job.status_id === 'Running' && (
                                        <div className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md font-medium flex items-center justify-center gap-2">
                                            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                                            Running...
                                        </div>
                                    )}
                                    {job.status_id === 'Failed' && (
                                        <button
                                            onClick={() => handleStartHarvest(job)}
                                            className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 font-medium transition-colors"
                                        >
                                            🔄 Retry
                                        </button>
                                    )}
                                    {job.status_id === 'Completed' && (
                                        <div className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md font-medium text-center">
                                            ✓ Completed
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
