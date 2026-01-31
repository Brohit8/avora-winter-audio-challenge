import * as Slider from '@radix-ui/react-slider'
import { MAX_SLIDER_BIN, COLORS } from '../constants'
import { binToHz } from '../utils/audio'

// Default division point (bin 56 = ~1200 Hz)
export const DEFAULT_DIVISION_BIN = 56

interface FrequencyDivisionSliderProps {
  divisionBin: number
  onDivisionChange: (bin: number) => void
}

export function FrequencyDivisionSlider({
  divisionBin,
  onDivisionChange,
}: FrequencyDivisionSliderProps) {
  // Calculate percentage for positioning
  const divisionPercent = (divisionBin / MAX_SLIDER_BIN) * 100

  return (
    <div style={{ width: '320px', padding: '16px 0' }}>
      {/* Zone Labels */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '8px',
        fontSize: '14px',
        fontWeight: 600,
      }}>
        <span style={{ color: COLORS.blue.primary }}>
          Dive
        </span>
        <span style={{ color: COLORS.red.primary }}>
          Jump
        </span>
      </div>

      {/* Frequency Range Labels */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '12px',
        fontSize: '11px',
        color: 'rgba(255,255,255,0.6)',
        fontFamily: 'monospace',
      }}>
        <span>0 Hz</span>
        <span style={{ color: '#fff' }}>{binToHz(divisionBin)} Hz</span>
        <span>{binToHz(MAX_SLIDER_BIN)} Hz</span>
      </div>

      {/* Main Slider with Colored Zones */}
      <div style={{ position: 'relative', height: '32px', marginBottom: '16px' }}>
        {/* Background track with colored zones */}
        <div style={{
          position: 'absolute',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '100%',
          height: '8px',
          borderRadius: '4px',
          overflow: 'hidden',
          display: 'flex',
        }}>
          {/* Dive zone (blue) */}
          <div style={{
            width: `${divisionPercent}%`,
            height: '100%',
            backgroundColor: COLORS.blue.primary,
            opacity: 0.6,
          }} />
          {/* Jump zone (red/orange) */}
          <div style={{
            width: `${100 - divisionPercent}%`,
            height: '100%',
            backgroundColor: COLORS.red.primary,
            opacity: 0.6,
          }} />
        </div>

        {/* Radix Slider (invisible track, visible thumb) */}
        <Slider.Root
          min={10}  // Don't allow division at 0
          max={MAX_SLIDER_BIN - 10}  // Don't allow division at max
          step={1}
          value={[divisionBin]}
          onValueChange={([value]) => onDivisionChange(value)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Slider.Track style={{
            position: 'relative',
            flexGrow: 1,
            height: '100%',
          }}>
            <Slider.Range style={{ display: 'none' }} />
          </Slider.Track>
          <Slider.Thumb
            style={{
              display: 'block',
              width: '4px',
              height: '24px',
              backgroundColor: '#ffffff',
              borderRadius: '2px',
              cursor: 'ew-resize',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            }}
          />
        </Slider.Root>
      </div>
    </div>
  )
}
