import { useRef, useEffect, useState } from 'react'
import type { VisualizerProps, Screen, FrequencyRange } from './types'
import {
  DEFAULT_RED_RANGE,
  DEFAULT_BLUE_RANGE,
  BASE_SPEED_MULTIPLIER,
  WHISTLE_BOOST,
  SINGING_BOOST,
  GUTTER_HEIGHT,
  GUTTER_GAP,
  BOAT_RADIUS,
  CANVAS_PADDING,
  COLORS,
} from './constants'
import { getFrequencyAverage } from './utils/audio'
import { FrequencySlider } from './components/FrequencySlider'


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
  timeDomainData: _timeDomainData,
  isActive: _isActive,
  width,
  height,
}: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [screen, setScreen] = useState<Screen>('setup')
  const [winner, setWinner] = useState<'red' | 'blue' | null>(null)
  // Frequency ranges for each boat (FFT bin indices)
  const [boat1Range, setBoat1Range] = useState<FrequencyRange>(DEFAULT_RED_RANGE)
  const [boat2Range, setBoat2Range] = useState<FrequencyRange>(DEFAULT_BLUE_RANGE)
  // Boat positions: 0 = starting line, 1 = finish line
  const boat1PosRef = useRef<number>(0)
  const boat2PosRef = useRef<number>(0)

  function resetBoatPositions() {
    boat1PosRef.current = 0
    boat2PosRef.current = 0
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Calculate positions based on canvas size
    const gutterWidth = width - CANVAS_PADDING * 2
    const centerY = height / 2
    const gutter1Y = centerY - GUTTER_GAP / 2 - GUTTER_HEIGHT
    const gutter2Y = centerY + GUTTER_GAP / 2
    const startX = CANVAS_PADDING + BOAT_RADIUS + 10
    const finishX = width - CANVAS_PADDING - 20 - BOAT_RADIUS  // Where boat center reaches finish

    let frameId: number

    // Draw function: renders the entire scene
    function draw() {
      if (!ctx) return

      // Clear canvas with black background
      ctx.fillStyle = COLORS.background
      ctx.fillRect(0, 0, width, height)

      // Draw gutters (water channels)
      ctx.fillStyle = COLORS.water
      ctx.fillRect(CANVAS_PADDING, gutter1Y, gutterWidth, GUTTER_HEIGHT)
      ctx.fillRect(CANVAS_PADDING, gutter2Y, gutterWidth, GUTTER_HEIGHT)

      // Calculate boat X positions by interpolating between start and finish
      const boat1X = startX + boat1PosRef.current * (finishX - startX)
      const boat2X = startX + boat2PosRef.current * (finishX - startX)

      // Draw red boat (top gutter)
      ctx.fillStyle = COLORS.red.primary
      ctx.beginPath()
      ctx.arc(boat1X, gutter1Y + GUTTER_HEIGHT / 2, BOAT_RADIUS, 0, Math.PI * 2)
      ctx.fill()

      // Draw blue boat (bottom gutter)
      ctx.fillStyle = COLORS.blue.primary
      ctx.beginPath()
      ctx.arc(boat2X, gutter2Y + GUTTER_HEIGHT / 2, BOAT_RADIUS, 0, Math.PI * 2)
      ctx.fill()

      // Draw finish line
      ctx.strokeStyle = COLORS.finishLine
      ctx.lineWidth = 3
      ctx.setLineDash([10, 5])
      ctx.beginPath()
      ctx.moveTo(width - CANVAS_PADDING - 20, gutter1Y - 10)
      ctx.lineTo(width - CANVAS_PADDING - 20, gutter2Y + GUTTER_HEIGHT + 10)
      ctx.stroke()
      ctx.setLineDash([])

    }

    // Animation loop: updates positions during race, then draws
    function animate() {
      // During race, update boat positions from audio data
      if (screen === 'race' && frequencyData.current) {
        const boat1Speed = getFrequencyAverage(frequencyData.current, boat1Range.start, boat1Range.end)
        const boat2Speed = getFrequencyAverage(frequencyData.current, boat2Range.start, boat2Range.end)

        boat1PosRef.current += boat1Speed * BASE_SPEED_MULTIPLIER * WHISTLE_BOOST
        boat2PosRef.current += boat2Speed * BASE_SPEED_MULTIPLIER * SINGING_BOOST

        // Clamp at finish line (can't go past 1)
        boat1PosRef.current = Math.min(boat1PosRef.current, 1)
        boat2PosRef.current = Math.min(boat2PosRef.current, 1)

        // Check for winner (first to reach position 1)
        if (boat1PosRef.current >= 1 || boat2PosRef.current >= 1) {
          // Determine winner (if tie, whoever is further ahead)
          if (boat1PosRef.current > boat2PosRef.current) {
            setWinner('red')
          } else {
            setWinner('blue')
          }
          setScreen('winner')
        }
      }

      draw()

      // Schedule next frame
      frameId = requestAnimationFrame(animate)
    }

    // Start the animation loop
    frameId = requestAnimationFrame(animate)

    // Cleanup: cancel animation frame when effect re-runs or component unmounts
    return () => {
      cancelAnimationFrame(frameId)
    }
  }, [screen, boat1Range, boat2Range, width, height, frequencyData])

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
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          gap: '20px',
        }}>
          <FrequencySlider
            color="red"
            label="Red Boat"
            range={boat1Range}
            onRangeChange={setBoat1Range}
          />

          <FrequencySlider
            color="blue"
            label="Blue Boat"
            range={boat2Range}
            onRangeChange={setBoat2Range}
          />

          <button onClick={() => {
            resetBoatPositions()
            setScreen('race')
          }}>
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
          gap: '16px',
        }}>
          <h2 style={{
            color: winner === 'red' ? COLORS.red.primary : COLORS.blue.primary,
            fontSize: '48px',
            margin: 0,
          }}>
            {winner === 'red' ? 'Red' : 'Blue'} Wins!
          </h2>
          <button onClick={() => {
            resetBoatPositions()
            setWinner(null)
            setScreen('setup')
          }}>
            Race Again
          </button>
        </div>
      )}
    </div>
  )

}
