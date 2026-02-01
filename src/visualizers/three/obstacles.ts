import * as THREE from 'three'
import { getGerstnerDisplacement, getGerstnerNormal } from './gerstnerWaves'

// Obstacle type definitions
export type ObstacleType = 'ROCK_SMALL' | 'ROCK_LARGE' | 'BIRD'

interface ObstacleConfig {
  width: number
  height: number
  depth: number
  color: number
  baseY: number
  floatsOnWater: boolean
}

const OBSTACLE_CONFIGS: Record<ObstacleType, ObstacleConfig> = {
  ROCK_SMALL: {
    width: 0.4,
    height: 0.5,
    depth: 0.4,
    color: 0x5a5a5a,
    baseY: 0.1,
    floatsOnWater: true,
  },
  ROCK_LARGE: {
    width: 0.6,
    height: 0.7,
    depth: 0.5,
    color: 0x4a4a4a,
    baseY: 0.15,
    floatsOnWater: true,
  },
  BIRD: {
    width: 0.5,
    height: 0.2,
    depth: 0.8,
    color: 0x2a2a2a,
    baseY: 1.2,
    floatsOnWater: false,
  },
}

export interface Obstacle {
  mesh: THREE.Mesh
  type: ObstacleType
  config: ObstacleConfig
  worldX: number
}

export function createObstacleMesh(type: ObstacleType): THREE.Mesh {
  const config = OBSTACLE_CONFIGS[type]

  const geometry = new THREE.BoxGeometry(config.width, config.height, config.depth)
  const material = new THREE.MeshStandardMaterial({
    color: config.color,
    roughness: 0.8,
    metalness: 0.1,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = true
  mesh.receiveShadow = true

  return mesh
}

export function createObstacle(type: ObstacleType, worldX: number): Obstacle {
  const mesh = createObstacleMesh(type)
  const config = OBSTACLE_CONFIGS[type]

  return {
    mesh,
    type,
    config,
    worldX,
  }
}

export function updateObstacle(
  obstacle: Obstacle,
  worldOffset: number,
  elapsed: number,
  gutterZ: number,
  phaseOffset: number
): void {
  const { mesh, config, worldX } = obstacle

  const screenX = worldX - worldOffset
  mesh.position.x = screenX
  mesh.position.z = gutterZ

  if (config.floatsOnWater) {
    const disp = getGerstnerDisplacement(screenX, gutterZ, elapsed, phaseOffset)
    const normal = getGerstnerNormal(screenX, gutterZ, elapsed, phaseOffset)

    mesh.position.y = config.baseY + disp.dy
    mesh.rotation.z = Math.asin(-normal.nx) * 0.6
    mesh.rotation.x = Math.asin(normal.nz) * 0.5
  } else {
    mesh.position.y = config.baseY
    mesh.rotation.set(0, 0, 0)
  }
}

export function isObstacleOffScreen(obstacle: Obstacle, worldOffset: number): boolean {
  const screenX = obstacle.worldX - worldOffset
  return screenX < -5
}

export function getObstacleConfig(type: ObstacleType): ObstacleConfig {
  return OBSTACLE_CONFIGS[type]
}

export function getJumpObstacleTypes(): ObstacleType[] {
  return ['ROCK_SMALL', 'ROCK_LARGE']
}

export function getDiveObstacleTypes(): ObstacleType[] {
  return ['BIRD']
}

// Forgiving hitbox shrink factor (0.6 = 40% smaller than visual)
const HITBOX_SHRINK = 0.6

/**
 * Check collision between boat and obstacle using forgiving AABB
 */
export function checkCollision(
  boatX: number,
  boatY: number,
  boatWidth: number,
  boatHeight: number,
  obstacle: Obstacle
): boolean {
  const { mesh, config } = obstacle

  // Boat hitbox (centered on boatX, boatY)
  const bHalfW = (boatWidth * HITBOX_SHRINK) / 2
  const bHalfH = (boatHeight * HITBOX_SHRINK) / 2
  const bLeft = boatX - bHalfW
  const bRight = boatX + bHalfW
  const bBottom = boatY - bHalfH
  const bTop = boatY + bHalfH

  // Obstacle hitbox (mesh.position is center)
  const oHalfW = (config.width * HITBOX_SHRINK) / 2
  const oHalfH = (config.height * HITBOX_SHRINK) / 2
  const oLeft = mesh.position.x - oHalfW
  const oRight = mesh.position.x + oHalfW
  const oBottom = mesh.position.y - oHalfH
  const oTop = mesh.position.y + oHalfH

  // AABB collision check
  return bLeft < oRight && bRight > oLeft && bBottom < oTop && bTop > oBottom
}
