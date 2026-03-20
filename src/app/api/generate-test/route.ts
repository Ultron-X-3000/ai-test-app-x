import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

interface GenerateTestRequest {
  images?: string[] // Multiple images
  imageBase64?: string // Single image (backward compatible)
  provider: 'openai' | 'gemini' | 'deepseek' | 'nvidia'
  questionCount: number
  difficulty: 'easy' | 'medium' | 'hard'
  apiKey?: string
}

const getSystemPrompt = (questionCount: number, difficulty: string) => `You are an expert test creator. Analyze ALL the provided images and create ${questionCount} multiple-choice test questions at ${difficulty} difficulty level.

IMPORTANT: You must respond with ONLY valid JSON, no additional text. The JSON must follow this exact structure:
{
  "title": "Test title based on image content",
  "description": "Brief description of what the test covers",
  "questions": [
    {
      "id": 1,
      "question": "The question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Explanation of why this is the correct answer"
    }
  ]
}

Rules:
- correctAnswer must be the index (0-3) of the correct option
- Each question must have exactly 4 options
- Combine information from ALL provided images to create comprehensive questions
- Questions should test understanding of concepts visible or related to the images
- For easy difficulty: basic identification and recall questions
- For medium difficulty: application and analysis questions
- For hard difficulty: synthesis and evaluation questions
- Provide clear, educational explanations`

export async function POST(request: NextRequest) {
  try {
    const body: GenerateTestRequest = await request.json()
    const { images, imageBase64, provider, questionCount, difficulty, apiKey } = body

    // Support both single image (backward compatible) and multiple images
    const imageUrls = images || (imageBase64 ? [imageBase64] : [])

    if (imageUrls.length === 0) {
      return NextResponse.json({ error: 'At least one image is required' }, { status: 400 })
    }

    const systemPrompt = getSystemPrompt(questionCount, difficulty)

    // Ensure proper data URL format for all images
    const formattedImages = imageUrls.map(img =>
      img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`
    )

    const userPrompt = `Create a ${difficulty} test with ${questionCount} multiple choice questions based on these ${formattedImages.length} image${formattedImages.length > 1 ? 's' : ''}. Respond with valid JSON only.`

    let response: any

    // Build content array with all images
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
                { role: 'user', content }
              ],
              temperature: 0.7,
              max_tokens: 4000
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
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              contents: [{
                parts: geminiParts
              }],
              generationConfig: {
                temperature: 0.7,
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
                { role: 'user', content }
              ],
              temperature: 0.7,
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
              model: 'meta/llama-3.2-90b-vision-instruct',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content }
              ],
              temperature: 0.7,
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
          { role: 'user', content }
        ],
        model: provider === 'openai' ? 'gpt-4o' : provider === 'gemini' ? 'gemini-2.0-flash' : 'deepseek-chat',
        temperature: 0.7,
        max_tokens: 4000
      })
    }

    const content_result = response.choices?.[0]?.message?.content

    if (!content_result) {
      console.error('API Response:', JSON.stringify(response, null, 2))
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    // Parse the JSON response
    try {
      let jsonContent = content_result
      const jsonMatch = content_result.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        jsonContent = jsonMatch[1].trim()
      }

      const testData = JSON.parse(jsonContent)
      return NextResponse.json(testData)
    } catch {
      console.error('Failed to parse AI response:', content_result)
      return NextResponse.json({
        error: 'Failed to parse test data',
        raw: content_result
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('Generate test error:', error)
    return NextResponse.json({
      error: error.message || 'Failed to generate test'
    }, { status: 500 })
  }
}
