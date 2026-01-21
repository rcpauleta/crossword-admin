// app/api/clues/generate-batch/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini'
const OPENROUTER_MAX_TOKENS = parseInt(process.env.OPENROUTER_MAX_TOKENS || '2000')
const OPENROUTER_TEMPERATURE = parseFloat(process.env.OPENROUTER_TEMPERATURE || '0.7')
const DEFAULT_BATCH_SIZE = parseInt(process.env.CLUE_BATCH_SIZE || '100')

async function parseAIResponse(rawContent: string): Promise<any[] | null> {
    // Try multiple parsing strategies

    // Strategy 1: Direct parse
    try {
        return JSON.parse(rawContent)
    } catch (e) {
        console.log('Direct parse failed, trying extraction...')
    }

    // Strategy 2: Extract JSON array from markdown/text
    try {
        const jsonMatch = rawContent.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0])
        }
    } catch (e) {
        console.log('Array extraction failed, trying code block...')
    }

    // Strategy 3: Extract from code blocks
    try {
        const codeBlockMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (codeBlockMatch) {
            return JSON.parse(codeBlockMatch[1])
        }
    } catch (e) {
        console.log('Code block extraction failed')
    }

    // Strategy 4: Try to fix common JSON errors
    try {
        // Replace single quotes with double quotes
        let fixed = rawContent.replace(/'/g, '"')
        // Remove trailing commas
        fixed = fixed.replace(/,(\s*[}\]])/g, '$1')
        return JSON.parse(fixed)
    } catch (e) {
        console.log('JSON repair failed')
    }

    return null
}

export async function POST(request: NextRequest) {
    try {
        const { languageId, difficulty, batchSize } = await request.json()
        const targetLanguage = languageId || 'PT-PT'
        const targetDifficulty = difficulty || 'medium'
        const targetBatchSize = batchSize || DEFAULT_BATCH_SIZE
        const MAX_RETRIES = 3

        console.log(`Using model: ${OPENROUTER_MODEL} (temp: ${OPENROUTER_TEMPERATURE}, max_tokens: ${OPENROUTER_MAX_TOKENS})`)

        // Use the Postgres function to get words without clues
        const { data: words, error: wordsError } = await supabase
            .rpc('get_words_without_clues', {
                lang_id: targetLanguage,
                diff_level: targetDifficulty,
                word_limit: targetBatchSize
            })

        if (wordsError) {
            console.error('Error fetching words:', wordsError)
            return NextResponse.json(
                { success: false, error: `Database error: ${wordsError.message}` },
                { status: 500 }
            )
        }

        if (!words || words.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: `No words without ${targetDifficulty} clues found for ${targetLanguage}. All words have clues!`,
                    allComplete: true
                },
                { status: 400 }
            )
        }

        console.log(`Generating ${targetDifficulty} clues for ${words.length} words in ${targetLanguage}`)

        const prompt = `Generate exactly ${words.length} crossword clues in ${targetLanguage} for these words.
Return ONLY a valid JSON array with no extra text, markdown, or explanation.

Words: ${words.map((w: any) => w.display_text).join(', ')}

Format:
[{"word":"palavra","clue":"definição curta"}]

Rules:
- ${targetDifficulty === 'easy' ? 'Simple, direct definitions' : targetDifficulty === 'medium' ? 'Moderate difficulty with some wordplay' : 'Cryptic clues with wordplay'}
- Maximum 80 characters per clue
- ${targetLanguage} language only
- One clue per word
- Valid JSON array only - no markdown, no explanations`

        let lastError = null

        // Retry logic
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                console.log(`Attempt ${attempt}/${MAX_RETRIES}...`)

                const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: OPENROUTER_MODEL,
                        messages: [
                            {
                                role: 'user',
                                content: prompt
                            }
                        ],
                        temperature: OPENROUTER_TEMPERATURE,
                        max_tokens: OPENROUTER_MAX_TOKENS
                    })
                })

                if (!response.ok) {
                    const errorText = await response.text()
                    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`)
                }

                const aiResult = await response.json()
                const rawContent = aiResult.choices[0]?.message?.content

                if (!rawContent) {
                    throw new Error('Empty response from AI')
                }

                console.log(`Raw AI response (first 200 chars): ${rawContent.substring(0, 200)}`)

                // Try to parse with multiple strategies
                const generatedClues = await parseAIResponse(rawContent)

                if (!generatedClues || !Array.isArray(generatedClues)) {
                    throw new Error('Could not parse valid JSON array from response')
                }

                if (generatedClues.length === 0) {
                    throw new Error('AI returned empty array')
                }

                console.log(`✅ Successfully parsed ${generatedClues.length} clues`)

                // Save clues to database
                const cluesToInsert = generatedClues
                    .filter(item => item.word && item.clue)
                    .map((item: any) => {
                        const word = words.find((w: any) =>
                            w.display_text.toLowerCase() === item.word.toLowerCase() ||
                            w.normalized_text.toLowerCase() === item.word.toLowerCase()
                        )

                        if (!word) {
                            console.warn(`Word not found: ${item.word}`)
                            return null
                        }

                        return {
                            word_id: word.id,
                            clue_text: item.clue,
                            language_id: targetLanguage,
                            difficulty_level: targetDifficulty
                        }
                    })
                    .filter(Boolean)

                if (cluesToInsert.length === 0) {
                    throw new Error('No valid clues to insert after filtering')
                }

                console.log(`Inserting ${cluesToInsert.length} clues...`)

                // Use upsert to handle any race conditions
                const { data: insertedClues, error: insertError } = await supabase
                    .from('Clue')
                    .upsert(cluesToInsert, {
                        onConflict: 'word_id,difficulty_level',
                        ignoreDuplicates: false
                    })
                    .select()

                if (insertError) {
                    console.error('Database insert error:', insertError)
                    throw insertError
                }

                console.log(`✅ Successfully inserted ${insertedClues?.length || 0} clues`)

                return NextResponse.json({
                    success: true,
                    cluesGenerated: insertedClues?.length || 0,
                    totalWords: words.length,
                    attempt: attempt
                })

            } catch (error: any) {
                lastError = error
                console.error(`Attempt ${attempt} failed:`, error.message)

                if (attempt < MAX_RETRIES) {
                    console.log(`Retrying in 2 seconds...`)
                    await new Promise(resolve => setTimeout(resolve, 2000))
                }
            }
        }

        // All retries failed
        return NextResponse.json(
            {
                success: false,
                error: `Failed after ${MAX_RETRIES} attempts: ${lastError?.message}`,
                lastError: lastError?.message
            },
            { status: 500 }
        )

    } catch (error: any) {
        console.error('Clue generation error:', error)
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}
