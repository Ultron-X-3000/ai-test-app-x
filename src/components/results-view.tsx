'use client'

import { useCallback, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Trophy, RotateCcw, CheckCircle, XCircle, Home, HelpCircle, FileText, Sparkles, Loader2 } from 'lucide-react'
import { useTestStore } from '@/store/test-store'
import { useAPIKeysStore } from '@/store/api-keys-store'

interface ResultsViewProps {
  onRetake: () => void
  onNewTest: () => void
}

export default function ResultsView({ onRetake, onNewTest }: ResultsViewProps) {
  const { testData, answers, timerEnabled, timerMinutes, timeRemaining, selectedProvider, setResults, results } = useTestStore()
  const { getKey } = useAPIKeysStore()
  const [isChecking, setIsChecking] = useState(false)
  const [checkError, setCheckError] = useState<string | null>(null)

  const isParsedPaper = testData?.sourceType === 'parsed_paper'

  // Check if we need AI checking (parsed paper with unknown answers)
  const needsAICheck = useMemo(() => {
    if (!testData || !isParsedPaper) return false
    return testData.questions.some(q => q.correctAnswer === null)
  }, [testData, isParsedPaper])

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }, [])

  // Calculate results
  const calculatedResults = useMemo(() => {
    if (!testData) return null

    const questions = testData.questions
    let correct = 0
    let incorrect = 0
    let unanswered = 0
    let unknownAnswers = 0

    questions.forEach(q => {
      const answer = answers.get(q.id)
      if (answer === undefined) {
        unanswered++
      } else if (q.correctAnswer === null) {
        unknownAnswers++
      } else if (answer === q.correctAnswer) {
        correct++
      } else {
        incorrect++
      }
    })

    const knownAnswerCount = questions.filter(q => q.correctAnswer !== null).length
    const percentage = knownAnswerCount > 0
      ? Math.round((correct / knownAnswerCount) * 100)
      : 0

    const timeUsed = timerEnabled && timerMinutes ? (timerMinutes * 60 - timeRemaining) : 0

    let grade = '-'
    let gradeColor = 'text-gray-500'

    if (knownAnswerCount > 0) {
      if (percentage >= 90) { grade = 'A'; gradeColor = 'text-green-500' }
      else if (percentage >= 80) { grade = 'B'; gradeColor = 'text-green-400' }
      else if (percentage >= 70) { grade = 'C'; gradeColor = 'text-yellow-500' }
      else if (percentage >= 60) { grade = 'D'; gradeColor = 'text-orange-500' }
      else { grade = 'F'; gradeColor = 'text-red-500' }
    }

    return {
      total: questions.length,
      correct,
      incorrect,
      unanswered,
      unknownAnswers,
      knownAnswerCount,
      percentage,
      grade,
      gradeColor,
      timeUsed,
      questions: questions.map(q => ({
        question: q,
        userAnswer: answers.get(q.id),
        isCorrect: q.correctAnswer !== null ? answers.get(q.id) === q.correctAnswer : null,
        hasKnownAnswer: q.correctAnswer !== null
      }))
    }
  }, [testData, answers, timerEnabled, timerMinutes, timeRemaining])

  // AI Check function
  const handleAICheck = useCallback(async () => {
    if (!testData) return

    setIsChecking(true)
    setCheckError(null)

    try {
      const apiKey = getKey(selectedProvider)

      const questionsToCheck = testData.questions.map(q => ({
        id: q.id,
        question: q.question,
        options: q.options,
        userAnswer: answers.get(q.id) ?? null
      }))

      const response = await fetch('/api/check-answers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          questions: questionsToCheck,
          provider: selectedProvider,
          apiKey
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to check answers')
      }

      const data = await response.json()

      // Update questions with correct answers from AI
      if (data.results) {
        const updatedQuestions = testData.questions.map(q => {
          const result = data.results.find((r: any) => r.questionId === q.id)
          if (result) {
            return {
              ...q,
              correctAnswer: result.correctAnswer,
              explanation: result.explanation || q.explanation
            }
          }
          return q
        })

        // Update test data with new correct answers
        testData.questions = updatedQuestions

        // Recalculate results
        const newResults = updatedQuestions.map(q => ({
          questionId: q.id,
          selectedAnswer: answers.get(q.id) ?? null,
          isCorrect: q.correctAnswer !== null ? answers.get(q.id) === q.correctAnswer : null,
          timeSpent: 0
        }))

        setResults(newResults)
      }
    } catch (err: any) {
      console.error('AI check error:', err)
      setCheckError(err.message || 'Failed to check answers with AI')
    } finally {
      setIsChecking(false)
    }
  }, [testData, answers, selectedProvider, getKey, setResults])

  if (!testData || !calculatedResults) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6 text-center">
          <p>No results available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Score Card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6">
          <CardHeader className="p-0 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                {isParsedPaper ? (
                  <FileText className="w-8 h-8 text-primary" />
                ) : (
                  <Trophy className={`w-8 h-8 ${calculatedResults.percentage >= 70 ? 'text-yellow-500' : 'text-gray-400'}`} />
                )}
              </div>
            </div>
            <CardTitle className="text-3xl">{testData.title}</CardTitle>
            <CardDescription className="text-base mt-2">{testData.description}</CardDescription>
            {isParsedPaper && (
              <Badge variant="outline" className="mt-2 text-blue-600 border-blue-300">
                Parsed Question Paper
              </Badge>
            )}
          </CardHeader>
        </div>

        <CardContent className="p-6">
          {/* Grade Circle */}
          {(!isParsedPaper || calculatedResults.knownAnswerCount > 0) && (
            <div className="flex justify-center mb-6">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-muted"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    className={calculatedResults.percentage >= 70 ? 'text-green-500' : calculatedResults.percentage >= 50 ? 'text-yellow-500' : 'text-red-500'}
                    strokeDasharray={`${(calculatedResults.percentage / 100) * 352} 352`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <span className={`text-4xl font-bold ${calculatedResults.gradeColor}`}>{calculatedResults.grade}</span>
                    <p className="text-sm text-muted-foreground">{calculatedResults.percentage}%</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stats Grid */}
          <div className={`grid ${isParsedPaper ? 'grid-cols-4' : 'grid-cols-3'} gap-4 mb-6`}>
            {calculatedResults.knownAnswerCount > 0 && (
              <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950">
                <CheckCircle className="w-6 h-6 mx-auto mb-1 text-green-500" />
                <p className="text-2xl font-bold text-green-600">{calculatedResults.correct}</p>
                <p className="text-xs text-muted-foreground">Correct</p>
              </div>
            )}
            {calculatedResults.knownAnswerCount > 0 && (
              <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950">
                <XCircle className="w-6 h-6 mx-auto mb-1 text-red-500" />
                <p className="text-2xl font-bold text-red-600">{calculatedResults.incorrect}</p>
                <p className="text-xs text-muted-foreground">Incorrect</p>
              </div>
            )}
            {calculatedResults.unknownAnswers > 0 && (
              <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950">
                <HelpCircle className="w-6 h-6 mx-auto mb-1 text-blue-500" />
                <p className="text-2xl font-bold text-blue-600">{calculatedResults.unknownAnswers}</p>
                <p className="text-xs text-muted-foreground">Unknown</p>
              </div>
            )}
            <div className="text-center p-3 rounded-lg bg-muted">
              <p className="text-2xl font-bold">{calculatedResults.unanswered}</p>
              <p className="text-xs text-muted-foreground">Unanswered</p>
            </div>
          </div>

          {/* AI Check for parsed papers */}
          {needsAICheck && (
            <div className="mb-6">
              <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-blue-700 dark:text-blue-300 mb-1">
                        Check Answers with AI
                      </p>
                      <p className="text-sm text-blue-600 dark:text-blue-400 mb-3">
                        Let AI evaluate your answers and provide the correct answers with explanations.
                      </p>
                      {checkError && (
                        <p className="text-sm text-red-500 mb-2">{checkError}</p>
                      )}
                      <Button
                        onClick={handleAICheck}
                        disabled={isChecking}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {isChecking ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Checking...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Check Answers with AI
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Time Stats */}
          {timerEnabled && calculatedResults.timeUsed > 0 && (
            <div className="mb-6 p-4 rounded-lg bg-muted">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Time Used:</span>
                <span className="font-semibold">{formatTime(calculatedResults.timeUsed)}</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onRetake}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Retake Test
            </Button>
            <Button className="flex-1" onClick={onNewTest}>
              <Home className="w-4 h-4 mr-2" />
              New Photo
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Results */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Question Review</CardTitle>
          <CardDescription>Review your answers and see details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {calculatedResults.questions.map(({ question, userAnswer, isCorrect, hasKnownAnswer }, index) => {
            const isAnswered = userAnswer !== undefined

            let cardClass = "p-4 rounded-lg border "
            if (hasKnownAnswer) {
              if (isCorrect) {
                cardClass += "border-green-200 bg-green-50 dark:bg-green-950"
              } else if (isAnswered) {
                cardClass += "border-red-200 bg-red-50 dark:bg-red-950"
              } else {
                cardClass += "border-muted"
              }
            } else {
              cardClass += "border-blue-200 bg-blue-50 dark:bg-blue-950"
            }

            return (
              <div key={question.id} className={cardClass}>
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    hasKnownAnswer
                      ? isCorrect
                        ? 'bg-green-500 text-white'
                        : isAnswered
                        ? 'bg-red-500 text-white'
                        : 'bg-muted'
                      : 'bg-blue-500 text-white'
                  }`}>
                    {hasKnownAnswer ? (
                      isCorrect ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : isAnswered ? (
                        <XCircle className="w-5 h-5" />
                      ) : (
                        <span className="text-sm font-medium">{index + 1}</span>
                      )
                    ) : (
                      <HelpCircle className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium mb-2">{question.question}</p>
                    <div className="space-y-1">
                      {question.options.map((option, optIndex) => {
                        const isUserAnswer = userAnswer === optIndex
                        const isCorrectAnswer = question.correctAnswer === optIndex

                        let textClass = "text-sm "
                        if (hasKnownAnswer) {
                          if (isCorrectAnswer) {
                            textClass += "text-green-600 font-medium"
                          } else if (isUserAnswer && !isCorrectAnswer) {
                            textClass += "text-red-600 line-through"
                          } else {
                            textClass += "text-muted-foreground"
                          }
                        } else {
                          if (isUserAnswer) {
                            textClass += "text-blue-600 font-medium"
                          } else {
                            textClass += "text-muted-foreground"
                          }
                        }

                        return (
                          <p key={optIndex} className={textClass}>
                            {String.fromCharCode(65 + optIndex)}. {option}
                            {hasKnownAnswer && isCorrectAnswer && ' ✓'}
                            {isUserAnswer && ' (your answer)'}
                          </p>
                        )
                      })}
                    </div>
                    {question.explanation && (
                      <p className="mt-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                        <strong>Explanation:</strong> {question.explanation}
                      </p>
                    )}
                    {!hasKnownAnswer && (
                      <p className="mt-2 text-sm text-blue-600 dark:text-blue-400">
                        <strong>Your answer:</strong> {userAnswer !== undefined ? `${String.fromCharCode(65 + userAnswer)}. ${question.options[userAnswer]}` : 'Not answered'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
