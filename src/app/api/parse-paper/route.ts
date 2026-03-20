import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

interface ParsePaperRequest {
  images?: string[]
  imageBase64?: string
  provider: 'openai' | 'gemini' | 'deepseek' | 'nvidia'
  apiKey?: string
}

const getSystemPrompt = () => `You are an expert at parsing and extracting questions from question papers, exams, and quizzes from images.

Your task is to carefully analyze ALL provided images and extract ALL questions visible across them. For each question:
1. Extract the full question text EXACTLY as written
2. Extract all answer options (A, B, C, D, or similar formats) - remove the letter prefix
3. Set correctAnswer to null (we don't know which is correct)
4. Keep the question number as part of the question text

CRITICAL: You must respond with ONLY valid JSON. No explanations, no markdown formatting around the JSON. Just the raw JSON object.

Example output format:
{"title":"SSC CGL Number System Questions","description":"Questions from SSC CGL exam on Number System","sourceType":"parsed_paper","questions":[{"id":1,"question":"If a number is multiplied by 5 and then 5 is added, the result is 30. What is the number?","options":["4","5","6","7"],"correctAnswer":null,"explanation":""}]}

Rules:
- Extract questions EXACTLY as written in the image, including any Hindi/English text
- For options, extract the full text after the letter (A, B, C, D)
- If a question has 4 options, include all 4
- If a question has 5 options (a, b, c, d, e), include all 5
- Number questions sequentially starting from 1
- Do NOT skip any questions
- Handle both English and Hindi text
- Return ONLY the JSON, no other text`

export async function POST(request: NextRequest) {
  try {
    const body: ParsePaperRequest = await request.json()
    const { images, imageBase64, provider, apiKey } = body

    const imageUrls = images || (imageBase64 ? [imageBase64] : [])

    if (imageUrls.length === 0) {
      return NextResponse.json({ error: 'At least one image is required' }, { status: 400 })
    }

    const systemPrompt = getSystemPrompt()
    const userPrompt = `Please extract all questions from these ${imageUrls.length} question paper image${imageUrls.length > 1 ? 's' : ''}. Return the data in the specified JSON format.`

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

      if (!testData.questions || testData.questions.length === 0) {
        return NextResponse.json({
          error: 'No questions could be extracted. Please ensure the images clearly show questions with options.',
          title: testData.title || 'Question Paper',
          description: testData.description || 'Failed to extract questions',
          questions: [],
          raw: content
