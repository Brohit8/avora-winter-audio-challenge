import * as THREE from 'three'
import { getGerstnerDisplacement, getGerstnerNormal } from './gerstnerWaves'
import { enableShadows } from './models'

// Obstacle type definitions
export type ObstacleType = 'SPIRAL' | 'MOLAR' | 'TOOTHBRUSH'

interface ObstacleConfig {
  width: number
  height: number
  depth: number
  color: number
  baseY: number
  floatsOnWater: boolean
  hitboxOffsetX: number  // Shift hitbox toward front (negative = toward boat)
}

// Debug visualization toggle - set to true to see hitboxes
export const DEBUG_HITBOXES = false

const OBSTACLE_CONFIGS: Record<ObstacleType, ObstacleConfig> = {
  SPIRAL: {
    width: 0.5,
    height: 0.3,
    depth: 0.5,
    color: 0x1a1a1a,
    baseY: 0.55,
    floatsOnWater: true,
    hitboxOffsetX: 0,  // Centered - symmetric shape
  },
  MOLAR: {
    width: 0.5,
    height: 0.5,
    depth: 0.5,
    color: 0xf5f5dc,
    baseY: 0.50,
    floatsOnWater: true,
    hitboxOffsetX: 0,  // Centered - symmetric shape
  },
  TOOTHBRUSH: {
    width: 1.0,  // Narrower hitbox (brush head only)
    height: 0.3,
    depth: 0.3,
    color: 0x4488ff,
    baseY: 1.0,
    floatsOnWater: false,
    hitboxOffsetX: 0.7,  // Shift toward front (bristle end hitting boat)
  },
}

export interface Obstacle {
  mesh: THREE.Mesh | THREE.Group
  type: ObstacleType
  config: ObstacleConfig
  worldX: number
  debugHitbox?: THREE.LineSegments  // Debug wireframe for hitbox visualization
}

// Spiral model

const SPIRAL_SCALE = 0.35
let cachedSpiralModel: THREE.Group | null = null

export function setSpiralModel(model: THREE.Group): void {
  model.scale.set(SPIRAL_SCALE, SPIRAL_SCALE, SPIRAL_SCALE)
  enableShadows(model)
  cachedSpiralModel = model
}

function cloneSpiralModel(): THREE.Group {
  const outerGroup = new THREE.Group()

  if (!cachedSpiralModel) {
    // Fallback geometry
    const geometry = new THREE.TorusGeometry(0.2, 0.06, 8, 16)
    const material = new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.rotation.x = -Math.PI / 2
    mesh.castShadow = true
    outerGroup.add(mesh)
    return outerGroup
  }

  const innerModel = cachedSpiralModel.clone()
  innerModel.rotation.x = -Math.PI / 2
  outerGroup.add(innerModel)

  return outerGroup
}

// Toothbrush model

const TOOTHBRUSH_SCALE = 0.20
let cachedToothbrushModel: THREE.Group | null = null

export function setToothbrushModel(model: THREE.Group): void {
  model.scale.set(TOOTHBRUSH_SCALE, TOOTHBRUSH_SCALE, TOOTHBRUSH_SCALE)
  enableShadows(model)
  cachedToothbrushModel = model
}

function cloneToothbrushModel(): THREE.Group {
  const outerGroup = new THREE.Group()

  if (!cachedToothbrushModel) {
    // Fallback geometry
    const geometry = new THREE.CapsuleGeometry(0.05, 0.4, 4, 8)
    const material = new THREE.MeshStandardMaterial({ color: 0x4488ff })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.rotation.z = Math.PI / 2
    mesh.castShadow = true
    outerGroup.add(mesh)
    return outerGroup
  }

  const innerModel = cachedToothbrushModel.clone()
  innerModel.rotation.x = Math.PI
  innerModel.rotation.y = 3 * Math.PI / 2
  outerGroup.add(innerModel)

  return outerGroup
}

// Molar model

const MOLAR_SCALE = 0.5
let cachedMolarModel: THREE.Group | null = null

export function setMolarModel(model: THREE.Group): void {
  model.scale.set(MOLAR_SCALE, MOLAR_SCALE, MOLAR_SCALE)
  enableShadows(model)
  cachedMolarModel = model
}

function cloneMolarModel(): THREE.Group {
  const outerGroup = new THREE.Group()

  if (!cachedMolarModel) {
    // Fallback geometry
    const geometry = new THREE.SphereGeometry(0.2, 8, 6)
    const material = new THREE.MeshStandardMaterial({ color: 0xf5f5dc })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = true
    outerGroup.add(mesh)
    return outerGroup
  }

  const innerModel = cachedMolarModel.clone()
  innerModel.rotation.y = -Math.PI / 6
  outerGroup.add(innerModel)

  return outerGroup
}

export function createObstacleMesh(type: ObstacleType): THREE.Mesh | THREE.Group {
  switch (type) {
    case 'SPIRAL':
      return cloneSpiralModel()
    case 'MOLAR':
      return cloneMolarModel()
    case 'TOOTHBRUSH':
      return cloneToothbrushModel()
  }
}

// Create a new obstacle instance at the given world position
export function createObstacle(type: ObstacleType, worldX: number): Obstacle {
  const mesh = createObstacleMesh(type)
  const config = OBSTACLE_CONFIGS[type]

  const obstacle: Obstacle = {
    mesh,
    type,
    config,
    worldX,
  }

  if (DEBUG_HITBOXES) {
    obstacle.debugHitbox = createDebugHitbox(config)
  }

  return obstacle
}

// Update obstacle position, syncing with wave motion if it floats
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

  // Update debug hitbox position
  if (DEBUG_HITBOXES) {
    updateDebugHitbox(obstacle)
  }
}

export function isObstacleOffScreen(obstacle: Obstacle, worldOffset: number): boolean {
  const screenX = obstacle.worldX - worldOffset
  return screenX < -5
}

export function getJumpObstacleTypes(): ObstacleType[] {
  return ['SPIRAL', 'MOLAR']
}

export function getDiveObstacleTypes(): ObstacleType[] {
  return ['TOOTHBRUSH']
}

// Collision detection

const HITBOX_SHRINK = 0.6
const BOAT_SAIL_HEIGHT = 0.8
const BOAT_SAIL_OFFSET_Y = 0.3
const BOAT_SAIL_OFFSET_X = 0  // Shift boat hitbox toward sail (positive = toward oncoming obstacles)

// AABB collision between boat and obstacle
export function checkCollision(
  boatX: number,
  boatY: number,
  boatWidth: number,
  boatHeight: number,
  obstacle: Obstacle
): boolean {
  const { mesh, config } = obstacle

  // Boat hitbox - use sail offset for flying obstacles (they hit the mast/sail)
  const boatOffsetX = config.floatsOnWater ? 0 : BOAT_SAIL_OFFSET_X
  const bHalfW = (boatWidth * HITBOX_SHRINK) / 2
  const bHalfH = ((boatHeight + BOAT_SAIL_HEIGHT) * HITBOX_SHRINK) / 2
  const boatCenterX = boatX + boatOffsetX
  const boatCenterY = boatY + BOAT_SAIL_OFFSET_Y
  const bLeft = boatCenterX - bHalfW
  const bRight = boatCenterX + bHalfW
  const bBottom = boatCenterY - bHalfH
  const bTop = boatCenterY + bHalfH

  // Obstacle hitbox - apply hitboxOffsetX
  const oHalfW = (config.width * HITBOX_SHRINK) / 2
  const oHalfH = (config.height * HITBOX_SHRINK) / 2
  const obstacleCenterX = mesh.position.x + config.hitboxOffsetX
  const oLeft = obstacleCenterX - oHalfW
  const oRight = obstacleCenterX + oHalfW
  const oBottom = mesh.position.y - oHalfH
  const oTop = mesh.position.y + oHalfH

  return bLeft < oRight && bRight > oLeft && bBottom < oTop && bTop > oBottom
}

// Debug hitbox visualization

export function createDebugHitbox(config: ObstacleConfig): THREE.LineSegments {
  const width = config.width * HITBOX_SHRINK
  const height = config.height * HITBOX_SHRINK
  const geometry = new THREE.BoxGeometry(width, height, 0.1)
  const edges = new THREE.EdgesGeometry(geometry)
  const material = new THREE.LineBasicMaterial({
    color: config.floatsOnWater ? 0x00ff00 : 0xff0000,  // Green for jump, red for dive
    linewidth: 2,
  })
  const wireframe = new THREE.LineSegments(edges, material)
  geometry.dispose()
  return wireframe
}

export function updateDebugHitbox(obstacle: Obstacle): void {
  if (!obstacle.debugHitbox) return
  const { mesh, config } = obstacle
  obstacle.debugHitbox.position.x = mesh.position.x + config.hitboxOffsetX
  obstacle.debugHitbox.position.y = mesh.position.y
  obstacle.debugHitbox.position.z = mesh.position.z + 0.1  // Slightly in front
}

// Boat debug hitbox helper
let boatDebugHitbox: THREE.LineSegments | null = null

export function createBoatDebugHitbox(boatWidth: number, boatHeight: number): THREE.LineSegments {
  const width = boatWidth * HITBOX_SHRINK
  const height = (boatHeight + BOAT_SAIL_HEIGHT) * HITBOX_SHRINK
  const geometry = new THREE.BoxGeometry(width, height, 0.1)
  const edges = new THREE.EdgesGeometry(geometry)
  const material = new THREE.LineBasicMaterial({ color: 0x0088ff, linewidth: 2 })
  boatDebugHitbox = new THREE.LineSegments(edges, material)
  geometry.dispose()
  return boatDebugHitbox
}

export function updateBoatDebugHitbox(
  boatX: number,
  boatY: number,
  boatZ: number,
  forFlying: boolean
): void {
  if (!boatDebugHitbox) return
  const offsetX = forFlying ? BOAT_SAIL_OFFSET_X : 0
  boatDebugHitbox.position.x = boatX + offsetX
  boatDebugHitbox.position.y = boatY + BOAT_SAIL_OFFSET_Y
  boatDebugHitbox.position.z = boatZ + 0.1
}

export function getBoatDebugHitbox(): THREE.LineSegments | null {
  return boatDebugHitbox
}

// Dispose mesh resources to prevent memory leaks
export function disposeObstacle(obstacle: Obstacle): void {
  obstacle.mesh.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose()
      if (Array.isArray(child.material)) {
        child.material.forEach(m => m.dispose())
      } else if (child.material) {
        child.material.dispose()
      }
    }
  })

  // Clean up debug hitbox
  if (obstacle.debugHitbox) {
    obstacle.debugHitbox.geometry.dispose()
      ; (obstacle.debugHitbox.material as THREE.Material).dispose()
  }
}
