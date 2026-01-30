import { useRef, useEffect, useState } from 'react'
import * as Slider from '@radix-ui/react-slider'

export interface VisualizerProps {
  frequencyData: React.RefObject<Uint8Array<ArrayBufferLike>>
  timeDomainData: React.RefObject<Uint8Array<ArrayBufferLike>>
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
  // timeDomainData and isActive available but unused in this visualization
  width,
  height,
}: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [screen, setScreen] = useState<Screen>('setup')
  // Frequency ranges for each boat (FFT bin indices)
  // Red boat: high frequencies (1200+ Hz) - upper mids, presence
  const [boat1Range, setBoat1Range] = useState({ start: 56, end: 200 })
  // Blue boat: low frequencies (0-1200 Hz) - bass, low mids, midrange
  const [boat2Range, setBoat2Range] = useState({ start: 0, end: 56 })
  const [draggingThumb, setDraggingThumb] = useState<'start' | 'end' | null>(null)
  // Stores the "other" thumb's position when we start dragging
  const dragAnchorRef = useRef<number>(0)
  // Boat positions: 0 = starting line, 1 = finish line
  const boat1PosRef = useRef<number>(0)
  const boat2PosRef = useRef<number>(0)

  // Audio processing constants
  const NOISE_THRESHOLD = 120    // Ignore values below this (0-255 scale)
  const MAX_SLIDER_BIN = 200     // ~4300 Hz - covers bass, voice, sax, whistling
  const HZ_PER_BIN = 21.5        // Approx Hz per FFT bin (44100 / 2048)

  // Get descriptive label for a single frequency (standard audio production terms)
  function getFrequencyLabel(hz: number): string {
    if (hz < 60) return 'Sub-Bass'
    if (hz < 250) return 'Bass'
    if (hz < 500) return 'Low Mids'
    if (hz < 2000) return 'Midrange'
    if (hz < 4000) return 'Upper Mids'
    return 'Presence'
  }

  function getFrequencyAverage(data: Uint8Array, startBin: number, endBin: number): number {
    if (startBin >= endBin) return 0
    let sum = 0
    for (let i = startBin; i < endBin; i++) {
      // Only count if above noise threshold
      const value = data[i] > NOISE_THRESHOLD ? data[i] - NOISE_THRESHOLD : 0
      sum += value
    }
    return sum / (endBin - startBin) / (255 - NOISE_THRESHOLD)
  }

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
    const SPEED_MULT = 0.01  // How fast boats move per unit of loudness
    const WHISTLE_BOOST = 30  // Boost for whistling (red boat) since energy is in ~3 bins but averaged over many
    const SINGING_BOOST = 2.2 // Boost for singing (blue boat) since energy spreads across harmonics

    // Calculate positions based on canvas size
    const gutterWidth = width - PADDING * 2
    const centerY = height / 2
    const gutter1Y = centerY - GUTTER_GAP / 2 - GUTTER_HEIGHT
    const gutter2Y = centerY + GUTTER_GAP / 2
    const startX = PADDING + BOAT_RADIUS + 10
    const finishX = width - PADDING - 20 - BOAT_RADIUS  // Where boat center reaches finish

    let frameId: number

    // Draw function: renders the entire scene
    function draw() {
      if (!ctx) return

      // Clear canvas with black background
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, width, height)

      // Draw gutters (water channels)
      ctx.fillStyle = '#1e3a5f'
      ctx.fillRect(PADDING, gutter1Y, gutterWidth, GUTTER_HEIGHT)
      ctx.fillRect(PADDING, gutter2Y, gutterWidth, GUTTER_HEIGHT)

      // Calculate boat X positions by interpolating between start and finish
      const boat1X = startX + boat1PosRef.current * (finishX - startX)
      const boat2X = startX + boat2PosRef.current * (finishX - startX)

      // Draw red boat (top gutter)
      ctx.fillStyle = '#ef4444'
      ctx.beginPath()
      ctx.arc(boat1X, gutter1Y + GUTTER_HEIGHT / 2, BOAT_RADIUS, 0, Math.PI * 2)
      ctx.fill()

      // Draw blue boat (bottom gutter)
      ctx.fillStyle = '#3b82f6'
      ctx.beginPath()
      ctx.arc(boat2X, gutter2Y + GUTTER_HEIGHT / 2, BOAT_RADIUS, 0, Math.PI * 2)
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

    }

    // Animation loop: updates positions during race, then draws
    function animate() {
      // During race, update boat positions from audio data
      if (screen === 'race' && frequencyData.current) {
        const boat1Speed = getFrequencyAverage(frequencyData.current, boat1Range.start, boat1Range.end)
        const boat2Speed = getFrequencyAverage(frequencyData.current, boat2Range.start, boat2Range.end)

        boat1PosRef.current += boat1Speed * SPEED_MULT * WHISTLE_BOOST
        boat2PosRef.current += boat2Speed * SPEED_MULT * SINGING_BOOST

        // Clamp at finish line (can't go past 1)
        boat1PosRef.current = Math.min(boat1PosRef.current, 1)
        boat2PosRef.current = Math.min(boat2PosRef.current, 1)
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
          {/* Red boat controls */}
          <div style={{ color: '#ef4444', textAlign: 'center', width: '320px' }}>
            <div style={{ marginBottom: '8px', fontFamily: 'monospace', fontSize: '14px' }}>
              Red Boat: {Math.round(boat1Range.start * HZ_PER_BIN)} - {Math.round(boat1Range.end * HZ_PER_BIN)} Hz
            </div>
            <div style={{ marginBottom: '8px', fontSize: '12px', color: '#ef9a9a' }}>
              ({getFrequencyLabel(boat1Range.start * HZ_PER_BIN)} - {getFrequencyLabel(boat1Range.end * HZ_PER_BIN)})
            </div>
            <Slider.Root
              min={0}
              max={MAX_SLIDER_BIN}
              step={1}
              value={[boat1Range.start, boat1Range.end]}
              onValueChange={([val1, val2]) => {
                if (draggingThumb === 'start') {
                  const anchor = dragAnchorRef.current
                  // Figure out which value is our dragged position
                  let draggedPos: number
                  if (val2 === anchor) {
                    // Haven't crossed yet - val1 is our position
                    draggedPos = val1
                  } else if (val1 >= anchor) {
                    // Crossed and pushing - val2 is our position
                    draggedPos = val2
                  } else {
                    draggedPos = val1
                  }
                  const newEnd = Math.max(draggedPos, anchor)
                  setBoat1Range({ start: draggedPos, end: newEnd })
                  dragAnchorRef.current = newEnd
                } else if (draggingThumb === 'end') {
                  const anchor = dragAnchorRef.current
                  let draggedPos: number
                  if (val1 === anchor) {
                    // Haven't crossed yet - val2 is our position
                    draggedPos = val2
                  } else if (val2 <= anchor) {
                    // Crossed and pushing - val1 is our position
                    draggedPos = val1
                  } else {
                    draggedPos = val2
                  }
                  const newStart = Math.min(draggedPos, anchor)
                  setBoat1Range({ start: newStart, end: draggedPos })
                  dragAnchorRef.current = newStart
                } else {
                  setBoat1Range({ start: val1, end: val2 })
                }
              }}
              onValueCommit={() => setDraggingThumb(null)}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                width: '200px',
                height: '20px',
              }}
            >
              <Slider.Track style={{
                backgroundColor: '#333',
                position: 'relative',
                flexGrow: 1,
                borderRadius: '9999px',
                height: '4px',
              }}>
                <Slider.Range style={{
                  position: 'absolute',
                  backgroundColor: '#ef4444',
                  borderRadius: '9999px',
                  height: '100%',
                }} />
              </Slider.Track>
              <Slider.Thumb
                onPointerDown={() => {
                  setDraggingThumb('start')
                  dragAnchorRef.current = boat1Range.end
                }}
                style={{
                  display: 'block',
                  width: '16px',
                  height: '16px',
                  backgroundColor: 'white',
                  borderRadius: '50%',
                  cursor: 'pointer',
                }}
              />
              <Slider.Thumb
                onPointerDown={() => {
                  setDraggingThumb('end')
                  dragAnchorRef.current = boat1Range.start
                }}
                style={{
                  display: 'block',
                  width: '16px',
                  height: '16px',
                  backgroundColor: 'white',
                  borderRadius: '50%',
                  cursor: 'pointer',
                }}
              />
            </Slider.Root>
          </div>

          {/* Blue boat controls */}
          <div style={{ color: '#3b82f6', textAlign: 'center', width: '320px' }}>
            <div style={{ marginBottom: '8px', fontFamily: 'monospace', fontSize: '14px' }}>
              Blue Boat: {Math.round(boat2Range.start * HZ_PER_BIN)} - {Math.round(boat2Range.end * HZ_PER_BIN)} Hz
            </div>
            <div style={{ marginBottom: '8px', fontSize: '12px', color: '#90caf9' }}>
              ({getFrequencyLabel(boat2Range.start * HZ_PER_BIN)} - {getFrequencyLabel(boat2Range.end * HZ_PER_BIN)})
            </div>
            <Slider.Root
              min={0}
              max={MAX_SLIDER_BIN}
              step={1}
              value={[boat2Range.start, boat2Range.end]}
              onValueChange={([val1, val2]) => {
                if (draggingThumb === 'start') {
                  const anchor = dragAnchorRef.current
                  let draggedPos: number
                  if (val2 === anchor) {
                    draggedPos = val1
                  } else if (val1 >= anchor) {
                    draggedPos = val2
                  } else {
                    draggedPos = val1
                  }
                  const newEnd = Math.max(draggedPos, anchor)
                  setBoat2Range({ start: draggedPos, end: newEnd })
                  dragAnchorRef.current = newEnd
                } else if (draggingThumb === 'end') {
                  const anchor = dragAnchorRef.current
                  let draggedPos: number
                  if (val1 === anchor) {
                    draggedPos = val2
                  } else if (val2 <= anchor) {
                    draggedPos = val1
                  } else {
                    draggedPos = val2
                  }
                  const newStart = Math.min(draggedPos, anchor)
                  setBoat2Range({ start: newStart, end: draggedPos })
                  dragAnchorRef.current = newStart
                } else {
                  setBoat2Range({ start: val1, end: val2 })
                }
              }}
              onValueCommit={() => setDraggingThumb(null)}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                width: '200px',
                height: '20px',
              }}
            >
              <Slider.Track style={{
                backgroundColor: '#333',
                position: 'relative',
                flexGrow: 1,
                borderRadius: '9999px',
                height: '4px',
              }}>
                <Slider.Range style={{
                  position: 'absolute',
                  backgroundColor: '#3b82f6',
                  borderRadius: '9999px',
                  height: '100%',
                }} />
              </Slider.Track>
              <Slider.Thumb
                onPointerDown={() => {
                  setDraggingThumb('start')
                  dragAnchorRef.current = boat2Range.end
                }}
                style={{
                  display: 'block',
                  width: '16px',
                  height: '16px',
                  backgroundColor: 'white',
                  borderRadius: '50%',
                  cursor: 'pointer',
                }}
              />
              <Slider.Thumb
                onPointerDown={() => {
                  setDraggingThumb('end')
                  dragAnchorRef.current = boat2Range.start
                }}
                style={{
                  display: 'block',
                  width: '16px',
                  height: '16px',
                  backgroundColor: 'white',
                  borderRadius: '50%',
                  cursor: 'pointer',
                }}
              />
            </Slider.Root>
          </div>

          <button onClick={() => {
            // Reset boat positions to start
            boat1PosRef.current = 0
            boat2PosRef.current = 0
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
