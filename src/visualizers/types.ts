import type { RefObject } from 'react'

// Game state
export type Screen = 'setup' | 'countdown' | 'race' | 'gameOverAnimation' | 'gameOver'

// Props passed from useAudio hook
export interface VisualizerProps {
  frequencyData: RefObject<Uint8Array<ArrayBufferLike>>
  timeDomainData: RefObject<Uint8Array<ArrayBufferLike>>
  isActive: boolean
  onRequestMic: () => Promise<void>
}
