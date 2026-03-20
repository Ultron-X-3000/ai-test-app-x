import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

interface ParsePaperRequest {
  images?: string[] // Multiple images
  imageBase64?: string // Single image (backward compatible)
  provider: 'openai' | 'gemini' | 'deepseek' | 'nvidia'
  apiKey?: string
}

const getSystemPrompt = () => `You are an expert at parsing and extracting questions from question papers, exams, and quizzes from images.

Your task is to carefully analyze ALL provided images and extract ALL questions visible across them. For each question:
1. Extract the full question text
2. Extract all answer options (A, B, C, D, or similar formats)
3. Identify the correct answer if it's marked in the image
4. If correct answer is not marked, set correctAnswer to null

IMPORTANT: You must respond with ONLY valid JSON, no additional text. The JSON must follow this exact structure:
{
  "title": "Extracted test title or 'Question Paper'",
  "description": "Brief description of the paper content",
  "sourceType": "parsed_paper",
  "questions": [
    {
      "id": 1,
      "question": "The complete question text",
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
      "correctAnswer": null,
      "explanation": ""
    }
  ]
}

Rules:
- Combine questions from ALL provided images
- Extract questions EXACTLY as written in the image
- Preserve the original numbering/ordering across pages
- For options, extract the full text without the A/B/C/D prefix
- If a question has more or fewer than 4 options, adapt accordingly but maintain at least 2 options
- If correct answers are visible (circled, checked, etc.), include them; otherwise set correctAnswer to null
- Handle different question formats: multiple choice, true/false, fill-in-the-blank (convert to MCQ if possible)
- For essay/short answer questions, create placeholder options if needed
- Be thorough - don't miss any questions
- Handle handwritten text if present
- If the images are unclear or no questions are found, return an empty questions array with an error message in the description`

export async function POST(request: NextRequest) {
  try {
    const body: ParsePaperRequest = await request.json()
    const { images, imageBase64, provider, apiKey } = body

    // Support both single image (backward compatible) and multiple images
    const imageUrls = images || (imageBase64 ? [imageBase64] : [])

    if (imageUrls.length === 0) {
      return NextResponse.json({ error: 'At least one image is required' }, { status: 400 })
    }

    const systemPrompt = getSystemPrompt()
    const userPrompt = `Please extract all questions from these ${imageUrls.length} question paper image${imageUrls.length > 1 ? 's' : ''}. Return the data in the specified JSON format.`

    let response: any

    // Ensure proper data URL format for all images
    const formattedImages = imageUrls.map(img =>
      img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`
    )

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
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              contents: [{
                parts: geminiParts
              }],
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 8000
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
              model: 'meta/llama-3.2-90b-vision-instruct',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content }
              ],
              temperature: 0.3,
              max_tokens: 8000
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
        temperature: 0.3,
        max_tokens: 8000
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

      // Validate that we have questions
      if (!testData.questions || testData.questions.length === 0) {
        return NextResponse.json({
          error: 'No questions could be extracted from the images. Please ensure the images clearly show questions.',
          title: testData.title || 'Question Paper',
          description: testData.description || 'Failed to extract questions',
          questions: []
        }, { status: 400 })
      }

      return NextResponse.json(testData)
    } catch {
      console.error('Failed to parse AI response:', content_result)
      return NextResponse.json({
        error: 'Failed to parse extracted questions',
        raw: content_result
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('Parse paper error:', error)
    return NextResponse.json({
      error: error.message || 'Failed to parse question paper'
    }, { status: 500 })
  }
}
