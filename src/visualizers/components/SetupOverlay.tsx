import type { FrequencyRange } from '../types'
import { FrequencySlider } from './FrequencySlider'

interface SetupOverlayProps {
  boat1Range: FrequencyRange
  boat2Range: FrequencyRange
  onBoat1RangeChange: (range: FrequencyRange) => void
  onBoat2RangeChange: (range: FrequencyRange) => void
  onStartRace: () => void
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
  gap: '20px',
}

export function SetupOverlay({
  boat1Range,
  boat2Range,
  onBoat1RangeChange,
  onBoat2RangeChange,
  onStartRace,
}: SetupOverlayProps) {
  return (
    <div style={overlayStyle}>
      <FrequencySlider
        color="red"
        label="Red Boat"
        range={boat1Range}
        onRangeChange={onBoat1RangeChange}
      />

      <FrequencySlider
        color="blue"
        label="Blue Boat"
        range={boat2Range}
        onRangeChange={onBoat2RangeChange}
      />

      <button onClick={onStartRace}>
        Start Race
      </button>
    </div>
  )
}
