import { useRef, useEffect, useState, useCallback } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { VisualizerProps, Screen, FrequencyRange, BoatColor } from './types'
import {
  COLORS,
  DEFAULT_RED_RANGE,
  BASE_SPEED_MULTIPLIER,
  WHISTLE_BOOST,
} from './constants'
import { getFrequencyAverage } from './utils/audio'
import { SetupOverlay } from './components/SetupOverlay'
import { CountdownOverlay } from './components/CountdownOverlay'
import { WinnerOverlay } from './components/WinnerOverlay'
import { createWindSwirlSprites, updateWindSwirls, disposeWindSwirls } from './three/windSwirls'
import { createSandTerrain } from './three/sandTerrain'
import { getGerstnerDisplacement, getGerstnerNormal } from './three/gerstnerWaves'
import { createGutter, type GutterResources } from './three/gutter'
import { enableShadows, applySailMaterial, makeUnlit } from './three/models'

// =============================================================================
// 3D Scene Layout (module-specific constants)
// =============================================================================

const RACE_START_X = -4

// Buoy position (finish line) - positioned toward end of gutter
const BUOY_X = 5.25

// Boat hull tip offset from center (measured from bounding box: max.z * 0.5 scale)
const BOAT_FRONT_OFFSET = 1

// Boat base Y position (lower = more submerged, higher = floating)
const BOAT_BASE_Y = 0.25

// Gutter position (z-axis) - single centered gutter
const GUTTER_Z = 0

// Wave phase offset
const GUTTER_PHASE = 0.0

// Camera animation settings
const CAMERA_ANIMATION_DURATION = 2000 // 2 seconds in ms
const DEFAULT_CAMERA_POS = new THREE.Vector3(0, 5, 10)
const DEFAULT_CAMERA_TARGET = new THREE.Vector3(0, 0, 0)

// Ease-out cubic for smooth deceleration
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/**
 * Visualizer - Three.js boat race visualizer with game logic
 */
export function Visualizer({
  frequencyData,
  timeDomainData: _timeDomainData,
  isActive: _isActive,
  onRequestMic,
}: VisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Responsive sizing
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight })

  // Game state
  const [screen, setScreen] = useState<Screen>('setup')
  const [redRange, setRedRange] = useState<FrequencyRange>(DEFAULT_RED_RANGE)
  const [winner, setWinner] = useState<BoatColor | null>(null)

  // Three.js object refs (shared between effects)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const boatRef = useRef<THREE.Group | null>(null)
  const buoyRef = useRef<THREE.Group | null>(null)
  const waterMaterialRef = useRef<THREE.ShaderMaterial | null>(null)
  const windSwirlsRef = useRef<THREE.Sprite[]>([])
  const animationStartTimeRef = useRef<number>(0)
  const waveTimeOriginRef = useRef<number>(0)

  // Game actions
  const handleStartRace = useCallback(() => {
    // Reset boat position when starting countdown
    if (boatRef.current) boatRef.current.position.x = RACE_START_X
    setScreen('countdown')
    setWinner(null)
  }, [])

  const handleCountdownComplete = useCallback(() => {
    setScreen('race')
  }, [])

  const handleRaceAgain = useCallback(() => {
    setScreen('setup')
    setWinner(null)
  }, [])

  // Effect 1: Scene Setup (only re-runs when dimensions change)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Initialize wave time origin (must be in useEffect, not during render)
    waveTimeOriginRef.current = performance.now()

    // === Scene Setup ===
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xc7e8ef)
    sceneRef.current = scene

    // === Sand Terrain with Bumps ===
    // Large enough that edges are outside the camera's visible area
    // (including after win animation camera pan to x=9.25, y=1.05)
    const { mesh: sand, geometry: sandGeometry, material: sandMaterial } = createSandTerrain({
      width: 150,
      depth: 120,
      segmentsX: 150,
      segmentsZ: 120,
    })
    scene.add(sand)

    // === Camera Setup ===
    const camera = new THREE.PerspectiveCamera(75, size.width / size.height, 0.1, 1000)
    camera.position.set(0, 5, 10)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    // === Renderer Setup ===
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(size.width, size.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)) // Cap at 2 for mobile performance
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // === Lighting ===
    // Hemisphere light for natural ambient fill (sky to ground gradient)
    const hemisphereLight = new THREE.HemisphereLight(
      0xc7e8ef,  // Sky color
      0xffeab3,  // Ground color (sand)
      0.8
    )
    scene.add(hemisphereLight)

    // Warm directional light for sun - positioned for classic 3/4 lighting
    // (high and slightly behind camera which is at 0, 5, 10)
    const directionalLight = new THREE.DirectionalLight(0xFFF5E6, 1.3)
    directionalLight.position.set(2, 12, 15)
    directionalLight.castShadow = true
    // Shadow camera setup - covers the race course
    directionalLight.shadow.mapSize.width = 1024
    directionalLight.shadow.mapSize.height = 1024
    directionalLight.shadow.camera.near = 1
    directionalLight.shadow.camera.far = 30
    directionalLight.shadow.camera.left = -10
    directionalLight.shadow.camera.right = 10
    directionalLight.shadow.camera.top = 10
    directionalLight.shadow.camera.bottom = -10
    scene.add(directionalLight)

    // === Gutter (water channel) ===
    const gutter = createGutter(scene, GUTTER_Z, GUTTER_PHASE)
    waterMaterialRef.current = gutter.waterMaterial

    // === Load Models ===
    const loader = new GLTFLoader()

    // Load finish line buoy (unlit so checkered pattern ignores lighting)
    loader.load(
      '/models/buoy.glb',
      (gltf) => {
        const buoy = gltf.scene.clone()
        makeUnlit(buoy)
        enableShadows(buoy, true, false)
        buoy.position.set(BUOY_X, 0.1, GUTTER_Z - 0.6)
        buoy.scale.set(0.36, 0.36, 0.36)
        scene.add(buoy)
        buoyRef.current = buoy
      },
      undefined,
      (error) => {
        console.error('Error loading buoy model:', error)
      }
    )

    const sailMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.red.primary,
      metalness: 0.0,
      roughness: 0.9,
    })

    loader.load(
      '/models/regatta_boat.glb',
      (gltf) => {
        const boat = gltf.scene.clone()
        enableShadows(boat)
        applySailMaterial(boat, sailMaterial)
        boat.position.set(RACE_START_X, BOAT_BASE_Y, GUTTER_Z)
        boat.scale.set(0.5, 0.5, 0.5)
        boat.rotation.y = Math.PI / 2
        scene.add(boat)
        boatRef.current = boat
      },
      undefined,
      (error) => {
        console.error('Error loading boat model:', error)
      }
    )

    // === Wind Swirl Sprites ===
    const windSwirls = createWindSwirlSprites(5)
    windSwirls.forEach(sprite => scene.add(sprite))
    windSwirlsRef.current = windSwirls

    // === Resize Handling ===
    const handleResize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
      setSize({ width, height })
    }
    window.addEventListener('resize', handleResize)

    // === Cleanup ===
    return () => {
      window.removeEventListener('resize', handleResize)
      sandGeometry.dispose()
      sandMaterial.dispose()
      gutter.dispose()
      sailMaterial.dispose()

      if (boatRef.current) scene.remove(boatRef.current)
      if (buoyRef.current) scene.remove(buoyRef.current)

      // Cleanup wind swirls
      windSwirlsRef.current.forEach(sprite => scene.remove(sprite))
      disposeWindSwirls(windSwirlsRef.current)
      windSwirlsRef.current = []

      renderer.dispose()
      container.removeChild(renderer.domElement)

      sceneRef.current = null
      cameraRef.current = null
      rendererRef.current = null
      boatRef.current = null
      buoyRef.current = null
      waterMaterialRef.current = null
    }
  }, [])

  // Effect 2: Animation Loop (re-runs when screen or ranges change, like Canvas 2D)
  useEffect(() => {
    const scene = sceneRef.current
    const camera = cameraRef.current
    const renderer = rendererRef.current
    if (!scene || !camera || !renderer) return

    let frameId: number

    function animate() {
      const boat = boatRef.current
      const waterMat = waterMaterialRef.current

      // Use stable time reference for wave animation (prevents snapping on state changes)
      const elapsed = (performance.now() - waveTimeOriginRef.current) / 1000
      if (waterMat) waterMat.uniforms.uTime.value = elapsed

      // Apply boat rocking synced to Gerstner waves
      if (boat) {
        // Get Gerstner displacement at boat position
        const disp = getGerstnerDisplacement(boat.position.x, GUTTER_Z, elapsed, GUTTER_PHASE)
        const normal = getGerstnerNormal(boat.position.x, GUTTER_Z, elapsed, GUTTER_PHASE)

        // Apply vertical displacement (horizontal displacement already in shader)
        boat.position.y = BOAT_BASE_Y + disp.dy

        // Derive rotation from surface normal
        // Normal tilted in X → roll (rotation.z), Normal tilted in Z → pitch (rotation.x)
        boat.rotation.z = Math.asin(-normal.nx) * 0.6   // Roll
        boat.rotation.x = Math.asin(normal.nz) * 0.5    // Pitch
      }

      // Apply buoy rocking synced to Gerstner waves
      const buoy = buoyRef.current

      if (buoy) {
        const disp = getGerstnerDisplacement(BUOY_X, GUTTER_Z - 0.6, elapsed, GUTTER_PHASE)
        const normal = getGerstnerNormal(BUOY_X, GUTTER_Z - 0.6, elapsed, GUTTER_PHASE)
        buoy.position.y = 0.1 + disp.dy
        buoy.rotation.z = Math.asin(-normal.nx) * 0.4
        buoy.rotation.x = Math.asin(normal.nz) * 0.4
      }

      // During race, update boat position from audio data
      if (screen === 'race' && frequencyData.current && boat) {
        const speed = getFrequencyAverage(frequencyData.current, redRange.start, redRange.end)

        boat.position.x += speed * BASE_SPEED_MULTIPLIER * WHISTLE_BOOST

        // Update wind swirls based on audio loudness
        updateWindSwirls(
          windSwirlsRef.current,
          boat.position.x,
          boat.position.y,
          boat.position.z,
          speed,
          elapsed
        )

        // Check for winner (front of boat crosses the buoy finish line)
        const boatFront = boat.position.x + BOAT_FRONT_OFFSET

        if (boatFront >= BUOY_X) {
          setWinner('red')
          // Start camera animation instead of showing winner immediately
          animationStartTimeRef.current = performance.now()
          setScreen('win_animation')
        }
      } else {
        // Hide wind swirls when not racing
        windSwirlsRef.current.forEach(sprite => sprite.visible = false)
      }

      // Camera pan animation during win_animation screen
      if (screen === 'win_animation' && winner && camera) {
        const animationElapsed = performance.now() - animationStartTimeRef.current
        const progress = Math.min(animationElapsed / CAMERA_ANIMATION_DURATION, 1)
        const easedProgress = easeOutCubic(progress)

        // Calculate boat's position at finish line
        const winnerZ = GUTTER_Z
        const boatY = BOAT_BASE_Y

        // Camera position: behind finish line, slightly elevated, centered on winner's lane
        // Distance back from boat determines field of view of the scene
        const cameraDistance = 4
        const cameraHeight = boatY + 0.8  // Slightly above boat for slight downward angle
        const targetPos = new THREE.Vector3(
          BUOY_X + cameraDistance,
          cameraHeight,
          winnerZ  // Directly behind winner for center framing
        )

        // Look directly at the winning boat's position to center it on screen
        const targetLookAt = new THREE.Vector3(BUOY_X, boatY, winnerZ)

        // Lerp camera position
        camera.position.lerpVectors(DEFAULT_CAMERA_POS, targetPos, easedProgress)

        // Lerp lookAt target
        const currentLookAt = new THREE.Vector3().lerpVectors(
          DEFAULT_CAMERA_TARGET,
          targetLookAt,
          easedProgress
        )
        camera.lookAt(currentLookAt)

        // Transition to winner screen after animation completes
        if (progress >= 1) {
          setScreen('winner')
        }
      }

      // Reset boat position and camera when in setup
      if (screen === 'setup' && boat && camera) {
        boat.position.x = RACE_START_X
        // Reset camera to default position
        camera.position.copy(DEFAULT_CAMERA_POS)
        camera.lookAt(DEFAULT_CAMERA_TARGET)
      }

      // Render (scene/camera/renderer are guaranteed non-null from the check above)
      renderer!.render(scene!, camera!)
      frameId = requestAnimationFrame(animate)
    }

    frameId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(frameId)
    }
  }, [screen, redRange, frequencyData, winner])

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100dvh' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {screen === 'setup' && (
        <SetupOverlay
          boatRange={redRange}
          onBoatRangeChange={setRedRange}
          onStartRace={handleStartRace}
          onRequestMic={onRequestMic}
        />
      )}

      {screen === 'countdown' && (
        <CountdownOverlay onComplete={handleCountdownComplete} />
      )}

      {screen === 'winner' && winner && (
        <WinnerOverlay
          winner={winner}
          onRaceAgain={handleRaceAgain}
        />
      )}
    </div>
  )
}
