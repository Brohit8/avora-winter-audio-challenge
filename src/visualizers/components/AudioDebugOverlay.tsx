import { useEffect, useRef, useState } from 'react'

interface AudioDebugOverlayProps {
  frequencyData: React.RefObject<Uint8Array | null>
  divisionBin: number
  noiseThreshold: number
  actionThreshold: number
  maxSliderBin: number
  onNoiseThresholdChange: (value: number) => void
  onActionThresholdChange: (value: number) => void
}

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: '8px',
  left: '8px',
  right: '8px',
  maxWidth: '320px',
  backgroundColor: 'rgba(0, 0, 0, 0.9)',
  color: '#fff',
  padding: 'clamp(8px, 2vw, 12px)',
  borderRadius: '8px',
  fontFamily: 'monospace',
  fontSize: 'clamp(11px, 2.5vw, 13px)',
  zIndex: 1000,
  boxSizing: 'border-box',
}

const barContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'clamp(4px, 1vw, 8px)',
  marginBottom: '6px',
}

const labelStyle: React.CSSProperties = {
  width: 'clamp(32px, 10vw, 50px)',
  textAlign: 'right',
  flexShrink: 0,
}

const barBackgroundStyle: React.CSSProperties = {
  flex: 1,
  height: 'clamp(16px, 4vw, 24px)',
  backgroundColor: '#333',
  borderRadius: '4px',
  position: 'relative',
  overflow: 'hidden',
  minWidth: '60px',
}

const thresholdLineStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: '2px',
  backgroundColor: '#fff',
  zIndex: 2,
}

const sliderRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'clamp(4px, 1vw, 8px)',
  marginTop: '8px',
}

const sliderLabelStyle: React.CSSProperties = {
  width: 'clamp(50px, 18vw, 80px)',
  flexShrink: 0,
}

const sliderStyle: React.CSSProperties = {
  flex: 1,
  height: '24px',
  minWidth: '80px',
  accentColor: '#3b82f6',
}

const valueStyle: React.CSSProperties = {
  width: 'clamp(24px, 8vw, 36px)',
  textAlign: 'right',
  flexShrink: 0,
}

const triggerStyle: React.CSSProperties = {
  width: 'clamp(36px, 12vw, 50px)',
  textAlign: 'center',
  fontWeight: 'bold',
  flexShrink: 0,
}

function getFrequencyAverageWithDetails(
  data: Uint8Array,
  startBin: number,
  endBin: number,
  noiseThreshold: number
): { raw: number; filtered: number; normalized: number } {
  if (startBin >= endBin) return { raw: 0, filtered: 0, normalized: 0 }

  let rawSum = 0
  let filteredSum = 0
  const maxValue = 255

  for (let i = startBin; i < endBin; i++) {
    rawSum += data[i]
    const value = data[i] > noiseThreshold ? data[i] - noiseThreshold : 0
    filteredSum += value
  }

  const count = endBin - startBin
  const raw = rawSum / count / maxValue
  const filtered = filteredSum / count / maxValue
  const normalized = filteredSum / count / (maxValue - noiseThreshold)

  return { raw, filtered, normalized }
}

export function AudioDebugOverlay({
  frequencyData,
  divisionBin,
  noiseThreshold,
  actionThreshold,
  maxSliderBin,
  onNoiseThresholdChange,
  onActionThresholdChange,
}: AudioDebugOverlayProps) {
  const [lowLevels, setLowLevels] = useState({ raw: 0, filtered: 0, normalized: 0 })
  const [highLevels, setHighLevels] = useState({ raw: 0, filtered: 0, normalized: 0 })
  const [jumpTriggered, setJumpTriggered] = useState(false)
  const [diveTriggered, setDiveTriggered] = useState(false)
  const animationRef = useRef<number>(0)

  useEffect(() => {
    function update() {
      const data = frequencyData.current
      if (data) {
        const low = getFrequencyAverageWithDetails(data, 0, divisionBin, noiseThreshold)
        const high = getFrequencyAverageWithDetails(data, divisionBin, maxSliderBin, noiseThreshold)
        setLowLevels(low)
        setHighLevels(high)
        setJumpTriggered(high.normalized > actionThreshold)
        setDiveTriggered(low.normalized > actionThreshold)
      }
      animationRef.current = requestAnimationFrame(update)
    }
    animationRef.current = requestAnimationFrame(update)
    return () => cancelAnimationFrame(animationRef.current)
  }, [frequencyData, divisionBin, noiseThreshold, actionThreshold, maxSliderBin])

  const thresholdPercent = actionThreshold * 100

  return (
    <div style={overlayStyle}>
      <div style={{ fontWeight: 'bold', marginBottom: '6px', fontSize: 'clamp(12px, 3vw, 14px)' }}>
        Audio Debug
      </div>

      {/* Low frequency (Dive) */}
      <div style={barContainerStyle}>
        <span style={labelStyle}>Low</span>
        <div style={barBackgroundStyle}>
          <div
            style={{
              ...thresholdLineStyle,
              left: `${thresholdPercent}%`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              width: `${lowLevels.normalized * 100}%`,
              backgroundColor: diveTriggered ? '#22c55e' : '#3b82f6',
              transition: 'width 0.05s',
            }}
          />
        </div>
        <span style={valueStyle}>{(lowLevels.normalized * 100).toFixed(0)}%</span>
        <span style={{ ...triggerStyle, color: diveTriggered ? '#22c55e' : '#444' }}>
          {diveTriggered ? 'DIVE' : '—'}
        </span>
      </div>

      {/* High frequency (Jump) */}
      <div style={barContainerStyle}>
        <span style={labelStyle}>High</span>
        <div style={barBackgroundStyle}>
          <div
            style={{
              ...thresholdLineStyle,
              left: `${thresholdPercent}%`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              width: `${highLevels.normalized * 100}%`,
              backgroundColor: jumpTriggered ? '#22c55e' : '#f59e0b',
              transition: 'width 0.05s',
            }}
          />
        </div>
        <span style={valueStyle}>{(highLevels.normalized * 100).toFixed(0)}%</span>
        <span style={{ ...triggerStyle, color: jumpTriggered ? '#22c55e' : '#444' }}>
          {jumpTriggered ? 'JUMP' : '—'}
        </span>
      </div>

      {/* Noise Threshold Slider */}
      <div style={sliderRowStyle}>
        <span style={sliderLabelStyle}>Noise:</span>
        <input
          type="range"
          min="0"
          max="150"
          value={noiseThreshold}
          onChange={(e) => onNoiseThresholdChange(Number(e.target.value))}
          style={sliderStyle}
        />
        <span style={valueStyle}>{noiseThreshold}</span>
      </div>

      {/* Action Threshold Slider */}
      <div style={sliderRowStyle}>
        <span style={sliderLabelStyle}>Trigger:</span>
        <input
          type="range"
          min="0.05"
          max="0.8"
          step="0.01"
          value={actionThreshold}
          onChange={(e) => onActionThresholdChange(Number(e.target.value))}
          style={sliderStyle}
        />
        <span style={valueStyle}>{actionThreshold.toFixed(2)}</span>
      </div>
    </div>
  )
}
