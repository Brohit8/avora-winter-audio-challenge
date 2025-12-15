import { useRef, useEffect } from 'react'

/**
 * Visualizer - YOUR CANVAS FOR THE CHALLENGE
 *
 * Props provided:
 *   - frequencyData: Uint8Array of FFT frequency bins (0-255 values)
 *   - timeDomainData: Uint8Array of waveform samples (0-255 values)
 *   - isActive: boolean indicating if audio is streaming
 *
 * The example below draws a simple waveform line. Replace it with your own!
 */
export function Visualizer({ frequencyData, timeDomainData, isActive }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height

    // Clear canvas
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, width, height)

    if (!isActive) {
      // Show placeholder when not active
      ctx.fillStyle = '#333'
      ctx.font = '16px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('Waiting for microphone...', width / 2, height / 2)
      return
    }

    // === YOUR VISUALIZATION CODE GOES HERE ===

    // Example: Simple waveform line
    ctx.beginPath()
    ctx.strokeStyle = '#0f0'
    ctx.lineWidth = 2

    const sliceWidth = width / timeDomainData.length
    let x = 0

    for (let i = 0; i < timeDomainData.length; i++) {
      const v = timeDomainData[i] / 255
      const y = v * height

      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
      x += sliceWidth
    }

    ctx.stroke()

    // === END VISUALIZATION CODE ===

  }, [frequencyData, timeDomainData, isActive])

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={400}
      style={{ display: 'block', margin: '0 auto' }}
    />
  )
}
