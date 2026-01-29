import { useRef, useEffect, useState } from 'react'

export interface VisualizerProps {
  frequencyData: React.RefObject<Uint8Array<ArrayBuffer>>
  timeDomainData: React.RefObject<Uint8Array<ArrayBuffer>>
  isActive: boolean
  width: number
  height: number
}
// Screen states for our game
type Screen = 'setup' | 'race' | 'winner'


/**
 * Visualizer - YOUR CANVAS FOR THE CHALLENGE
 *
 * Audio Pipeline (handled by useAudio):
 *   The useAudio hook captures microphone input via the Web Audio API. It creates
 *   an AnalyserNode that performs real-time FFT (Fast Fourier Transform) analysis,
 *   breaking the audio signal into frequency components. The data refs are updated
 *   every frame (~60fps) via requestAnimationFrame—no React re-renders involved.
 *
 * Props provided:
 *   - frequencyData: Ref to Uint8Array of 1024 FFT frequency bins (0-255 values).
 *       Index 0 is the lowest frequency (DC), higher indices = higher frequencies.
 *   - timeDomainData: Ref to Uint8Array of 2048 waveform samples (0-255 values).
 *       Represents the raw audio signal; 128 is silence, 0/255 are extremes.
 *   - isActive: boolean indicating if audio is streaming
 *   - width: Canvas width (fixed, do not override)
 *   - height: Canvas height (fixed, do not override)
 */
export function Visualizer({
  frequencyData,
  timeDomainData,
  isActive,
  width,
  height,
}: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [screen, setScreen] = useState<Screen>('setup')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Layout constants
    const GUTTER_HEIGHT = 60
    const GUTTER_GAP = 40
    const BOAT_RADIUS = 15
    const PADDING = 50

    // Calculate positions based on canvas size
    const gutterWidth = width - PADDING * 2
    const centerY = height / 2
    const gutter1Y = centerY - GUTTER_GAP / 2 - GUTTER_HEIGHT
    const gutter2Y = centerY + GUTTER_GAP / 2
    const startX = PADDING + BOAT_RADIUS + 10

    // Clear canvas with black background
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, width, height)

    // Draw gutters (water channels)
    ctx.fillStyle = '#1e3a5f'
    ctx.fillRect(PADDING, gutter1Y, gutterWidth, GUTTER_HEIGHT)
    ctx.fillRect(PADDING, gutter2Y, gutterWidth, GUTTER_HEIGHT)

    // Draw red boat (top gutter)
    ctx.fillStyle = '#ef4444'
    ctx.beginPath()
    ctx.arc(startX, gutter1Y + GUTTER_HEIGHT / 2, BOAT_RADIUS, 0, Math.PI * 2)
    ctx.fill()

    // Draw blue boat (bottom gutter)
    ctx.fillStyle = '#3b82f6'
    ctx.beginPath()
    ctx.arc(startX, gutter2Y + GUTTER_HEIGHT / 2, BOAT_RADIUS, 0, Math.PI * 2)
    ctx.fill()

    // Draw finish line
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 3
    ctx.setLineDash([10, 5])
    ctx.beginPath()
    ctx.moveTo(width - PADDING - 20, gutter1Y - 10)
    ctx.lineTo(width - PADDING - 20, gutter2Y + GUTTER_HEIGHT + 10)
    ctx.stroke()
    ctx.setLineDash([])


  }, [isActive, frequencyData, timeDomainData, width, height])

  return (
    <div style={{ position: 'relative', width, height }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ display: 'block' }}
      />

      {/* Setup screen overlay */}
      {screen === 'setup' && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
        }}>
          <button onClick={() => setScreen('race')}>
            Start Race
          </button>
        </div>
      )}

      {/* Winner screen overlay */}
      {screen === 'winner' && (
        <div style={{
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
        }}>
          <h2 style={{ color: 'white' }}>Winner!</h2>
          <button onClick={() => setScreen('setup')}>
            Race Again
          </button>
        </div>
      )}
    </div>
  )

}
