'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Stats = {
  totalPuzzles: number
  totalLanguages: number
  totalThemes: number
  totalWords: number
  totalClues: number
  pendingHarvestJobs: number
  completedHarvestJobs: number
  runningHarvestJobs: number
  totalHarvestJobWords: number
  totalHarvestJobTarget: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalPuzzles: 0,
    totalLanguages: 0,
    totalThemes: 0,
    totalWords: 0,
    totalClues: 0,
    pendingHarvestJobs: 0,
    completedHarvestJobs: 0,
    runningHarvestJobs: 0,
    totalHarvestJobWords: 0,
    totalHarvestJobTarget: 0,
  })
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)

  useEffect(() => {
    fetchStats()

    // Auto-refresh every 5 seconds if there are running jobs
    const interval = setInterval(() => {
      if (autoRefresh) {
        fetchStats()
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [autoRefresh])

  async function fetchStats() {
    try {
      const [
        puzzlesRes,
        languagesRes,
        themesRes,
        wordsRes,
        cluesRes,
        pendingJobsRes,
        completedJobsRes,
        runningJobsRes,
        harvestJobsRes,
      ] = await Promise.all([
        supabase.from('GeneratedPuzzle').select('id', { count: 'exact', head: true }),
        supabase.from('Language').select('ISO', { count: 'exact', head: true }),
        supabase.from('Theme').select('id', { count: 'exact', head: true }),
        supabase.from('Word').select('id', { count: 'exact', head: true }),
        supabase.from('Clue').select('id', { count: 'exact', head: true }),
        supabase
          .from('HarvestJob')
          .select('id', { count: 'exact', head: true })
          .eq('status_id', 'Pending'),
        supabase
          .from('HarvestJob')
          .select('id', { count: 'exact', head: true })
          .eq('status_id', 'Completed'),
        supabase
          .from('HarvestJob')
          .select('id', { count: 'exact', head: true })
          .eq('status_id', 'Running'),
        supabase
          .from('HarvestJob')
          .select('current_word_count, PuzzleConfig(target_word_count)')
      ])

      // Calculate totals from harvest jobs
      let totalCurrentWords = 0
      let totalTargetWords = 0

      if (harvestJobsRes.data) {
        harvestJobsRes.data.forEach((job: any) => {
          totalCurrentWords += job.current_word_count || 0
          if (job.PuzzleConfig && Array.isArray(job.PuzzleConfig)) {
            totalTargetWords += job.PuzzleConfig[0]?.target_word_count || 0
          }
        })
      }

      const hasRunning = (runningJobsRes.count || 0) > 0
      
      setStats({
        totalPuzzles: puzzlesRes.count || 0,
        totalLanguages: languagesRes.count || 0,
        totalThemes: themesRes.count || 0,
        totalWords: wordsRes.count || 0,
        totalClues: cluesRes.count || 0,
        pendingHarvestJobs: pendingJobsRes.count || 0,
        completedHarvestJobs: completedJobsRes.count || 0,
        runningHarvestJobs: runningJobsRes.count || 0,
        totalHarvestJobWords: totalCurrentWords,
        totalHarvestJobTarget: totalTargetWords,
      })

      // Disable auto-refresh if no running jobs
      if (!hasRunning && autoRefresh) {
        setAutoRefresh(false)
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-gray-400">Loading dashboard...</div>
      </div>
    )
  }

  const harvestProgress = stats.totalHarvestJobTarget > 0 
    ? (stats.totalHarvestJobWords / stats.totalHarvestJobTarget) * 100 
    : 0

  const statCards = [
    {
      title: 'Generated Puzzles',
      value: stats.totalPuzzles,
      icon: '🧩',
      color: 'from-blue-600 to-blue-700',
    },
    {
      title: 'Themes',
      value: stats.totalThemes,
      icon: '🎨',
      color: 'from-purple-600 to-purple-700',
    },
    {
      title: 'Languages',
      value: stats.totalLanguages,
      icon: '🌍',
      color: 'from-green-600 to-green-700',
    },
    {
      title: 'Words in Pool',
      value: stats.totalWords.toLocaleString(),
      icon: '📝',
      color: 'from-orange-600 to-orange-700',
    },
    {
      title: 'Clues',
      value: stats.totalClues.toLocaleString(),
      icon: '💡',
      color: 'from-yellow-600 to-yellow-700',
    },
    {
      title: 'Harvest Jobs',
      value: `${stats.completedHarvestJobs} done`,
      icon: '✅',
      color: 'from-green-600 to-green-700',
    },
  ]

  return (
    <div className="p-4 sm:p-8">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-gray-400">Welcome to Crossword Admin</p>
        </div>
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            autoRefresh
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          {autoRefresh ? '🔄 Auto-Refresh ON' : '🔄 Auto-Refresh OFF'}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => (
          <div
            key={card.title}
            className={`bg-gradient-to-br ${card.color} p-6 rounded-lg border border-gray-700 shadow-lg`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white text-sm font-medium">{card.title}</h3>
              <span className="text-3xl">{card.icon}</span>
            </div>
            <div className="text-3xl sm:text-4xl font-bold text-white">
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Harvest Progress Section */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">🌾 Harvest Progress</h2>
          {stats.runningHarvestJobs > 0 && (
            <span className="flex items-center gap-2 text-green-400 text-sm">
              <span className="animate-pulse">●</span> {stats.runningHarvestJobs} running
            </span>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm text-gray-400 mb-2">
              <span>Total Words Collected</span>
              <span className="font-medium text-white">
                {stats.totalHarvestJobWords} / {stats.totalHarvestJobTarget}
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-500 ${
                  stats.runningHarvestJobs > 0 ? 'bg-blue-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(harvestProgress, 100)}%` }}
              ></div>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {harvestProgress.toFixed(0)}% complete
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-700">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">{stats.pendingHarvestJobs}</div>
              <div className="text-xs text-gray-400">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{stats.runningHarvestJobs}</div>
              <div className="text-xs text-gray-400">Running</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{stats.completedHarvestJobs}</div>
              <div className="text-xs text-gray-400">Completed</div>
            </div>
          </div>
        </div>

        <a
          href="/harvest-jobs"
          className="block mt-4 text-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
        >
          View All Jobs →
        </a>
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <a
            href="/themes"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-md text-center transition-colors"
          >
            🎨 Manage Themes
          </a>
          <a
            href="/languages"
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-md text-center transition-colors"
          >
            🌍 Manage Languages
          </a>
          <a
            href="/puzzle-configs"
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-md text-center transition-colors"
          >
            ⚙️ Puzzle Configs
          </a>
          <a
            href="/puzzles"
            className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-3 rounded-md text-center transition-colors"
          >
            🧩 Generated Puzzles
          </a>
        </div>
      </div>

      {/* Alerts */}
      <div className="mt-8 space-y-3">
        {stats.pendingHarvestJobs > 0 && (
          <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-4">
            <p className="text-yellow-200">
              ⚠️ You have{' '}
              <strong>{stats.pendingHarvestJobs}</strong> pending harvest job
              {stats.pendingHarvestJobs !== 1 ? 's' : ''}. Go to{' '}
              <a href="/harvest-jobs" className="underline hover:text-yellow-100">
                Harvest Jobs
              </a>{' '}
              to start them.
            </p>
          </div>
        )}
        {stats.runningHarvestJobs > 0 && (
          <div className="bg-blue-900 border border-blue-700 rounded-lg p-4">
            <p className="text-blue-200">
              🌾{' '}
              <strong>{stats.runningHarvestJobs}</strong> harvest job
              {stats.runningHarvestJobs !== 1 ? 's are' : ' is'} currently running. Page
              auto-refreshing every 5 seconds.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
