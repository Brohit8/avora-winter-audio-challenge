import { useState, useEffect } from 'react'

interface CountdownOverlayProps {
  onComplete: () => void
}

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
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

export function CountdownOverlay({ onComplete }: CountdownOverlayProps) {
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    if (stepIndex < COUNTDOWN_STEPS.length) {
      const timer = setTimeout(() => {
        if (stepIndex === COUNTDOWN_STEPS.length - 1) {
          // Last step (GO!), wait a moment then complete
          setTimeout(onComplete, 400)
        } else {
          setStepIndex(stepIndex + 1)
        }
      }, STEP_DURATION)

      return () => clearTimeout(timer)
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
