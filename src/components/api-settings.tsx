'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Settings, Eye, EyeOff, Check, X, Trash2, Key, ExternalLink } from 'lucide-react'
import { useAPIKeysStore } from '@/store/api-keys-store'

const providerInfo = {
  openai: {
    name: 'OpenAI (ChatGPT)',
    placeholder: 'sk-...',
    getUrl: 'https://platform.openai.com/api-keys'
  },
  gemini: {
    name: 'Google Gemini',
    placeholder: 'AIza...',
    getUrl: 'https://aistudio.google.com/apikey'
  },
  deepseek: {
    name: 'DeepSeek',
    placeholder: 'sk-...',
    getUrl: 'https://platform.deepseek.com/api_keys'
  },
  nvidia: {
    name: 'NVIDIA NIM',
    placeholder: 'nvapi-...',
    getUrl: 'https://build.nvidia.com/'
  }
} as const

export default function APISettings() {
  const { keys, setKey, hasKey, clearKey } = useAPIKeysStore()
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({
    openai: false,
    gemini: false,
    deepseek: false,
    nvidia: false
  })
  const [tempKeys, setTempKeys] = useState<Record<string, string>>({
    openai: '',
    gemini: '',
    deepseek: '',
    nvidia: ''
  })

  // Fix hydration - only render client-specific content after mount
  useEffect(() => {
    setMounted(true)
    setTempKeys({
      openai: keys.openai,
      gemini: keys.gemini,
      deepseek: keys.deepseek,
      nvidia: keys.nvidia
    })
  }, [keys])

  const toggleShowKey = (provider: string) => {
    setShowKeys(prev => ({ ...prev, [provider]: !prev[provider] }))
  }

  const handleSave = () => {
    Object.entries(tempKeys).forEach(([provider, key]) => {
      setKey(provider as keyof typeof keys, key)
    })
    setIsOpen(false)
  }

  const handleClear = (provider: keyof typeof keys) => {
    clearKey(provider)
    setTempKeys(prev => ({ ...prev, [provider]: '' }))
  }

  const hasAnyKey = mounted && (hasKey('openai') || hasKey('gemini') || hasKey('deepseek') || hasKey('nvidia'))

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Settings className="w-4 h-4" />
          {hasAnyKey && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            API Key Settings
          </DialogTitle>
          <DialogDescription>
            Add your own API keys for direct access, or use the built-in API (no key needed).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Info Banner */}
          <Card className="bg-muted/50">
            <CardContent className="p-3">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> The app works without adding keys using the built-in API.
                Add your own keys for direct access to OpenAI, Gemini, or DeepSeek APIs.
              </p>
            </CardContent>
          </Card>

          {/* API Key Inputs */}
          {(Object.keys(providerInfo) as Array<keyof typeof providerInfo>).map((provider) => {
            const info = providerInfo[provider]
            const hasProviderKey = hasKey(provider)
            const currentValue = tempKeys[provider] || ''

            return (
              <div key={provider} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor={provider} className="flex items-center gap-2">
                    {info.name}
                    {hasProviderKey && (
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <Check className="w-3 h-3" />
                        Saved
                      </span>
                    )}
                  </Label>
                  <a
                    href={info.getUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    Get API Key
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id={provider}
                      type={showKeys[provider] ? 'text' : 'password'}
                      placeholder={info.placeholder}
                      value={currentValue}
                      onChange={(e) => setTempKeys(prev => ({ ...prev, [provider]: e.target.value }))}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => toggleShowKey(provider)}
                    >
                      {showKeys[provider] ? (
                        <EyeOff className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  {currentValue && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleClear(provider)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
