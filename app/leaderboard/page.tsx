// app/leaderboard/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/supabase'
import PublicLayout from '../components/PublicLayout'
import Link from 'next/link'

type LeaderboardEntry = {
    user_id: string
    username: string
    total_puzzles: number
    total_clean_runs: number
    average_time: number
    best_time: number
}

type RecentActivity = {
    username: string
    puzzle_name: string
    completion_time: number
    completed_at: string
    is_clean_run: boolean
}

export default function LeaderboardPage() {
    const [allTime, setAllTime] = useState<LeaderboardEntry[]>([])
    const [thisWeek, setThisWeek] = useState<LeaderboardEntry[]>([])
    const [today, setToday] = useState<LeaderboardEntry[]>([])
    const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
    const [activeTab, setActiveTab] = useState<'today' | 'week' | 'alltime'>('today')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchLeaderboards()
    }, [])

    async function fetchLeaderboards() {
        try {
            // Today's leaders
            const { data: todayData } = await supabase
                .rpc('get_leaderboard', {
                    time_period: 'today',
                    limit_count: 10
                })

            // This week
            const { data: weekData } = await supabase
                .rpc('get_leaderboard', {
                    time_period: 'week',
                    limit_count: 10
                })

            // All time
            const { data: allTimeData } = await supabase
                .rpc('get_leaderboard', {
                    time_period: 'all',
                    limit_count: 10
                })

            // Recent activity
            const { data: activityData } = await supabase
                .from('GameSession')
                .select(`
                    completion_time,
                    is_clean_run,
                    completed_at,
                    users:user_id (
                    raw_user_meta_data
                    ),
                    GeneratedPuzzle:puzzle_id (
                    PuzzleConfig:puzzle_config_id (
                        name
                    )
                    )
                `)
                .not('completed_at', 'is', null)
                .order('completed_at', { ascending: false })
                .limit(10)

            setToday(todayData || [])
            setThisWeek(weekData || [])
            setAllTime(allTimeData || [])
            setRecentActivity(activityData?.map((a: any) => ({
                username: a.users?.raw_user_meta_data?.username || 'Anonymous',
                puzzle_name: a.GeneratedPuzzle?.PuzzleConfig?.name || 'Unknown Puzzle',
                completion_time: a.completion_time,
                completed_at: a.completed_at,
                is_clean_run: a.is_clean_run
            })) || [])
        } catch (error) {
            console.error('Error fetching leaderboard:', error)
        } finally {
            setLoading(false)
        }
    }

    function formatTime(seconds: number) {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const currentLeaderboard = activeTab === 'today' ? today : activeTab === 'week' ? thisWeek : allTime

    return (
        <PublicLayout>
            <div className="min-h-screen bg-gray-900 text-white py-8">
                <div className="container mx-auto px-4">
                    <div className="max-w-6xl mx-auto">
                        {/* Header with Back Link */}
                        <div className="flex items-center justify-between mb-8">
                            <h1 className="text-4xl font-bold">🏆 Leaderboard</h1>
                            <Link
                                href="/play"
                                className="text-blue-400 hover:text-blue-300 font-medium flex items-center gap-2 transition-colors"
                            >
                                ← Voltar aos Puzzles
                            </Link>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-4 mb-8">
                            <button
                                onClick={() => setActiveTab('today')}
                                className={`px-6 py-3 rounded-lg font-medium transition-colors ${activeTab === 'today'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                    }`}
                            >
                                Hoje
                            </button>
                            <button
                                onClick={() => setActiveTab('week')}
                                className={`px-6 py-3 rounded-lg font-medium transition-colors ${activeTab === 'week'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                    }`}
                            >
                                Esta Semana
                            </button>
                            <button
                                onClick={() => setActiveTab('alltime')}
                                className={`px-6 py-3 rounded-lg font-medium transition-colors ${activeTab === 'alltime'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                    }`}
                            >
                                Todos os Tempos
                            </button>
                        </div>

                        {loading ? (
                            <div className="text-center py-16">
                                <p className="text-gray-400">A carregar leaderboard...</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Main Leaderboard */}
                                <div className="lg:col-span-2">
                                    <div className="bg-gray-800 rounded-lg p-6">
                                        <h2 className="text-2xl font-bold mb-6">
                                            {activeTab === 'today' ? '🔥 Top Jogadores Hoje' : activeTab === 'week' ? '⚡ Top da Semana' : '👑 Melhores de Sempre'}
                                        </h2>

                                        <div className="space-y-3">
                                            {currentLeaderboard.map((entry, index) => (
                                                <div
                                                    key={entry.user_id}
                                                    className={`flex items-center justify-between p-4 rounded-lg ${index === 0
                                                        ? 'bg-gradient-to-r from-yellow-600/20 to-yellow-500/10 border border-yellow-500/30'
                                                        : index === 1
                                                            ? 'bg-gradient-to-r from-gray-400/20 to-gray-300/10 border border-gray-400/30'
                                                            : index === 2
                                                                ? 'bg-gradient-to-r from-orange-600/20 to-orange-500/10 border border-orange-500/30'
                                                                : 'bg-gray-700/50'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="text-2xl font-bold w-8">
                                                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold">{entry.username}</p>
                                                            <p className="text-sm text-gray-400">
                                                                {entry.total_clean_runs} clean run{entry.total_clean_runs !== 1 ? 's' : ''} de {entry.total_puzzles} total
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xl font-bold text-blue-400">{entry.total_puzzles}</p>
                                                        <p className="text-xs text-gray-400">puzzles</p>
                                                    </div>
                                                </div>
                                            ))}

                                            {currentLeaderboard.length === 0 && (
                                                <p className="text-center text-gray-400 py-8">
                                                    Ninguém qualificado ainda
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Recent Activity Sidebar */}
                                <div className="lg:col-span-1">
                                    <div className="bg-gray-800 rounded-lg p-6">
                                        <h2 className="text-xl font-bold mb-6">🔥 Atividade Recente</h2>

                                        <div className="space-y-4">
                                            {recentActivity.map((activity, index) => (
                                                <div key={index} className="bg-blue-900/20 rounded-lg p-3 border border-blue-500/20">
                                                    <div className="flex items-start justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xl">🔥</span>
                                                            <p className="font-bold text-sm">{activity.username}</p>
                                                        </div>
                                                        {activity.is_clean_run && (
                                                            <span className="text-xs bg-green-600 px-2 py-1 rounded">
                                                                999 dicas
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-gray-400 mb-1">
                                                        completou {activity.puzzle_name}
                                                    </p>
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-sm font-mono text-blue-400">
                                                            {formatTime(activity.completion_time)}
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            {new Date(activity.completed_at).toLocaleDateString('pt-PT', {
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}

                                            {recentActivity.length === 0 && (
                                                <p className="text-center text-gray-400 text-sm py-8">
                                                    Sem atividade recente
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </PublicLayout>
    )
}
