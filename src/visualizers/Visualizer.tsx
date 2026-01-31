import { useRef, useEffect, useState, useCallback } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { VisualizerProps, Screen, FrequencyRange, BoatColor } from './types'
import {
  COLORS,
  DEFAULT_RED_RANGE,
  DEFAULT_BLUE_RANGE,
  BASE_SPEED_MULTIPLIER,
  WHISTLE_BOOST,
  SINGING_BOOST,
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

// Gutter positions (z-axis)
const GUTTER1_Z = -1.5  // Top gutter (red boat)
const GUTTER2_Z = 1.5   // Bottom gutter (blue boat)

// Wave phase offsets give each gutter different wave patterns
const GUTTER1_PHASE = 0.0
const GUTTER2_PHASE = 3.7

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
  const [blueRange, setBlueRange] = useState<FrequencyRange>(DEFAULT_BLUE_RANGE)
  const [winner, setWinner] = useState<BoatColor | null>(null)

  // Three.js object refs (shared between effects)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const redBoatRef = useRef<THREE.Group | null>(null)
  const blueBoatRef = useRef<THREE.Group | null>(null)
  const buoy1Ref = useRef<THREE.Group | null>(null)
  const buoy2Ref = useRef<THREE.Group | null>(null)
  const waterMaterial1Ref = useRef<THREE.ShaderMaterial | null>(null)
  const waterMaterial2Ref = useRef<THREE.ShaderMaterial | null>(null)
  const redSwirlsRef = useRef<THREE.Sprite[]>([])
  const blueSwirlsRef = useRef<THREE.Sprite[]>([])
  const animationStartTimeRef = useRef<number>(0)
  const waveTimeOriginRef = useRef<number>(0)

  // Game actions
  const handleStartRace = useCallback(() => {
    // Reset boat positions when starting countdown
    if (redBoatRef.current) redBoatRef.current.position.x = RACE_START_X
    if (blueBoatRef.current) blueBoatRef.current.position.x = RACE_START_X
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

    // === Gutters (water channels) ===
    const gutter1 = createGutter(scene, GUTTER1_Z, GUTTER1_PHASE)
    const gutter2 = createGutter(scene, GUTTER2_Z, GUTTER2_PHASE)
    waterMaterial1Ref.current = gutter1.waterMaterial
    waterMaterial2Ref.current = gutter2.waterMaterial

    // === Load Models ===
    const loader = new GLTFLoader()

    // Load finish line buoys (unlit so checkered pattern ignores lighting)
    loader.load(
      '/models/buoy.glb',
      (gltf) => {
        const buoy1 = gltf.scene.clone()
        makeUnlit(buoy1)
        enableShadows(buoy1, true, false)
        buoy1.position.set(BUOY_X, 0.1, GUTTER1_Z - 0.6)
        buoy1.scale.set(0.36, 0.36, 0.36)
        scene.add(buoy1)
        buoy1Ref.current = buoy1

        const buoy2 = gltf.scene.clone()
        makeUnlit(buoy2)
        enableShadows(buoy2, true, false)
        buoy2.position.set(BUOY_X, 0.1, GUTTER2_Z - 0.6)
        buoy2.scale.set(0.36, 0.36, 0.36)
        scene.add(buoy2)
        buoy2Ref.current = buoy2
      },
      undefined,
      (error) => {
        console.error('Error loading buoy model:', error)
      }
    )

    const redSailMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.red.primary,
      metalness: 0.0,
      roughness: 0.9,
    })
    const blueSailMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.blue.primary,
      metalness: 0.0,
      roughness: 0.9,
    })

    loader.load(
      '/models/regatta_boat.glb',
      (gltf) => {
        // Red boat (top gutter)
        const redBoat = gltf.scene.clone()
        enableShadows(redBoat)
        applySailMaterial(redBoat, redSailMaterial)
        redBoat.position.set(RACE_START_X, BOAT_BASE_Y, GUTTER1_Z)
        redBoat.scale.set(0.5, 0.5, 0.5)
        redBoat.rotation.y = Math.PI / 2
        scene.add(redBoat)
        redBoatRef.current = redBoat

        // Blue boat (bottom gutter)
        const blueBoat = gltf.scene.clone()
        enableShadows(blueBoat)
        applySailMaterial(blueBoat, blueSailMaterial)
        blueBoat.position.set(RACE_START_X, BOAT_BASE_Y, GUTTER2_Z)
        blueBoat.scale.set(0.5, 0.5, 0.5)
        blueBoat.rotation.y = Math.PI / 2
        scene.add(blueBoat)
        blueBoatRef.current = blueBoat
      },
      undefined,
      (error) => {
        console.error('Error loading boat model:', error)
      }
    )

    // === Wind Swirl Sprites ===
    const redSwirls = createWindSwirlSprites(5)
    redSwirls.forEach(sprite => scene.add(sprite))
    redSwirlsRef.current = redSwirls

    const blueSwirls = createWindSwirlSprites(5)
    blueSwirls.forEach(sprite => scene.add(sprite))
    blueSwirlsRef.current = blueSwirls

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
      gutter1.dispose()
      gutter2.dispose()
      redSailMaterial.dispose()
      blueSailMaterial.dispose()

      if (redBoatRef.current) scene.remove(redBoatRef.current)
      if (blueBoatRef.current) scene.remove(blueBoatRef.current)
      if (buoy1Ref.current) scene.remove(buoy1Ref.current)
      if (buoy2Ref.current) scene.remove(buoy2Ref.current)

      // Cleanup wind swirls
      redSwirlsRef.current.forEach(sprite => scene.remove(sprite))
      blueSwirlsRef.current.forEach(sprite => scene.remove(sprite))
      disposeWindSwirls(redSwirlsRef.current)
      disposeWindSwirls(blueSwirlsRef.current)
      redSwirlsRef.current = []
      blueSwirlsRef.current = []

      renderer.dispose()
      container.removeChild(renderer.domElement)

      sceneRef.current = null
      cameraRef.current = null
      rendererRef.current = null
      redBoatRef.current = null
      blueBoatRef.current = null
      buoy1Ref.current = null
      buoy2Ref.current = null
      waterMaterial1Ref.current = null
      waterMaterial2Ref.current = null
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
      const redBoat = redBoatRef.current
      const blueBoat = blueBoatRef.current
      const waterMat1 = waterMaterial1Ref.current
      const waterMat2 = waterMaterial2Ref.current

      // Use stable time reference for wave animation (prevents snapping on state changes)
      const elapsed = (performance.now() - waveTimeOriginRef.current) / 1000
      if (waterMat1) waterMat1.uniforms.uTime.value = elapsed
      if (waterMat2) waterMat2.uniforms.uTime.value = elapsed

      // Apply boat rocking synced to Gerstner waves
      if (redBoat) {
        // Get Gerstner displacement at boat position (red boat in gutter 1)
        const disp = getGerstnerDisplacement(redBoat.position.x, GUTTER1_Z, elapsed, GUTTER1_PHASE)
        const normal = getGerstnerNormal(redBoat.position.x, GUTTER1_Z, elapsed, GUTTER1_PHASE)

        // Apply vertical displacement (horizontal displacement already in shader)
        redBoat.position.y = BOAT_BASE_Y + disp.dy

        // Derive rotation from surface normal
        // Normal tilted in X → roll (rotation.z), Normal tilted in Z → pitch (rotation.x)
        redBoat.rotation.z = Math.asin(-normal.nx) * 0.6   // Roll
        redBoat.rotation.x = Math.asin(normal.nz) * 0.5    // Pitch
      }

      if (blueBoat) {
        // Blue boat in gutter 2, with different phase
        const disp = getGerstnerDisplacement(blueBoat.position.x, GUTTER2_Z, elapsed, GUTTER2_PHASE)
        const normal = getGerstnerNormal(blueBoat.position.x, GUTTER2_Z, elapsed, GUTTER2_PHASE)

        blueBoat.position.y = BOAT_BASE_Y + disp.dy
        blueBoat.rotation.z = Math.asin(-normal.nx) * 0.6
        blueBoat.rotation.x = Math.asin(normal.nz) * 0.5
      }

      // Apply buoy rocking synced to Gerstner waves
      const buoy1 = buoy1Ref.current
      const buoy2 = buoy2Ref.current

      if (buoy1) {
        const disp = getGerstnerDisplacement(BUOY_X, GUTTER1_Z - 0.6, elapsed, GUTTER1_PHASE)
        const normal = getGerstnerNormal(BUOY_X, GUTTER1_Z - 0.6, elapsed, GUTTER1_PHASE)
        buoy1.position.y = 0.1 + disp.dy
        buoy1.rotation.z = Math.asin(-normal.nx) * 0.4
        buoy1.rotation.x = Math.asin(normal.nz) * 0.4
      }

      if (buoy2) {
        const disp = getGerstnerDisplacement(BUOY_X, GUTTER2_Z - 0.6, elapsed, GUTTER2_PHASE)
        const normal = getGerstnerNormal(BUOY_X, GUTTER2_Z - 0.6, elapsed, GUTTER2_PHASE)
        buoy2.position.y = 0.1 + disp.dy
        buoy2.rotation.z = Math.asin(-normal.nx) * 0.4
        buoy2.rotation.x = Math.asin(normal.nz) * 0.4
      }

      // During race, update boat positions from audio data
      if (screen === 'race' && frequencyData.current && redBoat && blueBoat) {
        const redSpeed = getFrequencyAverage(frequencyData.current, redRange.start, redRange.end)
        const blueSpeed = getFrequencyAverage(frequencyData.current, blueRange.start, blueRange.end)

        redBoat.position.x += redSpeed * BASE_SPEED_MULTIPLIER * WHISTLE_BOOST
        blueBoat.position.x += blueSpeed * BASE_SPEED_MULTIPLIER * SINGING_BOOST

        // Update wind swirls based on audio loudness
        updateWindSwirls(
          redSwirlsRef.current,
          redBoat.position.x,
          redBoat.position.y,
          redBoat.position.z,
          redSpeed,
          elapsed
        )
        updateWindSwirls(
          blueSwirlsRef.current,
          blueBoat.position.x,
          blueBoat.position.y,
          blueBoat.position.z,
          blueSpeed,
          elapsed
        )

        // Check for winner (front of boat crosses the buoy finish line)
        const redFront = redBoat.position.x + BOAT_FRONT_OFFSET
        const blueFront = blueBoat.position.x + BOAT_FRONT_OFFSET

        if (redFront >= BUOY_X || blueFront >= BUOY_X) {
          if (redFront > blueFront) {
            setWinner('red')
          } else {
            setWinner('blue')
          }
          // Start camera animation instead of showing winner immediately
          animationStartTimeRef.current = performance.now()
          setScreen('win_animation')
        }
      } else {
        // Hide wind swirls when not racing
        redSwirlsRef.current.forEach(sprite => sprite.visible = false)
        blueSwirlsRef.current.forEach(sprite => sprite.visible = false)
      }

      // Camera pan animation during win_animation screen
      if (screen === 'win_animation' && winner && camera) {
        const animationElapsed = performance.now() - animationStartTimeRef.current
        const progress = Math.min(animationElapsed / CAMERA_ANIMATION_DURATION, 1)
        const easedProgress = easeOutCubic(progress)

        // Calculate winner's position at finish line
        const winnerZ = winner === 'red' ? GUTTER1_Z : GUTTER2_Z
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

      // Reset boat positions and camera when in setup
      if (screen === 'setup' && redBoat && blueBoat && camera) {
        redBoat.position.x = RACE_START_X
        blueBoat.position.x = RACE_START_X
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
  }, [screen, redRange, blueRange, frequencyData, winner])

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100dvh' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {screen === 'setup' && (
        <SetupOverlay
          boat1Range={redRange}
          boat2Range={blueRange}
          onBoat1RangeChange={setRedRange}
          onBoat2RangeChange={setBlueRange}
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
