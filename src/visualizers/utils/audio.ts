import { NOISE_THRESHOLD, MAX_AUDIO_VALUE, HZ_PER_BIN } from '../constants'

/**
 * Calculate average amplitude in a frequency range, normalized 0-1.
 * Applies noise threshold to filter ambient sound.
 */
export function getFrequencyAverage(
  data: Uint8Array,
  startBin: number,
  endBin: number
): number {
  if (startBin >= endBin) return 0

  let sum = 0
  for (let i = startBin; i < endBin; i++) {
    const value = data[i] > NOISE_THRESHOLD ? data[i] - NOISE_THRESHOLD : 0
    sum += value
  }
  return sum / (endBin - startBin) / (MAX_AUDIO_VALUE - NOISE_THRESHOLD)
}

/**
 * Convert Hz to simple pitch label.
 */
export function getFrequencyBandLabel(hz: number): string {
  if (hz < 60) return 'Very Low'
  if (hz < 250) return 'Low'
  if (hz < 500) return 'Low-Mid'
  if (hz < 2000) return 'Mid'
  if (hz < 4000) return 'High'
  return 'Very High'
}

/**
 * Convert FFT bin index to Hz.
 */
export function binToHz(bin: number): number {
  return Math.round(bin * HZ_PER_BIN)
}
