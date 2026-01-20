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
    const { languageISO, limit = 1000, minLength = 3, maxLength = 15 } = await request.json()

    if (!languageISO) {
        return NextResponse.json({ error: 'Language ISO required' }, { status: 400 })
    }

    try {
        // Verify language exists
        const { data: language, error: langError } = await supabase
            .from('Language')
            .select('ISO, name')
            .eq('ISO', languageISO)
            .single()

        if (langError || !language) {
            return NextResponse.json({ error: 'Language not found' }, { status: 404 })
        }

        // Get all words from dictionary
        console.log(`Loading dictionary for ${languageISO}...`)
        const allWords = await dictionaryService.getAllWords(languageISO)
        console.log(`Found ${allWords.length} words in dictionary`)

        // Filter: only words within length range, no special chars
        const validWords = allWords.filter(word => {
            const len = word.length
            return len >= minLength &&
                len <= maxLength &&
                /^[a-zA-ZÀ-ÿ]+$/.test(word) &&
                word.toLowerCase() === word // Avoid proper nouns
        })

        console.log(`Filtered to ${validWords.length} valid words`)

        // Deduplicate by normalized form FIRST (before checking database)
        const uniqueWordsMap = new Map<string, string>()
        for (const word of validWords) {
            const normalized = normalizeText(word)
            if (!uniqueWordsMap.has(normalized)) {
                uniqueWordsMap.set(normalized, word)
            }
        }
        const totalUniqueInDictionary = uniqueWordsMap.size

        // Get existing words to avoid duplicates - FETCH ALL (remove default limit)
        const allExistingWords = []
        let from = 0
        const batchSize = 1000

        while (true) {
            const { data: batch, error } = await supabase
                .from('Word')
                .select('normalized_text')
                .eq('language_id', languageISO)
                .range(from, from + batchSize - 1)

            if (error) {
                console.error('Error fetching existing words:', error)
                break
            }

            if (!batch || batch.length === 0) break

            allExistingWords.push(...batch)

            if (batch.length < batchSize) break // Last batch

            from += batchSize
        }

        const existingSet = new Set(allExistingWords.map(w => w.normalized_text))
        console.log(`Found ${existingSet.size} existing words in database (fetched in ${Math.ceil(allExistingWords.length / batchSize)} batches)`)

        // Filter out words already in database
        const wordsToImport = Array.from(uniqueWordsMap.entries())
            .filter(([normalized]) => !existingSet.has(normalized))

        console.log(`After filtering: ${wordsToImport.length} words to import`)

        const remainingCount = wordsToImport.length
        const newWords = wordsToImport.slice(0, limit).map(([_, word]) => word)

        console.log(`Importing ${newWords.length} unique new words (${remainingCount} remaining)...`)

        if (newWords.length === 0) {
            return NextResponse.json({
                success: true,
                imported: 0,
                message: 'All available words have been imported! 🎉',
                stats: {
                    totalInDictionary: allWords.length,
                    totalUniqueInDictionary,
                    alreadyInDatabase: existingSet.size,
                    remaining: 0,
                    percentComplete: 100
                }
            })
        }

        // Prepare words to insert
        const wordsToInsert = newWords.map(word => ({
            display_text: word,
            normalized_text: normalizeText(word),
            language_id: languageISO
        }))

        console.log(`Attempting to insert ${wordsToInsert.length} words...`)

        // Use regular insert since we've already filtered duplicates
        const { data: insertedWords, error: insertError } = await supabase
            .from('Word')
            .insert(wordsToInsert)
            .select()

        if (insertError) {
            console.error('Insert error:', insertError)

            // If we get duplicate key error, it means our filtering didn't work
            if (insertError.message.includes('duplicate key')) {
                console.log('Duplicate detected, switching to batch insert with error handling...')

                // Try inserting one by one to skip duplicates
                let successCount = 0
                for (const wordData of wordsToInsert) {
                    const { error } = await supabase
                        .from('Word')
                        .insert([wordData])

                    if (!error) {
                        successCount++
                    } else if (!error.message.includes('duplicate key')) {
                        console.error('Unexpected error:', error)
                    }
                }

                console.log(`Inserted ${successCount} words (skipped duplicates)`)

                // Get updated count
                const { count: totalCount } = await supabase
                    .from('Word')
                    .select('*', { count: 'exact', head: true })
                    .eq('language_id', languageISO)

                const newRemaining = remainingCount - successCount
                const percentComplete = Math.round(((totalCount || 0) / totalUniqueInDictionary) * 100)

                return NextResponse.json({
                    success: true,
                    imported: successCount,
                    message: newRemaining > 0
                        ? `Imported ${successCount} words. ${newRemaining} more available!`
                        : 'All available words imported! 🎉',
                    stats: {
                        totalInDictionary: allWords.length,
                        totalUniqueInDictionary,
                        alreadyInDatabase: totalCount || 0,
                        remaining: newRemaining,
                        percentComplete
                    }
                })
            }

            return NextResponse.json({ error: insertError.message }, { status: 500 })
        }

        console.log(`Successfully inserted ${insertedWords?.length || 0} words`)

        // Get updated count
        const { count: totalCount } = await supabase
            .from('Word')
            .select('*', { count: 'exact', head: true })
            .eq('language_id', languageISO)

        const newRemaining = remainingCount - (insertedWords?.length || 0)
        const percentComplete = Math.round(((totalCount || 0) / totalUniqueInDictionary) * 100)

        return NextResponse.json({
            success: true,
            imported: insertedWords?.length || 0,
            message: newRemaining > 0
                ? `Imported ${insertedWords?.length} words. ${newRemaining} more available!`
                : 'All available words imported! 🎉',
            stats: {
                totalInDictionary: allWords.length,
                totalUniqueInDictionary,
                alreadyInDatabase: totalCount || 0,
                remaining: newRemaining,
                percentComplete
            }
        })

    } catch (error) {
        console.error('Import error:', error)
        return NextResponse.json({
            error: `Failed to import words: ${error}`
        }, { status: 500 })
    }
}
