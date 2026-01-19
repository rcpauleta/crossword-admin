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
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

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
      ])

      setStats({
        totalPuzzles: puzzlesRes.count || 0,
        totalLanguages: languagesRes.count || 0,
        totalThemes: themesRes.count || 0,
        totalWords: wordsRes.count || 0,
        totalClues: cluesRes.count || 0,
        pendingHarvestJobs: pendingJobsRes.count || 0,
        completedHarvestJobs: completedJobsRes.count || 0,
      })
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
      title: 'Pending Harvest Jobs',
      value: stats.pendingHarvestJobs,
      icon: '🌾',
      color: 'from-red-600 to-red-700',
    },
    {
      title: 'Completed Harvest Jobs',
      value: stats.completedHarvestJobs,
      icon: '✅',
      color: 'from-green-600 to-green-700',
    },
  ]

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-gray-400">Welcome to Crossword Admin</p>
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
      </div>
    </div>
  )
}
