import { useState, useEffect, useRef, useCallback } from 'react'

export interface UseAudioOptions {
  fftSize?: number
}

export interface UseAudioReturn {
  /** Ref containing FFT frequency data (0-255 values). Updated in-place every frame. */
  frequencyData: React.RefObject<Uint8Array<ArrayBuffer>>
  /** Ref containing time-domain waveform data (0-255 values). Updated in-place every frame. */
  timeDomainData: React.RefObject<Uint8Array<ArrayBuffer>>
  /** Whether the microphone is active and streaming */
  isActive: boolean
  /** Error message if mic permission denied or unavailable */
  error: string | null
  /** Start microphone capture */
  start: () => Promise<void>
  /** Stop microphone capture */
  stop: () => void
}

/**
 * useAudio - A stable hook for accessing microphone audio data
 *
 * Returns refs that are updated in-place every frame. Consumers should
 * run their own requestAnimationFrame loop to read the data.
 *
 * DO NOT MODIFY THIS FILE - This is the stable audio pipeline for the challenge.
 * Modify src/visualizers/Visualizer.tsx instead.
 */
export function useAudio({ fftSize = 2048 }: UseAudioOptions = {}): UseAudioReturn {
  const [isActive, setIsActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Audio data buffers - updated in-place, no React re-renders
  const frequencyData = useRef(new Uint8Array(fftSize / 2))
  const timeDomainData = useRef(new Uint8Array(fftSize))

  // Web Audio API refs
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  // Track mounted state to prevent setState after unmount
  const mountedRef = useRef(true)

  const stop = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect()
      sourceRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    analyserRef.current = null

    if (mountedRef.current) {
      setIsActive(false)
    }
  }, [])

  const start = useCallback(async () => {
    // Stop any existing session first
    stop()

    try {
      if (mountedRef.current) {
        setError(null)
      }

      audioContextRef.current = new AudioContext()

      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = fftSize
      analyserRef.current.smoothingTimeConstant = 0.8

      // Allocate buffers sized to the analyser
      frequencyData.current = new Uint8Array(analyserRef.current.frequencyBinCount)
      timeDomainData.current = new Uint8Array(analyserRef.current.fftSize)

      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      })

      // Check if we were stopped/unmounted during await
      if (!mountedRef.current || !audioContextRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        return
      }

      sourceRef.current = audioContextRef.current.createMediaStreamSource(streamRef.current)
      sourceRef.current.connect(analyserRef.current)

      setIsActive(true)

      // Animation loop - updates refs in-place, no React involvement
      const updateData = () => {
        if (!analyserRef.current) return

        analyserRef.current.getByteFrequencyData(frequencyData.current)
        analyserRef.current.getByteTimeDomainData(timeDomainData.current)

        animationFrameRef.current = requestAnimationFrame(updateData)
      }

      updateData()
    } catch (err) {
      if (!mountedRef.current) return

      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Microphone permission denied')
        } else if (err.name === 'NotFoundError') {
          setError('No microphone found')
        } else {
          setError(err.message)
        }
      } else {
        setError('Unknown error occurred')
      }
      setIsActive(false)
    }
  }, [fftSize, stop])

  // Track mounted state and cleanup on unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      stop()
    }
  }, [stop])

  return {
    frequencyData,
    timeDomainData,
    isActive,
    error,
    start,
    stop,
  }
}
