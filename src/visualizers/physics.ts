import {
  JUMP_VELOCITY,
  GRAVITY,
  DIVE_DEPTH,
  DIVE_SPEED,
  ACTION_THRESHOLD,
  ACTION_COOLDOWN,
} from './constants'

/**
 * Boat physics state for jump/dive mechanics
 */
export interface PhysicsState {
  velocityY: number
  isJumping: boolean
  isDiving: boolean
  diveProgress: number  // 0 = surface, 1 = fully submerged
  actionCooldown: number
}

/**
 * Create initial physics state
 */
export function createPhysicsState(): PhysicsState {
  return {
    velocityY: 0,
    isJumping: false,
    isDiving: false,
    diveProgress: 0,
    actionCooldown: 0,
  }
}

/**
 * Reset physics state (e.g., when starting a new race)
 */
export function resetPhysicsState(state: PhysicsState): void {
  state.velocityY = 0
  state.isJumping = false
  state.isDiving = false
  state.diveProgress = 0
  state.actionCooldown = 0
}

/**
 * Trigger a jump if conditions allow
 */
export function triggerJump(state: PhysicsState): boolean {
  if (!state.isJumping && !state.isDiving && state.actionCooldown === 0) {
    state.isJumping = true
    state.velocityY = JUMP_VELOCITY
    return true
  }
  return false
}

/**
 * Trigger a dive if conditions allow
 */
export function triggerDive(state: PhysicsState): boolean {
  if (!state.isJumping && !state.isDiving) {
    state.isDiving = true
    return true
  }
  return false
}

/**
 * Check audio input and trigger actions
 */
export function checkAudioTriggers(
  state: PhysicsState,
  jumpLoudness: number,
  diveLoudness: number
): void {
  if (state.isJumping || state.isDiving) return

  if (jumpLoudness > ACTION_THRESHOLD && state.actionCooldown === 0) {
    triggerJump(state)
  } else if (diveLoudness > ACTION_THRESHOLD) {
    triggerDive(state)
  }
}

/**
 * Update physics state for one frame
 * Returns the Y position offset from water level
 */
export function updatePhysics(
  state: PhysicsState,
  dt: number,
  waterLevel: number,
  isDiveHeld: boolean
): number {
  // Decrement cooldown timer
  if (state.actionCooldown > 0) {
    state.actionCooldown = Math.max(0, state.actionCooldown - dt)
  }

  // Apply jump physics
  if (state.isJumping) {
    state.velocityY -= GRAVITY * dt
    const newY = waterLevel + state.velocityY * dt

    // Land when hitting water
    if (newY <= waterLevel) {
      state.velocityY = 0
      state.isJumping = false
      state.actionCooldown = ACTION_COOLDOWN
      return waterLevel
    }

    return newY
  }

  // Apply dive physics
  if (state.isDiving) {
    if (isDiveHeld) {
      // Dive down toward target depth
      state.diveProgress = Math.min(1, state.diveProgress + DIVE_SPEED * dt)
    } else {
      // Rise back up
      state.diveProgress = Math.max(0, state.diveProgress - DIVE_SPEED * dt)
      if (state.diveProgress === 0) {
        state.isDiving = false
      }
    }

    return waterLevel + (DIVE_DEPTH * state.diveProgress)
  }

  // Float on water
  return waterLevel
}
