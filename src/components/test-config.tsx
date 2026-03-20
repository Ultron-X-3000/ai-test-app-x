'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Brain, Sparkles, Zap, Timer, FileText, Wand2, Cpu } from 'lucide-react'
import { useTestStore, AIProvider, Difficulty, TestMode } from '@/store/test-store'

interface TestConfigProps {
  onProcess: () => void
  isLoading: boolean
}

const providerInfo: Record<AIProvider, { name: string; icon: typeof Brain; description: string }> = {
  openai: {
    name: 'ChatGPT',
    icon: Brain,
    description: 'OpenAI GPT-4o - Advanced vision and reasoning'
  },
  gemini: {
    name: 'Google Gemini',
    icon: Sparkles,
    description: 'Gemini 2.0 Flash - Fast multimodal AI'
  },
  deepseek: {
    name: 'DeepSeek',
    icon: Zap,
    description: 'DeepSeek Chat - Efficient language model'
  },
  nvidia: {
    name: 'NVIDIA NIM',
    icon: Cpu,
    description: 'NVIDIA AI - Powerful GPU-accelerated AI'
  }
}

export default function TestConfig({ onProcess, isLoading }: TestConfigProps) {
  const {
    testMode,
    selectedProvider,
    setProvider,
    questionCount,
    setQuestionCount,
    difficulty,
    setDifficulty,
    timerEnabled,
    setTimerEnabled,
    timerMinutes,
    setTimerMinutes
  } = useTestStore()

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="w-5 h-5" />
          Test Configuration
        </CardTitle>
        <CardDescription>
          {testMode === 'generate' ? 'Configure how AI will generate your test' : 'Configure how AI will parse your paper'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* AI Provider Selection */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">AI Provider</Label>
          <RadioGroup
            value={selectedProvider}
            onValueChange={(value) => setProvider(value as AIProvider)}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
          >
            {(Object.entries(providerInfo) as [AIProvider, typeof providerInfo[AIProvider]][]).map(([key, info]) => {
              const Icon = info.icon
              return (
                <div key={key} className="relative">
                  <RadioGroupItem
                    value={key}
                    id={key}
                    className="peer sr-only"
                  />
                  <label
                    htmlFor={key}
                    className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-muted cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/50"
                  >
                    <Icon className="w-6 h-6" />
                    <span className="font-medium text-sm">{info.name}</span>
                    <span className="text-xs text-muted-foreground text-center">{info.description}</span>
                  </label>
                </div>
              )
            })}
          </RadioGroup>
        </div>

        {/* Question Count (only for generate mode) */}
        {testMode === 'generate' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Number of Questions</Label>
              <span className="text-2xl font-bold text-primary">{questionCount}</span>
            </div>
            <Slider
              value={[questionCount]}
              onValueChange={([value]) => setQuestionCount(value)}
              min={3}
              max={20}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>3 questions</span>
              <span>20 questions</span>
            </div>
          </div>
        )}

        {/* Difficulty (only for generate mode) */}
        {testMode === 'generate' && (
          <div className="space-y-3">
            <Label className="text-base font-semibold">Difficulty Level</Label>
            <Select value={difficulty} onValueChange={(value) => setDifficulty(value as Difficulty)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">
                  <div className="flex flex-col">
                    <span className="font-medium">Easy</span>
                    <span className="text-xs text-muted-foreground">Basic recall and identification</span>
                  </div>
                </SelectItem>
                <SelectItem value="medium">
                  <div className="flex flex-col">
                    <span className="font-medium">Medium</span>
                    <span className="text-xs text-muted-foreground">Application and analysis</span>
                  </div>
                </SelectItem>
                <SelectItem value="hard">
                  <div className="flex flex-col">
                    <span className="font-medium">Hard</span>
                    <span className="text-xs text-muted-foreground">Synthesis and evaluation</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Timer Settings */}
        <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Timer className="w-5 h-5 text-primary" />
              <Label className="text-base font-semibold">Timer Mode</Label>
            </div>
            <Switch
              checked={timerEnabled}
              onCheckedChange={setTimerEnabled}
            />
          </div>

          {timerEnabled && (
            <div className="space-y-2 pt-2">
              <Label>Time Limit (minutes)</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={1}
                  max={120}
                  value={timerMinutes}
                  onChange={(e) => setTimerMinutes(Math.max(1, Math.min(120, parseInt(e.target.value) || 1)))}
                  className="w-24"
                />
                <span className="text-muted-foreground">minutes</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Timer will count down during the test. Auto-submit when time runs out.
              </p>
            </div>
          )}
        </div>

        {/* Process Button */}
        <Button
          size="lg"
          className="w-full"
          onClick={onProcess}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {testMode === 'generate' ? 'Generating Test...' : 'Parsing Paper...'}
            </>
          ) : (
            <>
              {testMode === 'generate' ? (
                <>
                  <Wand2 className="w-4 h-4 mr-2" />
                  Generate Test with {providerInfo[selectedProvider].name}
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Extract Questions with {providerInfo[selectedProvider].name}
                </>
              )}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
