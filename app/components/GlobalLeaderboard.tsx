'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/app/contexts/AuthContext'

type TopPlayer = {
    rank: number
    userId: string
    username: string
    totalCompleted: number
    cleanRuns: number
}

type SpeedChampion = {
    rank: number
    userId: string
    username: string
    avgTime: number
    cleanRuns: number
}

type RecentActivity = {
    userId: string
    username: string
    puzzleName: string
    time: number
    penalty: number
    hints: number
    completedAt: string
    isClean: boolean
}

type GlobalStats = {
    totalPuzzlesSolved: number
    totalPlayers: number
    solvedToday: number
}

export default function GlobalLeaderboard() {
    const { user } = useAuth()
    const [topPlayers, setTopPlayers] = useState<TopPlayer[]>([])
    const [speedChampions, setSpeedChampions] = useState<SpeedChampion[]>([])
    const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
    const [stats, setStats] = useState<GlobalStats>({
        totalPuzzlesSolved: 0,
        totalPlayers: 0,
        solvedToday: 0
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchGlobalLeaderboard()
    }, [])

    async function fetchGlobalLeaderboard() {
        setLoading(true)
        try {
            const response = await fetch('/api/leaderboard/global')
            const data = await response.json()
            
            if (data.topPlayers) {
                setTopPlayers(data.topPlayers)
                setSpeedChampions(data.speedChampions)
                setRecentActivity(data.recentActivity)
                setStats(data.stats)
            }
        } catch (error) {
            console.error('Error fetching global leaderboard:', error)
        } finally {
            setLoading(false)
        }
    }

    function formatTime(seconds: number): string {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    function getRelativeTime(dateString: string): string {
        const date = new Date(dateString)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMins / 60)
        const diffDays = Math.floor(diffHours / 24)

        if (diffMins < 1) return 'agora'
        if (diffMins < 60) return `${diffMins}m atrás`
        if (diffHours < 24) return `${diffHours}h atrás`
        if (diffDays < 7) return `${diffDays}d atrás`
        return date.toLocaleDateString('pt-PT')
    }

    function getMedalEmoji(rank: number): string {
        if (rank === 1) return '🥇'
        if (rank === 2) return '🥈'
        if (rank === 3) return '🥉'
        return `#${rank}`
    }

    if (loading) {
        return (
            <div className="bg-gray-800 rounded-lg p-6">
                <div className="text-center text-gray-400">A carregar leaderboard global...</div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Global Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <div className="text-gray-400 text-sm mb-1">Total de Puzzles Resolvidos</div>
                    <div className="text-3xl font-bold text-white">{stats.totalPuzzlesSolved}</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <div className="text-gray-400 text-sm mb-1">Jogadores Ativos</div>
                    <div className="text-3xl font-bold text-white">{stats.totalPlayers}</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <div className="text-gray-400 text-sm mb-1">Resolvidos Hoje</div>
                    <div className="text-3xl font-bold text-green-400">{stats.solvedToday}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Players */}
                <div className="bg-gray-800 rounded-lg p-6">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        🏆 Top Jogadores
                    </h2>
                    {topPlayers.length === 0 ? (
                        <div className="text-center text-gray-400 py-4">
                            Nenhum puzzle completo ainda
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {topPlayers.map((player) => {
                                const isCurrentUser = user?.id === player.userId
                                return (
                                    <div
                                        key={player.rank}
                                        className={`
                                            flex items-center gap-3 p-3 rounded-lg
                                            ${isCurrentUser 
                                                ? 'bg-blue-900 border border-blue-700' 
                                                : 'bg-gray-700'
                                            }
                                        `}
                                    >
                                        <div className="text-2xl w-10 text-center">
                                            {getMedalEmoji(player.rank)}
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-white font-medium">
                                                {player.username}
                                                {isCurrentUser && (
                                                    <span className="ml-2 text-xs text-blue-400">(tu)</span>
                                                )}
                                            </div>
                                            <div className="text-xs text-gray-400">
                                                {player.cleanRuns} clean runs de {player.totalCompleted} total
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xl font-bold text-white">
                                                {player.totalCompleted}
                                            </div>
                                            <div className="text-xs text-gray-400">puzzles</div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Speed Champions */}
                <div className="bg-gray-800 rounded-lg p-6">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        ⚡ Campeões de Velocidade
                    </h2>
                    <div className="text-xs text-gray-400 mb-3">Mínimo 3 clean runs</div>
                    {speedChampions.length === 0 ? (
                        <div className="text-center text-gray-400 py-4">
                            Ninguém qualificado ainda
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {speedChampions.map((champion) => {
                                const isCurrentUser = user?.id === champion.userId
                                return (
                                    <div
                                        key={champion.rank}
                                        className={`
                                            flex items-center gap-3 p-3 rounded-lg
                                            ${isCurrentUser 
                                                ? 'bg-blue-900 border border-blue-700' 
                                                : 'bg-gray-700'
                                            }
                                        `}
                                    >
                                        <div className="text-2xl w-10 text-center">
                                            {getMedalEmoji(champion.rank)}
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-white font-medium">
                                                {champion.username}
                                                {isCurrentUser && (
                                                    <span className="ml-2 text-xs text-blue-400">(tu)</span>
                                                )}
                                            </div>
                                            <div className="text-xs text-gray-400">
                                                {champion.cleanRuns} clean runs
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xl font-bold text-green-400 font-mono">
                                                {formatTime(champion.avgTime)}
                                            </div>
                                            <div className="text-xs text-gray-400">média</div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    🔥 Atividade Recente
                </h2>
                {recentActivity.length === 0 ? (
                    <div className="text-center text-gray-400 py-4">
                        Nenhuma atividade recente
                    </div>
                ) : (
                    <div className="space-y-2">
                        {recentActivity.map((activity, index) => {
                            const isCurrentUser = user?.id === activity.userId
                            return (
                                <div
                                    key={index}
                                    className={`
                                        flex items-center gap-3 p-3 rounded-lg
                                        ${isCurrentUser 
                                            ? 'bg-blue-900 border border-blue-700' 
                                            : 'bg-gray-700'
                                        }
                                    `}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="text-white font-medium truncate">
                                            {activity.username}
                                            {isCurrentUser && (
                                                <span className="ml-2 text-xs text-blue-400">(tu)</span>
                                            )}
                                            <span className="text-gray-400 font-normal ml-2">
                                                completou
                                            </span>
                                            <span className="text-blue-400 font-normal ml-1">
                                                {activity.puzzleName}
                                            </span>
                                        </div>
                                        <div className="text-xs text-gray-400">
                                            {getRelativeTime(activity.completedAt)}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-white font-mono font-bold">
                                            {formatTime(activity.time + activity.penalty)}
                                        </div>
                                        {activity.isClean ? (
                                            <div className="text-xs text-green-400">✨ Clean</div>
                                        ) : (
                                            <div className="text-xs text-orange-400">
                                                {activity.hints} {activity.hints === 1 ? 'dica' : 'dicas'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
