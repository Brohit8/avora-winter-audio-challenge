import type { FrequencyRange } from '../types'
import { FrequencySlider } from './FrequencySlider'

interface SetupOverlayProps {
  boat1Range: FrequencyRange
  boat2Range: FrequencyRange
  onBoat1RangeChange: (range: FrequencyRange) => void
  onBoat2RangeChange: (range: FrequencyRange) => void
  onStartRace: () => void
  onRequestMic: () => Promise<void>
}

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
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

export function SetupOverlay({
  boat1Range,
  boat2Range,
  onBoat1RangeChange,
  onBoat2RangeChange,
  onStartRace,
  onRequestMic,
}: SetupOverlayProps) {
  const handleStartClick = async () => {
    await onRequestMic()
    onStartRace()
  }

  return (
    <div style={overlayStyle}>
      <h1 style={titleStyle}>Avora Raingutter Regatta</h1>

      <p style={instructionsStyle}>
        Create wind with your voice!<br />
        Louder = faster. Each boat catches a different pitch range.
      </p>

      <FrequencySlider
        color="red"
        label="Red Boat"
        range={boat1Range}
        onRangeChange={onBoat1RangeChange}
      />

      <FrequencySlider
        color="blue"
        label="Blue Boat"
        range={boat2Range}
        onRangeChange={onBoat2RangeChange}
      />

      <button style={buttonStyle} onClick={handleStartClick}>
        Start Race
      </button>
    </div>
  )
}
