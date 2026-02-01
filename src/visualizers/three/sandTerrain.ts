import * as THREE from 'three'

/**
 * Sand Terrain Generator
 * Creates a plane geometry with procedural noise displacement for beach-like dunes
 * Supports UV scrolling for movement illusion
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

// Shader for scrolling sand texture
const sandVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    vUv = uv;
    vNormal = normalMatrix * normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const sandFragmentShader = `
  uniform float uOffset;
  uniform vec3 uBaseColor;
  uniform vec3 uDarkColor;

  varying vec2 vUv;
  varying vec3 vNormal;

  // Simple noise for sand grain texture
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      value += amplitude * noise(p);
      p *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    // Scroll UV based on world offset (X direction = along river)
    vec2 scrolledUV = vUv;
    scrolledUV.x += uOffset;

    // Multi-scale noise for sand texture
    float largeNoise = fbm(scrolledUV * 8.0);
    float smallNoise = fbm(scrolledUV * 32.0);
    float tinyNoise = fbm(scrolledUV * 64.0);

    // Combine noise scales
    float pattern = largeNoise * 0.5 + smallNoise * 0.3 + tinyNoise * 0.2;

    // Mix base and dark colors based on pattern
    vec3 color = mix(uDarkColor, uBaseColor, pattern * 0.4 + 0.6);

    // Simple lighting based on normal
    float light = dot(vNormal, normalize(vec3(1.0, 2.0, 1.0))) * 0.3 + 0.7;
    color *= light;

    gl_FragColor = vec4(color, 1.0);
  }
`

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
 * Create sand material with scrolling texture
 */
export function createSandMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uOffset: { value: 0 },
      uBaseColor: { value: new THREE.Color(0xfff0c0) },  // Lighter warm sand
      uDarkColor: { value: new THREE.Color(0xc9a060) },  // Much darker golden brown
    },
    vertexShader: sandVertexShader,
    fragmentShader: sandFragmentShader,
  })
}

/**
 * Create complete sand terrain mesh
 */
export function createSandTerrain(config: Partial<SandTerrainConfig> = {}): {
  mesh: THREE.Mesh
  geometry: THREE.PlaneGeometry
  material: THREE.ShaderMaterial
} {
  const geometry = createSandGeometry(config)
  const material = createSandMaterial()

  const mesh = new THREE.Mesh(geometry, material)
  mesh.receiveShadow = true
  mesh.position.set(0, -0.05, 0)  // Slightly below water level

  return { mesh, geometry, material }
}
