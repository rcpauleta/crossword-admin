type ChatCompletionResult = {
  success: boolean
  content: string
  error?: string
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export async function callOpenRouter(
  systemPrompt: string,
  userPrompt: string,
  model: string = 'openai/gpt-4o-mini'
): Promise<ChatCompletionResult> {
  try {
    const response = await fetch('/api/openrouter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        systemPrompt,
        userPrompt,
        model
      })
    })

    const data = await response.json()
    return data
  } catch (error: any) {
    return {
      success: false,
      content: '',
      error: `Request failed: ${error.message}`
    }
  }
}

export async function testOpenRouterConnection(): Promise<boolean> {
  const result = await callOpenRouter(
    'You are a helpful assistant.',
    'Say "Hello" if you can read this.',
    'openai/gpt-4o-mini'
  )
  
  return result.success
}
