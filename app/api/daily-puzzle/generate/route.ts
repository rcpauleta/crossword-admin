import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { date, languageId, difficulty, force } = body
        const targetDate = date || new Date().toISOString().split('T')[0]
        const targetLanguage = languageId || 'PT-PT'
        const targetDifficulty = difficulty || 'medium' // NEW

        // Check if daily puzzle already exists for this difficulty
        const { data: existing } = await supabase
            .from('DailyPuzzle')
            .select('id, puzzle_id')
            .eq('date', targetDate)
            .eq('language_id', targetLanguage)
            .eq('difficulty_level', targetDifficulty) // NEW
            .single()

        if (existing && !force) {
            return NextResponse.json({
                success: true,
                message: 'Daily puzzle already exists for this difficulty',
                dailyPuzzleId: existing.id,
                puzzleId: existing.puzzle_id,
                alreadyExists: true
            })
        }

        // Get the daily config for this language and difficulty
        const { data: config, error: configError } = await supabase
            .from('PuzzleConfig')
            .select('*')
            .eq('config_type', 'daily')
            .eq('language_id', targetLanguage)
            .eq('difficulty_level', targetDifficulty) // NEW
            .eq('is_active', true)
            .single()

        if (configError || !config) {
            return NextResponse.json(
                { success: false, error: `No daily config found for ${targetLanguage} ${targetDifficulty}` },
                { status: 404 }
            )
        }

        // Generate puzzle...
        const generateResponse = await fetch(
            `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/generate-puzzle`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ configId: config.id })
            }
        )

        const generateResult = await generateResponse.json()
        if (!generateResult.success) throw new Error(generateResult.error)

        // Link to DailyPuzzle table
        const { data: dailyPuzzle, error: dailyError } = await supabase
            .from('DailyPuzzle')
            .insert({
                date: targetDate,
                puzzle_id: generateResult.puzzle.id,
                language_id: targetLanguage,
                difficulty_level: targetDifficulty // NEW
            })
            .select()
            .single()

        if (dailyError) throw dailyError

        return NextResponse.json({
            success: true,
            dailyPuzzle,
            puzzleDetails: generateResult.puzzle
        })

    } catch (error: any) {
        console.error('Daily puzzle generation error:', error)
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}