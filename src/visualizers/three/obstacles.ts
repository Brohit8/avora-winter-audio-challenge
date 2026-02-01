import * as THREE from 'three'
import { getGerstnerDisplacement, getGerstnerNormal } from './gerstnerWaves'

// Obstacle type definitions
export type ObstacleType = 'SPIRAL' | 'ROCK_LARGE' | 'BIRD'

interface ObstacleConfig {
  width: number
  height: number
  depth: number
  color: number
  baseY: number
  floatsOnWater: boolean
}

const OBSTACLE_CONFIGS: Record<ObstacleType, ObstacleConfig> = {
  SPIRAL: {
    width: 0.5,
    height: 0.3,
    depth: 0.5,
    color: 0x1a1a1a,  // Dark color for spiral
    baseY: 0.55,  // Floats higher on water surface
    floatsOnWater: true,
  },
  ROCK_LARGE: {
    width: 0.6,
    height: 0.7,
    depth: 0.5,
    color: 0x4a4a4a,
    baseY: 0.25,  // Adjusted for water at Y=0.35
    floatsOnWater: true,
  },
  BIRD: {
    width: 0.5,
    height: 0.2,
    depth: 0.8,
    color: 0x2a2a2a,
    baseY: 1.0,  // Adjusted for higher boat position
    floatsOnWater: false,
  },
}

export interface Obstacle {
  mesh: THREE.Mesh | THREE.Group
  type: ObstacleType
  config: ObstacleConfig
  worldX: number
}

// =============================================================================
// Spiral Model Configuration
// =============================================================================

// Adjust this to change the spiral size (default 0.15)
const SPIRAL_SCALE = 0.35

// Cached spiral model - set once after loading, cloned for each obstacle
let cachedSpiralModel: THREE.Group | null = null

/**
 * Set the spiral model after loading. Call once at scene setup.
 * Only applies scale and shadows - flat orientation is applied per-clone
 * to avoid being overwritten by wave rocking.
 */
export function setSpiralModel(model: THREE.Group): void {
  model.scale.set(SPIRAL_SCALE, SPIRAL_SCALE, SPIRAL_SCALE)
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true
      child.receiveShadow = true
    }
  })
  cachedSpiralModel = model
}

/**
 * Clone the cached spiral model with nested group structure.
 * Outer group receives wave rocking, inner model stays flat.
 */
function cloneSpiralModel(): THREE.Group {
  const outerGroup = new THREE.Group()

  if (!cachedSpiralModel) {
    // Fallback: simple torus if model not loaded yet
    const geometry = new THREE.TorusGeometry(0.2, 0.06, 8, 16)
    const material = new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.rotation.x = -Math.PI / 2
    mesh.castShadow = true
    outerGroup.add(mesh)
    return outerGroup
  }

  const innerModel = cachedSpiralModel.clone()
  innerModel.rotation.x = -Math.PI / 2  // Flat orientation (preserved from wave rocking)
  outerGroup.add(innerModel)

  return outerGroup
}

export function createObstacleMesh(type: ObstacleType): THREE.Mesh | THREE.Group {
  // Use cached spiral model for SPIRAL type
  if (type === 'SPIRAL') {
    return cloneSpiralModel()
  }

  // Fallback to box geometry for other types
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
  return ['SPIRAL', 'ROCK_LARGE']
}

export function getDiveObstacleTypes(): ObstacleType[] {
  return ['BIRD']
}

// Forgiving hitbox shrink factor (0.6 = 40% smaller than visual)
const HITBOX_SHRINK = 0.6

// Boat sail extends upward from boat position
const BOAT_SAIL_HEIGHT = 0.8  // How far the sail extends above boat.position.y
const BOAT_SAIL_OFFSET = 0.3  // Vertical offset to center hitbox on sail

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

  // Boat hitbox (offset upward to cover sail)
  const bHalfW = (boatWidth * HITBOX_SHRINK) / 2
  const bHalfH = ((boatHeight + BOAT_SAIL_HEIGHT) * HITBOX_SHRINK) / 2
  const boatCenterY = boatY + BOAT_SAIL_OFFSET  // Offset hitbox upward
  const bLeft = boatX - bHalfW
  const bRight = boatX + bHalfW
  const bBottom = boatCenterY - bHalfH
  const bTop = boatCenterY + bHalfH

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
