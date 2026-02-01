import * as THREE from 'three'
import { waterVertexShader, waterFragmentShader } from './gerstnerWaves'

/**
 * River water surface factory
 * Creates animated water with a deep water layer beneath
 */

// River geometry constants
const RIVER_LENGTH = 80  // Extended to span well beyond any camera view
const WATER_WIDTH = 2.5  // Wider for river appearance
const WATER_SEGMENTS_X = 200  // More segments for longer water
const WATER_SEGMENTS_Z = 20
const WATER_Y = 0.35

// Deep water layer (box that fills gap between wave troughs and ground)
const DEEP_WATER_HEIGHT = 0.4  // Thickness of the fill layer
const DEEP_WATER_Y = 0.15  // Center of box - top at ~0.35, bottom at ~-0.05
const DEEP_WATER_COLOR = 0x1a8a9a  // Lighter teal to blend with wave troughs

const WATER_COLOR = 0x00abbf
const HIGHLIGHT_COLOR = 0xffffff
const DEEP_COLOR = 0x01b3bf

export interface GutterResources {
  waterMaterial: THREE.ShaderMaterial
  dispose: () => void
}

/**
 * Create river water surface and add it to the scene
 */
export function createGutter(
  scene: THREE.Scene,
  gutterZ: number,
  phase: number
): GutterResources {
  // Deep water layer (box that fills gap between wave troughs and ground)
  const deepWaterGeometry = new THREE.BoxGeometry(RIVER_LENGTH, DEEP_WATER_HEIGHT, WATER_WIDTH)
  const deepWaterMaterial = new THREE.MeshBasicMaterial({ color: DEEP_WATER_COLOR })
  const deepWater = new THREE.Mesh(deepWaterGeometry, deepWaterMaterial)
  deepWater.position.set(0, DEEP_WATER_Y, gutterZ)
  scene.add(deepWater)

  // Animated water surface
  const waterGeometry = new THREE.PlaneGeometry(
    RIVER_LENGTH,
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

  // Return resources for animation and cleanup
  return {
    waterMaterial,
    dispose: () => {
      deepWaterGeometry.dispose()
      deepWaterMaterial.dispose()
      waterGeometry.dispose()
      waterMaterial.dispose()
    },
  }
}
