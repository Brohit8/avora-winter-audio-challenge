import { useState } from 'react'
import { FrequencyDivisionSlider } from './FrequencyDivisionSlider'
import { baseOverlayStyle } from './overlayStyles'

interface SetupOverlayProps {
  divisionBin: number
  onDivisionChange: (bin: number) => void
  onStartRace: () => void
  onRequestMic: () => Promise<void>
}

// Detect mobile via touch capability and screen width
function isMobileDevice(): boolean {
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  const isNarrow = window.innerWidth < 768
  return hasTouch && isNarrow
}

const overlayStyle: React.CSSProperties = {
  ...baseOverlayStyle,
  gap: '20px',
  padding: '20px',
  boxSizing: 'border-box',
}

const titleStyle: React.CSSProperties = {
  fontSize: 'clamp(1rem, 5vw, 2.5rem)',
  fontWeight: 700,
  color: '#ffffff',
  letterSpacing: '0.05em',
  textAlign: 'center',
  margin: 0,
  textTransform: 'uppercase',
  maxWidth: '100%',
  wordWrap: 'break-word',
}

const instructionsStyle: React.CSSProperties = {
  fontSize: 'clamp(0.875rem, 2.5vw, 1.125rem)',
  color: 'rgba(255, 255, 255, 0.85)',
  textAlign: 'center',
  lineHeight: 1.6,
  maxWidth: '320px',
  margin: '0 0 8px 0',
}

const buttonStyle: React.CSSProperties = {
  fontSize: 'clamp(1rem, 3vw, 1.25rem)',
  fontWeight: 600,
  padding: '12px 32px',
  borderRadius: '8px',
  border: 'none',
  backgroundColor: '#ffffff',
  color: '#000000',
  cursor: 'pointer',
  marginTop: '8px',
  minHeight: '48px',
  minWidth: '160px',
}

const errorStyle: React.CSSProperties = {
  color: '#ff6b6b',
  fontSize: 'clamp(0.75rem, 2vw, 0.875rem)',
  textAlign: 'center',
  maxWidth: '280px',
  margin: '8px 0 0 0',
}

export function SetupOverlay({
  divisionBin,
  onDivisionChange,
  onStartRace,
  onRequestMic,
}: SetupOverlayProps) {
  const [micError, setMicError] = useState<string | null>(null)

  const handleStartClick = async () => {
    setMicError(null)
    try {
      await onRequestMic()
      onStartRace()
    } catch {
      // Mic rejected - check if mobile or desktop
      if (isMobileDevice()) {
        setMicError('Microphone access is required to play on mobile devices.')
      } else {
        // Desktop: proceed with keyboard controls
        onStartRace()
      }
    }
  }

  return (
    <div style={overlayStyle}>
      <h1 style={titleStyle}>Avora Surf</h1>

      <p style={instructionsStyle}>
        Hum/Sing to duck. Whistle/Snap to jump.<br />
        Avoid dental disasters!
      </p>

      <FrequencyDivisionSlider
        divisionBin={divisionBin}
        onDivisionChange={onDivisionChange}
      />

      <button style={buttonStyle} onClick={handleStartClick}>
        Start
      </button>

      {micError && <p style={errorStyle}>{micError}</p>}
    </div>
  )
}
