import type { FrequencyRange } from './types'

// =============================================================================
// Audio Processing
// =============================================================================

export const NOISE_THRESHOLD = 90       // Ignore FFT values below this (0-255 scale)
export const MAX_AUDIO_VALUE = 255      // Maximum FFT bin value
export const HZ_PER_BIN = 21.5          // Approx Hz per FFT bin (44100 / 2048)

// =============================================================================
// Frequency Slider
// =============================================================================

export const MAX_SLIDER_BIN = 200       // ~4300 Hz - covers human voice range

// Default frequency assignments (FFT bin indices)
// Gap in middle (500-1500 Hz) avoids normal speech triggering either boat
export const DEFAULT_RED_RANGE: FrequencyRange = { start: 70, end: 200 }   // 1500-4300 Hz (whistling)
export const DEFAULT_BLUE_RANGE: FrequencyRange = { start: 10, end: 25 }   // 215-540 Hz (humming, avoids breath noise)

// =============================================================================
// Boat Speed Tuning
// =============================================================================

export const BASE_SPEED_MULTIPLIER = 0.01   // Base movement per unit of loudness
export const WHISTLE_BOOST = 35             // Narrow-band signals (whistling) need more boost
export const SINGING_BOOST = 7             // Low-frequency humming needs boost (narrow range, less energy)

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
