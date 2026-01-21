import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: NextRequest) {
    try {
        // Get all completed sessions
        const { data: sessions, error } = await supabase
            .from('GameSession')
            .select(`
                id,
                user_id,
                puzzle_id,
                time_seconds,
                time_penalty,
                hints_used,
                completed_at,
                score_percentage,
                GeneratedPuzzle!puzzle_id (
                    id,
                    puzzle_config_id (
                        name
                    )
                )
            `)
            .eq('is_completed', true)
            .eq('score_percentage', 100)
            .order('completed_at', { ascending: false })

        if (error) {
            console.error('Global leaderboard error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        if (!sessions || sessions.length === 0) {
            return NextResponse.json({
                topPlayers: [],
                speedChampions: [],
                recentActivity: [],
                stats: {
                    totalPuzzlesSolved: 0,
                    totalPlayers: 0,
                    solvedToday: 0
                }
            })
        }

        // Calculate stats per user
        const userStats = new Map<string, {
            userId: string
            totalCompleted: number
            totalTime: number
            cleanRuns: number
            totalRuns: number
        }>()

        sessions.forEach(session => {
            const isClean = (session.hints_used || 0) === 0 && (session.time_penalty || 0) === 0
            
            if (!userStats.has(session.user_id)) {
                userStats.set(session.user_id, {
                    userId: session.user_id,
                    totalCompleted: 0,
                    totalTime: 0,
                    cleanRuns: 0,
                    totalRuns: 0
                })
            }

            const stats = userStats.get(session.user_id)!
            stats.totalCompleted++
            stats.totalRuns++
            if (isClean) {
                stats.cleanRuns++
                stats.totalTime += session.time_seconds
            }
        })

        // Top Players (most puzzles completed)
        const topPlayers = Array.from(userStats.values())
            .sort((a, b) => b.totalCompleted - a.totalCompleted)
            .slice(0, 5)
            .map((stats, index) => ({
                rank: index + 1,
                userId: stats.userId,
                username: `Player ${stats.userId.substring(0, 8)}`,
                totalCompleted: stats.totalCompleted,
                cleanRuns: stats.cleanRuns
            }))

        // Speed Champions (best average time on clean runs, min 3 puzzles)
        const speedChampions = Array.from(userStats.values())
            .filter(stats => stats.cleanRuns >= 3)
            .map(stats => ({
                userId: stats.userId,
                avgTime: Math.round(stats.totalTime / stats.cleanRuns),
                cleanRuns: stats.cleanRuns
            }))
            .sort((a, b) => a.avgTime - b.avgTime)
            .slice(0, 5)
            .map((stats, index) => ({
                rank: index + 1,
                userId: stats.userId,
                username: `Player ${stats.userId.substring(0, 8)}`,
                avgTime: stats.avgTime,
                cleanRuns: stats.cleanRuns
            }))

        // Recent Activity (last 10 completions)
        const recentActivity = sessions
            .slice(0, 10)
            .map(session => ({
                userId: session.user_id,
                username: `Player ${session.user_id.substring(0, 8)}`,
                puzzleName: session.GeneratedPuzzle?.[0]?.puzzle_config_id?.[0]?.name || 'Unknown Puzzle',
                time: session.time_seconds,
                penalty: session.time_penalty || 0,
                hints: session.hints_used || 0,
                completedAt: session.completed_at,
                isClean: (session.hints_used || 0) === 0 && (session.time_penalty || 0) === 0
            }))

        // Global Stats
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const solvedToday = sessions.filter(s => 
            new Date(s.completed_at) >= today
        ).length

        const stats = {
            totalPuzzlesSolved: sessions.length,
            totalPlayers: userStats.size,
            solvedToday: solvedToday
        }

        return NextResponse.json({
            topPlayers,
            speedChampions,
            recentActivity,
            stats
        })

    } catch (error) {
        console.error('Global leaderboard error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
