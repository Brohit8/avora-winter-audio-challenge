import { useRef, useEffect, useState } from 'react'
import * as Slider from '@radix-ui/react-slider'
import type { VisualizerProps, Screen, FrequencyRange } from './types'
import {
  HZ_PER_BIN,
  MAX_SLIDER_BIN,
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
import { getFrequencyAverage, getFrequencyBandLabel } from './utils/audio'


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
  const [draggingThumb, setDraggingThumb] = useState<'start' | 'end' | null>(null)
  // Stores the "other" thumb's position when we start dragging
  const dragAnchorRef = useRef<number>(0)
  // Boat positions: 0 = starting line, 1 = finish line
  const boat1PosRef = useRef<number>(0)
  const boat2PosRef = useRef<number>(0)


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
          {/* Red boat controls */}
          <div style={{ color: COLORS.red.primary, textAlign: 'center', width: '320px' }}>
            <div style={{ marginBottom: '8px', fontFamily: 'monospace', fontSize: '14px' }}>
              Red Boat: {Math.round(boat1Range.start * HZ_PER_BIN)} - {Math.round(boat1Range.end * HZ_PER_BIN)} Hz
            </div>
            <div style={{ marginBottom: '8px', fontSize: '12px', color: COLORS.red.secondary }}>
              ({getFrequencyBandLabel(boat1Range.start * HZ_PER_BIN)} - {getFrequencyBandLabel(boat1Range.end * HZ_PER_BIN)})
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
                backgroundColor: COLORS.sliderTrack,
                position: 'relative',
                flexGrow: 1,
                borderRadius: '9999px',
                height: '4px',
              }}>
                <Slider.Range style={{
                  position: 'absolute',
                  backgroundColor: COLORS.red.primary,
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
          <div style={{ color: COLORS.blue.primary, textAlign: 'center', width: '320px' }}>
            <div style={{ marginBottom: '8px', fontFamily: 'monospace', fontSize: '14px' }}>
              Blue Boat: {Math.round(boat2Range.start * HZ_PER_BIN)} - {Math.round(boat2Range.end * HZ_PER_BIN)} Hz
            </div>
            <div style={{ marginBottom: '8px', fontSize: '12px', color: COLORS.blue.secondary }}>
              ({getFrequencyBandLabel(boat2Range.start * HZ_PER_BIN)} - {getFrequencyBandLabel(boat2Range.end * HZ_PER_BIN)})
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
                backgroundColor: COLORS.sliderTrack,
                position: 'relative',
                flexGrow: 1,
                borderRadius: '9999px',
                height: '4px',
              }}>
                <Slider.Range style={{
                  position: 'absolute',
                  backgroundColor: COLORS.blue.primary,
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
            // Reset game state
            boat1PosRef.current = 0
            boat2PosRef.current = 0
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
