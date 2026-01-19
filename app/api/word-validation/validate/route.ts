import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const BATCH_SIZE = 50

// Helper to remove accents and normalize
function normalizeText(text: string): string {
    return text
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
}

export async function POST(request: NextRequest) {
    try {
        const { languageId } = await request.json() // Remove themeId

        // Get pending validation items for this language (no theme filtering)
        const { data: queueItems, error: queueError } = await supabase
            .from('WordValidationQueue')
            .select(`
                word_id,
                Word!inner(
                    id,
                    normalized_text,
                    display_text,
                    language_id,
                    Language!inner(ISO, name)
                )
            `)
            .eq('status_id', 'Pending')
            .eq('Word.language_id', languageId)
            .limit(BATCH_SIZE) as {
                data: Array<{
                    word_id: number;
                    Word: {
                        id: number;
                        normalized_text: string;
                        display_text: string;
                        language_id: number;
                        Language: {
                            ISO: string;
                            name: string;
                        };
                    };
                }> | null; error: any
            }

        if (queueError) throw queueError

        if (!queueItems || queueItems.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No pending words to validate',
                validated: 0
            })
        }

        // Mark as InProgress
        const wordIds = queueItems.map(item => item.word_id)
        await supabase
            .from('WordValidationQueue')
            .update({ status_id: 'InProgress', last_checked_at: new Date().toISOString() })
            .in('word_id', wordIds)

        // Prepare word list for AI
        const wordList = queueItems.map((item: any) => ({
            id: item.Word.id,
            normalized: item.Word.normalized_text,
            display: item.Word.display_text
        }))

        const languageISO = queueItems[0].Word.Language.ISO
        const languageName = queueItems[0].Word.Language.name

        // Build validation prompt
        const systemPrompt = "You are a strict Data Quality Auditor for a crossword puzzle database. Your job is to validate that word entries follow normalization rules. You do NOT create new content. You only verify and report issues."

        const userPrompt = `Validate the following list of ${wordList.length} words for language: ${languageISO}.

INPUT DATA:
${JSON.stringify(wordList, null, 2)}

YOU MUST PERFORM TWO SEPARATE CHECKS FOR EACH WORD:

CHECK 1 - NORMALIZATION VALIDATION:
The "normalized" field MUST be the "display" field with these transformations ONLY:
1. Convert to UPPERCASE
2. Remove ALL diacritics/accents (á→A, ã→A, ç→C, é→E, í→I, ó→O, ú→U, etc.)
3. NO other changes allowed

EXAMPLES:
✓ Display: "Circulação" → Normalized: "CIRCULACAO" (correct)
✗ Display: "Circulação" → Normalized: "CIRCULAÇÃO" (wrong - accents not removed)

CHECK 2 - WORD VALIDITY:
Is the "display" text a valid, real word in ${languageName}?
- Must be a real word that exists in the language dictionary
- Must be ONE word (no multi-word phrases unless it's a proper compound)
- No typos, no concatenations, no foreign words

EXAMPLES FOR PORTUGUESE:
✓ "Bola" - Valid Portuguese word (means ball)
✓ "Nata" - Valid Portuguese word (means cream)
✗ "Seried" - NOT a valid Portuguese word (typo or invalid)
✗ "Computar" - Valid if it exists, invalid if it doesn't

OUTPUT JSON FORMAT:
[
  {
    "id": 123,
    "is_valid": true,  // true ONLY if BOTH checks pass
    "issue_type": null,  // "NORMALIZATION_MISMATCH" or "INVALID_WORD" or null
    "suggested_fix_normalized": null  // ONLY for NORMALIZATION_MISMATCH
  }
]

DECISION LOGIC:
- If normalization is wrong → is_valid: false, issue_type: "NORMALIZATION_MISMATCH", suggest correct normalized form
- If normalization is correct BUT word is not valid in ${languageName} → is_valid: false, issue_type: "INVALID_WORD"
- If both normalization is correct AND word is valid → is_valid: true, issue_type: null

Return exactly ${wordList.length} results in the same order as input.`

        // Call OpenRouter
        const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
                'X-Title': 'Crossword Validation'
            },
            body: JSON.stringify({
                model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
                responses: 1,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ]
            })
        })

        if (!openRouterResponse.ok) {
            throw new Error(`OpenRouter API error: ${openRouterResponse.status}`)
        }

        const aiResponse = await openRouterResponse.json()
        const content = aiResponse.choices[0].message.content

        // Parse JSON response
        let validationResults
        try {
            const jsonMatch = content.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/) || content.match(/(\[[\s\S]*?\])/)
            const jsonString = jsonMatch ? jsonMatch[1] : content
            validationResults = JSON.parse(jsonString)
        } catch (parseError) {
            throw new Error(`Failed to parse AI validation response as JSON`)
        }

        if (!Array.isArray(validationResults)) {
            throw new Error('AI response is not a valid array')
        }

        // Update validation queue with results
        let validCount = 0
        let invalidCount = 0
        let updateErrors = []
        let autoCorrectedCount = 0

        for (const result of validationResults) {
            // POST-PROCESSING: Verify AI's decision
            const originalWord = wordList.find(w => w.id === result.id)
            if (!originalWord) continue

            const expectedNormalized = normalizeText(originalWord.display)
            const currentNormalized = originalWord.normalized

            // Determine final validation result
            let finalIsValid = result.is_valid
            let finalIssueType = result.issue_type
            let finalSuggestion = result.suggested_fix_normalized

            // Check if normalization is correct
            const normalizationCorrect = (currentNormalized === expectedNormalized)

            if (result.issue_type === 'NORMALIZATION_MISMATCH' && normalizationCorrect) {
                // AI flagged normalization issue, but normalization is actually correct
                // This means the word itself might be invalid (not a normalization problem)
                console.log(`Auto-correcting word ${result.id}: Normalization is correct (${currentNormalized}), checking word validity`)

                // If AI still says invalid, it must be because the word itself is invalid
                if (!result.is_valid) {
                    finalIssueType = 'INVALID_WORD'
                    finalSuggestion = null
                } else {
                    // Normalization correct and word valid
                    finalIsValid = true
                    finalIssueType = null
                    finalSuggestion = null
                }
                autoCorrectedCount++
            } else if (!normalizationCorrect && result.issue_type === 'NORMALIZATION_MISMATCH') {
                // AI correctly identified normalization issue
                finalIsValid = false
                finalIssueType = 'NORMALIZATION_MISMATCH'
                finalSuggestion = expectedNormalized
            } else if (result.issue_type === 'INVALID_WORD') {
                // AI says word is invalid (not Portuguese) - trust it even if normalization is correct
                finalIsValid = false
                finalIssueType = 'INVALID_WORD'
                finalSuggestion = null
            } else if (normalizationCorrect && result.is_valid) {
                // Everything is correct
                finalIsValid = true
                finalIssueType = null
                finalSuggestion = null
            } else if (normalizationCorrect && !result.is_valid && !result.issue_type) {
                // Normalization correct but AI says invalid without specifying why
                // Assume it's an invalid word
                finalIsValid = false
                finalIssueType = 'INVALID_WORD'
                finalSuggestion = null
            }

            const status = finalIsValid ? 'Valid' : 'Invalid'
            const updateData: any = {
                status_id: status,
                last_checked_at: new Date().toISOString()
            }

            if (!finalIsValid) {
                updateData.issue_type = finalIssueType || 'UNKNOWN'
                if (finalSuggestion) {
                    updateData.suggested_normalized_fix = finalSuggestion
                }
            }

            const { data, error } = await supabase
                .from('WordValidationQueue')
                .update(updateData)
                .eq('word_id', result.id)
                .select()

            if (error) {
                console.error(`Failed to update word ${result.id}:`, error)
                updateErrors.push({ wordId: result.id, error: error.message })
            } else if (!data || data.length === 0) {
                updateErrors.push({ wordId: result.id, error: 'No rows updated' })
            } else {
                if (finalIsValid) {
                    validCount++
                } else {
                    invalidCount++
                }
            }
        }

        console.log(`Validation complete: ${validCount} valid, ${invalidCount} invalid, ${autoCorrectedCount} auto-corrected, ${updateErrors.length} errors`)

        return NextResponse.json({
            success: true,
            validated: validationResults.length,
            valid: validCount,
            invalid: invalidCount,
            autoCorrected: autoCorrectedCount,
            errors: updateErrors.length > 0 ? updateErrors : undefined
        })

    } catch (error: any) {
        console.error('Validation error:', error)

        // Mark items as failed
        try {
            const { themeId, languageId } = await request.json()

            const { data: failedItems } = await supabase
                .from('WordValidationQueue')
                .select('word_id, Word!inner(language_id, Word_Theme!inner(theme_id))')
                .eq('status_id', 'InProgress')
                .eq('Word.language_id', languageId)

            const failedIds = (failedItems as any[])
                ?.filter(item => item.Word.Word_Theme.some((wt: any) => wt.theme_id === themeId))
                .map(item => item.word_id) || []

            if (failedIds.length > 0) {
                await supabase
                    .from('WordValidationQueue')
                    .update({
                        status_id: 'Pending',
                        error_log: error.message
                    })
                    .in('word_id', failedIds)
            }
        } catch { }

        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}
