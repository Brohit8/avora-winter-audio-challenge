import type { FrequencyRange } from './types'

// =============================================================================
// Audio Processing
// =============================================================================

export const NOISE_THRESHOLD = 120      // Ignore FFT values below this (0-255 scale)
export const MAX_AUDIO_VALUE = 255      // Maximum FFT bin value
export const HZ_PER_BIN = 21.5          // Approx Hz per FFT bin (44100 / 2048)

// =============================================================================
// Frequency Slider
// =============================================================================

export const MAX_SLIDER_BIN = 200       // ~4300 Hz - covers human voice range

// Default frequency assignments (FFT bin indices)
export const DEFAULT_RED_RANGE: FrequencyRange = { start: 56, end: 200 }   // 1200-4300 Hz
export const DEFAULT_BLUE_RANGE: FrequencyRange = { start: 0, end: 56 }    // 0-1200 Hz

// =============================================================================
// Boat Speed Tuning
// =============================================================================

export const BASE_SPEED_MULTIPLIER = 0.01   // Base movement per unit of loudness
export const WHISTLE_BOOST = 30             // Narrow-band signals need more boost
export const SINGING_BOOST = 2.2            // Spread-spectrum signals need less

// =============================================================================
// Canvas 2D Layout (will be replaced by Three.js constants)
// =============================================================================

export const GUTTER_HEIGHT = 60
export const GUTTER_GAP = 40
export const BOAT_RADIUS = 15
export const CANVAS_PADDING = 50

// =============================================================================
// Colors
// =============================================================================

export const COLORS = {
  red: {
    primary: '#ef4444',
    secondary: '#ef9a9a',
  },
  blue: {
    primary: '#3b82f6',
    secondary: '#90caf9',
  },
  water: '#1e3a5f',
  background: '#000000',
  finishLine: '#ffffff',
  sliderTrack: '#333333',
} as const
