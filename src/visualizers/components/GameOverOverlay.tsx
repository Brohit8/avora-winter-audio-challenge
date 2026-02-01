interface GameOverOverlayProps {
  score: number
  onPlayAgain: () => void
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

const titleStyle: React.CSSProperties = {
  color: '#ff4444',
  fontSize: 'clamp(2rem, 8vw, 3rem)',
  margin: 0,
  fontWeight: 700,
}

const scoreStyle: React.CSSProperties = {
  color: '#ffffff',
  fontSize: 'clamp(1.5rem, 6vw, 2.5rem)',
  margin: 0,
  fontFamily: 'monospace',
}

const buttonStyle: React.CSSProperties = {
  marginTop: '16px',
  padding: '12px 32px',
  fontSize: '18px',
  fontWeight: 600,
  color: '#ffffff',
  backgroundColor: '#4a90d9',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
}

export function GameOverOverlay({ score, onPlayAgain }: GameOverOverlayProps) {
  const formattedScore = score.toString().padStart(5, '0')

  return (
    <div style={overlayStyle}>
      <h2 style={titleStyle}>Game Over</h2>
      <p style={scoreStyle}>Score: {formattedScore}</p>
      <button style={buttonStyle} onClick={onPlayAgain}>
        Play Again
      </button>
    </div>
  )
}
