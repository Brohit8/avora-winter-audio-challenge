import * as THREE from 'three'

/**
 * Sand Terrain Generator
 * Creates a plane geometry with procedural noise displacement for beach-like dunes
 */

// Simple 2D noise function (no external dependencies)
function noise2D(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return (n - Math.floor(n)) * 2 - 1
}

// Smoothed noise with interpolation
function smoothNoise(x: number, y: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0

  // Interpolate between grid points
  const n00 = noise2D(x0, y0)
  const n10 = noise2D(x0 + 1, y0)
  const n01 = noise2D(x0, y0 + 1)
  const n11 = noise2D(x0 + 1, y0 + 1)

  // Smooth interpolation
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)

  return (
    n00 * (1 - sx) * (1 - sy) +
    n10 * sx * (1 - sy) +
    n01 * (1 - sx) * sy +
    n11 * sx * sy
  )
}

// Fractal Brownian Motion for natural-looking terrain
function fbm(x: number, y: number, octaves: number = 3): number {
  let value = 0
  let amplitude = 1
  let frequency = 1
  let maxValue = 0

  for (let i = 0; i < octaves; i++) {
    value += amplitude * smoothNoise(x * frequency, y * frequency)
    maxValue += amplitude
    amplitude *= 0.5
    frequency *= 2
  }

  return value / maxValue
}

interface SandTerrainConfig {
  width: number
  depth: number
  segmentsX: number
  segmentsZ: number
  bumpHeight: number      // Max height of sand bumps
  bumpScale: number       // Scale of the noise pattern
  flattenCenter?: boolean // Keep center area flatter for water channels
}

const DEFAULT_CONFIG: SandTerrainConfig = {
  width: 30,
  depth: 20,
  segmentsX: 60,
  segmentsZ: 40,
  bumpHeight: 0.35,   // Increased for more visible dunes
  bumpScale: 0.5,     // Larger features for better visibility
  flattenCenter: false,
}

/**
 * Create sand terrain geometry with procedural bumps
 */
export function createSandGeometry(config: Partial<SandTerrainConfig> = {}): THREE.PlaneGeometry {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  const geometry = new THREE.PlaneGeometry(
    cfg.width,
    cfg.depth,
    cfg.segmentsX,
    cfg.segmentsZ
  )

  // Rotate to lay flat (Y-up)
  geometry.rotateX(-Math.PI / 2)

  // Get position attribute for vertex manipulation
  const positions = geometry.attributes.position

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i)
    const z = positions.getZ(i)

    // Calculate noise-based height
    let height = fbm(x * cfg.bumpScale, z * cfg.bumpScale, 3) * cfg.bumpHeight

    // Optionally flatten the center area where water channels are
    if (cfg.flattenCenter) {
      const centerFalloff = Math.abs(z) / (cfg.depth / 2)
      const flattenFactor = Math.min(1, centerFalloff * 1.5)
      height *= flattenFactor
    }

    // Apply height displacement
    positions.setY(i, height)
  }

  // Recalculate normals for proper lighting
  geometry.computeVertexNormals()

  return geometry
}

/**
 * Create sand material with beach-like appearance
 */
export function createSandMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0xffeab3,  // Warm peachy sand
    roughness: 0.85,
    metalness: 0.0,
  })
}

/**
 * Create complete sand terrain mesh
 */
export function createSandTerrain(config: Partial<SandTerrainConfig> = {}): {
  mesh: THREE.Mesh
  geometry: THREE.PlaneGeometry
  material: THREE.MeshStandardMaterial
} {
  const geometry = createSandGeometry(config)
  const material = createSandMaterial()

  const mesh = new THREE.Mesh(geometry, material)
  mesh.receiveShadow = true
  mesh.position.set(0, -0.05, 0)  // Slightly below water level

  return { mesh, geometry, material }
}
