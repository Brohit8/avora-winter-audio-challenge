import { COLORS } from '../constants'

interface WinnerOverlayProps {
  winner: 'red' | 'blue'
  onRaceAgain: () => void
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
  gap: '16px',
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

export function WinnerOverlay({ winner, onRaceAgain }: WinnerOverlayProps) {
  return (
    <div style={overlayStyle}>
      <h2 style={{
        color: winner === 'red' ? COLORS.red.primary : COLORS.blue.primary,
        fontSize: '48px',
        margin: 0,
      }}>
        {winner === 'red' ? 'Red' : 'Blue'} Wins!
      </h2>
      <button style={buttonStyle} onClick={onRaceAgain}>
        Race Again
      </button>
    </div>
  )
}
