import * as THREE from 'three'
import {
  OBSTACLE_SPAWN_DELAY,
  OBSTACLE_MIN_GAP,
  OBSTACLE_GAP_VARIANCE,
  OBSTACLE_SPAWN_DISTANCE,
  MAX_OBSTACLE_DUPLICATION,
  WORLD_SCROLL_SPEED,
  BOAT_HITBOX_WIDTH,
  BOAT_HITBOX_HEIGHT,
  GUTTER_Z,
  GUTTER_PHASE,
} from './constants'
import {
  createObstacle,
  updateObstacle,
  isObstacleOffScreen,
  getJumpObstacleTypes,
  getDiveObstacleTypes,
  checkCollision,
  disposeObstacle,
  type Obstacle,
  type ObstacleType,
} from './three/obstacles'

// Manages obstacle spawning, updating, collision detection, and cleanup
export class ObstacleManager {
  private obstacles: Obstacle[] = []
  private lastObstacleWorldX = 0
  private obstacleHistory: ObstacleType[] = []
  private scene: THREE.Scene

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  reset(): void {
    this.obstacles.forEach(obs => {
      this.scene.remove(obs.mesh)
      disposeObstacle(obs)
    })
    this.obstacles = []
    this.lastObstacleWorldX = 0
    this.obstacleHistory = []
  }

  trySpawn(worldOffset: number): void {
    const timeSinceStart = worldOffset / WORLD_SCROLL_SPEED

    if (timeSinceStart <= OBSTACLE_SPAWN_DELAY) return

    const spawnThreshold = worldOffset + OBSTACLE_SPAWN_DISTANCE
    const gap = OBSTACLE_MIN_GAP + Math.random() * OBSTACLE_GAP_VARIANCE

    if (this.lastObstacleWorldX !== 0 && spawnThreshold <= this.lastObstacleWorldX + gap) {
      return
    }

    // Pick random obstacle type
    const allTypes = [...getJumpObstacleTypes(), ...getDiveObstacleTypes()]
    let selectedType: ObstacleType

    // Avoid too many duplicates
    const lastType = this.obstacleHistory[this.obstacleHistory.length - 1]
    let consecutiveCount = 0
    for (let i = this.obstacleHistory.length - 1; i >= 0; i--) {
      if (this.obstacleHistory[i] === lastType) consecutiveCount++
      else break
    }

    if (consecutiveCount >= MAX_OBSTACLE_DUPLICATION) {
      const otherTypes = allTypes.filter(t => t !== lastType)
      selectedType = otherTypes[Math.floor(Math.random() * otherTypes.length)]
    } else {
      selectedType = allTypes[Math.floor(Math.random() * allTypes.length)]
    }

    // Create and add obstacle
    const obstacle = createObstacle(selectedType, spawnThreshold)
    this.scene.add(obstacle.mesh)
    this.obstacles.push(obstacle)
    this.lastObstacleWorldX = spawnThreshold
    this.obstacleHistory.push(selectedType)

    // Keep history small
    if (this.obstacleHistory.length > 10) {
      this.obstacleHistory.shift()
    }
  }

  updateAll(worldOffset: number, elapsed: number): void {
    this.obstacles.forEach(obstacle => {
      updateObstacle(obstacle, worldOffset, elapsed, GUTTER_Z, GUTTER_PHASE)
    })
  }

  checkBoatCollision(boatX: number, boatY: number): boolean {
    for (const obstacle of this.obstacles) {
      if (checkCollision(boatX, boatY, BOAT_HITBOX_WIDTH, BOAT_HITBOX_HEIGHT, obstacle)) {
        return true
      }
    }
    return false
  }

  removeOffScreen(worldOffset: number): void {
    const toRemove = this.obstacles.filter(obs => isObstacleOffScreen(obs, worldOffset))
    toRemove.forEach(obs => {
      this.scene.remove(obs.mesh)
      disposeObstacle(obs)
    })
    this.obstacles = this.obstacles.filter(obs => !isObstacleOffScreen(obs, worldOffset))
  }

  getObstacles(): readonly Obstacle[] {
    return this.obstacles
  }
}
