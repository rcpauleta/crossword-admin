import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
    try {
        // Get all unique theme+language combinations with pending validations
        const { data: queueItems, error: queueError } = await supabase
            .from('WordValidationQueue')
            .select(`
                word_id,
                Word!inner(
                    language_id,
                    Word_Theme!inner(theme_id)
                )
            `)
            .eq('status_id', 'Pending')

        if (queueError) throw queueError

        if (!queueItems || queueItems.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No pending validations',
                processed: 0
            })
        }

        // Get unique theme+language combinations
        const combos = new Map<string, {themeId: number, languageId: string}>()
        
        for (const item of (queueItems as any[])) {
            for (const wt of item.Word.Word_Theme) {
                const key = `${wt.theme_id}_${item.Word.language_id}`
                if (!combos.has(key)) {
                    combos.set(key, {
                        themeId: wt.theme_id,
                        languageId: item.Word.language_id
                    })
                }
            }
        }

        console.log(`Processing ${combos.size} theme+language combinations...`)

        let totalValidated = 0
        let totalValid = 0
        let totalInvalid = 0
        let failures = 0

        // Process each combination
        for (const combo of combos.values()) {
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/word-validation/validate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        themeId: combo.themeId,
                        languageId: combo.languageId
                    })
                })

                const result = await response.json()

                if (result.success) {
                    totalValidated += result.validated || 0
                    totalValid += result.valid || 0
                    totalInvalid += result.invalid || 0
                } else {
                    failures++
                    console.error(`Validation failed for theme ${combo.themeId}, language ${combo.languageId}:`, result.error)
                }

                // Small delay between batches to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500))

            } catch (error) {
                console.error(`Error processing theme ${combo.themeId}, language ${combo.languageId}:`, error)
                failures++
            }
        }

        return NextResponse.json({
            success: true,
            processed: combos.size,
            validated: totalValidated,
            valid: totalValid,
            invalid: totalInvalid,
            failures
        })

    } catch (error: any) {
        console.error('Auto-validation error:', error)
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}
