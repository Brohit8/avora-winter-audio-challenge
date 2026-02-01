import * as THREE from 'three'

/**
 * Parallax Clouds
 * Soft, natural-looking clouds that scroll slowly in the background
 * to create depth and movement illusion
 */

// =============================================================================
// ADJUSTABLE CONSTANTS
// =============================================================================

// Cloud parallax speed relative to world scroll (0.15 = 15% of world speed)
// Lower = slower/more distant feel, Higher = faster/closer feel
export const CLOUD_PARALLAX_SPEED = 0.25

// =============================================================================
// Cloud Configuration
// =============================================================================

const CLOUD_COUNT = 4
const CLOUD_Y_MIN = 5        // Minimum height in sky
const CLOUD_Y_MAX = 9        // Maximum height in sky
const CLOUD_Z = -35          // Far behind the scene (closer = bigger appearance)
const CLOUD_SPREAD_X = 80    // How far clouds spread horizontally (tighter grouping)
const CLOUD_SCALE_MIN = 10   // Minimum cloud scale
const CLOUD_SCALE_MAX = 15   // Maximum cloud scale
const CLOUD_OPACITY = 1.0    // Full opacity for visible clouds

// Cloud colors (white with slight warmth to match sunny beach scene)
const CLOUD_COLOR = 0xffffff
const CLOUD_SHADOW_COLOR = 0xe8e8f0  // Slight blue-gray for depth

// Shader for soft, fluffy cloud appearance
const cloudVertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const cloudFragmentShader = `
  uniform float uOpacity;
  uniform vec3 uColor;
  uniform vec3 uShadowColor;

  varying vec2 vUv;

  // Noise functions for soft cloud shape
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
    // Center UV coordinates
    vec2 centered = vUv - 0.5;

    // Create soft elliptical shape (wider than tall for cloud look)
    float dist = length(centered * vec2(1.0, 1.5));

    // Add noise to edges for fluffy appearance
    float noiseVal = fbm(vUv * 4.0);
    float edge = 0.35 + noiseVal * 0.15;

    // Soft alpha falloff
    float alpha = smoothstep(edge + 0.1, edge - 0.1, dist);

    // Add internal variation for depth
    float internalNoise = fbm(vUv * 8.0);
    vec3 color = mix(uShadowColor, uColor, internalNoise * 0.3 + 0.7);

    // Slight darkening at bottom for volume
    color *= 0.9 + 0.1 * vUv.y;

    gl_FragColor = vec4(color, alpha * uOpacity);
  }
`

interface Cloud {
  mesh: THREE.Mesh
  baseX: number  // Original X position for wrapping calculation
  speed: number  // Individual speed variation
}

export interface CloudSystem {
  clouds: Cloud[]
  dispose: () => void
}

/**
 * Create cloud material
 */
function createCloudMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: CLOUD_OPACITY },
      uColor: { value: new THREE.Color(CLOUD_COLOR) },
      uShadowColor: { value: new THREE.Color(CLOUD_SHADOW_COLOR) },
    },
    vertexShader: cloudVertexShader,
    fragmentShader: cloudFragmentShader,
    transparent: true,
    depthWrite: false,  // Prevent z-fighting with sky
    side: THREE.DoubleSide,
  })
}

/**
 * Create a single cloud mesh
 */
function createCloudMesh(scale: number): THREE.Mesh {
  // Simple plane geometry - shader handles the soft shape
  const geometry = new THREE.PlaneGeometry(1, 0.6)
  const material = createCloudMaterial()

  const mesh = new THREE.Mesh(geometry, material)
  mesh.scale.set(scale, scale, 1)

  return mesh
}

/**
 * Create the cloud system and add to scene
 */
export function createClouds(scene: THREE.Scene): CloudSystem {
  const clouds: Cloud[] = []
  const geometries: THREE.PlaneGeometry[] = []
  const materials: THREE.ShaderMaterial[] = []

  for (let i = 0; i < CLOUD_COUNT; i++) {
    // Randomize cloud properties
    const scale = CLOUD_SCALE_MIN + Math.random() * (CLOUD_SCALE_MAX - CLOUD_SCALE_MIN)
    const x = (Math.random() - 0.5) * CLOUD_SPREAD_X
    const y = CLOUD_Y_MIN + Math.random() * (CLOUD_Y_MAX - CLOUD_Y_MIN)
    const speedVariation = 0.8 + Math.random() * 0.4  // 80-120% of base speed

    const mesh = createCloudMesh(scale)
    mesh.position.set(x, y, CLOUD_Z)

    // Slight random rotation for variety
    mesh.rotation.z = (Math.random() - 0.5) * 0.2

    scene.add(mesh)

    clouds.push({
      mesh,
      baseX: x,
      speed: speedVariation,
    })

    geometries.push(mesh.geometry as THREE.PlaneGeometry)
    materials.push(mesh.material as THREE.ShaderMaterial)
  }

  return {
    clouds,
    dispose: () => {
      geometries.forEach(g => g.dispose())
      materials.forEach(m => m.dispose())
    },
  }
}

/**
 * Update cloud positions based on world offset
 * Call this in the animation loop
 */
export function updateClouds(
  cloudSystem: CloudSystem,
  worldOffset: number
): void {
  const wrapWidth = CLOUD_SPREAD_X * 2  // Wide enough for seamless wrap

  for (const cloud of cloudSystem.clouds) {
    // Calculate parallax offset
    const parallaxOffset = worldOffset * CLOUD_PARALLAX_SPEED * cloud.speed

    // Apply offset and wrap around for infinite scrolling
    let x = cloud.baseX - parallaxOffset

    // Wrap clouds when they go too far off screen (handles negative numbers correctly)
    x = (((x + wrapWidth / 2) % wrapWidth) + wrapWidth) % wrapWidth - wrapWidth / 2

    cloud.mesh.position.x = x
  }
}
