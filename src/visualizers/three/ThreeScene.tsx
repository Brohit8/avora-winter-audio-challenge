import { useRef, useEffect, useState, useCallback } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { VisualizerProps, Screen, FrequencyRange, BoatColor } from '../types'
import {
  COLORS,
  DEFAULT_RED_RANGE,
  DEFAULT_BLUE_RANGE,
  BASE_SPEED_MULTIPLIER,
  WHISTLE_BOOST,
  SINGING_BOOST,
} from '../constants'
import { getFrequencyAverage } from '../utils/audio'
import { SetupOverlay } from '../components/SetupOverlay'
import { WinnerOverlay } from '../components/WinnerOverlay'

// Race boundaries (X positions in 3D space)
const RACE_START_X = -4
const RACE_END_X = 4

/**
 * ThreeScene - Three.js boat race visualizer with game logic
 */
export function ThreeScene({
  frequencyData,
  timeDomainData: _timeDomainData,
  isActive: _isActive,
  width,
  height,
}: VisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null)

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

  // Game actions
  const handleStartRace = useCallback(() => {
    // Reset boat positions when starting race
    if (redBoatRef.current) redBoatRef.current.position.x = RACE_START_X
    if (blueBoatRef.current) blueBoatRef.current.position.x = RACE_START_X
    setScreen('race')
    setWinner(null)
  }, [])

  const handleRaceAgain = useCallback(() => {
    setScreen('setup')
    setWinner(null)
  }, [])

  // Effect 1: Scene Setup (only re-runs when dimensions change)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // === Scene Setup ===
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(COLORS.background)
    sceneRef.current = scene

    // === Camera Setup ===
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
    camera.position.set(0, 5, 10)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    // === Renderer Setup ===
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // === Lighting ===
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(5, 10, 5)
    scene.add(directionalLight)

    // === Gutters (water channels) ===
    const gutterGeometry = new THREE.BoxGeometry(12, 0.5, 1.5)
    const gutterMaterial = new THREE.MeshStandardMaterial({ color: COLORS.water })

    const gutter1 = new THREE.Mesh(gutterGeometry, gutterMaterial)
    gutter1.position.set(0, 0, -2)
    scene.add(gutter1)

    const gutter2 = new THREE.Mesh(gutterGeometry, gutterMaterial)
    gutter2.position.set(0, 0, 2)
    scene.add(gutter2)

    // === Finish Line ===
    const finishLineGeometry = new THREE.BoxGeometry(0.2, 0.6, 5)
    const finishLineMaterial = new THREE.MeshStandardMaterial({ color: COLORS.finishLine })
    const finishLine = new THREE.Mesh(finishLineGeometry, finishLineMaterial)
    finishLine.position.set(RACE_END_X, 0.3, 0)
    scene.add(finishLine)

    // === Load Boat Models ===
    const loader = new GLTFLoader()

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
        const isSailMesh = (mesh: THREE.Mesh) => {
          return mesh.name.includes('Sail') || mesh.parent?.name.includes('Sail')
        }

        // Red boat (top gutter)
        const redBoat = gltf.scene.clone()
        redBoat.traverse((child) => {
          if (child instanceof THREE.Mesh && isSailMesh(child)) {
            child.material = redSailMaterial
          }
        })
        redBoat.position.set(RACE_START_X, 0.5, -2)
        redBoat.scale.set(0.5, 0.5, 0.5)
        redBoat.rotation.y = Math.PI / 2
        scene.add(redBoat)
        redBoatRef.current = redBoat

        // Blue boat (bottom gutter)
        const blueBoat = gltf.scene.clone()
        blueBoat.traverse((child) => {
          if (child instanceof THREE.Mesh && isSailMesh(child)) {
            child.material = blueSailMaterial
          }
        })
        blueBoat.position.set(RACE_START_X, 0.5, 2)
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

    // === Cleanup ===
    return () => {
      gutterGeometry.dispose()
      gutterMaterial.dispose()
      finishLineGeometry.dispose()
      finishLineMaterial.dispose()
      redSailMaterial.dispose()
      blueSailMaterial.dispose()

      if (redBoatRef.current) scene.remove(redBoatRef.current)
      if (blueBoatRef.current) scene.remove(blueBoatRef.current)

      renderer.dispose()
      container.removeChild(renderer.domElement)

      sceneRef.current = null
      cameraRef.current = null
      rendererRef.current = null
      redBoatRef.current = null
      blueBoatRef.current = null
    }
  }, [width, height])

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

      // During race, update boat positions from audio data
      if (screen === 'race' && frequencyData.current && redBoat && blueBoat) {
        const redSpeed = getFrequencyAverage(frequencyData.current, redRange.start, redRange.end)
        const blueSpeed = getFrequencyAverage(frequencyData.current, blueRange.start, blueRange.end)

        redBoat.position.x += redSpeed * BASE_SPEED_MULTIPLIER * WHISTLE_BOOST
        blueBoat.position.x += blueSpeed * BASE_SPEED_MULTIPLIER * SINGING_BOOST

        // Check for winner (first to cross finish line)
        if (redBoat.position.x >= RACE_END_X || blueBoat.position.x >= RACE_END_X) {
          if (redBoat.position.x > blueBoat.position.x) {
            setWinner('red')
          } else {
            setWinner('blue')
          }
          setScreen('winner')
        }
      }

      // Reset boat positions when in setup
      if (screen === 'setup' && redBoat && blueBoat) {
        redBoat.position.x = RACE_START_X
        blueBoat.position.x = RACE_START_X
      }

      // Render (scene/camera/renderer are guaranteed non-null from the check above)
      renderer!.render(scene!, camera!)
      frameId = requestAnimationFrame(animate)
    }

    frameId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(frameId)
    }
  }, [screen, redRange, blueRange, frequencyData])

  return (
    <div style={{ position: 'relative', width, height }}>
      <div ref={containerRef} style={{ width, height }} />

      {screen === 'setup' && (
        <SetupOverlay
          boat1Range={redRange}
          boat2Range={blueRange}
          onBoat1RangeChange={setRedRange}
          onBoat2RangeChange={setBlueRange}
          onStartRace={handleStartRace}
        />
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
