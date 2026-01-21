import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/supabase'

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const puzzleId = searchParams.get('puzzleId')
    const cleanRunsOnly = searchParams.get('cleanRunsOnly') === 'true'

    if (!puzzleId) {
        return NextResponse.json({ error: 'puzzleId required' }, { status: 400 })
    }

    console.log('Fetching leaderboard for puzzle:', puzzleId, 'cleanRunsOnly:', cleanRunsOnly)

    let query = supabase
        .from('GameSession')
        .select('*')
        .eq('puzzle_id', parseInt(puzzleId))
        .eq('is_completed', true)
        .eq('score_percentage', 100)

    if (cleanRunsOnly) {
        query = query.eq('hints_used', 0).eq('time_penalty', 0)
    }

    const { data: sessions, error } = await query
        .order('time_seconds', { ascending: true })
        .limit(50)

    console.log('Query result:', { sessions, error })

    if (error) {
        console.error('Leaderboard error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!sessions || sessions.length === 0) {
        return NextResponse.json({ leaderboard: [] })
    }

    // Build leaderboard
    const leaderboard = sessions.map((session, index) => ({
        rank: index + 1,
        userId: session.user_id,
        username: `Player ${session.user_id.substring(0, 8)}`,
        time: session.time_seconds,
        penalty: session.time_penalty || 0,
        hints: session.hints_used || 0,
        completedAt: session.completed_at,
        isCleanRun: (session.hints_used || 0) === 0 && (session.time_penalty || 0) === 0
    }))

    console.log('Returning leaderboard:', leaderboard)

    return NextResponse.json({ leaderboard })
}
