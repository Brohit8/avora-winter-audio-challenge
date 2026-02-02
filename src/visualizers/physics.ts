import {
  JUMP_VELOCITY,
  GRAVITY,
  DIVE_DEPTH,
  DIVE_SPEED,
  ACTION_THRESHOLD,
  ACTION_COOLDOWN,
} from './constants'

// Physics state for jump/dive mechanics
export interface PhysicsState {
  velocityY: number
  isJumping: boolean
  isDiving: boolean
  diveProgress: number
  actionCooldown: number
}

export function createPhysicsState(): PhysicsState {
  return {
    velocityY: 0,
    isJumping: false,
    isDiving: false,
    diveProgress: 0,
    actionCooldown: 0,
  }
}

export function resetPhysicsState(state: PhysicsState): void {
  state.velocityY = 0
  state.isJumping = false
  state.isDiving = false
  state.diveProgress = 0
  state.actionCooldown = 0
}

export function triggerJump(state: PhysicsState): boolean {
  if (!state.isJumping && !state.isDiving && state.actionCooldown === 0) {
    state.isJumping = true
    state.velocityY = JUMP_VELOCITY
    return true
  }
  return false
}

export function triggerDive(state: PhysicsState): boolean {
  if (!state.isJumping && !state.isDiving) {
    state.isDiving = true
    return true
  }
  return false
}

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

// Returns boat Y position
export function updatePhysics(
  state: PhysicsState,
  dt: number,
  waterLevel: number,
  isDiveHeld: boolean
): number {
  if (state.actionCooldown > 0) {
    state.actionCooldown = Math.max(0, state.actionCooldown - dt)
  }

  // Jump
  if (state.isJumping) {
    state.velocityY -= GRAVITY * dt
    const newY = waterLevel + state.velocityY * dt

    if (newY <= waterLevel) {
      state.velocityY = 0
      state.isJumping = false
      state.actionCooldown = ACTION_COOLDOWN
      return waterLevel
    }

    return newY
  }

  // Dive
  if (state.isDiving) {
    if (isDiveHeld) {
      state.diveProgress = Math.min(1, state.diveProgress + DIVE_SPEED * dt)
    } else {
      state.diveProgress = Math.max(0, state.diveProgress - DIVE_SPEED * dt)
      if (state.diveProgress === 0) {
        state.isDiving = false
      }
    }

    return waterLevel + (DIVE_DEPTH * state.diveProgress)
  }

  return waterLevel
}
