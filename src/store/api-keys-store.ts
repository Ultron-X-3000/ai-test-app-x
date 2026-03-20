import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface APIKeys {
  openai: string
  gemini: string
  deepseek: string
  nvidia: string
}

interface APIKeysStore {
  keys: APIKeys
  setKey: (provider: keyof APIKeys, key: string) => void
  getKey: (provider: keyof APIKeys) => string | undefined
  hasKey: (provider: keyof APIKeys) => boolean
  clearKey: (provider: keyof APIKeys) => void
  clearAllKeys: () => void
}

export const useAPIKeysStore = create<APIKeysStore>()(
  persist(
    (set, get) => ({
      keys: {
        openai: '',
        gemini: '',
        deepseek: '',
        nvidia: ''
      },

      setKey: (provider, key) =>
        set((state) => ({
          keys: { ...state.keys, [provider]: key }
        })),

      getKey: (provider) => get().keys[provider] || undefined,

      hasKey: (provider) => {
        const key = get().keys[provider]
        return key !== undefined && key !== null && key.trim() !== ''
      },

      clearKey: (provider) =>
        set((state) => ({
          keys: { ...state.keys, [provider]: '' }
        })),

      clearAllKeys: () =>
        set({
          keys: { openai: '', gemini: '', deepseek: '', nvidia: '' }
        })
    }),
    {
      name: 'ai-test-api-keys'
    }
  )
)
