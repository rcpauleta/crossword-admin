import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const BATCH_SIZE = 50

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

CRITICAL NORMALIZATION RULES:
The "normalized" field MUST be the "display" field with these transformations ONLY:
1. Convert to UPPERCASE
2. Remove ALL diacritics/accents (á→A, ã→A, ç→C, é→E, í→I, ó→O, ú→U, etc.)
3. NO other changes allowed (no translation, no spelling changes, no additions)

EXAMPLES OF CORRECT NORMALIZATION:
- Display: "Circulação" → Normalized: "CIRCULACAO" ✓ VALID
- Display: "José" → Normalized: "JOSE" ✓ VALID
- Display: "São Paulo" → Normalized: "SAO PAULO" ✓ VALID
- Display: "Música" → Normalized: "MUSICA" ✓ VALID

EXAMPLES OF INCORRECT NORMALIZATION:
- Display: "Circulação" → Normalized: "CIRCULAÇÃO" ✗ INVALID (accents not removed)
- Display: "José" → Normalized: "JOSEPH" ✗ INVALID (translation, not normalization)
- Display: "acordeão" → Normalized: "ACORDEON" ✗ INVALID (should be "ACORDEAO")

VALIDITY CHECK:
Also check if "display" is a valid single word in ${languageName}:
- Must be ONE word (no phrases like "São Paulo" unless it's a proper compound word)
- No concatenations or non-words
- No foreign language words

OUTPUT JSON FORMAT (return for EVERY input word):
[
  {
    "id": 123,
    "is_valid": true,  // true if normalized matches display with accents removed + uppercase
    "issue_type": null,  // or "NORMALIZATION_MISMATCH" or "INVALID_WORD"
    "suggested_fix_normalized": null  // ONLY if normalization is wrong (accents not properly removed)
  }
]

IMPORTANT: 
- If "normalized" correctly removes accents and uppercases "display", mark is_valid: true
- Only suggest a fix if the normalization is WRONG (e.g., accents not removed, wrong characters)
- Return exactly ${wordList.length} results in the same order as input`

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

        for (const result of validationResults) {
            const status = result.is_valid ? 'Valid' : 'Invalid'
            const updateData: any = {
                status_id: status,
                last_checked_at: new Date().toISOString()
            }

            if (!result.is_valid) {
                updateData.issue_type = result.issue_type || 'UNKNOWN'
                if (result.suggested_fix_normalized) {
                    updateData.suggested_normalized_fix = result.suggested_fix_normalized
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
                console.warn(`No rows updated for word ${result.id} - word may not be in queue`)
                updateErrors.push({ wordId: result.id, error: 'No rows updated' })
            } else {
                console.log(`Updated word ${result.id} to status ${status}`)
                if (result.is_valid) {
                    validCount++
                } else {
                    invalidCount++
                }
            }
        }

        console.log(`Validation complete: ${validCount} valid, ${invalidCount} invalid, ${updateErrors.length} errors`)

        if (updateErrors.length > 0) {
            console.error('Update errors:', updateErrors)
        }

        return NextResponse.json({
            success: true,
            validated: validationResults.length,
            valid: validCount,
            invalid: invalidCount,
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
