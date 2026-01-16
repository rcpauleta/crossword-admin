import { NextRequest, NextResponse } from 'next/server'

type OpenRouterMessage = {
    role: 'system' | 'user' | 'assistant'
    content: string
}

type OpenRouterRequest = {
    model: string
    messages: OpenRouterMessage[]
}

export async function POST(request: NextRequest) {
    try {
        const { systemPrompt, userPrompt, model } = await request.json()

        const apiKey = process.env.OPENROUTER_API_KEY

        if (!apiKey) {
            return NextResponse.json(
                { success: false, error: 'OpenRouter API key not configured' },
                { status: 500 }
            )
        }

        const messages: OpenRouterMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ]

        const requestBody: OpenRouterRequest = {
            model: model || process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
            messages
        }

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
                'X-Title': 'Crossword Admin'
            },
            body: JSON.stringify(requestBody)
        })

        if (!response.ok) {
            const errorText = await response.text()
            return NextResponse.json(
                { success: false, error: `OpenRouter API error: ${response.status} - ${errorText}` },
                { status: response.status }
            )
        }

        const data = await response.json()

        if (!data.choices || data.choices.length === 0) {
            return NextResponse.json(
                { success: false, error: 'No response from OpenRouter' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            content: data.choices[0].message.content,
            usage: data.usage
        })
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: `Request failed: ${error.message}` },
            { status: 500 }
        )
    }
}
