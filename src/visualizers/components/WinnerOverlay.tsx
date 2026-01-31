import { COLORS } from '../constants'

interface WinnerOverlayProps {
  winner: 'red'
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

export function WinnerOverlay({ onRaceAgain }: WinnerOverlayProps) {
  return (
    <div style={overlayStyle}>
      <h2 style={{
        color: COLORS.red.primary,
        fontSize: '48px',
        margin: 0,
      }}>
        You Win!
      </h2>
      <button onClick={onRaceAgain}>
        Play Again
      </button>
    </div>
  )
}
