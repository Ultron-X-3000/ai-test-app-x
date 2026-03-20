'use client'

import { useCallback } from 'react'
import { useTestStore, CapturedImage } from '@/store/test-store'
import MultiImageCapture from '@/components/multi-image-capture'
import TestConfig from '@/components/test-config'
import TestView from '@/components/test-view'
import ResultsView from '@/components/results-view'
import APISettings from '@/components/api-settings'
import { ThemeToggle } from '@/components/theme-toggle'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Brain, Wand2, FileText, ArrowLeft, Camera, Upload, Sparkles } from 'lucide-react'
import { useAPIKeysStore } from '@/store/api-keys-store'

export default function Home() {
  const {
    currentView,
    setView,
    testMode,
    setTestMode,
    images,
    addImage,
    removeImage,
    clearImages,
    testData,
    setTestData,
    isLoading,
    setIsLoading,
    error,
    setError,
    selectedProvider,
    questionCount,
    difficulty,
    timerMinutes,
    setTimeRemaining,
    resetTest,
    answers,
    setResults
  } = useTestStore()

  const { getKey } = useAPIKeysStore()

  const handleSelectMode = useCallback((mode: 'generate' | 'parse') => {
    setTestMode(mode)
    clearImages()
    setView(mode)
  }, [setTestMode, clearImages, setView])

  const handleContinue = useCallback(() => {
    setView('config')
  }, [setView])

  const handleBack = useCallback(() => {
    if (currentView === 'config') {
      setView(testMode)
    } else if (currentView === 'generate' || currentView === 'parse') {
      clearImages()
      setView('home')
    }
  }, [currentView, testMode, setView, clearImages])

  const handleProcess = useCallback(async () => {
    if (images.length === 0) return

    setIsLoading(true)
    setError(null)

    try {
      const endpoint = testMode === 'generate' ? '/api/generate-test' : '/api/parse-paper'
      const apiKey = getKey(selectedProvider)

      const body = {
        images: images.map(img => img.dataUrl),
        provider: selectedProvider,
        questionCount,
        difficulty,
        apiKey
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to process images')
      }

      const data = await response.json()

      if (testMode === 'parse') {
        data.sourceType = 'parsed_paper'
      } else {
        data.sourceType = 'generated'
      }

      setTestData(data)

      if (timerMinutes > 0) {
        setTimeRemaining(timerMinutes * 60)
      }

      setView('test')
    } catch (err: any) {
      console.error('Error processing:', err)
      setError(err.message || 'Failed to process images. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [images, testMode, selectedProvider, questionCount, difficulty, timerMinutes, setIsLoading, setError, setTestData, setTimeRemaining, setView, getKey])

  const handleTestComplete = useCallback(() => {
    if (testData) {
      const results = testData.questions.map(q => ({
        questionId: q.id,
        selectedAnswer: answers.get(q.id) ?? null,
        isCorrect: q.correctAnswer !== null ? answers.get(q.id) === q.correctAnswer : null,
        timeSpent: 0
      }))
      setResults(results)
    }
    setView('results')
  }, [testData, answers, setResults, setView])

  const handleRetakeTest = useCallback(() => {
    setView('test')
  }, [setView])

  const handleNewTest = useCallback(() => {
    resetTest()
    setView('home')
  }, [resetTest, setView])

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {currentView !== 'home' && (
                <Button variant="ghost" size="icon" onClick={handleBack}>
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              )}
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Brain className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">AI Test Generator</h1>
                <p className="text-xs text-muted-foreground">ChatGPT • Gemini • DeepSeek • NVIDIA</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <APISettings />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Error Display */}
        {error && (
          <Card className="max-w-2xl mx-auto mb-6 border-destructive">
            <CardContent className="p-4 text-destructive">
              <p className="font-medium">Error</p>
              <p className="text-sm">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => setError(null)}
              >
                Dismiss
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Home View - Mode Selection */}
        {currentView === 'home' && (
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-2">AI Test Generator</h2>
              <p className="text-muted-foreground text-lg">
                Generate tests from content or parse existing question papers
              </p>
            </div>

            {/* Two Main Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Generate Test Card */}
              <Card
                className="cursor-pointer hover:border-primary hover:shadow-lg transition-all group"
                onClick={() => handleSelectMode('generate')}
              >
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Wand2 className="w-8 h-8 text-primary" />
                  </div>
                  <CardTitle className="text-xl">Generate Test</CardTitle>
                  <CardDescription>
                    AI creates questions from your content
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Camera className="w-4 h-4" />
                    <span>Take photos of textbooks, notes, diagrams</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Upload className="w-4 h-4" />
                    <span>Upload images from your device</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Sparkles className="w-4 h-4" />
                    <span>AI generates custom questions</span>
                  </div>
                  <Button className="w-full mt-4" size="lg">
                    Start Generating
                  </Button>
                </CardContent>
              </Card>

              {/* Parse Paper Card */}
              <Card
                className="cursor-pointer hover:border-primary hover:shadow-lg transition-all group"
                onClick={() => handleSelectMode('parse')}
              >
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                    <FileText className="w-8 h-8 text-blue-500" />
                  </div>
                  <CardTitle className="text-xl">Parse Paper</CardTitle>
                  <CardDescription>
                    Extract questions from existing papers
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Camera className="w-4 h-4" />
                    <span>Take photos of question papers</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Upload className="w-4 h-4" />
                    <span>Upload scanned papers</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Brain className="w-4 h-4" />
                    <span>AI extracts questions as-is</span>
                  </div>
                  <Button className="w-full mt-4" size="lg" variant="secondary">
                    Start Parsing
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Tips */}
            <div className="text-center text-sm text-muted-foreground">
              <p>💡 Tip: You can add multiple images for both modes</p>
            </div>
          </div>
        )}

        {/* Generate Mode - Image Capture */}
        {currentView === 'generate' && (
          <div className="max-w-2xl mx-auto">
            <MultiImageCapture
              images={images}
              onAddImage={addImage}
              onRemoveImage={removeImage}
              onClearImages={clearImages}
              onContinue={handleContinue}
              mode="generate"
            />
          </div>
        )}

        {/* Parse Mode - Image Capture */}
        {currentView === 'parse' && (
          <div className="max-w-2xl mx-auto">
            <MultiImageCapture
              images={images}
              onAddImage={addImage}
              onRemoveImage={removeImage}
              onClearImages={clearImages}
              onContinue={handleContinue}
              mode="parse"
            />
          </div>
        )}

        {/* Configuration View */}
        {currentView === 'config' && images.length > 0 && (
          <div className="space-y-6">
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold mb-2">Configure Your Test</h2>
              <p className="text-muted-foreground">
                {images.length} image{images.length !== 1 ? 's' : ''} selected
              </p>
            </div>

            {/* Preview Images */}
            <Card className="max-w-2xl mx-auto overflow-hidden">
              <CardContent className="p-4">
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {images.map((img) => (
                    <img
                      key={img.id}
                      src={img.dataUrl}
                      alt="Preview"
                      className="w-20 h-20 object-cover rounded-lg border shrink-0"
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            <TestConfig
              onProcess={handleProcess}
              isLoading={isLoading}
            />
          </div>
        )}

        {/* Test View */}
        {currentView === 'test' && testData && (
          <TestView onComplete={handleTestComplete} />
        )}

        {/* Results View */}
        {currentView === 'results' && (
          <ResultsView
            onRetake={handleRetakeTest}
            onNewTest={handleNewTest}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
            <p>AI Test Generator - Create tests from photos instantly</p>
            <div className="flex items-center gap-4 flex-wrap justify-center">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                ChatGPT
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                Gemini
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                DeepSeek
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-600"></span>
                NVIDIA NIM
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
