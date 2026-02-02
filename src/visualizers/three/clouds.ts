import * as THREE from 'three'

// Parallax clouds with procedural noise shading

export const CLOUD_PARALLAX_SPEED = 0.25

const CLOUD_COUNT = 4
const CLOUD_Y_MIN = 5
const CLOUD_Y_MAX = 9
const CLOUD_Z = -35
const CLOUD_SPREAD_X = 80
const CLOUD_SCALE_MIN = 10
const CLOUD_SCALE_MAX = 15
const CLOUD_OPACITY = 1.0

const CLOUD_COLOR = 0xffffff
const CLOUD_SHADOW_COLOR = 0xe8e8f0

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
    vec2 centered = vUv - 0.5;
    float dist = length(centered * vec2(1.0, 1.5));
    float noiseVal = fbm(vUv * 4.0);
    float edge = 0.35 + noiseVal * 0.15;
    float alpha = smoothstep(edge + 0.1, edge - 0.1, dist);
    float internalNoise = fbm(vUv * 8.0);
    vec3 color = mix(uShadowColor, uColor, internalNoise * 0.3 + 0.7);
    color *= 0.9 + 0.1 * vUv.y;
    gl_FragColor = vec4(color, alpha * uOpacity);
  }
`

interface Cloud {
  mesh: THREE.Mesh
  baseX: number
  speed: number
}

export interface CloudSystem {
  clouds: Cloud[]
  dispose: () => void
}

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
    depthWrite: false,
    side: THREE.DoubleSide,
  })
}

function createCloudMesh(scale: number): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(1, 0.6)
  const material = createCloudMaterial()

  const mesh = new THREE.Mesh(geometry, material)
  mesh.scale.set(scale, scale, 1)

  return mesh
}

export function createClouds(scene: THREE.Scene): CloudSystem {
  const clouds: Cloud[] = []
  const geometries: THREE.PlaneGeometry[] = []
  const materials: THREE.ShaderMaterial[] = []

  for (let i = 0; i < CLOUD_COUNT; i++) {
    const scale = CLOUD_SCALE_MIN + Math.random() * (CLOUD_SCALE_MAX - CLOUD_SCALE_MIN)
    const x = (Math.random() - 0.5) * CLOUD_SPREAD_X
    const y = CLOUD_Y_MIN + Math.random() * (CLOUD_Y_MAX - CLOUD_Y_MIN)
    const speedVariation = 0.8 + Math.random() * 0.4

    const mesh = createCloudMesh(scale)
    mesh.position.set(x, y, CLOUD_Z)
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

export function updateClouds(
  cloudSystem: CloudSystem,
  worldOffset: number
): void {
  const wrapWidth = CLOUD_SPREAD_X * 2

  for (const cloud of cloudSystem.clouds) {
    const parallaxOffset = worldOffset * CLOUD_PARALLAX_SPEED * cloud.speed
    let x = cloud.baseX - parallaxOffset
    x = (((x + wrapWidth / 2) % wrapWidth) + wrapWidth) % wrapWidth - wrapWidth / 2
    cloud.mesh.position.x = x
  }
}
