import { useRef, useEffect, useState, useCallback } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { VisualizerProps, Screen, FrequencyRange, BoatColor } from './types'
import {
  COLORS,
  DEFAULT_RED_RANGE,
} from './constants'
import { getFrequencyAverage } from './utils/audio'
import { SetupOverlay } from './components/SetupOverlay'
import { CountdownOverlay } from './components/CountdownOverlay'
import { WinnerOverlay } from './components/WinnerOverlay'
import { createWindSwirlSprites, updateWindSwirls, disposeWindSwirls } from './three/windSwirls'
import { createSandTerrain } from './three/sandTerrain'
import { getGerstnerDisplacement, getGerstnerNormal } from './three/gerstnerWaves'
import { createGutter, type GutterResources } from './three/gutter'
import { enableShadows, applySailMaterial } from './three/models'

// =============================================================================
// 3D Scene Layout (module-specific constants)
// =============================================================================

// Boat fixed X position (left-third of screen, like dino game)
const BOAT_X = -2.5

// Boat base Y position (lower = more submerged, higher = floating)
const BOAT_BASE_Y = 0.25

// Gutter position (z-axis) - single centered gutter
const GUTTER_Z = 0

// Wave phase offset
const GUTTER_PHASE = 0.0

// Camera settings
const DEFAULT_CAMERA_POS = new THREE.Vector3(0, 5, 10)
const DEFAULT_CAMERA_TARGET = new THREE.Vector3(0, 0, 0)

// World scroll speed (units per second)
const WORLD_SCROLL_SPEED = 3

// Jump physics (Chrome dino style)
const JUMP_VELOCITY = 8        // Initial upward velocity
const GRAVITY = 25             // Downward acceleration

// Dive physics
const DIVE_DEPTH = -0.6        // How far below water (negative = down, 50% sail visible)
const DIVE_SPEED = 8           // Speed of diving down and rising up

// Audio thresholds
const ACTION_THRESHOLD = 0.25  // Loudness threshold to trigger jump/dive
const ACTION_COOLDOWN = 0.3    // Seconds to wait after action before allowing another

// Frequency bands for jump/dive (FFT bin indices)
const DIVE_FREQ_START = 0      // 0 Hz
const DIVE_FREQ_END = 56       // ~1200 Hz (singing/humming range)
const JUMP_FREQ_START = 56     // ~1200 Hz
const JUMP_FREQ_END = 200      // ~4300 Hz (whistling range)

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
  const waterMaterialRef = useRef<THREE.ShaderMaterial | null>(null)
  const windSwirlsRef = useRef<THREE.Sprite[]>([])
  const waveTimeOriginRef = useRef<number>(0)
  const worldOffsetRef = useRef<number>(0)
  const lastFrameTimeRef = useRef<number>(0)
  const boatVelocityYRef = useRef<number>(0)
  const isJumpingRef = useRef<boolean>(false)
  const isDivingRef = useRef<boolean>(false)
  const diveProgressRef = useRef<number>(0)  // 0 = surface, 1 = fully submerged
  const actionCooldownRef = useRef<number>(0)  // Time remaining before next action allowed

  // Game actions
  const handleStartRace = useCallback(() => {
    // Reset boat position and world offset when starting countdown
    if (boatRef.current) boatRef.current.position.x = BOAT_X
    worldOffsetRef.current = 0
    lastFrameTimeRef.current = 0
    // Reset jump/dive state
    boatVelocityYRef.current = 0
    isJumpingRef.current = false
    isDivingRef.current = false
    diveProgressRef.current = 0
    actionCooldownRef.current = 0
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
        boat.position.set(BOAT_X, BOAT_BASE_Y, GUTTER_Z)
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

        // Water surface level (base + wave displacement)
        const waterLevel = BOAT_BASE_Y + disp.dy

        // Jump/Dive physics (only during race)
        if (screen === 'race') {
          const dt = 1 / 60  // Approximate frame time

          // Decrement cooldown timer
          if (actionCooldownRef.current > 0) {
            actionCooldownRef.current = Math.max(0, actionCooldownRef.current - dt)
          }

          // Check for action triggers
          if (frequencyData.current && !isJumpingRef.current && !isDivingRef.current) {
            const diveLoudness = getFrequencyAverage(frequencyData.current, DIVE_FREQ_START, DIVE_FREQ_END)
            const jumpLoudness = getFrequencyAverage(frequencyData.current, JUMP_FREQ_START, JUMP_FREQ_END)

            // Jump requires cooldown to be finished (discrete action)
            if (jumpLoudness > ACTION_THRESHOLD && actionCooldownRef.current === 0) {
              // High frequency (whistling) = jump
              isJumpingRef.current = true
              boatVelocityYRef.current = JUMP_VELOCITY
            }
            // Dive has no cooldown (continuous hold action)
            else if (diveLoudness > ACTION_THRESHOLD) {
              // Low frequency (singing/humming) = dive
              isDivingRef.current = true
            }
          }

          // Apply jump physics when in air
          if (isJumpingRef.current) {
            boatVelocityYRef.current -= GRAVITY * dt
            boat.position.y += boatVelocityYRef.current * dt

            // Land when hitting water
            if (boat.position.y <= waterLevel) {
              boat.position.y = waterLevel
              boatVelocityYRef.current = 0
              isJumpingRef.current = false
              actionCooldownRef.current = ACTION_COOLDOWN  // Start cooldown
            }
          }
          // Apply dive physics when submerging
          else if (isDivingRef.current) {
            // Check if still holding dive (low frequency sound)
            const diveLoudness = frequencyData.current
              ? getFrequencyAverage(frequencyData.current, DIVE_FREQ_START, DIVE_FREQ_END)
              : 0

            if (diveLoudness > ACTION_THRESHOLD) {
              // Dive down toward target depth
              diveProgressRef.current = Math.min(1, diveProgressRef.current + DIVE_SPEED * dt)
            } else {
              // Rise back up
              diveProgressRef.current = Math.max(0, diveProgressRef.current - DIVE_SPEED * dt)
              if (diveProgressRef.current === 0) {
                isDivingRef.current = false
                // No cooldown after dive - it's a continuous hold action
              }
            }

            // Apply dive offset to water level
            boat.position.y = waterLevel + (DIVE_DEPTH * diveProgressRef.current)
          }
          // Float on water when not jumping or diving
          else {
            boat.position.y = waterLevel
          }
        } else {
          // Not racing - just float on water
          boat.position.y = waterLevel
        }

        // Derive rotation from surface normal
        // Normal tilted in X → roll (rotation.z), Normal tilted in Z → pitch (rotation.x)
        boat.rotation.z = Math.asin(-normal.nx) * 0.6   // Roll
        boat.rotation.x = Math.asin(normal.nz) * 0.5    // Pitch
      }

      // During race, update world offset at constant rate
      if (screen === 'race') {
        // Calculate delta time
        const currentTime = performance.now()
        if (lastFrameTimeRef.current === 0) {
          lastFrameTimeRef.current = currentTime
        }
        const deltaTime = (currentTime - lastFrameTimeRef.current) / 1000
        lastFrameTimeRef.current = currentTime

        // Increment world offset (for obstacle positioning and score)
        worldOffsetRef.current += WORLD_SCROLL_SPEED * deltaTime

        // Update wind swirls (positioned relative to boat)
        if (frequencyData.current && boat) {
          const speed = getFrequencyAverage(frequencyData.current, redRange.start, redRange.end)
          updateWindSwirls(
            windSwirlsRef.current,
            boat.position.x,
            boat.position.y,
            boat.position.z,
            speed,
            elapsed
          )
        }
      } else {
        // Hide wind swirls when not racing
        windSwirlsRef.current.forEach(sprite => sprite.visible = false)
      }

      // Reset boat position and camera when in setup
      if (screen === 'setup' && boat && camera) {
        boat.position.x = BOAT_X
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
