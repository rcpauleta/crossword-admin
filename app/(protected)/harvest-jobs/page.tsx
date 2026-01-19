'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import AdminLayout from '../../components/AdminLayout'
import { callOpenRouter } from '../../lib/openrouter'

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
    Theme: { name: string }
    Language: { name: string }
    Difficulty: { name: string }
    HarvestStatus: { name: string }
}

export default function HarvestJobsPage() {
    const [jobs, setJobs] = useState<HarvestJob[]>([])
    const [loading, setLoading] = useState(true)

    // Filter states
    const [searchTerm, setSearchTerm] = useState('')
    const [filterStatus, setFilterStatus] = useState<string>('all')
    const [statuses, setStatuses] = useState<string[]>([])

    const [harvestingJobId, setHarvestingJobId] = useState<number | null>(null)

    useEffect(() => {
        fetchStatuses()
        fetchJobs()
    }, [])

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
        const { data, error } = await supabase
            .from('HarvestJob')
            .select(`
        *,
        Theme!inner(name),
        Language!inner(name),
        Difficulty!inner(name),
        HarvestStatus!inner(name)
      `)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching harvest jobs:', error)
        } else {
            setJobs(data || [])
        }
        setLoading(false)
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

        try {
            const response = await fetch('/api/harvest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobId: job.id })
            })

            const result = await response.json()

            if (result.success) {
                alert(
                    `Harvest completed successfully!\n\n` +
                    `New words: ${result.stats.newWords}\n` +
                    `Updated words: ${result.stats.updatedWords}\n` +
                    `Duplicates: ${result.stats.duplicates}\n` +
                    `Total: ${result.stats.totalWords}/${result.stats.targetWords}\n` +
                    `Status: ${result.stats.isComplete ? 'Completed ✓' : 'Pending (run again)'}`
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

    function getStatusColor(status: string) {
        switch (status.toLowerCase()) {
            case 'pending': return 'text-yellow-400'
            case 'running': return 'text-blue-400'
            case 'completed': return 'text-green-400'
            case 'failed': return 'text-red-400'
            default: return 'text-gray-400'
        }
    }

    function getStatusBadgeColor(status: string) {
        switch (status.toLowerCase()) {
            case 'pending': return 'bg-yellow-600'
            case 'running': return 'bg-blue-600'
            case 'completed': return 'bg-green-600'
            case 'failed': return 'bg-red-600'
            default: return 'bg-gray-600'
        }
    }

    // Add this function inside the component
    async function testOpenRouter() {
        const result = await callOpenRouter(
            'You are a helpful assistant.',
            'Say "Hello" and confirm you are working correctly.',
            'openai/gpt-4o-mini'
        )

        if (result.success) {
            alert(`OpenRouter Test Success!\n\nResponse: ${result.content}\n\nTokens: ${result.usage?.total_tokens}`)
        } else {
            alert(`OpenRouter Test Failed!\n\nError: ${result.error}`)
        }
    }

    if (loading) return <AdminLayout title="Harvest Jobs"><div className="text-gray-400">Loading harvest jobs...</div></AdminLayout>

    return (
        <AdminLayout title="Harvest Jobs">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-white">Harvest Jobs</h1>
                    <button
                        onClick={fetchJobs}
                        className="bg-gray-700 text-white px-6 py-2 rounded-md hover:bg-gray-600 font-medium"
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
                <div className="bg-gray-800 shadow rounded-lg overflow-hidden border border-gray-700">
                    {filteredJobs.length === 0 ? (
                        <div className="p-12 text-center text-gray-400">
                            {jobs.length === 0 ? 'No harvest jobs yet. Create jobs from the Themes page.' : 'No jobs match your filters.'}
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-700">
                            {filteredJobs.map((job) => (
                                <div
                                    key={job.id}
                                    className="p-6 hover:bg-gray-700 transition-colors"
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="text-lg font-semibold text-white">
                                                    {job.Theme.name}
                                                </h3>
                                                <span className={`px-2 py-1 ${getStatusBadgeColor(job.status_id)} text-white text-xs rounded font-medium`}>
                                                    {job.HarvestStatus.name}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4 mb-3 text-sm">
                                                <span className="text-gray-300">
                                                    🌍 {job.Language.name}
                                                </span>
                                                <span className="text-gray-300">
                                                    ⚡ {job.Difficulty.name}
                                                </span>
                                            </div>
                                            <div className="flex gap-4 text-sm text-gray-500">
                                                {job.current_word_count !== null && (
                                                    <span>Words: {job.current_word_count}</span>
                                                )}
                                                {job.consecutive_duplicates !== null && (
                                                    <span>Duplicates: {job.consecutive_duplicates}</span>
                                                )}
                                                {job.last_run_at && (
                                                    <span>Last run: {new Date(job.last_run_at).toLocaleString()}</span>
                                                )}
                                                <span className="text-gray-600">
                                                    Created: {new Date(job.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="ml-4">
                                            {job.status_id === 'Pending' && (
                                                <button
                                                    onClick={() => handleStartHarvest(job)}
                                                    disabled={harvestingJobId === job.id}
                                                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center gap-2"
                                                >
                                                    {harvestingJobId === job.id ? (
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
                                                <div className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium animate-pulse">
                                                    ⏳ Running...
                                                </div>
                                            )}
                                            {job.status_id === 'Failed' && (
                                                <button
                                                    onClick={() => handleStartHarvest(job)}
                                                    disabled={harvestingJobId === job.id}
                                                    className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 text-sm font-medium transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center gap-2"
                                                >
                                                    {harvestingJobId === job.id ? (
                                                        <>
                                                            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                                                            Retrying...
                                                        </>
                                                    ) : (
                                                        <>🔄 Retry</>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    )
}
