import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
    try {
        const { jobId } = await request.json()

        // 1. Fetch job with all related data
        const { data: job, error: jobError } = await supabase
            .from('HarvestJob')
            .select(`
        *,
        Theme!inner(id, name, system_instructions, user_prompt, target_word_count),
        Language!inner(ISO, name),
        Difficulty!inner(id, name, prompt_name, prompt_description, order)
      `)
            .eq('id', jobId)
            .single()

        if (jobError || !job) {
            return NextResponse.json(
                { success: false, error: 'Job not found' },
                { status: 404 }
            )
        }

        // Update status to Running
        await supabase
            .from('HarvestJob')
            .update({
                status_id: 'Running',
                last_run_at: new Date().toISOString()
            })
            .eq('id', jobId)

        // 2. Build prompts with placeholder replacement
        const wordsPerRequest = parseInt(process.env.HARVEST_WORDS_PER_REQUEST || '50')

        // Get existing words for this language to avoid duplicates
        const { data: existingWords } = await supabase
            .from('Word')
            .select('normalized_text')
            .eq('language_id', job.Language.ISO)

        const existingWordsList = existingWords?.map(w => w.normalized_text).join(', ') || 'None'

        const systemPrompt = job.Theme.system_instructions || 'You are a helpful assistant.'
        let userPrompt = job.Theme.user_prompt || ''

        // Replace placeholders
        userPrompt = userPrompt
            .replace(/\{\{NUMBER_OF_WORDS\}\}/gi, wordsPerRequest.toString())
            .replace(/\{\{LANGUAGE_ISO\}\}/gi, job.Language.ISO)
            .replace(/\{\{LANGUAGE\}\}/gi, job.Language.name)
            .replace(/\{\{DIFFICULTY_LEVEL\}\}/gi, job.Difficulty.order?.toString() || '1')
            .replace(/\{\{DIFFICULTY_LABEL\}\}/gi, job.Difficulty.name)
            .replace(/\{\{DIFFICULTY_ID\}\}/gi, job.Difficulty.id)
            .replace(/\{\{DIFFICULTY_NAME\}\}/gi, job.Difficulty.prompt_name || job.Difficulty.name)
            .replace(/\{\{DIFFICULTY_DESCRIPTION\}\}/gi, job.Difficulty.prompt_description || '')
            .replace(/\{\{EXISTING_WORDS_LIST\}\}/gi, existingWordsList)

        // 3. Call OpenRouter
        const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
                'X-Title': 'Crossword Harvest'
            },
            body: JSON.stringify({
                model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
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

        // 4. Parse JSON response
        let wordsData
        try {
            // Try to extract JSON from markdown code blocks if present
            const jsonMatch = content.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/) || content.match(/(\[[\s\S]*?\])/)
            const jsonString = jsonMatch ? jsonMatch[1] : content
            wordsData = JSON.parse(jsonString)
        } catch (parseError) {
            throw new Error(`Failed to parse AI response as JSON: ${parseError}`)
        }

        if (!Array.isArray(wordsData) || wordsData.length === 0) {
            throw new Error('AI response is not a valid array of words')
        }

        // 5. Process and insert words
        let newWordsCount = 0
        let updatedWordsCount = 0
        let duplicatesCount = 0

        for (const wordData of wordsData) {
            const normalizedText = wordData.word?.toUpperCase().trim()
            if (!normalizedText) continue

            const displayText = wordData.display_text || wordData.word
            const clueText = wordData.clue
            const wordDifficulty = wordData.word_difficulty || job.Difficulty.order || 1

            // Map word_difficulty (1-5) to difficulty_id using order
            const { data: difficultyMapping } = await supabase
                .from('Difficulty')
                .select('id')
                .eq('order', wordDifficulty)
                .eq('is_active', true)
                .single()

            const mappedDifficultyId = difficultyMapping?.id || job.Difficulty.id

            // Upsert Word
            const { data: existingWord } = await supabase
                .from('Word')
                .select('id, difficulty_id')
                .eq('normalized_text', normalizedText)
                .eq('language_id', job.Language.ISO)
                .single()

            let wordId

            if (existingWord) {
                // Word exists - update if new difficulty is lower
                if (mappedDifficultyId < existingWord.difficulty_id) {
                    await supabase
                        .from('Word')
                        .update({
                            difficulty_id: mappedDifficultyId,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', existingWord.id)
                    updatedWordsCount++
                } else {
                    duplicatesCount++
                }
                wordId = existingWord.id
            } else {
                // Insert new word
                const { data: newWord, error: wordError } = await supabase
                    .from('Word')
                    .insert({
                        normalized_text: normalizedText,
                        display_text: displayText,
                        length: normalizedText.length,
                        language_id: job.Language.ISO,
                        difficulty_id: mappedDifficultyId
                    })
                    .select('id')
                    .single()

                if (wordError) {
                    console.error('Error inserting word:', wordError)
                    continue
                }

                wordId = newWord.id
                newWordsCount++
            }

            // Insert Word_Theme link
            await supabase
                .from('Word_Theme')
                .insert({
                    word_id: wordId,
                    theme_id: job.Theme.id
                })
                .select()
                .single()
                .then(() => { }) // Ignore conflicts

            // Insert Clue
            if (clueText) {
                await supabase
                    .from('Clue')
                    .insert({
                        word_id: wordId,
                        clue: clueText,
                        theme_id: job.Theme.id,
                        language_id: job.Language.ISO,
                        difficulty_id: job.Difficulty.id
                    })
                    .select()
                    .single()
                    .then(() => { }) // Ignore conflicts
            }
        }

        // 6. Update job status
        const currentWordCount = (job.current_word_count || 0) + newWordsCount
        const targetWordCount = job.Theme.target_word_count || 500
        const isComplete = currentWordCount >= targetWordCount

        await supabase
            .from('HarvestJob')
            .update({
                status_id: isComplete ? 'Completed' : 'Pending',
                current_word_count: currentWordCount,
                consecutive_duplicates: duplicatesCount,
                last_run_at: new Date().toISOString()
            })
            .eq('id', jobId)

        return NextResponse.json({
            success: true,
            stats: {
                newWords: newWordsCount,
                updatedWords: updatedWordsCount,
                duplicates: duplicatesCount,
                totalWords: currentWordCount,
                targetWords: targetWordCount,
                isComplete
            }
        })

    } catch (error: any) {
        console.error('Harvest error:', error)

        // Update job to failed status
        const { jobId } = await request.json()
        if (jobId) {
            await supabase
                .from('HarvestJob')
                .update({
                    status_id: 'Failed',
                    error_log: error.message
                })
                .eq('id', jobId)
        }

        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}
