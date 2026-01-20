import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/supabase'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

export async function POST(request: NextRequest) {
    const { languageISO, batchSize = 100, difficulty = 'medium' } = await request.json()

    try {
        // Fetch words that DON'T have clues yet using LEFT JOIN
        const { data: wordsNeedingClues, error: queryError } = await supabase
            .rpc('get_words_without_clues', {
                lang_iso: languageISO,
                diff_level: difficulty,
                batch_limit: batchSize
            })

        if (queryError) throw queryError

        if (!wordsNeedingClues || wordsNeedingClues.length === 0) {
            return NextResponse.json({
                message: 'All words have clues! 🎉',
                generated: 0
            })
        }

        console.log(`Found ${wordsNeedingClues.length} words needing clues`)

        // Generate clues using AI (same as before)
        const wordList = wordsNeedingClues.map((w: { display_text: any }) => w.display_text).join(', ')

        const prompt = `Generate crossword clues in ${languageISO} for these words: ${wordList}

IMPORTANT: Return ONLY valid JSON array, no other text.

Format (strict JSON):
[{"word":"casa","clue":"Lugar onde vivemos"},{"word":"sol","clue":"Estrela do nosso sistema solar"}]

Requirements:
- ${difficulty === 'easy' ? 'Simple definitions' : difficulty === 'medium' ? 'Moderate difficulty' : 'Cryptic clues'}
- Under 80 characters per clue
- ${languageISO} language
- Valid JSON only`

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'openai/gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 2000
            })
        })

        const aiResult = await response.json()
        const rawContent = aiResult.choices[0].message.content

        // Extract JSON from the response (AI sometimes adds extra text)
        let generatedClues
        try {
            // Try to parse directly first
            generatedClues = JSON.parse(rawContent)
        } catch (e) {
            // If that fails, try to extract JSON array from the content
            console.log('Raw AI response:', rawContent)

            const jsonMatch = rawContent.match(/\[[\s\S]*\]/)
            if (jsonMatch) {
                try {
                    generatedClues = JSON.parse(jsonMatch[0])
                } catch (e2) {
                    console.error('Failed to parse extracted JSON:', jsonMatch[0])
                    // Skip this batch and continue
                    return NextResponse.json({
                        success: true,
                        generated: 0,
                        message: 'Skipped batch due to AI response parsing error',
                        error: 'Invalid JSON from AI'
                    })
                }
            } else {
                console.error('No JSON array found in response:', rawContent)
                return NextResponse.json({
                    success: true,
                    generated: 0,
                    message: 'Skipped batch due to AI response format error',
                    error: 'No JSON in AI response'
                })
            }
        }

        // Validate that we got an array
        if (!Array.isArray(generatedClues)) {
            console.error('AI returned non-array:', generatedClues)
            return NextResponse.json({
                success: true,
                generated: 0,
                message: 'Skipped batch - AI returned invalid format'
            })
        }

        // 4. Save clues to database
        const cluesToInsert = generatedClues.map((item: any) => {
            const word = wordsNeedingClues.find((w: { display_text: string }) =>
                w.display_text.toLowerCase() === item.word.toLowerCase()
            )
            return {
                word_id: word?.id,
                clue_text: item.clue,
                difficulty_level: difficulty
            }
        }).filter(c => c.word_id) // Only include valid matches

        const { data: insertedClues, error } = await supabase
            .from('Clue')
            .upsert(cluesToInsert, {
                onConflict: 'word_id,difficulty_level',
                ignoreDuplicates: true  // Skip duplicates instead of throwing error
            })
            .select()

        if (error) {
            console.error('Insert error (non-fatal):', error)
            // Continue anyway - some clues may have been inserted
        }

        // Count how many were actually inserted (excluding duplicates)
        const actualInserted = insertedClues?.length || 0

        // Get updated stats
        const { count: totalWords } = await supabase
            .from('Word')
            .select('*', { count: 'exact', head: true })
            .eq('language_id', languageISO)

        const { count: totalClues } = await supabase
            .from('Clue')
            .select('word_id, Word!inner(language_id)', { count: 'exact', head: true })
            .eq('Word.language_id', languageISO)
            .eq('difficulty_level', difficulty)

        return NextResponse.json({
            success: true,
            generated: actualInserted,  // Actual new clues inserted
            message: actualInserted > 0
                ? `Generated ${actualInserted} clues`
                : 'No new clues (all words already have clues)',
            stats: {
                totalWords: totalWords || 0,
                totalClues: totalClues || 0,
                remaining: (totalWords || 0) - (totalClues || 0),
                percentComplete: Math.round(((totalClues || 0) / (totalWords || 1)) * 100)
            }
        })

    } catch (error) {
        console.error('Clue generation error:', error)
        return NextResponse.json({
            error: `Failed to generate clues: ${error}`
        }, { status: 500 })
    }
}

