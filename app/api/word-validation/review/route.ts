import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
    try {
        const { wordId, action, suggestedNormalized } = await request.json()

        if (!wordId || !action) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
        }

        if (action === 'mark_fixed') {
            // User says it's actually valid - mark as Fixed
            const { data, error } = await supabase
                .from('WordValidationQueue')
                .update({ 
                    status_id: 'Fixed',
                    last_checked_at: new Date().toISOString()
                })
                .eq('word_id', wordId)
                .select()

            if (error) {
                throw error
            }

            return NextResponse.json({ success: true, action: 'marked_fixed', updated: data })
        }

        if (action === 'accept_suggestion') {
            if (!suggestedNormalized) {
                return NextResponse.json({ success: false, error: 'No suggestion provided' }, { status: 400 })
            }

            // Get the word details
            const { data: word, error: wordError } = await supabase
                .from('Word')
                .select('id, language_id, normalized_text')
                .eq('id', wordId)
                .single()

            if (wordError || !word) {
                return NextResponse.json({ success: false, error: 'Word not found' }, { status: 404 })
            }

            // Check if a word with the suggested normalized text already exists for this language
            const { data: existingWord } = await supabase
                .from('Word')
                .select('id, normalized_text')
                .eq('language_id', word.language_id)
                .eq('normalized_text', suggestedNormalized.toUpperCase())
                .single()

            if (existingWord) {
                return NextResponse.json({ 
                    success: false, 
                    error: 'duplicate',
                    message: `A word with normalized text "${suggestedNormalized}" already exists for this language. Cannot apply suggestion.`
                })
            }

            // Update the word's normalized_text
            const { error: updateError } = await supabase
                .from('Word')
                .update({ 
                    normalized_text: suggestedNormalized.toUpperCase(),
                    length: suggestedNormalized.length
                })
                .eq('id', wordId)

            if (updateError) {
                throw updateError
            }

            // Mark as Valid in the queue
            const { error: queueError } = await supabase
                .from('WordValidationQueue')
                .update({ 
                    status_id: 'Valid',
                    last_checked_on: new Date().toISOString()
                })
                .eq('word_id', wordId)

            if (queueError) {
                throw queueError
            }

            return NextResponse.json({ 
                success: true, 
                action: 'suggestion_accepted',
                newNormalized: suggestedNormalized.toUpperCase()
            })
        }

        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })

    } catch (error: any) {
        console.error('Review error:', error)
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}
