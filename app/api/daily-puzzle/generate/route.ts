import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { date, languageId, force } = body  // Add force flag
        const targetDate = date || new Date().toISOString().split('T')[0]
        const targetLanguage = languageId || 'PT-PT'

        // Check if daily puzzle already exists
        const { data: existing } = await supabase
            .from('DailyPuzzle')
            .select('id, puzzle_id')
            .eq('date', targetDate)
            .eq('language_id', targetLanguage)
            .single()

        if (existing && !force) {
            return NextResponse.json({
                success: true,
                message: 'Daily puzzle already exists for this date',
                dailyPuzzleId: existing.id,
                puzzleId: existing.puzzle_id,
                alreadyExists: true
            })
        }

        // If force=true and exists, delete the old one first
        if (existing && force) {
            console.log(`Force regenerating daily puzzle for ${targetDate}`)

            // Delete the old DailyPuzzle entry
            await supabase
                .from('DailyPuzzle')
                .delete()
                .eq('id', existing.id)

            // Optionally delete the old GeneratedPuzzle too
            await supabase
                .from('GeneratedPuzzle')
                .delete()
                .eq('id', existing.puzzle_id)
        }

        // Get the daily config for this language
        const { data: config, error: configError } = await supabase
            .from('PuzzleConfig')
            .select('*')
            .eq('config_type', 'daily')
            .eq('language_id', targetLanguage)
            .eq('is_active', true)
            .single()

        if (configError || !config) {
            return NextResponse.json(
                { success: false, error: `No daily config found for language ${targetLanguage}` },
                { status: 404 }
            )
        }

        console.log(`Generating daily puzzle for ${targetDate} using config:`, config)

        // Generate puzzle using the daily config
        const generateResponse = await fetch(
            `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/generate-puzzle`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ configId: config.id })
            }
        )

        const generateResult = await generateResponse.json()

        if (!generateResult.success) {
            throw new Error(generateResult.error)
        }

        // Link to DailyPuzzle table
        const { data: dailyPuzzle, error: dailyError } = await supabase
            .from('DailyPuzzle')
            .insert({
                date: targetDate,
                puzzle_id: generateResult.puzzle.id,
                language_id: targetLanguage
            })
            .select()
            .single()

        if (dailyError) throw dailyError

        return NextResponse.json({
            success: true,
            dailyPuzzle,
            puzzleDetails: generateResult.puzzle,
            regenerated: force || false
        })

    } catch (error: any) {
        console.error('Daily puzzle generation error:', error)
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}