import { baseOverlayStyle } from './overlayStyles'

interface GameOverOverlayProps {
  score: number
  highScore: number
  isNewHighScore: boolean
  onPlayAgain: () => void
}

const overlayStyle: React.CSSProperties = {
  ...baseOverlayStyle,
  gap: '16px',
}

const titleStyle: React.CSSProperties = {
  color: '#ff4444',
  fontSize: 'clamp(2rem, 8vw, 3rem)',
  margin: 0,
  fontWeight: 700,
}

const newHighScoreStyle: React.CSSProperties = {
  color: '#ffcc00',
  fontSize: 'clamp(1rem, 4vw, 1.5rem)',
  margin: 0,
  fontWeight: 600,
}

const scoreStyle: React.CSSProperties = {
  color: '#ffffff',
  fontSize: 'clamp(1.5rem, 6vw, 2.5rem)',
  margin: 0,
  fontFamily: 'monospace',
}

const highScoreStyle: React.CSSProperties = {
  color: '#ffffff',
  fontSize: 'clamp(1rem, 4vw, 1.5rem)',
  margin: 0,
  fontFamily: 'monospace',
  opacity: 0.7,
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

export function GameOverOverlay({ score, highScore, isNewHighScore, onPlayAgain }: GameOverOverlayProps) {
  const formattedScore = score.toString().padStart(5, '0')
  const formattedHighScore = highScore.toString().padStart(5, '0')

  return (
    <div style={overlayStyle}>
      <h2 style={titleStyle}>Game Over</h2>
      {isNewHighScore && <p style={newHighScoreStyle}>New High Score!</p>}
      <p style={scoreStyle}>Score: {formattedScore}</p>
      {!isNewHighScore && highScore > 0 && (
        <p style={highScoreStyle}>Best: {formattedHighScore}</p>
      )}
      <button style={buttonStyle} onClick={onPlayAgain}>
        Play Again
      </button>
    </div>
  )
}
