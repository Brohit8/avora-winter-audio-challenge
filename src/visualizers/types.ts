import type { RefObject } from 'react'

// Game state
export type Screen = 'setup' | 'countdown' | 'race' | 'win_animation' | 'winner' | 'gameOver'
export type BoatColor = 'red'

// Frequency range for boat assignment (FFT bin indices)
export interface FrequencyRange {
  start: number
  end: number
}

// Props passed from useAudio hook
export interface VisualizerProps {
  frequencyData: RefObject<Uint8Array<ArrayBufferLike>>
  timeDomainData: RefObject<Uint8Array<ArrayBufferLike>>
  isActive: boolean
  onRequestMic: () => Promise<void>
}
