'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/app/contexts/AuthContext'

type LeaderboardEntry = {
    rank: number
    userId: string
    username: string
    time: number
    penalty: number
    hints: number
    completedAt: string
    isCleanRun: boolean
}

type LeaderboardProps = {
    puzzleId: number
    refreshTrigger?: number  // Add this
}

export default function Leaderboard({ puzzleId, refreshTrigger }: LeaderboardProps) {
    const { user } = useAuth()
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
    const [cleanRunsOnly, setCleanRunsOnly] = useState(false)
    const [loading, setLoading] = useState(true)
    const [userRank, setUserRank] = useState<number | null>(null)

    useEffect(() => {
        fetchLeaderboard()
    }, [puzzleId, cleanRunsOnly, refreshTrigger])

    async function fetchLeaderboard() {
        setLoading(true)
        try {
            const response = await fetch(
                `/api/leaderboard?puzzleId=${puzzleId}&cleanRunsOnly=${cleanRunsOnly}`
            )
            const data = await response.json()
            
            if (data.leaderboard) {
                setLeaderboard(data.leaderboard)
                
                // Find user's rank
                if (user) {
                    const userEntry = data.leaderboard.find(
                        (entry: LeaderboardEntry) => entry.userId === user.id
                    )
                    setUserRank(userEntry?.rank || null)
                }
            }
        } catch (error) {
            console.error('Error fetching leaderboard:', error)
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

        if (diffMins < 60) return `${diffMins}m ago`
        if (diffHours < 24) return `${diffHours}h ago`
        if (diffDays < 7) return `${diffDays}d ago`
        return date.toLocaleDateString('pt-PT')
    }

    function getMedalEmoji(rank: number): string {
        if (rank === 1) return '🥇'
        if (rank === 2) return '🥈'
        if (rank === 3) return '🥉'
        return ''
    }

    if (loading) {
        return (
            <div className="bg-gray-800 rounded-lg p-6">
                <div className="text-center text-gray-400">A carregar leaderboard...</div>
            </div>
        )
    }

    return (
        <div className="bg-gray-800 rounded-lg p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    🏆 Leaderboard
                </h2>
                
                {/* Filter Toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={cleanRunsOnly}
                        onChange={(e) => setCleanRunsOnly(e.target.checked)}
                        className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-300">Só sem dicas</span>
                </label>
            </div>

            {/* User's Rank Banner */}
            {user && userRank && (
                <div className="bg-blue-900 border border-blue-700 rounded-lg p-3 mb-4">
                    <div className="text-blue-200 text-sm">A tua posição</div>
                    <div className="text-white font-bold text-xl">
                        #{userRank} {getMedalEmoji(userRank)}
                    </div>
                </div>
            )}

            {/* Leaderboard Table */}
            {leaderboard.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                    Ninguém completou este puzzle ainda.
                    <br />
                    Sê o primeiro! 🚀
                </div>
            ) : (
                <div className="space-y-2">
                    {leaderboard.map((entry) => {
                        const isCurrentUser = user?.id === entry.userId
                        const totalTime = entry.time + entry.penalty

                        return (
                            <div
                                key={entry.rank}
                                className={`
                                    flex items-center gap-4 p-3 rounded-lg transition-colors
                                    ${isCurrentUser 
                                        ? 'bg-blue-900 border border-blue-700' 
                                        : 'bg-gray-700 hover:bg-gray-650'
                                    }
                                `}
                            >
                                {/* Rank */}
                                <div className="text-center w-12">
                                    <div className="text-2xl">
                                        {getMedalEmoji(entry.rank) || (
                                            <span className="text-gray-400 font-bold">
                                                #{entry.rank}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Username */}
                                <div className="flex-1 min-w-0">
                                    <div className="text-white font-medium truncate">
                                        {entry.username}
                                        {isCurrentUser && (
                                            <span className="ml-2 text-xs text-blue-400">(tu)</span>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-400">
                                        {getRelativeTime(entry.completedAt)}
                                    </div>
                                </div>

                                {/* Time */}
                                <div className="text-right">
                                    <div className="text-white font-mono font-bold">
                                        {formatTime(totalTime)}
                                    </div>
                                    {entry.penalty > 0 && (
                                        <div className="text-xs text-orange-400">
                                            +{entry.penalty}s ({entry.hints} {entry.hints === 1 ? 'dica' : 'dicas'})
                                        </div>
                                    )}
                                    {entry.isCleanRun && (
                                        <div className="text-xs text-green-400">✨ Clean</div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Stats Footer */}
            {leaderboard.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-700 text-center text-sm text-gray-400">
                    {leaderboard.length} {leaderboard.length === 1 ? 'jogador completou' : 'jogadores completaram'} este puzzle
                </div>
            )}
        </div>
    )
}
