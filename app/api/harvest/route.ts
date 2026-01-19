import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Configuration
const MAX_EXISTING_WORDS = 150 // Limit words sent to AI
const MAX_DUPLICATE_RATIO = 0.3 // Stop if >30% duplicates
const MAX_CONSECUTIVE_DUPLICATES = 5 // Stop after 5 consecutive duplicates

export async function POST(request: NextRequest) {
    try {
        const { jobId, autoRun = false } = await request.json()

        // 1. Fetch job with all related data
        const { data: job, error: jobError } = await supabase
            .from('HarvestJob')
            .select(`
        *,
        Theme!inner(id, name, system_instructions, user_prompt, target_word_count),
        Language!inner(ISO, name),
        Difficulty!inner(id, name, prompt_name, prompt_descri, order)
      `)
            .eq('id', jobId)
            .single()

        if (jobError || !job) {
            return NextResponse.json(
                { success: false, error: 'Job not found' },
                { status: 404 }
            )
        }

        // Check if already completed
        if (job.status_id === 'Completed') {
            return NextResponse.json({
                success: true,
                stats: {
                    newWords: 0,
                    totalWords: job.current_word_count,
                    targetWords: job.Theme.target_word_count,
                    isComplete: true,
                    reason: 'Already completed'
                }
            })
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

        // Get existing words (CAPPED at MAX_EXISTING_WORDS)
        const { data: existingWords } = await supabase
            .from('Word')
            .select('normalized_text')
            .eq('language_id', job.Language.ISO)
            .limit(MAX_EXISTING_WORDS)

        const existingWordsList = existingWords?.map(w => w.normalized_text).slice(0, MAX_EXISTING_WORDS).join(', ') || 'None'

        // 3. Build and replace prompts
        const systemPrompt = job.Theme.system_instructions || 'You are a helpful assistant.'
        let userPrompt = job.Theme.user_prompt || ''

        userPrompt = userPrompt
            .replace(/\{\{NUMBER_OF_WORDS\}\}/gi, wordsPerRequest.toString())
            .replace(/\{\{LANGUAGE_ISO\}\}/gi, job.Language.ISO)
            .replace(/\{\{LANGUAGE\}\}/gi, job.Language.name)
            .replace(/\{\{DIFFICULTY_LEVEL\}\}/gi, job.Difficulty.order?.toString() || '1')
            .replace(/\{\{DIFFICULTY_LABEL\}\}/gi, job.Difficulty.name)
            .replace(/\{\{DIFFICULTY_ID\}\}/gi, job.Difficulty.id)
            .replace(/\{\{DIFFICULTY_NAME\}\}/gi, job.Difficulty.prompt_name || job.Difficulty.name)
            .replace(/\{\{DIFFICULTY_DESCRIPTION\}\}/gi, job.Difficulty.prompt_descri || '')
            .replace(/\{\{EXISTING_WORDS_LIST\}\}/gi, existingWordsList)

        // 4. Call OpenRouter
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

        // 5. Parse JSON response
        let wordsData
        try {
            const jsonMatch = content.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/) || content.match(/(\[[\s\S]*?\])/)
            const jsonString = jsonMatch ? jsonMatch[1] : content
            wordsData = JSON.parse(jsonString)
        } catch (parseError) {
            throw new Error(`Failed to parse AI response as JSON`)
        }

        if (!Array.isArray(wordsData) || wordsData.length === 0) {
            throw new Error('AI response is not a valid array of words')
        }

        // 6. Process and insert words WITH DUPLICATE TRACKING
        let newWordsCount = 0
        let duplicatesCount = 0
        let consecutiveDuplicates = 0

        for (const wordData of wordsData) {
            const normalizedText = wordData.word?.toUpperCase().trim()
            if (!normalizedText) continue

            const displayText = wordData.display_text || wordData.word
            const clueText = wordData.clue
            const wordDifficulty = wordData.word_difficulty || job.Difficulty.order || 1

            // Map difficulty
            const { data: difficultyMapping } = await supabase
                .from('Difficulty')
                .select('id')
                .eq('order', wordDifficulty)
                .eq('is_active', true)
                .single()

            const mappedDifficultyId = difficultyMapping?.id || job.Difficulty.id

            // Check if word exists
            const { data: existingWord } = await supabase
                .from('Word')
                .select('id, difficulty_id')
                .eq('normalized_text', normalizedText)
                .eq('language_id', job.Language.ISO)
                .single()

            let wordId

            if (existingWord) {
                duplicatesCount++
                consecutiveDuplicates++

                // Stop if too many consecutive duplicates
                if (consecutiveDuplicates >= MAX_CONSECUTIVE_DUPLICATES) {
                    console.log(`⚠️ Too many consecutive duplicates (${consecutiveDuplicates}), stopping harvest`)
                    break
                }

                if (mappedDifficultyId < existingWord.difficulty_id) {
                    await supabase
                        .from('Word')
                        .update({
                            difficulty_id: mappedDifficultyId,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', existingWord.id)
                }
                wordId = existingWord.id
            } else {
                consecutiveDuplicates = 0 // Reset on new word

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
                        .then(() => { }) // Ignore conflicts
                }
            }
    
            // 7. Calculate duplicate ratio
            const totalProcessed = newWordsCount + duplicatesCount
            const duplicateRatio = totalProcessed > 0 ? duplicatesCount / totalProcessed : 0

            // 8. Update job status
            const currentWordCount = (job.current_word_count || 0) + newWordsCount
            const targetWordCount = job.Theme.target_word_count || 500
            const isComplete = currentWordCount >= targetWordCount || duplicateRatio > MAX_DUPLICATE_RATIO

            const newStatus = isComplete ? 'Completed' : 'Pending'

            await supabase
                .from('HarvestJob')
                .update({
                    status_id: newStatus,
                    current_word_count: currentWordCount,
                    consecutive_duplicates: consecutiveDuplicates,
                    last_run_at: new Date().toISOString()
                })
                .eq('id', jobId)

            const stopReason =
                duplicateRatio > MAX_DUPLICATE_RATIO ? 'Duplicate ratio too high' :
                    consecutiveDuplicates >= MAX_CONSECUTIVE_DUPLICATES ? 'Too many consecutive duplicates' :
                        currentWordCount >= targetWordCount ? 'Target word count reached' : null

            return NextResponse.json({
                success: true,
                stats: {
                    newWords: newWordsCount,
                    duplicates: duplicatesCount,
                    duplicateRatio: (duplicateRatio * 100).toFixed(1) + '%',
                    totalWords: currentWordCount,
                    targetWords: targetWordCount,
                    isComplete,
                    stopReason
                }
            })
        } catch (error: any) {
            console.error('Harvest error:', error)

            try {
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
            } catch (parseError) {
                console.error('Could not parse jobId from request')
            }

            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500 }
            )
        }
    }

