'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Camera, FlipHorizontal, RefreshCw, Upload, Image as ImageIcon, GalleryVerticalEnd } from 'lucide-react'

interface CameraCaptureProps {
  onCapture: (imageBase64: string) => void
  capturedImage: string | null
  onRetake: () => void
}

export default function CameraCapture({ onCapture, capturedImage, onRetake }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
  const [error, setError] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [hasCamera, setHasCamera] = useState<boolean | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Detect if mobile device
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase()
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
      setIsMobile(isMobileDevice || isTouchDevice)
    }
    checkMobile()
  }, [])

  // Check if device has camera
  useEffect(() => {
    const checkCamera = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const cameras = devices.filter(device => device.kind === 'videoinput')
        setHasCamera(cameras.length > 0)
      } catch {
        setHasCamera(false)
      }
    }
    checkCamera()
  }, [])

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }, [])

  // Start camera when facingMode changes or component mounts
  useEffect(() => {
    if (capturedImage || !hasCamera) return

    let mounted = true

    const initCamera = async () => {
      try {
        stopStream()

        const newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        })

        if (mounted) {
          streamRef.current = newStream
          setIsReady(false)

          if (videoRef.current) {
            videoRef.current.srcObject = newStream
            videoRef.current.onloadedmetadata = () => {
              if (mounted) {
                videoRef.current?.play()
                setIsReady(true)
              }
            }
          }
        } else {
          newStream.getTracks().forEach(track => track.stop())
        }
      } catch (err: any) {
        if (mounted) {
          console.error('Camera error:', err)
          setError(err.message || 'Failed to access camera.')
        }
      }
    }

    initCamera()

    return () => {
      mounted = false
      stopStream()
    }
  }, [facingMode, capturedImage, hasCamera, stopStream])

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

    const imageBase64 = canvas.toDataURL('image/jpeg', 0.9)
    onCapture(imageBase64)
    stopStream()
  }, [isReady, facingMode, onCapture, stopStream])

  const toggleCamera = useCallback(() => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user')
  }, [])

  const handleFileUpload = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      if (result) {
        onCapture(result)
      }
    }
    reader.onerror = () => {
      setError('Failed to read file')
    }
    reader.readAsDataURL(file)
  }, [onCapture])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
    // Reset input so same file can be selected again
    if (e.target) {
      e.target.value = ''
    }
  }, [handleFileUpload])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileUpload(file)
    }
  }, [handleFileUpload])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleRetake = useCallback(() => {
    onRetake()
  }, [onRetake])

  const retryCamera = useCallback(() => {
    setError(null)
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user')
  }, [])

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  if (capturedImage) {
    return (
      <Card className="w-full max-w-2xl mx-auto overflow-hidden">
        <CardContent className="p-0 relative">
          <img
            src={capturedImage}
            alt="Captured"
            className="w-full h-auto max-h-[60vh] object-contain bg-black"
          />
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-3">
            <Button
              variant="secondary"
              size="lg"
              onClick={handleRetake}
              className="bg-white/90 hover:bg-white"
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              Retake
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Camera View (for mobile/devices with camera) */}
      {hasCamera && (
        <Card className="overflow-hidden">
          <CardContent className="p-0 relative">
            {error ? (
              <div className="flex flex-col items-center justify-center h-[40vh] bg-muted p-6 text-center">
                <Camera className="w-16 h-16 text-muted-foreground mb-4" />
                <p className="text-destructive font-medium mb-2">Camera Error</p>
                <p className="text-sm text-muted-foreground mb-4">{error}</p>
                <Button onClick={retryCamera}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              </div>
            ) : (
              <>
                <div className="relative bg-black aspect-video">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                  />
                  {!isReady && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <div className="animate-pulse text-white">Starting camera...</div>
                    </div>
                  )}
                </div>
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-3">
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={toggleCamera}
                    className="rounded-full bg-white/90 hover:bg-white h-12 w-12"
                    title={facingMode === 'user' ? 'Switch to back camera' : 'Switch to front camera'}
                  >
                    <FlipHorizontal className="w-5 h-5" />
                  </Button>
                  <Button
                    size="lg"
                    onClick={capturePhoto}
                    disabled={!isReady}
                    className="rounded-full h-14 w-14 p-0"
                    title="Take photo"
                  >
                    <Camera className="w-6 h-6" />
                  </Button>
                </div>
              </>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </CardContent>
        </Card>
      )}

      {/* File Upload Section */}
      <Card>
        <CardContent className="p-6">
          {/* Mobile: Simple upload button */}
          {isMobile ? (
            <div className="space-y-4">
              <Button
                variant="outline"
                size="lg"
                className="w-full h-20 flex-col gap-2"
                onClick={openFilePicker}
              >
                <GalleryVerticalEnd className="w-6 h-6" />
                <span>Choose from Gallery</span>
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <p className="text-xs text-center text-muted-foreground">
                Tap to select an image from your device
              </p>
            </div>
          ) : (
            /* Desktop: Drag & drop zone */
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={openFilePicker}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  {hasCamera ? <ImageIcon className="w-8 h-8 text-primary" /> : <Upload className="w-8 h-8 text-primary" />}
                </div>
                <div>
                  <p className="font-medium">
                    {hasCamera ? 'Or upload from device' : 'Upload an image'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Drag & drop or click to select
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Supports: JPG, PNG, WEBP, HEIC
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tips */}
      <div className="text-center text-sm text-muted-foreground">
        <p>
          {isMobile && hasCamera ? (
            <>Take a photo or choose from gallery</>
          ) : hasCamera ? (
            <>Use camera for quick capture or upload existing images</>
          ) : (
            <>Upload a photo of your question paper or study material</>
          )}
        </p>
      </div>
    </div>
  )
}
