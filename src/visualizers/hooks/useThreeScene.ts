import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { COLORS, BOAT_X, BOAT_BASE_Y, GUTTER_Z, GUTTER_PHASE } from '../constants'
import { createSandTerrain } from '../three/sandTerrain'
import { createGutter } from '../three/gutter'
import { createClouds, type CloudSystem } from '../three/clouds'
import { createWindSwirlSprites, disposeWindSwirls } from '../three/windSwirls'
import { enableShadows, applySailMaterial } from '../three/models'
import { loadAllAssets } from '../three/AssetLoader'
import { ObstacleManager } from '../game/ObstacleManager'

// Camera defaults
const DEFAULT_CAMERA_POS = new THREE.Vector3(0, 3, 6)
const DEFAULT_CAMERA_TARGET = new THREE.Vector3(0, 0, 0)

export { DEFAULT_CAMERA_POS, DEFAULT_CAMERA_TARGET }

// Three.js scene initialization and resource management
export function useThreeScene(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight })

  // Three.js object refs
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const boatRef = useRef<THREE.Group | null>(null)
  const waterMaterialRef = useRef<THREE.ShaderMaterial | null>(null)
  const sandMaterialRef = useRef<THREE.ShaderMaterial | null>(null)
  const windSwirlsRef = useRef<THREE.Sprite[]>([])
  const cloudSystemRef = useRef<CloudSystem | null>(null)
  const obstacleManagerRef = useRef<ObstacleManager | null>(null)
  const waveTimeOriginRef = useRef<number>(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    waveTimeOriginRef.current = performance.now()

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xc7e8ef)
    sceneRef.current = scene

    // Obstacle manager
    const obstacleManager = new ObstacleManager(scene)
    obstacleManagerRef.current = obstacleManager

    // Sand terrain
    const { mesh: sand, geometry: sandGeometry, material: sandMaterial } = createSandTerrain({
      width: 150,
      depth: 120,
      segmentsX: 150,
      segmentsZ: 120,
    })
    scene.add(sand)
    sandMaterialRef.current = sandMaterial

    // Camera
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.copy(DEFAULT_CAMERA_POS)
    camera.lookAt(DEFAULT_CAMERA_TARGET)
    cameraRef.current = camera

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Lighting
    const hemisphereLight = new THREE.HemisphereLight(0xc7e8ef, 0xffeab3, 0.8)
    scene.add(hemisphereLight)

    const directionalLight = new THREE.DirectionalLight(0xFFF5E6, 1.3)
    directionalLight.position.set(2, 12, 15)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 1024
    directionalLight.shadow.mapSize.height = 1024
    directionalLight.shadow.camera.near = 1
    directionalLight.shadow.camera.far = 30
    directionalLight.shadow.camera.left = -10
    directionalLight.shadow.camera.right = 10
    directionalLight.shadow.camera.top = 10
    directionalLight.shadow.camera.bottom = -10
    scene.add(directionalLight)

    // Water channel
    const gutter = createGutter(scene, GUTTER_Z, GUTTER_PHASE)
    waterMaterialRef.current = gutter.waterMaterial

    // Clouds
    const cloudSystem = createClouds(scene)
    cloudSystemRef.current = cloudSystem

    // Boat model
    const sailMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.red.primary,
      metalness: 0.0,
      roughness: 0.9,
    })

    loadAllAssets()
      .then(({ model: boatModel }) => {
        const boat = boatModel.clone()
        enableShadows(boat)
        applySailMaterial(boat, sailMaterial)
        boat.position.set(BOAT_X, BOAT_BASE_Y, GUTTER_Z)
        boat.scale.set(0.35, 0.35, 0.35)
        boat.rotation.y = Math.PI / 2
        scene.add(boat)
        boatRef.current = boat
      })
      .catch((error) => {
        console.error('Error loading models:', error)
      })

    // Wind effects
    const windSwirls = createWindSwirlSprites(5)
    windSwirls.forEach(sprite => scene.add(sprite))
    windSwirlsRef.current = windSwirls

    // Resize handling
    const handleResize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
      setSize({ width, height })
    }
    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      sandGeometry.dispose()
      sandMaterial.dispose()
      gutter.dispose()
      sailMaterial.dispose()

      if (boatRef.current) scene.remove(boatRef.current)

      windSwirlsRef.current.forEach(sprite => scene.remove(sprite))
      disposeWindSwirls(windSwirlsRef.current)
      windSwirlsRef.current = []

      if (cloudSystemRef.current) {
        cloudSystemRef.current.clouds.forEach(c => scene.remove(c.mesh))
        cloudSystemRef.current.dispose()
      }

      renderer.dispose()
      container.removeChild(renderer.domElement)

      sceneRef.current = null
      cameraRef.current = null
      rendererRef.current = null
      boatRef.current = null
      waterMaterialRef.current = null
      sandMaterialRef.current = null
      cloudSystemRef.current = null
    }
  }, [containerRef])

  return {
    // Core Three.js objects
    sceneRef,
    cameraRef,
    rendererRef,
    boatRef,

    // Materials for animation updates
    waterMaterialRef,
    sandMaterialRef,

    // Effects
    windSwirlsRef,
    cloudSystemRef,

    // Game objects
    obstacleManagerRef,

    // Timing
    waveTimeOriginRef,

    // Viewport
    size,
  }
}
