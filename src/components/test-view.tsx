'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  ArrowLeft,
  ArrowRight,
  Flag,
  HelpCircle,
  Clock,
  Menu,
  CheckCircle,
  Circle,
  AlertTriangle
} from 'lucide-react'
import { useTestStore, TestQuestion } from '@/store/test-store'

interface TestViewProps {
  onComplete: () => void
}

export default function TestView({ onComplete }: TestViewProps) {
  const {
    testData,
    currentQuestionIndex,
    setCurrentQuestion,
    answers,
    setAnswer,
    timerEnabled,
    timerMinutes,
    timeRemaining,
    setTimeRemaining,
    isTimerRunning,
    setIsTimerRunning
  } = useTestStore()

  const [showExplanation, setShowExplanation] = useState(false)
  const hasCompletedRef = useRef(false)

  const currentQuestion = testData?.questions[currentQuestionIndex]
  const totalQuestions = testData?.questions.length || 0
  const progress = totalQuestions > 0 ? ((currentQuestionIndex + 1) / totalQuestions) * 100 : 0
  const isParsedPaper = testData?.sourceType === 'parsed_paper'
  const answeredCount = answers.size

  // Format time
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }, [])

  // Initialize timer
  useEffect(() => {
    if (timerEnabled && timerMinutes > 0 && timeRemaining === 0) {
      setTimeRemaining(timerMinutes * 60)
    }
  }, [timerEnabled, timerMinutes, timeRemaining, setTimeRemaining])

  // Auto-start timer when test begins
  useEffect(() => {
    if (timerEnabled && !isTimerRunning) {
      setIsTimerRunning(true)
    }
  }, [timerEnabled, isTimerRunning, setIsTimerRunning])

  // Timer countdown
  useEffect(() => {
    if (!isTimerRunning || !timerEnabled) return

    const interval = setInterval(() => {
      setTimeRemaining(Math.max(0, timeRemaining - 1))
    }, 1000)

    return () => clearInterval(interval)
  }, [isTimerRunning, timerEnabled, timeRemaining, setTimeRemaining])

  // Auto-submit when time runs out
  useEffect(() => {
    if (timerEnabled && timeRemaining === 0 && !hasCompletedRef.current) {
      hasCompletedRef.current = true
      setIsTimerRunning(false)
      onComplete()
    }
  }, [timerEnabled, timeRemaining, setIsTimerRunning, onComplete])

  const handleAnswer = useCallback((answerIndex: number) => {
    if (currentQuestion) {
      setAnswer(currentQuestion.id, answerIndex)
    }
  }, [currentQuestion, setAnswer])

  const goToQuestion = useCallback((index: number) => {
    if (index >= 0 && index < totalQuestions) {
      setCurrentQuestion(index)
      setShowExplanation(false)
    }
  }, [totalQuestions, setCurrentQuestion])

  const handleSubmit = useCallback(() => {
    setIsTimerRunning(false)
    onComplete()
  }, [onComplete, setIsTimerRunning])

  const isQuestionAnswered = useCallback((questionId: number) => {
    return answers.has(questionId)
  }, [answers])

  // Timer display colors
  const getTimerColor = () => {
    if (timeRemaining > 60) return 'text-green-500'
    if (timeRemaining > 30) return 'text-yellow-500'
    return 'text-red-500 animate-pulse'
  }

  const getTimerBg = () => {
    if (timeRemaining > 60) return 'bg-green-500/10 border-green-500/30'
    if (timeRemaining > 30) return 'bg-yellow-500/10 border-yellow-500/30'
    return 'bg-red-500/10 border-red-500/30 animate-pulse'
  }

  if (!testData || !currentQuestion) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6 text-center">
          <p>No test data available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Fixed Header with Timer and Progress */}
      <div className="sticky top-16 z-40 bg-background/95 backdrop-blur border-b pb-3 mb-4">
        <div className="flex items-center justify-between gap-4">
          {/* Title and Progress */}
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold truncate">{testData.title}</h2>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {currentQuestionIndex + 1}/{totalQuestions}
              </span>
            </div>
          </div>

          {/* Timer Display */}
          {timerEnabled && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${getTimerBg()}`}>
              <Clock className={`w-5 h-5 ${getTimerColor()}`} />
              <span className={`text-xl font-mono font-bold ${getTimerColor()}`}>
                {formatTime(timeRemaining)}
              </span>
            </div>
          )}

          {/* Question Navigation Sheet */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden">
                <Menu className="w-4 h-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <SheetHeader>
                <SheetTitle>Questions</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <QuestionGrid
                  questions={testData.questions}
                  currentIndex={currentQuestionIndex}
                  answers={answers}
                  onSelect={goToQuestion}
                  isQuestionAnswered={isQuestionAnswered}
                />
                <Button
                  className="w-full mt-4 bg-green-600 hover:bg-green-700"
                  onClick={handleSubmit}
                >
                  <Flag className="w-4 h-4 mr-2" />
                  Submit Test
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Desktop Sidebar - Question Navigation */}
        <Card className="hidden lg:block w-64 shrink-0 h-fit sticky top-36">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Questions</CardTitle>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-green-500" />
                {answeredCount} answered
              </span>
              <span className="flex items-center gap-1">
                <Circle className="w-3 h-3" />
                {totalQuestions - answeredCount} left
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="h-[300px] pr-2">
              <QuestionGrid
                questions={testData.questions}
                currentIndex={currentQuestionIndex}
                answers={answers}
                onSelect={goToQuestion}
                isQuestionAnswered={isQuestionAnswered}
              />
            </ScrollArea>
            <Button
              className="w-full mt-4 bg-green-600 hover:bg-green-700"
              onClick={handleSubmit}
            >
              <Flag className="w-4 h-4 mr-2" />
              Submit Test
            </Button>
          </CardContent>
        </Card>

        {/* Main Question Area */}
        <Card className="flex-1">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <Badge variant="secondary" className="mb-2">
                  Question {currentQuestionIndex + 1}
                </Badge>
                {isParsedPaper && (
                  <Badge variant="outline" className="ml-2 text-blue-600 border-blue-300">
                    Parsed
                  </Badge>
                )}
              </div>
            </div>
            <CardTitle className="text-xl leading-relaxed">
              {currentQuestion.question}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup
              value={answers.get(currentQuestion.id)?.toString()}
              onValueChange={(value) => handleAnswer(parseInt(value))}
              className="space-y-3"
            >
              {currentQuestion.options.map((option, index) => {
                const isSelected = answers.get(currentQuestion.id) === index
                const isCorrect = currentQuestion.correctAnswer === index
                const hasKnownAnswer = currentQuestion.correctAnswer !== null

                let optionClass = "border-2 transition-all rounded-lg"
                if (showExplanation && hasKnownAnswer) {
                  if (isCorrect) {
                    optionClass += " border-green-500 bg-green-50 dark:bg-green-950"
                  } else if (isSelected && !isCorrect) {
                    optionClass += " border-red-500 bg-red-50 dark:bg-red-950"
                  }
                } else if (isSelected) {
                  optionClass += " border-primary bg-primary/5"
                }

                return (
                  <div key={index} className={optionClass}>
                    <RadioGroupItem
                      value={index.toString()}
                      id={`option-${index}`}
                      className="peer sr-only"
                      disabled={showExplanation && hasKnownAnswer}
                    />
                    <label
                      htmlFor={`option-${index}`}
                      className="flex items-center gap-3 p-4 cursor-pointer rounded-lg peer-disabled:cursor-default"
                    >
                      <span className="flex items-center justify-center w-8 h-8 rounded-full border-2 text-sm font-medium shrink-0">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span className="flex-1">{option}</span>
                    </label>
                  </div>
                )
              })}
            </RadioGroup>

            {/* Explanation */}
            {showExplanation && currentQuestion.explanation && (
              <div className="p-4 rounded-lg bg-muted mt-4">
                <p className="font-medium mb-1">Explanation:</p>
                <p className="text-sm text-muted-foreground">
                  {currentQuestion.explanation}
                </p>
              </div>
            )}

            {/* Show Explanation Button */}
            {isQuestionAnswered(currentQuestion.id) && !showExplanation && currentQuestion.correctAnswer !== null && (
              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={() => setShowExplanation(true)}
              >
                Show Answer & Explanation
              </Button>
            )}

            {/* Info for parsed papers */}
            {isParsedPaper && currentQuestion.correctAnswer === null && (
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 mt-4">
                <div className="flex items-start gap-2">
                  <HelpCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Answer will be shown in results after submission.
                  </p>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-4 border-t mt-6">
              <Button
                variant="outline"
                onClick={() => goToQuestion(currentQuestionIndex - 1)}
                disabled={currentQuestionIndex === 0}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>

              {currentQuestionIndex < totalQuestions - 1 ? (
                <Button onClick={() => goToQuestion(currentQuestionIndex + 1)}>
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} className="bg-green-600 hover:bg-green-700">
                  <Flag className="w-4 h-4 mr-2" />
                  Submit Test
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Warning when time is low */}
      {timerEnabled && timeRemaining <= 30 && timeRemaining > 0 && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-bounce">
          <AlertTriangle className="w-5 h-5" />
          <span className="font-medium">Time running out! {formatTime(timeRemaining)} remaining</span>
        </div>
      )}
    </div>
  )
}

// Question Grid Component
function QuestionGrid({
  questions,
  currentIndex,
  answers,
  onSelect,
  isQuestionAnswered
}: {
  questions: TestQuestion[]
  currentIndex: number
  answers: Map<number, number>
  onSelect: (index: number) => void
  isQuestionAnswered: (id: number) => boolean
}) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {questions.map((q, index) => {
        const isCurrent = index === currentIndex
        const isAnswered = isQuestionAnswered(q.id)

        return (
          <Button
            key={q.id}
            variant={isCurrent ? 'default' : isAnswered ? 'secondary' : 'outline'}
            size="sm"
            className={`h-10 w-full p-0 ${isCurrent ? 'ring-2 ring-primary ring-offset-2' : ''}`}
            onClick={() => onSelect(index)}
          >
            {index + 1}
          </Button>
        )
      })}
    </div>
  )
}
