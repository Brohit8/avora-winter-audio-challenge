import { useState, useEffect, useRef } from 'react'
import { baseOverlayStyle } from './overlayStyles'

interface CountdownOverlayProps {
  onComplete: () => void
}

const overlayStyle: React.CSSProperties = {
  ...baseOverlayStyle,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  pointerEvents: 'none',
}

const countdownTextStyle: React.CSSProperties = {
  fontSize: 'clamp(4rem, 20vw, 10rem)',
  fontWeight: 700,
  color: '#ffffff',
  textAlign: 'center',
  textShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
}

const COUNTDOWN_STEPS = ['3', '2', '1', 'GO!']
const STEP_DURATION = 800 // ms per step
const GO_DELAY = 400 // ms to show "GO!" before completing

export function CountdownOverlay({ onComplete }: CountdownOverlayProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (stepIndex < COUNTDOWN_STEPS.length) {
      const timer = setTimeout(() => {
        if (stepIndex === COUNTDOWN_STEPS.length - 1) {
          // Last step (GO!), wait a moment then complete
          completeTimerRef.current = setTimeout(onComplete, GO_DELAY)
        } else {
          setStepIndex(stepIndex + 1)
        }
      }, STEP_DURATION)

      return () => {
        clearTimeout(timer)
        if (completeTimerRef.current) {
          clearTimeout(completeTimerRef.current)
        }
      }
    }
  }, [stepIndex, onComplete])

  return (
    <div style={overlayStyle}>
      <span style={countdownTextStyle}>
        {COUNTDOWN_STEPS[stepIndex]}
      </span>
    </div>
  )
}
