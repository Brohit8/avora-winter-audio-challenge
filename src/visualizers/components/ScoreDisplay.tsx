interface ScoreDisplayProps {
  score: number
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
}

export function ScoreDisplay({ score }: ScoreDisplayProps) {
  // Format score with leading zeros (5 digits)
  const formattedScore = score.toString().padStart(5, '0')

  return (
    <div style={containerStyle}>
      {formattedScore}
    </div>
  )
}
