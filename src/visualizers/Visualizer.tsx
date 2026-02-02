import { useRef, useEffect, useState, useCallback } from 'react'
import * as THREE from 'three'
import type { VisualizerProps, Screen, BoatColor } from './types'
import {
  COLORS,
  MAX_SLIDER_BIN,
  BOAT_X,
  BOAT_BASE_Y,
  GUTTER_Z,
  GUTTER_PHASE,
  CAMERA_ANIMATION_DURATION,
  WORLD_SCROLL_SPEED,
  JUMP_VELOCITY,
  GRAVITY,
  DIVE_DEPTH,
  DIVE_SPEED,
  ACTION_THRESHOLD,
  ACTION_COOLDOWN,
  SCORE_COEFFICIENT,
  HIGH_SCORE_KEY,
  OBSTACLE_SPAWN_DELAY,
  OBSTACLE_MIN_GAP,
  OBSTACLE_GAP_VARIANCE,
  OBSTACLE_SPAWN_DISTANCE,
  MAX_OBSTACLE_DUPLICATION,
  BOAT_HITBOX_WIDTH,
  BOAT_HITBOX_HEIGHT,
} from './constants'
import { getFrequencyAverage } from './utils/audio'
import { SetupOverlay } from './components/SetupOverlay'
import { ScoreDisplay } from './components/ScoreDisplay'
import { GameOverOverlay } from './components/GameOverOverlay'
import { DEFAULT_DIVISION_BIN } from './components/FrequencyDivisionSlider'
import { CountdownOverlay } from './components/CountdownOverlay'
import { WinnerOverlay } from './components/WinnerOverlay'
import { createWindSwirlSprites, updateWindSwirls, disposeWindSwirls } from './three/windSwirls'
import { createSandTerrain } from './three/sandTerrain'
import { getGerstnerDisplacement, getGerstnerNormal } from './three/gerstnerWaves'
import { createGutter } from './three/gutter'
import { enableShadows, applySailMaterial } from './three/models'
import {
  createObstacle,
  updateObstacle,
  isObstacleOffScreen,
  getJumpObstacleTypes,
  getDiveObstacleTypes,
  checkCollision,
  disposeObstacle,
  type Obstacle,
  type ObstacleType,
} from './three/obstacles'
import { createClouds, updateClouds, type CloudSystem } from './three/clouds'
import { loadAllAssets } from './three/AssetLoader'

// =============================================================================
// Scene Constants (not in constants.ts because they use THREE.Vector3)
// =============================================================================

const DEFAULT_CAMERA_POS = new THREE.Vector3(0, 3, 6)
const DEFAULT_CAMERA_TARGET = new THREE.Vector3(0, 0, 0)

// Reusable Vector3 objects for animation loop (avoids garbage collection)
const _targetPos = new THREE.Vector3()
const _targetLookAt = new THREE.Vector3()
const _currentLookAt = new THREE.Vector3()

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
  const [divisionBin, setDivisionBin] = useState<number>(DEFAULT_DIVISION_BIN)
  const [winner, setWinner] = useState<BoatColor | null>(null)
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
  const boatVelocityYRef = useRef<number>(0)
  const isJumpingRef = useRef<boolean>(false)
  const isDivingRef = useRef<boolean>(false)
  const diveProgressRef = useRef<number>(0)  // 0 = surface, 1 = fully submerged
  const actionCooldownRef = useRef<number>(0)  // Time remaining before next action allowed
  const isDownKeyHeldRef = useRef<boolean>(false)  // Track if down arrow is held
  const obstaclesRef = useRef<Obstacle[]>([])
  const lastObstacleWorldXRef = useRef<number>(0)
  const obstacleHistoryRef = useRef<ObstacleType[]>([])
  const animationStartTimeRef = useRef<number>(0)
  const cloudSystemRef = useRef<CloudSystem | null>(null)

  // Keyboard controls for jump (spacebar) and dive (down arrow)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (screen !== 'race') return

      if (e.code === 'Space' && !e.repeat) {
        // Spacebar = Jump (only if not already jumping and cooldown finished)
        if (!isJumpingRef.current && !isDivingRef.current && actionCooldownRef.current === 0) {
          isJumpingRef.current = true
          boatVelocityYRef.current = JUMP_VELOCITY
        }
        e.preventDefault()
      } else if (e.code === 'ArrowDown') {
        // Down arrow = Dive (hold to stay down)
        if (!isJumpingRef.current && !isDivingRef.current) {
          isDivingRef.current = true
        }
        isDownKeyHeldRef.current = true
        e.preventDefault()
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowDown') {
        isDownKeyHeldRef.current = false
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [screen])

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
    // Reset jump/dive state
    boatVelocityYRef.current = 0
    isJumpingRef.current = false
    isDivingRef.current = false
    diveProgressRef.current = 0
    actionCooldownRef.current = 0
    isDownKeyHeldRef.current = false
    // Clear obstacles
    const scene = sceneRef.current
    if (scene) {
      obstaclesRef.current.forEach(obs => {
        scene.remove(obs.mesh)
        disposeObstacle(obs)
      })
    }
    obstaclesRef.current = []
    lastObstacleWorldXRef.current = 0
    obstacleHistoryRef.current = []
    setScore(0)
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
    setScreen('gameOver_animation')
  }, [highScore])

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
    camera.position.copy(DEFAULT_CAMERA_POS)
    camera.lookAt(DEFAULT_CAMERA_TARGET)
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

    // Store sand material ref for animation updates
    sandMaterialRef.current = sandMaterial

    // === Gutter (water channel) ===
    const gutter = createGutter(scene, GUTTER_Z, GUTTER_PHASE)
    waterMaterialRef.current = gutter.waterMaterial

    // === Clouds (parallax background) ===
    const cloudSystem = createClouds(scene)
    cloudSystemRef.current = cloudSystem

    // === Load Models ===
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

      // Cleanup clouds
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

      // Update sand texture scroll based on world offset (creates movement illusion)
      // Sand mesh is 150 units wide, UV spans 0-1, so 1/150 = 0.00667 per world unit
      const sandMat = sandMaterialRef.current
      if (sandMat) sandMat.uniforms.uOffset.value = worldOffsetRef.current / 150

      // Update cloud parallax (slower than world speed for depth)
      const clouds = cloudSystemRef.current
      if (clouds) updateClouds(clouds, worldOffsetRef.current)

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

          // Check for action triggers (divisionBin splits dive/jump frequency ranges)
          if (frequencyData.current && !isJumpingRef.current && !isDivingRef.current) {
            const diveLoudness = getFrequencyAverage(frequencyData.current, 0, divisionBin)
            const jumpLoudness = getFrequencyAverage(frequencyData.current, divisionBin, MAX_SLIDER_BIN)

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
            // Check if still holding dive (low frequency sound OR down arrow key)
            const diveLoudness = frequencyData.current
              ? getFrequencyAverage(frequencyData.current, 0, divisionBin)
              : 0

            if (diveLoudness > ACTION_THRESHOLD || isDownKeyHeldRef.current) {
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

        // Update score based on distance traveled
        setScore(Math.floor(worldOffsetRef.current * SCORE_COEFFICIENT))

        // Obstacle spawning
        const worldOffset = worldOffsetRef.current
        const timeSinceStart = worldOffset / WORLD_SCROLL_SPEED

        if (timeSinceStart > OBSTACLE_SPAWN_DELAY) {
          const spawnThreshold = worldOffset + OBSTACLE_SPAWN_DISTANCE
          const lastWorldX = lastObstacleWorldXRef.current
          const gap = OBSTACLE_MIN_GAP + Math.random() * OBSTACLE_GAP_VARIANCE

          if (lastWorldX === 0 || spawnThreshold > lastWorldX + gap) {
            // Pick random obstacle type
            const allTypes = [...getJumpObstacleTypes(), ...getDiveObstacleTypes()]
            let selectedType: ObstacleType

            // Avoid too many duplicates
            const history = obstacleHistoryRef.current
            const lastType = history[history.length - 1]
            let consecutiveCount = 0
            for (let i = history.length - 1; i >= 0; i--) {
              if (history[i] === lastType) consecutiveCount++
              else break
            }

            if (consecutiveCount >= MAX_OBSTACLE_DUPLICATION) {
              // Pick a different type
              const otherTypes = allTypes.filter(t => t !== lastType)
              selectedType = otherTypes[Math.floor(Math.random() * otherTypes.length)]
            } else {
              selectedType = allTypes[Math.floor(Math.random() * allTypes.length)]
            }

            // Create and add obstacle
            const obstacle = createObstacle(selectedType, spawnThreshold)
            scene!.add(obstacle.mesh)
            obstaclesRef.current.push(obstacle)
            lastObstacleWorldXRef.current = spawnThreshold
            obstacleHistoryRef.current.push(selectedType)

            // Keep history small
            if (obstacleHistoryRef.current.length > 10) {
              obstacleHistoryRef.current.shift()
            }
          }
        }

        // Update all obstacles
        obstaclesRef.current.forEach(obstacle => {
          updateObstacle(obstacle, worldOffset, elapsed, GUTTER_Z, GUTTER_PHASE)
        })

        // Check collision with obstacles
        if (boat) {
          for (const obstacle of obstaclesRef.current) {
            if (checkCollision(
              boat.position.x,
              boat.position.y,
              BOAT_HITBOX_WIDTH,
              BOAT_HITBOX_HEIGHT,
              obstacle
            )) {
              handleGameOver()
              return // Stop animation loop
            }
          }
        }

        // Remove off-screen obstacles
        const toRemove = obstaclesRef.current.filter(obs => isObstacleOffScreen(obs, worldOffset))
        toRemove.forEach(obs => {
          scene!.remove(obs.mesh)
          disposeObstacle(obs)
        })
        obstaclesRef.current = obstaclesRef.current.filter(obs => !isObstacleOffScreen(obs, worldOffset))

        // Update wind swirls (positioned relative to boat)
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
        // Hide wind swirls when not racing
        windSwirlsRef.current.forEach(sprite => sprite.visible = false)
      }

      // Camera pan animation during game over
      if (screen === 'gameOver_animation' && boat && camera) {
        const animationElapsed = performance.now() - animationStartTimeRef.current
        const progress = Math.min(animationElapsed / CAMERA_ANIMATION_DURATION, 1)
        const easedProgress = easeOutCubic(progress)

        // Target camera position: close to boat, slightly elevated, from the side
        _targetPos.set(
          boat.position.x + 1.5,  // Slightly ahead of boat
          boat.position.y + 0.8,  // Above boat level
          boat.position.z + 2.5   // From the side
        )

        // Look at the boat
        _targetLookAt.set(
          boat.position.x,
          boat.position.y + 0.2,
          boat.position.z
        )

        // Lerp camera position
        camera.position.lerpVectors(DEFAULT_CAMERA_POS, _targetPos, easedProgress)

        // Lerp lookAt target
        _currentLookAt.lerpVectors(
          DEFAULT_CAMERA_TARGET,
          _targetLookAt,
          easedProgress
        )
        camera.lookAt(_currentLookAt)

        // Transition to game over screen after animation completes
        if (progress >= 1) {
          setScreen('gameOver')
        }
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
  }, [screen, divisionBin, frequencyData, winner, handleGameOver])

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

      {screen === 'winner' && winner && (
        <WinnerOverlay
          winner={winner}
          onRaceAgain={handleRaceAgain}
        />
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
