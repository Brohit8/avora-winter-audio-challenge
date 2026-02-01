import * as THREE from 'three'
import { waterVertexShader, waterFragmentShader } from './gerstnerWaves'

/**
 * Gutter (water channel) factory
 * Creates a complete gutter with water surface, walls, bottom, and end caps
 */

// Gutter geometry constants
const GUTTER_LENGTH = 80  // Extended to span well beyond any camera view
const WATER_WIDTH = 1.5
const WATER_SEGMENTS_X = 200  // More segments for longer water
const WATER_SEGMENTS_Z = 16
const WATER_Y = 0.25

const WALL_HEIGHT = 0.3
const WALL_THICKNESS = 0.1
const WALL_Y = 0.15
const WALL_OFFSET = 0.80  // water half-width (0.75) + wall half-thickness (0.05)

const BOTTOM_HEIGHT = 0.05
const BOTTOM_WIDTH = 1.74  // water + walls + small overlap
const BOTTOM_Y = 0

const WALL_COLOR = 0x1a2a3f
const WATER_COLOR = 0x00abbf
const HIGHLIGHT_COLOR = 0xffffff
const DEEP_COLOR = 0x01b3bf

export interface GutterResources {
  waterMaterial: THREE.ShaderMaterial
  dispose: () => void
}

/**
 * Create a complete gutter and add it to the scene
 */
export function createGutter(
  scene: THREE.Scene,
  gutterZ: number,
  phase: number
): GutterResources {
  // Shared geometries and materials (created once, reused for both gutters if called twice)
  const waterGeometry = new THREE.PlaneGeometry(
    GUTTER_LENGTH,
    WATER_WIDTH,
    WATER_SEGMENTS_X,
    WATER_SEGMENTS_Z
  )
  waterGeometry.rotateX(-Math.PI / 2)

  const waterColor = new THREE.Color(WATER_COLOR)
  const highlightColor = new THREE.Color(HIGHLIGHT_COLOR)
  const deepColor = new THREE.Color(DEEP_COLOR)

  const waterMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPhaseOffset: { value: phase },
      uColor: { value: waterColor },
      uHighlightColor: { value: highlightColor },
      uDeepColor: { value: deepColor },
    },
    vertexShader: waterVertexShader,
    fragmentShader: waterFragmentShader,
  })

  const water = new THREE.Mesh(waterGeometry, waterMaterial)
  water.position.set(0, WATER_Y, gutterZ)
  water.receiveShadow = true
  scene.add(water)

  // Wall material (shared by all wall pieces)
  const wallMaterial = new THREE.MeshStandardMaterial({ color: WALL_COLOR })

  // Side walls
  const sideGeometry = new THREE.BoxGeometry(GUTTER_LENGTH, WALL_HEIGHT, WALL_THICKNESS)

  const leftWall = new THREE.Mesh(sideGeometry, wallMaterial)
  leftWall.position.set(0, WALL_Y, gutterZ - WALL_OFFSET)
  leftWall.receiveShadow = true
  scene.add(leftWall)

  const rightWall = new THREE.Mesh(sideGeometry, wallMaterial)
  rightWall.position.set(0, WALL_Y, gutterZ + WALL_OFFSET)
  rightWall.receiveShadow = true
  scene.add(rightWall)

  // Bottom
  const bottomGeometry = new THREE.BoxGeometry(GUTTER_LENGTH, BOTTOM_HEIGHT, BOTTOM_WIDTH)
  const bottom = new THREE.Mesh(bottomGeometry, wallMaterial)
  bottom.position.set(0, BOTTOM_Y, gutterZ)
  bottom.receiveShadow = true
  scene.add(bottom)

  // Return resources for animation and cleanup
  return {
    waterMaterial,
    dispose: () => {
      waterGeometry.dispose()
      waterMaterial.dispose()
      sideGeometry.dispose()
      bottomGeometry.dispose()
      wallMaterial.dispose()
    },
  }
}
