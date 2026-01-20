import { supabase } from '@/lib/supabase/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { dictionaryService } from '@/lib/dictionary-service'

function normalizeText(text: string): string {
    return text
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
}

export async function POST(request: NextRequest) {
    const { languageId } = await request.json()  // This is ISO like "PT-PT"

    if (!languageId) {
        return NextResponse.json({ error: 'Language ID required' }, { status: 400 })
    }

    // Get language info - ISO is the primary key
    const { data: language, error: langError } = await supabase
        .from('Language')
        .select('ISO, name')
        .eq('ISO', languageId)
        .single()

    if (!language) {
        return NextResponse.json({ 
            error: 'Language not found', 
            debug: { languageId, langError } 
        }, { status: 404 })
    }

    const languageISO = language.ISO

    // Get pending words - use ISO for language_id comparison
    const { data: queueItems, error: queueError } = await supabase
        .from('WordValidationQueue')
        .select(`
            word_id,
            status_id,
            Word!inner(
                id,
                display_text,
                normalized_text,
                language_id
            )
        `)
        .eq('Word.language_id', languageISO)
        .eq('status_id', 'Pending')

    if (queueError) {
        return NextResponse.json({ error: queueError.message }, { status: 500 })
    }

    if (!queueItems || queueItems.length === 0) {
        return NextResponse.json({ success: true, validated: 0, valid: 0, invalid: 0 })
    }

    // Load dictionary
    try {
        await dictionaryService.loadDictionary(languageISO)
    } catch (error) {
        return NextResponse.json({ 
            error: `Dictionary not available for ${languageISO}. Error: ${error}` 
        }, { status: 400 })
    }

    let validCount = 0
    let invalidCount = 0

    for (const item of queueItems as any[]) {
        const word = item.Word
        const displayText = word.display_text
        const normalizedText = word.normalized_text
        const expectedNormalized = normalizeText(displayText)

        // Check 1: Normalization
        const normalizationCorrect = normalizedText === expectedNormalized

        // Check 2: Word validity using dictionary
        const isValidWord = await dictionaryService.isValidWord(displayText.toLowerCase(), languageISO)

        let finalIsValid = normalizationCorrect && isValidWord
        let issueType = null
        let suggestion = null

        if (!normalizationCorrect) {
            issueType = 'NORMALIZATION_MISMATCH'
            suggestion = expectedNormalized
            finalIsValid = false
        } else if (!isValidWord) {
            issueType = 'INVALID_WORD'
            finalIsValid = false
        }

        const updateData: any = {
            status_id: finalIsValid ? 'Valid' : 'Invalid',
            last_checked_on: new Date().toISOString()
        }

        if (!finalIsValid) {
            updateData.issue_type = issueType
            if (suggestion) {
                updateData.suggested_normalized_fix = suggestion
            }
        }

        await supabase
            .from('WordValidationQueue')
            .update(updateData)
            .eq('word_id', word.id)

        if (finalIsValid) {
            validCount++
        } else {
            invalidCount++
        }
    }

    return NextResponse.json({
        success: true,
        validated: queueItems.length,
        valid: validCount,
        invalid: invalidCount
    })
}
