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
      <button onClick={onRaceAgain}>
        Race Again
      </button>
    </div>
  )
}
