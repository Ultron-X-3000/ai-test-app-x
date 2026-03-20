import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

interface GenerateTestRequest {
  images?: string[]
  provider: 'openai' | 'gemini' | 'deepseek' | 'nvidia'
  questionCount: number
  difficulty: 'easy' | 'medium' | 'hard'
  apiKey?: string
}

const getSystemPrompt = (questionCount: number, difficulty: string) => `You are an expert test creator. Create ${questionCount} high-quality multiple-choice questions based on the provided images.

CRITICAL INSTRUCTIONS:
1. Analyze the image content carefully
2. Create questions that test understanding of what is shown in the image
3. Each question must have exactly 4 options
4. Only ONE option should be correct
5. The correctAnswer is the INDEX (0, 1, 2, or 3) of the correct option
6. Double-check that your correctAnswer points to the actually correct option

Question Quality Rules:
- ${difficulty === 'easy' ? 'Basic recall and recognition questions' : difficulty === 'medium' ? 'Application and analysis questions' : 'Complex synthesis and evaluation questions'}
- Make questions clear and unambiguous
- All 4 options should be plausible but only ONE correct
- Include a brief explanation for why the answer is correct

Return ONLY valid JSON:
{
  "title": "Test Title",
  "description": "Description",
  "questions": [
    {
      "id": 1,
      "question": "Clear question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Why option A is correct"
    }
  ]
}

IMPORTANT: Verify each correctAnswer matches the actual correct option before responding.`

export async function POST(request: NextRequest) {
  try {
    const body: GenerateTestRequest = await request.json()
    const { images, provider, questionCount, difficulty, apiKey } = body

    if (!images || images.length === 0) {
      return NextResponse.json({ error: 'At least one image is required' }, { status: 400 })
    }

    const systemPrompt = getSystemPrompt(questionCount, difficulty)
    const userPrompt = `Create a ${difficulty} test with ${questionCount} multiple choice questions based on the content in this image. Make sure the correctAnswer field accurately points to the correct option. Return valid JSON only.`

    let response: any

    const formattedImages = images.map(img =>
      img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`
    )

    const content: any[] = []
    formattedImages.forEach(imgUrl => {
      content.push({
        type: 'image_url',
        image_url: { url: imgUrl }
      })
    })
    content.push({
      type: 'text',
      text: userPrompt
    })

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
                { role: 'user', content }
              ],
              temperature: 0.3,
              max_tokens: 8000
            })
          }).then(res => res.json())
          break

        case 'gemini':
          const geminiParts = formattedImages.map(imgUrl => ({
            inline_data: {
              mime_type: 'image/jpeg',
              data: imgUrl.split(',')[1]
            }
          }))
          geminiParts.push({ text: `${systemPrompt}\n\n${userPrompt}` })

          response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: geminiParts }],
              generationConfig: { temperature: 0.3, maxOutputTokens: 8000 }
            })
          }).then(res => res.json())

          if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
            response = {
              choices: [{ message: { content: response.candidates[0].content.parts[0].text } }]
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
                { role: 'user', content }
              ],
              temperature: 0.3,
              max_tokens: 8000
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
                { role: 'user', content }
              ],
              temperature: 0.3,
              max_tokens: 4096
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
          { role: 'user', content }
        ],
        model: provider === 'openai' ? 'gpt-4o' : provider === 'gemini' ? 'gemini-2.0-flash' : 'deepseek-chat',
        temperature: 0.3,
        max_tokens: 8000
      })
    }

    const content_result = response.choices?.[0]?.message?.content

    if (!content_result) {
      console.error('API Response:', JSON.stringify(response, null, 2))
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    try {
      let jsonContent = content_result
      const jsonMatch = content_result.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        jsonContent = jsonMatch[1].trim()
      }
      if (!jsonContent.startsWith('{')) {
        const jsonStart = content_result.indexOf('{')
        const jsonEnd = content_result.lastIndexOf('}')
        if (jsonStart !== -1 && jsonEnd !== -1) {
          jsonContent = content_result.substring(jsonStart, jsonEnd + 1)
        }
      }

      const testData = JSON.parse(jsonContent)
      return NextResponse.json(testData)
    } catch {
      console.error('Failed to parse AI response:', content_result.substring(0, 1000))
      return NextResponse.json({
        error: 'Failed to parse test data',
        raw: content_result.substring(0, 1000)
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('Generate test error:', error)
    return NextResponse.json({
      error: error.message || 'Failed to generate test'
    }, { status: 500 })
  }
}
