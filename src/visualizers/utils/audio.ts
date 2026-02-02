import { NOISE_THRESHOLD, MAX_AUDIO_VALUE, HZ_PER_BIN } from '../constants'

// Audio analysis utilities

// Average amplitude in frequency range, normalized 0-1
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

export function getFrequencyBandLabel(hz: number): string {
  if (hz < 60) return 'Sub-Bass'
  if (hz < 250) return 'Bass'
  if (hz < 500) return 'Low Mids'
  if (hz < 2000) return 'Midrange'
  if (hz < 4000) return 'Upper Mids'
  return 'Presence'
}

export function binToHz(bin: number): number {
  return Math.round(bin * HZ_PER_BIN)
}
