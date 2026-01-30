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

// =============================================================================
// GERSTNER WAVES - Industry standard for realistic ocean simulation
// Reference: GPU Gems Ch.1, used in Sea of Thieves, AC Black Flag
// Key insight: vertices move in elliptical orbits, not just up/down
// This bunches vertices at crests (sharp peaks) and spreads them at troughs (flat)
// =============================================================================

interface GerstnerWave {
  dir: [number, number]  // Normalized direction (dx, dz)
  steepness: number      // Q: 0 = sine, higher = sharper peaks (max ~1)
  wavelength: number     // Distance between crests
  speed: number          // How fast the wave travels
}

// Multiple waves at different angles for natural ocean look
// Each gutter will get a phase offset for variation
// Steepness reduced for subtler motion (was 0.25/0.20/0.15/0.10)
const GERSTNER_WAVES: GerstnerWave[] = [
  { dir: [1.0, 0.0],   steepness: 0.12, wavelength: 4.0, speed: 1.2 },   // Primary: along gutter
  { dir: [0.7, 0.7],   steepness: 0.08, wavelength: 2.5, speed: 1.5 },   // Diagonal
  { dir: [0.9, -0.4],  steepness: 0.06, wavelength: 1.8, speed: 1.8 },   // Slight cross
  { dir: [-0.3, 0.95], steepness: 0.04, wavelength: 1.2, speed: 2.2 },   // Cross-wave (perpendicular chop)
]

// Normalize directions and pre-compute angular frequencies
const WAVES_PROCESSED = GERSTNER_WAVES.map((w, i) => {
  const len = Math.sqrt(w.dir[0] ** 2 + w.dir[1] ** 2)
  const dx = w.dir[0] / len
  const dz = w.dir[1] / len
  const omega = (2 * Math.PI) / w.wavelength  // Angular frequency
  const amplitude = w.steepness / omega        // A = Q / ω for proper steepness
  return { dx, dz, omega, amplitude, speed: w.speed, phase: i * 1.3 }
})

// Water shader for Gerstner waves
const waterVertexShader = `
  uniform float uTime;
  uniform float uPhaseOffset;  // Different per gutter for variation
  varying float vWaveHeight;
  varying vec3 vNormal;

  void main() {
    vec3 pos = position;
    vec3 tangent = vec3(1.0, 0.0, 0.0);
    vec3 binormal = vec3(0.0, 0.0, 1.0);

    // Sum Gerstner wave contributions
    ${WAVES_PROCESSED.map((w, i) => `
    {
      float phase${i} = ${w.omega.toFixed(4)} * (${w.dx.toFixed(4)} * position.x + ${w.dz.toFixed(4)} * position.z) + uTime * ${w.speed.toFixed(2)} + uPhaseOffset + ${w.phase.toFixed(2)};
      float s${i} = sin(phase${i});
      float c${i} = cos(phase${i});

      // Gerstner displacement: horizontal + vertical
      pos.x += ${(w.amplitude * w.dx).toFixed(5)} * c${i};
      pos.z += ${(w.amplitude * w.dz).toFixed(5)} * c${i};
      pos.y += ${w.amplitude.toFixed(5)} * s${i};

      // Accumulate tangent/binormal for normal calculation
      float wa${i} = ${(w.omega * w.amplitude).toFixed(5)};
      tangent.x -= wa${i} * ${w.dx.toFixed(4)} * ${w.dx.toFixed(4)} * s${i};
      tangent.y += wa${i} * ${w.dx.toFixed(4)} * c${i};
      tangent.z -= wa${i} * ${w.dx.toFixed(4)} * ${w.dz.toFixed(4)} * s${i};
      binormal.x -= wa${i} * ${w.dx.toFixed(4)} * ${w.dz.toFixed(4)} * s${i};
      binormal.y += wa${i} * ${w.dz.toFixed(4)} * c${i};
      binormal.z -= wa${i} * ${w.dz.toFixed(4)} * ${w.dz.toFixed(4)} * s${i};
    }`).join('')}

    vWaveHeight = pos.y - position.y;
    vNormal = normalize(cross(binormal, tangent));

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const waterFragmentShader = `
  uniform vec3 uColor;
  uniform vec3 uHighlightColor;
  uniform vec3 uDeepColor;
  varying float vWaveHeight;
  varying vec3 vNormal;

  void main() {
    // Base ocean blue
    vec3 baseColor = mix(uDeepColor, uColor, 0.7);

    // Wave height shading - lighter on crests, darker in troughs
    float heightFactor = clamp(vWaveHeight * 6.0 + 0.5, 0.0, 1.0);
    baseColor = mix(baseColor, uHighlightColor, heightFactor * 0.25);

    // Subtle specular highlight based on surface normal facing up
    float specular = pow(max(0.0, vNormal.y), 4.0);
    baseColor = mix(baseColor, uHighlightColor, specular * 0.15);

    gl_FragColor = vec4(baseColor, 1.0);
  }
`

// Calculate Gerstner wave displacement at a position (must match shader)
function getGerstnerDisplacement(
  x: number,
  z: number,
  time: number,
  phaseOffset: number
): { dx: number; dy: number; dz: number } {
  let dx = 0, dy = 0, dz = 0

  WAVES_PROCESSED.forEach(w => {
    const phase = w.omega * (w.dx * x + w.dz * z) + time * w.speed + phaseOffset + w.phase
    const s = Math.sin(phase)
    const c = Math.cos(phase)

    dx += w.amplitude * w.dx * c
    dz += w.amplitude * w.dz * c
    dy += w.amplitude * s
  })

  return { dx, dy, dz }
}

// Calculate surface normal for boat rotation (cross product of tangent and binormal)
function getGerstnerNormal(
  x: number,
  z: number,
  time: number,
  phaseOffset: number
): { nx: number; ny: number; nz: number } {
  let tx = 1, ty = 0, tz = 0  // Tangent
  let bx = 0, by = 0, bz = 1  // Binormal

  WAVES_PROCESSED.forEach(w => {
    const phase = w.omega * (w.dx * x + w.dz * z) + time * w.speed + phaseOffset + w.phase
    const s = Math.sin(phase)
    const c = Math.cos(phase)
    const wa = w.omega * w.amplitude

    tx -= wa * w.dx * w.dx * s
    ty += wa * w.dx * c
    tz -= wa * w.dx * w.dz * s

    bx -= wa * w.dx * w.dz * s
    by += wa * w.dz * c
    bz -= wa * w.dz * w.dz * s
  })

  // Normal = binormal × tangent
  const nx = by * tz - bz * ty
  const ny = bz * tx - bx * tz
  const nz = bx * ty - by * tx
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz)

  return { nx: nx / len, ny: ny / len, nz: nz / len }
}

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
  const waterMaterial1Ref = useRef<THREE.ShaderMaterial | null>(null)
  const waterMaterial2Ref = useRef<THREE.ShaderMaterial | null>(null)

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

    // === Gutters (water channels with Gerstner wave shader) ===
    const waterColor = new THREE.Color(0x1e6091)      // Medium ocean blue
    const highlightColor = new THREE.Color(0x5ba3c6)  // Lighter blue for highlights
    const deepColor = new THREE.Color(0x14405f)       // Darker blue for troughs

    // Water plane geometry with segments for smooth Gerstner displacement
    const waterGeometry = new THREE.PlaneGeometry(12, 1.5, 64, 16)
    waterGeometry.rotateX(-Math.PI / 2) // Lay flat

    // Phase offsets give each gutter different wave patterns
    const GUTTER1_PHASE = 0.0
    const GUTTER2_PHASE = 3.7

    const waterMaterial1 = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPhaseOffset: { value: GUTTER1_PHASE },
        uColor: { value: waterColor },
        uHighlightColor: { value: highlightColor },
        uDeepColor: { value: deepColor },
      },
      vertexShader: waterVertexShader,
      fragmentShader: waterFragmentShader,
    })
    waterMaterial1Ref.current = waterMaterial1

    const waterMaterial2 = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPhaseOffset: { value: GUTTER2_PHASE },
        uColor: { value: waterColor.clone() },
        uHighlightColor: { value: highlightColor.clone() },
        uDeepColor: { value: deepColor.clone() },
      },
      vertexShader: waterVertexShader,
      fragmentShader: waterFragmentShader,
    })
    waterMaterial2Ref.current = waterMaterial2

    const water1 = new THREE.Mesh(waterGeometry, waterMaterial1)
    water1.position.set(0, 0.25, -2)
    scene.add(water1)

    const water2 = new THREE.Mesh(waterGeometry.clone(), waterMaterial2)
    water2.position.set(0, 0.25, 2)
    scene.add(water2)

    // Gutter sides (channel walls)
    const gutterSideGeometry = new THREE.BoxGeometry(12, 0.3, 0.1)
    const gutterSideMaterial = new THREE.MeshStandardMaterial({ color: 0x1a2a3f })

    // Top gutter walls
    const gutter1Left = new THREE.Mesh(gutterSideGeometry, gutterSideMaterial)
    gutter1Left.position.set(0, 0.15, -2.75)
    scene.add(gutter1Left)
    const gutter1Right = new THREE.Mesh(gutterSideGeometry, gutterSideMaterial)
    gutter1Right.position.set(0, 0.15, -1.25)
    scene.add(gutter1Right)

    // Bottom gutter walls
    const gutter2Left = new THREE.Mesh(gutterSideGeometry, gutterSideMaterial)
    gutter2Left.position.set(0, 0.15, 1.25)
    scene.add(gutter2Left)
    const gutter2Right = new THREE.Mesh(gutterSideGeometry, gutterSideMaterial)
    gutter2Right.position.set(0, 0.15, 2.75)
    scene.add(gutter2Right)

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
      waterGeometry.dispose()
      waterMaterial1.dispose()
      waterMaterial2.dispose()
      gutterSideGeometry.dispose()
      gutterSideMaterial.dispose()
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
      waterMaterial1Ref.current = null
      waterMaterial2Ref.current = null
    }
  }, [width, height])

  // Effect 2: Animation Loop (re-runs when screen or ranges change, like Canvas 2D)
  useEffect(() => {
    const scene = sceneRef.current
    const camera = cameraRef.current
    const renderer = rendererRef.current
    if (!scene || !camera || !renderer) return

    let frameId: number
    const startTime = performance.now()

    function animate() {
      const redBoat = redBoatRef.current
      const blueBoat = blueBoatRef.current
      const waterMat1 = waterMaterial1Ref.current
      const waterMat2 = waterMaterial2Ref.current

      // Update water shader time
      const elapsed = (performance.now() - startTime) / 1000
      if (waterMat1) waterMat1.uniforms.uTime.value = elapsed
      if (waterMat2) waterMat2.uniforms.uTime.value = elapsed

      // Apply boat rocking synced to Gerstner waves
      // Each gutter has a different phase offset for variation
      const GUTTER1_PHASE = 0.0
      const GUTTER2_PHASE = 3.7

      if (redBoat) {
        // Get Gerstner displacement at boat position (red boat in gutter 1, z=-2)
        const disp = getGerstnerDisplacement(redBoat.position.x, -2, elapsed, GUTTER1_PHASE)
        const normal = getGerstnerNormal(redBoat.position.x, -2, elapsed, GUTTER1_PHASE)

        // Apply vertical displacement (horizontal displacement already in shader)
        redBoat.position.y = 0.5 + disp.dy

        // Derive rotation from surface normal
        // Normal tilted in X → roll (rotation.z), Normal tilted in Z → pitch (rotation.x)
        redBoat.rotation.z = Math.asin(-normal.nx) * 0.6   // Roll
        redBoat.rotation.x = Math.asin(normal.nz) * 0.5    // Pitch
      }

      if (blueBoat) {
        // Blue boat in gutter 2, z=2, with different phase
        const disp = getGerstnerDisplacement(blueBoat.position.x, 2, elapsed, GUTTER2_PHASE)
        const normal = getGerstnerNormal(blueBoat.position.x, 2, elapsed, GUTTER2_PHASE)

        blueBoat.position.y = 0.5 + disp.dy
        blueBoat.rotation.z = Math.asin(-normal.nx) * 0.6
        blueBoat.rotation.x = Math.asin(normal.nz) * 0.5
      }

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
