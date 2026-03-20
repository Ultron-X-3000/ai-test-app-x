import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

interface CheckAnswersRequest {
  questions: Array<{
    id: number
    question: string
    options: string[]
    userAnswer: number | null
  }>
  provider: 'openai' | 'gemini' | 'deepseek' | 'nvidia'
  apiKey?: string
}

const getSystemPrompt = () => `You are an expert at evaluating test answers. Your task is to determine if the user's selected answer is correct for each question.

IMPORTANT: You must respond with ONLY valid JSON, no additional text. The JSON must follow this exact structure:
{
  "results": [
    {
      "questionId": 1,
      "isCorrect": true,
      "correctAnswer": 0,
      "explanation": "Brief explanation of why the answer is correct or incorrect"
    }
  ]
}

Rules:
- For each question, evaluate the user's answer against the correct answer
- If the user's answer is correct, set isCorrect to true
- If the user's answer is incorrect, set isCorrect to false and provide the correct answer index
- If the user didn't answer (userAnswer is null), set isCorrect to false and provide the correct answer
- Provide a brief explanation for each answer
- Be thorough and accurate in your evaluation`

export async function POST(request: NextRequest) {
  try {
    const body: CheckAnswersRequest = await request.json()
    const { questions, provider, apiKey } = body

    if (!questions || questions.length === 0) {
      return NextResponse.json({ error: 'Questions are required' }, { status: 400 })
    }

    const systemPrompt = getSystemPrompt()
    const userPrompt = `Please evaluate these test answers and provide the correct answers with explanations:

${JSON.stringify(questions, null, 2)}

Respond with the JSON structure specified.`

    let response: any

    if (apiKey) {
      // Use custom API key
      switch (provider) {
        case 'openai':
          response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: 'gpt-4o',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
              ],
              temperature: 0.3,
              max_tokens: 4000
            })
          }).then(res => res.json())
          break

        case 'gemini':
          response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              contents: [{
                parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
              }],
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 4000
              }
            })
          }).then(res => res.json())
          if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
            response = {
              choices: [{
                message: {
                  content: response.candidates[0].content.parts[0].text
                }
              }]
            }
          }
          break

        case 'deepseek':
          response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: 'deepseek-chat',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
              ],
              temperature: 0.3,
              max_tokens: 4000
            })
          }).then(res => res.json())
          break

        case 'nvidia':
          response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: 'meta/llama-3.1-405b-instruct',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
              ],
              temperature: 0.3,
              max_tokens: 4000
            })
          }).then(res => res.json())
          break

        default:
          return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
      }
    } else {
      // Use z-ai-web-dev-sdk
      const zai = await ZAI.create()

      response = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        model: provider === 'openai' ? 'gpt-4o' : provider === 'gemini' ? 'gemini-2.0-flash' : 'deepseek-chat',
        temperature: 0.3,
        max_tokens: 4000
      })
    }

    const content = response.choices?.[0]?.message?.content

    if (!content) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    // Parse the JSON response
    try {
      let jsonContent = content
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        jsonContent = jsonMatch[1].trim()
      }

      const data = JSON.parse(jsonContent)
      return NextResponse.json(data)
    } catch {
      console.error('Failed to parse AI response:', content)
      return NextResponse.json({
        error: 'Failed to parse AI response',
        raw: content
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('Check answers error:', error)
    return NextResponse.json({
      error: error.message || 'Failed to check answers'
    }, { status: 500 })
  }
}
