'use client'

import { useEffect, useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Play, Pause, RotateCcw, Clock } from 'lucide-react'
import { useTestStore } from '@/store/test-store'

interface TimerDisplayProps {
  onTimeUp?: () => void
}

export default function TimerDisplay({ onTimeUp }: TimerDisplayProps) {
  const {
    timerEnabled,
    timeRemaining,
    isTimerRunning,
    setTimeRemaining,
    setIsTimerRunning,
    timerMinutes
  } = useTestStore()

  const onTimeUpRef = useRef(onTimeUp)

  // Update ref in effect, not during render
  useEffect(() => {
    onTimeUpRef.current = onTimeUp
  }, [onTimeUp])

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }, [])

  useEffect(() => {
    if (timerEnabled && timeRemaining === 0 && isTimerRunning) {
      setIsTimerRunning(false)
      // Call onTimeUp in effect, not during render
      if (onTimeUpRef.current) {
        onTimeUpRef.current()
      }
    }
  }, [timeRemaining, isTimerRunning, timerEnabled, setIsTimerRunning])

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (isTimerRunning && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining(timeRemaining - 1)
      }, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isTimerRunning, timeRemaining, setTimeRemaining])

  const toggleTimer = useCallback(() => {
    if (timeRemaining === 0) {
      setTimeRemaining(timerMinutes * 60)
    }
    setIsTimerRunning(!isTimerRunning)
  }, [isTimerRunning, timeRemaining, timerMinutes, setIsTimerRunning, setTimeRemaining])

  const resetTimer = useCallback(() => {
    setIsTimerRunning(false)
    setTimeRemaining(timerMinutes * 60)
  }, [timerMinutes, setIsTimerRunning, setTimeRemaining])

  const addMinute = useCallback(() => {
    setTimeRemaining(timeRemaining + 60)
  }, [timeRemaining, setTimeRemaining])

  const subtractMinute = useCallback(() => {
    if (timeRemaining >= 60) {
      setTimeRemaining(timeRemaining - 60)
    }
  }, [timeRemaining, setTimeRemaining])

  if (!timerEnabled) return null

  const progress = timerMinutes > 0 ? ((timerMinutes * 60 - timeRemaining) / (timerMinutes * 60)) * 100 : 0
  const isLowTime = timeRemaining < 60 && timeRemaining > 0
  const isCritical = timeRemaining < 30 && timeRemaining > 0

  return (
    <Card className={`${isCritical ? 'border-red-500 animate-pulse' : isLowTime ? 'border-yellow-500' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Clock className={`w-5 h-5 ${isCritical ? 'text-red-500' : isLowTime ? 'text-yellow-500' : 'text-primary'}`} />
            <span className={`text-2xl font-mono font-bold ${isCritical ? 'text-red-500' : isLowTime ? 'text-yellow-500' : ''}`}>
              {formatTime(timeRemaining)}
            </span>
          </div>

          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ${isCritical ? 'bg-red-500' : isLowTime ? 'bg-yellow-500' : 'bg-primary'}`}
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={subtractMinute}
              disabled={timeRemaining < 60 || isTimerRunning}
            >
              -1m
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={addMinute}
              disabled={isTimerRunning}
            >
              +1m
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={toggleTimer}
            >
              {isTimerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={resetTimer}
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
