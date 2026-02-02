import { useRef, useEffect, useCallback } from 'react'
import type { VisualizerProps } from './types'
import {
  MAX_SLIDER_BIN,
  BOAT_X,
  BOAT_BASE_Y,
  GUTTER_Z,
  GUTTER_PHASE,
  WORLD_SCROLL_SPEED,
  ACTION_THRESHOLD,
} from './constants'
import {
  createPhysicsState,
  resetPhysicsState,
  checkAudioTriggers,
  updatePhysics,
  type PhysicsState,
} from './game/physics'
import { useKeyboardControls } from './hooks/useKeyboardControls'
import { useGameState } from './hooks/useGameState'
import { useThreeScene, DEFAULT_CAMERA_POS, DEFAULT_CAMERA_TARGET } from './hooks/useThreeScene'
import { getFrequencyAverage } from './utils/audio'
import { SetupOverlay } from './components/SetupOverlay'
import { ScoreDisplay } from './components/ScoreDisplay'
import { GameOverOverlay } from './components/GameOverOverlay'
import { CountdownOverlay } from './components/CountdownOverlay'
import { updateWindSwirls } from './three/windSwirls'
import { getGerstnerDisplacement, getGerstnerNormal } from './three/gerstnerWaves'
import { updateClouds } from './three/clouds'
import { updateGameOverCamera, resetCamera } from './game/cameraAnimation'

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

  // Game state
  const {
    screen,
    divisionBin,
    score,
    highScore,
    isNewHighScore,
    setDivisionBin,
    startCountdown,
    startRace,
    triggerGameOver,
    showGameOver,
    updateScore,
  } = useGameState()

  // Three.js scene
  const {
    sceneRef,
    cameraRef,
    rendererRef,
    boatRef,
    waterMaterialRef,
    sandMaterialRef,
    windSwirlsRef,
    cloudSystemRef,
    obstacleManagerRef,
    waveTimeOriginRef,
  } = useThreeScene(containerRef)

  // Game-specific refs
  const worldOffsetRef = useRef<number>(0)
  const lastFrameTimeRef = useRef<number>(0)
  const physicsStateRef = useRef<PhysicsState>(createPhysicsState())
  const animationStartTimeRef = useRef<number>(0)

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
    startCountdown()
  }, [startCountdown])

  const handleGameOver = useCallback(() => {
    triggerGameOver(worldOffsetRef.current)
    animationStartTimeRef.current = performance.now()
  }, [triggerGameOver])

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
          const diveLoudness = frequencyData.current
            ? getFrequencyAverage(frequencyData.current, 0, divisionBin)
            : 0
          if (frequencyData.current) {
            const jumpLoudness = getFrequencyAverage(frequencyData.current, divisionBin, MAX_SLIDER_BIN)
            checkAudioTriggers(physics, jumpLoudness, diveLoudness)
          }

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
        updateScore(worldOffsetRef.current)

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
          showGameOver()
        }
      }

      // Setup state reset
      if (screen === 'setup' && boat && camera) {
        boat.position.x = BOAT_X
        resetCamera(camera, DEFAULT_CAMERA_POS, DEFAULT_CAMERA_TARGET)
      }

      if (renderer && scene && camera) {
        renderer.render(scene, camera)
      }
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
        <CountdownOverlay onComplete={startRace} />
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
