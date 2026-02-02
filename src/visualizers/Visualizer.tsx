import { useRef, useEffect, useState, useCallback } from 'react'
import * as THREE from 'three'
import type { VisualizerProps, Screen } from './types'
import {
  COLORS,
  MAX_SLIDER_BIN,
  BOAT_X,
  BOAT_BASE_Y,
  GUTTER_Z,
  GUTTER_PHASE,
  WORLD_SCROLL_SPEED,
  ACTION_THRESHOLD,
  SCORE_COEFFICIENT,
  HIGH_SCORE_KEY,
} from './constants'
import {
  createPhysicsState,
  resetPhysicsState,
  checkAudioTriggers,
  updatePhysics,
  type PhysicsState,
} from './game/physics'
import { useKeyboardControls } from './hooks/useKeyboardControls'
import { getFrequencyAverage } from './utils/audio'
import { SetupOverlay } from './components/SetupOverlay'
import { ScoreDisplay } from './components/ScoreDisplay'
import { GameOverOverlay } from './components/GameOverOverlay'
import { DEFAULT_DIVISION_BIN } from './components/FrequencyDivisionSlider'
import { CountdownOverlay } from './components/CountdownOverlay'
import { createWindSwirlSprites, updateWindSwirls, disposeWindSwirls } from './three/windSwirls'
import { createSandTerrain } from './three/sandTerrain'
import { getGerstnerDisplacement, getGerstnerNormal } from './three/gerstnerWaves'
import { createGutter } from './three/gutter'
import { enableShadows, applySailMaterial } from './three/models'
import { createClouds, updateClouds, type CloudSystem } from './three/clouds'
import { loadAllAssets } from './three/AssetLoader'
import { ObstacleManager } from './game/ObstacleManager'
import { updateGameOverCamera, resetCamera } from './game/cameraAnimation'

// Scene constants (use THREE.Vector3, so kept separate from constants.ts)
const DEFAULT_CAMERA_POS = new THREE.Vector3(0, 3, 6)
const DEFAULT_CAMERA_TARGET = new THREE.Vector3(0, 0, 0)

/**
 * Visualizer - Three.js boat racing game with audio controls
 *
 * Audio Pipeline (handled by useAudio):
 *   The useAudio hook captures microphone input via the Web Audio API. It creates
 *   an AnalyserNode that performs real-time FFT (Fast Fourier Transform) analysis,
 *   breaking the audio signal into frequency components. The data refs are updated
 *   every frame (~60fps) via requestAnimationFrame—no React re-renders involved.
 *
 * Props:
 *   - frequencyData: Ref to Uint8Array of 1024 FFT frequency bins (0-255 values).
 *       Index 0 is the lowest frequency (DC), higher indices = higher frequencies.
 *   - timeDomainData: Ref to Uint8Array of 2048 waveform samples (0-255 values).
 *       Represents the raw audio signal; 128 is silence, 0/255 are extremes.
 *   - isActive: boolean indicating if audio is streaming
 *   - onRequestMic: callback to request microphone access
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
  const [divisionBin, setDivisionBin] = useState<number>(DEFAULT_DIVISION_BIN)
  const [score, setScore] = useState<number>(0)
  const [highScore, setHighScore] = useState<number>(() => {
    const saved = localStorage.getItem(HIGH_SCORE_KEY)
    return saved ? parseInt(saved, 10) : 0
  })
  const [isNewHighScore, setIsNewHighScore] = useState<boolean>(false)

  // Three.js object refs (shared between effects)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const boatRef = useRef<THREE.Group | null>(null)
  const waterMaterialRef = useRef<THREE.ShaderMaterial | null>(null)
  const sandMaterialRef = useRef<THREE.ShaderMaterial | null>(null)
  const windSwirlsRef = useRef<THREE.Sprite[]>([])
  const waveTimeOriginRef = useRef<number>(0)
  const worldOffsetRef = useRef<number>(0)
  const lastFrameTimeRef = useRef<number>(0)
  const physicsStateRef = useRef<PhysicsState>(createPhysicsState())
  const obstacleManagerRef = useRef<ObstacleManager | null>(null)
  const animationStartTimeRef = useRef<number>(0)
  const cloudSystemRef = useRef<CloudSystem | null>(null)

  // Keyboard controls
  const { isDownKeyHeldRef } = useKeyboardControls(screen, physicsStateRef)

  // Game actions
  const handleStartRace = useCallback(() => {
    // Reset camera to default position
    if (cameraRef.current) {
      cameraRef.current.position.copy(DEFAULT_CAMERA_POS)
      cameraRef.current.lookAt(DEFAULT_CAMERA_TARGET)
    }
    // Reset boat position and world offset when starting countdown
    if (boatRef.current) boatRef.current.position.x = BOAT_X
    worldOffsetRef.current = 0
    lastFrameTimeRef.current = 0
    // Reset physics state
    resetPhysicsState(physicsStateRef.current)
    isDownKeyHeldRef.current = false
    // Clear obstacles
    obstacleManagerRef.current?.reset()
    setScore(0)
    setScreen('countdown')
  }, [])

  const handleCountdownComplete = useCallback(() => {
    setScreen('race')
  }, [])

  const handleGameOver = useCallback(() => {
    // Check for new high score
    const currentScore = Math.floor(worldOffsetRef.current * SCORE_COEFFICIENT)
    if (currentScore > highScore) {
      setHighScore(currentScore)
      setIsNewHighScore(true)
      localStorage.setItem(HIGH_SCORE_KEY, currentScore.toString())
    } else {
      setIsNewHighScore(false)
    }
    animationStartTimeRef.current = performance.now()
    setScreen('gameOverAnimation')
  }, [highScore])

  // Scene setup (runs once on mount)
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

    // Sand terrain (sized to stay within camera bounds)
    const { mesh: sand, geometry: sandGeometry, material: sandMaterial } = createSandTerrain({
      width: 150,
      depth: 120,
      segmentsX: 150,
      segmentsZ: 120,
    })
    scene.add(sand)

    // Camera
    const camera = new THREE.PerspectiveCamera(75, size.width / size.height, 0.1, 1000)
    camera.position.copy(DEFAULT_CAMERA_POS)
    camera.lookAt(DEFAULT_CAMERA_TARGET)
    cameraRef.current = camera

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(size.width, size.height)
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

    sandMaterialRef.current = sandMaterial

    // Water channel
    const gutter = createGutter(scene, GUTTER_Z, GUTTER_PHASE)
    waterMaterialRef.current = gutter.waterMaterial

    // Clouds
    const cloudSystem = createClouds(scene)
    cloudSystemRef.current = cloudSystem

    // Models
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
  }, [])

  // Animation loop
  useEffect(() => {
    const scene = sceneRef.current
    const camera = cameraRef.current
    const renderer = rendererRef.current
    if (!scene || !camera || !renderer) return

    let frameId: number

    function animate() {
      const boat = boatRef.current
      const waterMat = waterMaterialRef.current

      // Elapsed time for wave animation
      const elapsed = (performance.now() - waveTimeOriginRef.current) / 1000
      if (waterMat) waterMat.uniforms.uTime.value = elapsed

      // Sand scroll for movement illusion
      const sandMat = sandMaterialRef.current
      if (sandMat) sandMat.uniforms.uOffset.value = worldOffsetRef.current / 150

      // Cloud parallax
      const clouds = cloudSystemRef.current
      if (clouds) updateClouds(clouds, worldOffsetRef.current)

      // Boat wave rocking
      if (boat) {
        const disp = getGerstnerDisplacement(boat.position.x, GUTTER_Z, elapsed, GUTTER_PHASE)
        const normal = getGerstnerNormal(boat.position.x, GUTTER_Z, elapsed, GUTTER_PHASE)
        const waterLevel = BOAT_BASE_Y + disp.dy

        // Physics (race only)
        if (screen === 'race') {
          const dt = 1 / 60
          const physics = physicsStateRef.current

          // Audio triggers
          if (frequencyData.current) {
            const diveLoudness = getFrequencyAverage(frequencyData.current, 0, divisionBin)
            const jumpLoudness = getFrequencyAverage(frequencyData.current, divisionBin, MAX_SLIDER_BIN)
            checkAudioTriggers(physics, jumpLoudness, diveLoudness)
          }

          // Dive hold check
          const diveLoudness = frequencyData.current
            ? getFrequencyAverage(frequencyData.current, 0, divisionBin)
            : 0
          const isDiveHeld = diveLoudness > ACTION_THRESHOLD || isDownKeyHeldRef.current

          boat.position.y = updatePhysics(physics, dt, waterLevel, isDiveHeld)
        } else {
          boat.position.y = waterLevel
        }

        // Rotation from wave normal
        boat.rotation.z = Math.asin(-normal.nx) * 0.6
        boat.rotation.x = Math.asin(normal.nz) * 0.5
      }

      // Race logic
      if (screen === 'race') {
        const currentTime = performance.now()
        if (lastFrameTimeRef.current === 0) {
          lastFrameTimeRef.current = currentTime
        }
        const deltaTime = (currentTime - lastFrameTimeRef.current) / 1000
        lastFrameTimeRef.current = currentTime

        worldOffsetRef.current += WORLD_SCROLL_SPEED * deltaTime
        setScore(Math.floor(worldOffsetRef.current * SCORE_COEFFICIENT))

        // Obstacles
        const worldOffset = worldOffsetRef.current
        const obstacleManager = obstacleManagerRef.current
        if (obstacleManager) {
          obstacleManager.trySpawn(worldOffset)
          obstacleManager.updateAll(worldOffset, elapsed)

          if (boat && obstacleManager.checkBoatCollision(boat.position.x, boat.position.y)) {
            handleGameOver()
            return
          }

          obstacleManager.removeOffScreen(worldOffset)
        }

        // Wind effects
        if (frequencyData.current && boat) {
          const speed = getFrequencyAverage(frequencyData.current, divisionBin, MAX_SLIDER_BIN)
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
        windSwirlsRef.current.forEach(sprite => sprite.visible = false)
      }

      // Game over camera animation
      if (screen === 'gameOverAnimation' && boat && camera) {
        const result = updateGameOverCamera(
          camera,
          boat,
          animationStartTimeRef.current,
          DEFAULT_CAMERA_POS,
          DEFAULT_CAMERA_TARGET
        )
        if (result.isComplete) {
          setScreen('gameOver')
        }
      }

      // Setup state reset
      if (screen === 'setup' && boat && camera) {
        boat.position.x = BOAT_X
        resetCamera(camera, DEFAULT_CAMERA_POS, DEFAULT_CAMERA_TARGET)
      }

      renderer!.render(scene!, camera!)
      frameId = requestAnimationFrame(animate)
    }

    frameId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(frameId)
    }
  }, [screen, divisionBin, frequencyData, handleGameOver])

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100dvh' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {screen === 'race' && (
        <ScoreDisplay score={score} highScore={highScore} />
      )}

      {screen === 'setup' && (
        <SetupOverlay
          divisionBin={divisionBin}
          onDivisionChange={setDivisionBin}
          onStartRace={handleStartRace}
          onRequestMic={onRequestMic}
        />
      )}

      {screen === 'countdown' && (
        <CountdownOverlay onComplete={handleCountdownComplete} />
      )}

      {screen === 'gameOver' && (
        <GameOverOverlay
          score={score}
          highScore={highScore}
          isNewHighScore={isNewHighScore}
          onPlayAgain={handleStartRace}
        />
      )}
    </div>
  )
}
