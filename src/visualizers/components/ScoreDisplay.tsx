interface ScoreDisplayProps {
  score: number
  highScore: number
}

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'clamp(12px, 3vw, 24px)',
  right: 'clamp(12px, 3vw, 24px)',
  fontFamily: 'monospace',
  fontWeight: 700,
  fontSize: 'clamp(1.25rem, 5vw, 2rem)',
  color: '#ffffff',
  textShadow: '0 2px 8px rgba(0, 0, 0, 0.6)',
  userSelect: 'none',
  pointerEvents: 'none',
  zIndex: 10,
  display: 'flex',
  gap: 'clamp(16px, 4vw, 32px)',
}

const highScoreStyle: React.CSSProperties = {
  opacity: 0.7,
}

export function ScoreDisplay({ score, highScore }: ScoreDisplayProps) {
  const formattedScore = score.toString().padStart(5, '0')
  const formattedHighScore = highScore.toString().padStart(5, '0')

  return (
    <div style={containerStyle}>
      {highScore > 0 && (
        <span style={highScoreStyle}>HI {formattedHighScore}</span>
      )}
      <span>{formattedScore}</span>
    </div>
  )
}
