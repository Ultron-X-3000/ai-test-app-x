import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

interface ParsePaperRequest {
  images?: string[]
  imageBase64?: string
  provider: 'openai' | 'gemini' | 'deepseek' | 'nvidia'
  apiKey?: string
}

const getSystemPrompt = () => `You are an expert at parsing and extracting questions from question papers.

Extract ALL questions from the image. For each question:
1. Extract the question text
2. Extract all options (A, B, C, D text without the letter)
3. Set correctAnswer to null

IMPORTANT: Return ONLY valid JSON. No markdown. No explanations.

Example:
{"title":"SSC CGL Questions","description":"Number System questions","sourceType":"parsed_paper","questions":[{"id":1,"question":"What is 2+2?","options":["3","4","5","6"],"correctAnswer":null,"explanation":""}]}

Rules:
- Extract ALL visible questions
- Keep question numbers in the text
- Handle Hindi/English text
- Return ONLY the JSON object`

export async function POST(request: NextRequest) {
  try {
    const body: ParsePaperRequest = await request.json()
    const { images, imageBase64, provider, apiKey } = body

    const imageUrls = images || (imageBase64 ? [imageBase64] : [])

    if (imageUrls.length === 0) {
      return NextResponse.json({ error: 'At least one image is required' }, { status: 400 })
    }

    const systemPrompt = getSystemPrompt()
    const userPrompt = `Extract all questions from this question paper image. Return valid JSON only.`

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
              temperature: 0.2,
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
                temperature: 0.2,
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
              temperature: 0.2,
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
              model: 'meta/llama-3.2-90b-vision-instruct',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content }
              ],
              temperature: 0.2,
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
        temperature: 0.2,
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
