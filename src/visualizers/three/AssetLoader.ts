import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { setSpiralModel, setMolarModel, setToothbrushModel } from './obstacles'

// Centralized GLTF model loading

const loader = new GLTFLoader()

export interface BoatAssets {
  model: THREE.Group
}

function loadModel(path: string): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    loader.load(
      path,
      (gltf) => resolve(gltf.scene),
      undefined,
      (error) => reject(new Error(`Failed to load ${path}: ${error}`))
    )
  })
}

export async function loadBoatModel(): Promise<THREE.Group> {
  return loadModel('/models/regatta_boat.glb')
}

// Load obstacle models and register with obstacle system
export async function loadObstacleModels(): Promise<void> {
  const [spiral, molar, toothbrush] = await Promise.all([
    loadModel('/models/spiral_v3.glb'),
    loadModel('/models/molar.glb'),
    loadModel('/models/toothbrush.glb'),
  ])

  setSpiralModel(spiral)
  setMolarModel(molar)
  setToothbrushModel(toothbrush)
}

// Load all game assets in parallel
export async function loadAllAssets(): Promise<BoatAssets> {
  const [boatModel] = await Promise.all([
    loadBoatModel(),
    loadObstacleModels(),
  ])

  return { model: boatModel }
}
