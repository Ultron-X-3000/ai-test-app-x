import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

interface ParsePaperRequest {
  images?: string[]
  imageBase64?: string
  provider: 'openai' | 'gemini' | 'deepseek' | 'nvidia'
  apiKey?: string
}

const getSystemPrompt = () => `You are an expert at extracting questions from exam papers. Your job is to accurately read and extract questions from images.

CRITICAL INSTRUCTIONS:
1. Look at the image carefully - it contains a question paper with multiple choice questions
2. Extract EACH question exactly as written (keep the original wording)
3. Extract each option EXACTLY as written - do not modify, paraphrase, or change any text
4. Keep Hindi text in Hindi, English text in English
5. Do NOT guess or invent any content - only extract what is visible

For each question extract:
- question: The full question text exactly as shown (include question number like "1.", "Q1", etc.)
- options: Array of exactly 4 option texts (extract ONLY the text part, not A/B/C/D letters)
- correctAnswer: Set to null (we don't know the answers)
- explanation: Empty string

Return ONLY this JSON format with no additional text:
{
  "title": "Title from paper or 'Question Paper'",
  "description": "Brief description",
  "sourceType": "parsed_paper",
  "questions": [
    {
      "id": 1,
      "question": "Exact question text here",
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
      "correctAnswer": null,
      "explanation": ""
    }
  ]
}

IMPORTANT: If you cannot clearly read a question or option, skip it. Only extract clearly visible questions.`

export async function POST(request: NextRequest) {
  try {
    const body: ParsePaperRequest = await request.json()
    const { images, imageBase64, provider, apiKey } = body

    const imageUrls = images || (imageBase64 ? [imageBase64] : [])

    if (imageUrls.length === 0) {
      return NextResponse.json({ error: 'At least one image is required' }, { status: 400 })
    }

    const systemPrompt = getSystemPrompt()
    const userPrompt = `Please carefully extract all multiple choice questions from this question paper image. Extract the questions and options EXACTLY as written. Return valid JSON only.`

    let response: any

    const formattedImages = imageUrls.map(img =>
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
              temperature: 0.1,
              max_tokens: 16000
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
                temperature: 0.1,
                maxOutputTokens: 16000
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
              temperature: 0.1,
              max_tokens: 16000
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
              temperature: 0.1,
              max_tokens: 4096
            })
          }).then(res => res.json())
          break

        default:
          return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
      }
    } else {
      const zai = await ZAI.create()
      response = await zai.chat.completions.createVision({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content }
        ],
        temperature: 0.1,
        max_tokens: 16000
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

      if (!testData.questions || testData.questions.length === 0) {
        return NextResponse.json({
          error: 'No questions found. Make sure the image shows questions with options.',
          questions: []
        }, { status: 400 })
      }

      return NextResponse.json(testData)
    } catch (parseError) {
      console.error('Parse error:', parseError)
      return NextResponse.json({
        error: 'Could not parse questions. Try using Gemini or ChatGPT provider.',
        raw: content_result.substring(0, 500)
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('Parse paper error:', error)
    return NextResponse.json({
      error: error.message || 'Failed to parse question paper'
    }, { status: 500 })
  }
}
