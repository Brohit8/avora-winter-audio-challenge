import type { FrequencyRange } from './types'

// =============================================================================
// Audio Processing
// =============================================================================

export const NOISE_THRESHOLD = 80       // Ignore FFT values below this (0-255 scale)
export const MAX_AUDIO_VALUE = 255      // Maximum FFT bin value
export const HZ_PER_BIN = 21.5          // Approx Hz per FFT bin (44100 / 2048)

// =============================================================================
// Frequency Slider
// =============================================================================

export const MAX_SLIDER_BIN = 200       // ~4300 Hz - covers human voice range

// Default frequency assignment (FFT bin indices)
export const DEFAULT_RED_RANGE: FrequencyRange = { start: 56, end: 200 }   // 1200-4300 Hz

// =============================================================================
// Scene Layout
// =============================================================================

export const BOAT_X = -1.5              // Boat fixed X position
export const BOAT_BASE_Y = 0.35         // Boat base Y (adjusted for water at Y=0.35)
export const GUTTER_Z = 0               // Gutter position (z-axis) - single centered gutter
export const GUTTER_PHASE = 0.0         // Wave phase offset

// =============================================================================
// Camera
// =============================================================================

export const CAMERA_ANIMATION_DURATION = 2000  // ms

// =============================================================================
// World Scroll
// =============================================================================

export const WORLD_SCROLL_SPEED = 3     // Units per second

// =============================================================================
// Physics - Jump
// =============================================================================

export const JUMP_VELOCITY = 10
export const GRAVITY = 30

// =============================================================================
// Physics - Dive
// =============================================================================

export const DIVE_DEPTH = -0.6
export const DIVE_SPEED = 8

// =============================================================================
// Audio Action Thresholds
// =============================================================================

export const ACTION_THRESHOLD = 0.25
export const ACTION_COOLDOWN = 0.3

// =============================================================================
// Score
// =============================================================================

export const SCORE_COEFFICIENT = 3
export const HIGH_SCORE_KEY = 'sonicSurf_highScore'

// =============================================================================
// Obstacles
// =============================================================================

export const OBSTACLE_SPAWN_DELAY = 3       // Seconds before first obstacle
export const OBSTACLE_MIN_GAP = 4           // Minimum world units between obstacles
export const OBSTACLE_GAP_VARIANCE = 3      // Random extra gap
export const OBSTACLE_SPAWN_DISTANCE = 8    // How far ahead to spawn
export const MAX_OBSTACLE_DUPLICATION = 2   // Max same type in a row

// =============================================================================
// Boat Hitbox
// =============================================================================

export const BOAT_HITBOX_WIDTH = 0.8
export const BOAT_HITBOX_HEIGHT = 0.6

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
