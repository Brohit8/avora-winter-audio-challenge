import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * useAudio - A stable hook for accessing microphone audio data
 *
 * DO NOT MODIFY THIS FILE - This is the stable audio pipeline for the challenge.
 * Modify src/visualizers/Visualizer.jsx instead.
 *
 * @param {Object} options
 * @param {number} options.fftSize - FFT size for frequency analysis (default: 2048)
 * @returns {Object} Audio data and controls
 */
export function useAudio({ fftSize = 2048 } = {}) {
  const [isActive, setIsActive] = useState(false)
  const [error, setError] = useState(null)
  const [frequencyData, setFrequencyData] = useState(() => new Uint8Array(fftSize / 2))
  const [timeDomainData, setTimeDomainData] = useState(() => new Uint8Array(fftSize))

  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const sourceRef = useRef(null)
  const streamRef = useRef(null)
  const animationFrameRef = useRef(null)

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
    setIsActive(false)
  }, [])

  const start = useCallback(async () => {
    try {
      setError(null)

      const AudioContext = window.AudioContext || window.webkitAudioContext
      audioContextRef.current = new AudioContext()

      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = fftSize
      analyserRef.current.smoothingTimeConstant = 0.8

      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      })

      sourceRef.current = audioContextRef.current.createMediaStreamSource(streamRef.current)
      sourceRef.current.connect(analyserRef.current)

      setIsActive(true)

      const updateData = () => {
        if (!analyserRef.current) return

        const freqData = new Uint8Array(analyserRef.current.frequencyBinCount)
        const timeData = new Uint8Array(analyserRef.current.fftSize)

        analyserRef.current.getByteFrequencyData(freqData)
        analyserRef.current.getByteTimeDomainData(timeData)

        setFrequencyData(freqData)
        setTimeDomainData(timeData)

        animationFrameRef.current = requestAnimationFrame(updateData)
      }

      updateData()
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Microphone permission denied')
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found')
      } else {
        setError(err.message)
      }
      setIsActive(false)
    }
  }, [fftSize])

  useEffect(() => {
    return () => {
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
