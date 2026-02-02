import { useRef, useState } from 'react'
import * as Slider from '@radix-ui/react-slider'
import type { FrequencyRange, BoatColor } from '../types'
import { MAX_SLIDER_BIN, COLORS } from '../constants'
import { getFrequencyBandLabel, binToHz } from '../utils/audio'

// Dual-thumb range slider for selecting a frequency band
interface FrequencySliderProps {
  color: BoatColor
  label: string
  range: FrequencyRange
  onRangeChange: (range: FrequencyRange) => void
}

export function FrequencySlider({
  color,
  label,
  range,
  onRangeChange,
}: FrequencySliderProps) {
  const [draggingThumb, setDraggingThumb] = useState<'start' | 'end' | null>(null)
  const dragAnchorRef = useRef<number>(0)

  const colors = COLORS[color]

  // Handle the complex crossover logic when thumbs cross each other
  function handleValueChange([val1, val2]: number[]) {
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
      onRangeChange({ start: draggedPos, end: newEnd })
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
      onRangeChange({ start: newStart, end: draggedPos })
      dragAnchorRef.current = newStart
    } else {
      onRangeChange({ start: val1, end: val2 })
    }
  }

  return (
    <div style={{ color: colors.primary, textAlign: 'center', width: '320px' }}>
      <div style={{ marginBottom: '8px', fontFamily: 'monospace', fontSize: '14px' }}>
        {label}: {binToHz(range.start)} - {binToHz(range.end)} Hz
      </div>
      <div style={{ marginBottom: '8px', fontSize: '12px', color: colors.secondary }}>
        ({getFrequencyBandLabel(binToHz(range.start))} - {getFrequencyBandLabel(binToHz(range.end))})
      </div>
      <Slider.Root
        min={0}
        max={MAX_SLIDER_BIN}
        step={1}
        value={[range.start, range.end]}
        onValueChange={handleValueChange}
        onValueCommit={() => setDraggingThumb(null)}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          width: '200px',
          height: '20px',
          margin: '0 auto',
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
            backgroundColor: colors.primary,
            borderRadius: '9999px',
            height: '100%',
          }} />
        </Slider.Track>
        <Slider.Thumb
          onPointerDown={() => {
            setDraggingThumb('start')
            dragAnchorRef.current = range.end
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
            dragAnchorRef.current = range.start
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
  )
}
