// Audio Processing
export const NOISE_THRESHOLD = 80
export const MAX_AUDIO_VALUE = 255
export const HZ_PER_BIN = 21.5

// Frequency Slider
export const MAX_SLIDER_BIN = 200

// Scene Layout
export const BOAT_X = -1.5
export const BOAT_BASE_Y = 0.35
export const GUTTER_Z = 0
export const GUTTER_PHASE = 0.0

// Camera
export const CAMERA_ANIMATION_DURATION = 2000

// World Scroll
export const WORLD_SCROLL_SPEED = 3

// Physics
export const JUMP_VELOCITY = 10
export const GRAVITY = 30
export const DIVE_DEPTH = -0.6
export const DIVE_SPEED = 8

// Audio Thresholds
export const ACTION_THRESHOLD = 0.25
export const ACTION_COOLDOWN = 0.3

// Score
export const SCORE_COEFFICIENT = 3
export const HIGH_SCORE_KEY = 'sonicSurf_highScore'

// Obstacles
export const OBSTACLE_SPAWN_DELAY = 3
export const OBSTACLE_MIN_GAP = 4
export const OBSTACLE_GAP_VARIANCE = 3
export const OBSTACLE_SPAWN_DISTANCE = 8
export const MAX_OBSTACLE_DUPLICATION = 2

// Boat Hitbox
export const BOAT_HITBOX_WIDTH = 0.8
export const BOAT_HITBOX_HEIGHT = 0.6

// Colors
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
