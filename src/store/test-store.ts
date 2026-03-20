import { create } from 'zustand'

export interface TestQuestion {
  id: number
  question: string
  options: string[]
  correctAnswer: number | null
  explanation: string
}

export interface TestData {
  title: string
  description: string
  sourceType?: 'generated' | 'parsed_paper'
  questions: TestQuestion[]
}

export interface TestResult {
  questionId: number
  selectedAnswer: number | null
  isCorrect: boolean | null
  timeSpent: number
}

export interface CapturedImage {
  id: string
  dataUrl: string
  timestamp: number
}

export type AIProvider = 'openai' | 'gemini' | 'deepseek' | 'nvidia'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type AppView = 'home' | 'generate' | 'parse' | 'config' | 'test' | 'results'
export type TestMode = 'generate' | 'parse'

interface TestStore {
  currentView: AppView
  setView: (view: AppView) => void
  testMode: TestMode
  setTestMode: (mode: TestMode) => void
  images: CapturedImage[]
  addImage: (image: CapturedImage) => void
  removeImage: (id: string) => void
  clearImages: () => void
  selectedProvider: AIProvider
  setProvider: (provider: AIProvider) => void
  questionCount: number
  setQuestionCount: (count: number) => void
  difficulty: Difficulty
  setDifficulty: (difficulty: Difficulty) => void
  testData: TestData | null
  setTestData: (data: TestData | null) => void
  currentQuestionIndex: number
  setCurrentQuestion: (index: number) => void
  answers: Map<number, number>
  setAnswer: (questionId: number, answerIndex: number) => void
  timerEnabled: boolean
  setTimerEnabled: (enabled: boolean) => void
  timerMinutes: number
  setTimerMinutes: (minutes: number) => void
  timeRemaining: number
  setTimeRemaining: (seconds: number) => void
  isTimerRunning: boolean
  setIsTimerRunning: (running: boolean) => void
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
  error: string | null
  setError: (error: string | null) => void
  results: TestResult[]
  setResults: (results: TestResult[]) => void
  resetTest: () => void
}

const initialState = {
  currentView: 'home' as AppView,
  testMode: 'generate' as TestMode,
  images: [] as CapturedImage[],
  selectedProvider: 'openai' as AIProvider,
  questionCount: 5,
  difficulty: 'medium' as Difficulty,
  testData: null,
  currentQuestionIndex: 0,
  answers: new Map<number, number>(),
  timerEnabled: false,
  timerMinutes: 10,
  timeRemaining: 0,
  isTimerRunning: false,
  isLoading: false,
  error: null,
  results: [],
}

export const useTestStore = create<TestStore>((set, get) => ({
  ...initialState,

  setView: (view) => set({ currentView: view }),
  setTestMode: (mode) => set({ testMode: mode }),
  setProvider: (provider) => set({ selectedProvider: provider }),
  setQuestionCount: (count) => set({ questionCount: count }),
  setDifficulty: (difficulty) => set({ difficulty: difficulty }),
  setTestData: (data) => set({ testData: data }),
  setCurrentQuestion: (index) => set({ currentQuestionIndex: index }),
  setAnswer: (questionId, answerIndex) =>
    set((state) => {
      const newAnswers = new Map(state.answers)
      newAnswers.set(questionId, answerIndex)
      return { answers: newAnswers }
    }),
  setTimerEnabled: (enabled) => set({ timerEnabled: enabled }),
  setTimerMinutes: (minutes) => set({ timerMinutes: minutes }),
  setTimeRemaining: (seconds) => set({ timeRemaining: seconds }),
  setIsTimerRunning: (running) => set({ isTimerRunning: running }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error: error }),
  setResults: (results) => set({ results: results }),

  addImage: (image) =>
    set((state) => ({
      images: [...state.images, image]
    })),

  removeImage: (id) =>
    set((state) => ({
      images: state.images.filter(img => img.id !== id)
    })),

  clearImages: () => set({ images: [] }),

  resetTest: () =>
    set({
      currentView: 'home',
      testMode: 'generate',
      images: [],
      testData: null,
      currentQuestionIndex: 0,
      answers: new Map(),
      timerEnabled: get().timerEnabled,
      timerMinutes: get().timerMinutes,
      timeRemaining: 0,
      isTimerRunning: false,
      isLoading: false,
      error: null,
      results: [],
      selectedProvider: get().selectedProvider,
      questionCount: get().questionCount,
      difficulty: get().difficulty,
    }),
}))
