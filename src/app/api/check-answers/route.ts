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

const getSystemPrompt = () => `You are an expert at evaluating multiple-choice test answers. Your task is to determine the CORRECT answer for each question and check if the user's answer matches.

CRITICAL INSTRUCTIONS:
1. Read each question carefully
2. Determine which option (0, 1, 2, or 3) is the CORRECT answer based on knowledge
3. Compare with the user's answer
4. Provide clear explanations

IMPORTANT: You must know or determine the correct answer. Do NOT just mark things as correct/incorrect randomly. Use your knowledge to find the right answer.

Return ONLY valid JSON:
{
  "results": [
    {
      "questionId": 1,
      "isCorrect": true,
      "correctAnswer": 0,
      "explanation": "Clear explanation of why this is the correct answer"
    }
  ]
}

Rules:
- isCorrect: true if userAnswer matches the correct answer, false otherwise
- correctAnswer: the INDEX (0-3) of the actually correct option
- If userAnswer is null, isCorrect is false
- Provide educational explanations`

export async function POST(request: NextRequest) {
  try {
    const body: CheckAnswersRequest = await request.json()
    const { questions, provider, apiKey } = body

    if (!questions || questions.length === 0) {
      return NextResponse.json({ error: 'Questions are required' }, { status: 400 })
    }

    const systemPrompt = getSystemPrompt()
    const userPrompt = `Please evaluate these test answers. For each question, determine the CORRECT answer based on your knowledge, then check if the user's answer is correct.

Questions to evaluate:
 ${JSON.stringify(questions, null, 2)}

Respond with the JSON structure. Make sure to provide the actual correct answer for each question.`

    let response: any

    if (apiKey) {
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
              temperature: 0.1,
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
                temperature: 0.1,
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
              temperature: 0.1,
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
              model: 'z-ai/glm5',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
              ],
              temperature: 0.1,
              max_tokens: 4000
            })
          }).then(res => res.json())
          break

        default:
          return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
      }
    } else {
      const zai = await ZAI.create()
      response = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        model: provider === 'openai' ? 'gpt-4o' : provider === 'gemini' ? 'gemini-2.0-flash' : 'deepseek-chat',
        temperature: 0.1,
        max_tokens: 4000
      })
    }

    const content = response.choices?.[0]?.message?.content

    if (!content) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    try {
      let jsonContent = content
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        jsonContent = jsonMatch[1].trim()
      }
      if (!jsonContent.startsWith('{')) {
        const jsonStart = content.indexOf('{')
        const jsonEnd = content.lastIndexOf('}')
        if (jsonStart !== -1 && jsonEnd !== -1) {
          jsonContent = content.substring(jsonStart, jsonEnd + 1)
        }
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
