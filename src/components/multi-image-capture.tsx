'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Camera, Upload, X, FlipHorizontal } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { VisuallyHidden } from '@/components/ui/visually-hidden'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CapturedImage } from '@/store/test-store'

interface MultiImageCaptureProps {
  images: CapturedImage[]
  onAddImage: (image: CapturedImage) => void
  onRemoveImage: (id: string) => void
  onClearImages: () => void
  onContinue: () => void
  mode: 'generate' | 'parse'
}

export default function MultiImageCapture({
  images,
  onAddImage,
  onRemoveImage,
  onContinue,
  mode
}: MultiImageCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const cameraInitRef = useRef(false)
  
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
  const [isReady, setIsReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  const generateId = () => `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // File upload handler
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return

      const reader = new FileReader()
      reader.onload = (event) => {
        const result = event.target?.result as string
        if (result) {
          onAddImage({
            id: generateId(),
            dataUrl: result,
            timestamp: Date.now()
          })
        }
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }, [onAddImage])

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setIsReady(false)
    cameraInitRef.current = false
  }, [])

  // Start camera stream
  const startCamera = useCallback(async (facing: 'user' | 'environment') => {
    try {
      setCameraError(null)
      setIsReady(false)
      stopCamera()

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setIsReady(true)
      }
    } catch (err: any) {
      console.error('Camera error:', err)
      setCameraError(err.message || 'Failed to access camera. Please check permissions.')
    }
  }, [stopCamera])

  // Open camera dialog
  const openCamera = useCallback(() => {
    setCameraError(null)
    cameraInitRef.current = false
    setIsCameraOpen(true)
  }, [])

  // Close camera dialog
  const closeCamera = useCallback(() => {
    stopCamera()
    setIsCameraOpen(false)
    setCameraError(null)
  }, [stopCamera])

  // Start camera when dialog opens
  useEffect(() => {
    if (isCameraOpen && !cameraInitRef.current) {
      cameraInitRef.current = true
      // Small delay to ensure video element is in DOM
      const timer = setTimeout(() => {
        startCamera(facingMode)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isCameraOpen, facingMode, startCamera])

  // Capture photo
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isReady) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    if (!context) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    if (facingMode === 'user') {
      context.translate(canvas.width, 0)
      context.scale(-1, 1)
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    const imageBase64 = canvas.toDataURL('image/jpeg', 0.95)
    onAddImage({
      id: generateId(),
      dataUrl: imageBase64,
      timestamp: Date.now()
    })

    closeCamera()
  }, [isReady, facingMode, onAddImage, closeCamera])

  // Toggle camera direction
  const toggleCamera = useCallback(() => {
    cameraInitRef.current = false
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user')
  }, [])

  const modeTitle = mode === 'generate' ? 'Generate Test' : 'Parse Question Paper'
  const modeDescription = mode === 'generate'
    ? 'Add photos of content to generate questions from'
    : 'Add photos of question papers to extract questions'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">{modeTitle}</h2>
        <p className="text-muted-foreground">{modeDescription}</p>
      </div>

      {/* Image Gallery */}
      {images.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Selected Images ({images.length})</h3>
            </div>
            <ScrollArea className="w-full">
              <div className="flex gap-3 pb-2">
                {images.map((image) => (
                  <div key={image.id} className="relative flex-shrink-0">
                    <img
                      src={image.dataUrl}
                      alt="Captured"
                      className="w-24 h-24 object-cover rounded-lg border"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                      onClick={() => onRemoveImage(image.id)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Add Image Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <Button
          size="lg"
          variant="outline"
          className="h-24 flex-col gap-2"
          onClick={openCamera}
        >
          <Camera className="w-6 h-6" />
          <span>Take Photo</span>
        </Button>

        <div className="relative">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileUpload}
            className="absolute inset-0 opacity-0 cursor-pointer z-10"
          />
          <Button
            size="lg"
            variant="outline"
            className="w-full h-24 flex-col gap-2 pointer-events-none"
          >
            <Upload className="w-6 h-6" />
            <span>Upload Files</span>
          </Button>
        </div>
      </div>

      {/* Continue Button */}
      <Button
        size="lg"
        className="w-full"
        disabled={images.length === 0}
        onClick={onContinue}
      >
        Continue with {images.length} image{images.length !== 1 ? 's' : ''}
      </Button>

      {/* Camera Modal */}
      <Dialog open={isCameraOpen} onOpenChange={(open) => !open && closeCamera()}>
        <DialogContent 
          showCloseButton={false}
          className="fixed inset-0 w-screen h-screen max-w-none m-0 p-0 bg-black border-none rounded-none z-[100] translate-x-0 translate-y-0 top-0 left-0"
        >
          <VisuallyHidden>
            <DialogTitle>Camera</DialogTitle>
          </VisuallyHidden>

          {cameraError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black text-white p-6 text-center">
              <Camera className="w-16 h-16 mb-4" />
              <p className="text-lg font-medium mb-2">Camera Error</p>
              <p className="text-sm text-gray-400 mb-4">{cameraError}</p>
              <div className="flex gap-3">
                <Button onClick={() => startCamera(facingMode)} variant="secondary">
                  Try Again
                </Button>
                <Button onClick={closeCamera} variant="outline" className="text-white border-white/30">
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Video - Full Screen */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
                style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
              />

              {/* Loading Overlay */}
              {!isReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                  <div className="text-center">
                    <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <div className="text-white text-lg">Starting camera...</div>
                  </div>
                </div>
              )}

              {/* Close Button - Top Left */}
              <Button
                variant="ghost"
                size="icon"
                onClick={closeCamera}
                className="absolute top-4 left-4 z-20 rounded-full bg-black/40 text-white hover:bg-black/60 h-12 w-12"
              >
                <X className="w-6 h-6" />
              </Button>

              {/* Bottom Controls - Overlay */}
              <div className="absolute bottom-0 left-0 right-0 z-20 p-6 pb-10 bg-gradient-to-t from-black/70 to-transparent">
                <div className="flex items-center justify-center gap-8 max-w-md mx-auto">
                  {/* Flip Camera Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleCamera}
                    disabled={!isReady}
                    className="rounded-full bg-white/20 text-white hover:bg-white/30 h-14 w-14 backdrop-blur-sm"
                  >
                    <FlipHorizontal className="w-7 h-7" />
                  </Button>

                  {/* Capture Button */}
                  <Button
                    size="lg"
                    onClick={capturePhoto}
                    disabled={!isReady}
                    className="rounded-full h-20 w-20 p-0 bg-white hover:bg-gray-100 shadow-lg"
                  >
                    <div className="w-16 h-16 rounded-full border-4 border-gray-400 flex items-center justify-center">
                      <Camera className="w-8 h-8 text-gray-600" />
                    </div>
                  </Button>

                  {/* Placeholder for symmetry */}
                  <div className="w-14 h-14" />
                </div>
              </div>
            </>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </DialogContent>
      </Dialog>
    </div>
  )
}
