import * as THREE from 'three'
import { waterVertexShader, waterFragmentShader } from './gerstnerWaves'

// River water surface with animated Gerstner waves

const RIVER_LENGTH = 80
const WATER_WIDTH = 2.5
const WATER_SEGMENTS_X = 200
const WATER_SEGMENTS_Z = 20
const WATER_Y = 0.35

const DEEP_WATER_HEIGHT = 0.4
const DEEP_WATER_Y = 0.15
const DEEP_WATER_COLOR = 0x1a8a9a

const WATER_COLOR = 0x00abbf
const HIGHLIGHT_COLOR = 0xffffff
const DEEP_COLOR = 0x01b3bf

export interface GutterResources {
  waterMaterial: THREE.ShaderMaterial
  dispose: () => void
}

export function createGutter(
  scene: THREE.Scene,
  gutterZ: number,
  phase: number
): GutterResources {
  // Deep water fill layer
  const deepWaterGeometry = new THREE.BoxGeometry(RIVER_LENGTH, DEEP_WATER_HEIGHT, WATER_WIDTH)
  const deepWaterMaterial = new THREE.MeshBasicMaterial({ color: DEEP_WATER_COLOR })
  const deepWater = new THREE.Mesh(deepWaterGeometry, deepWaterMaterial)
  deepWater.position.set(0, DEEP_WATER_Y, gutterZ)
  scene.add(deepWater)

  // Wave surface
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
