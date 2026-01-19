import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
    try {
        const { themeId, languageId } = await request.json()

        // Get all words for this theme/language
        const { data: wordThemes, error: wordError } = await supabase
            .from('Word_Theme')
            .select(`
                word_id,
                Word!inner(
                    id,
                    language_id
                )
            `)
            .eq('theme_id', themeId)
            .eq('Word.language_id', languageId)

        if (wordError) throw wordError

        if (!wordThemes || wordThemes.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No words found for this theme/language',
                queued: 0
            })
        }

        // Deduplicate word IDs (a word can appear multiple times if it has multiple themes)
        const wordIds = [...new Set(wordThemes.map((wt: any) => wt.word_id))]

        // Check which words are already in the queue
        const { data: existing } = await supabase
            .from('WordValidationQueue')
            .select('WordId')
            .in('WordId', wordIds)

        const existingIds = new Set(existing?.map((e: any) => e.WordId) || [])

        // Filter out words already in queue
        const newWordIds = wordIds.filter(id => !existingIds.has(id))

        if (newWordIds.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'All words already queued',
                queued: 0,
                skipped: wordIds.length
            })
        }

        // Insert new queue items
        const newQueueItems = newWordIds.map(id => ({
            WordId: id,
            StatusId: 'Pending'
        }))

        const { error: insertError } = await supabase
            .from('WordValidationQueue')
            .insert(newQueueItems)

        if (insertError) {
            // If still getting duplicate errors, it means concurrent inserts happened
            // Just report success with what we tried
            if (insertError.code === '23505') {
                return NextResponse.json({
                    success: true,
                    queued: 0,
                    skipped: wordIds.length,
                    message: 'Words already queued (concurrent insert detected)'
                })
            }
            throw insertError
        }

        return NextResponse.json({
            success: true,
            queued: newWordIds.length,
            skipped: existingIds.size,
            total: wordIds.length
        })

    } catch (error: any) {
        console.error('Error populating validation queue:', error)
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}
