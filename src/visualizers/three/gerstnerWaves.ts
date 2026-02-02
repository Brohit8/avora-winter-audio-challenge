// Gerstner wave simulation (trochoid waves)

interface GerstnerWave {
  dir: [number, number]
  steepness: number
  wavelength: number
  speed: number
}

const GERSTNER_WAVES: GerstnerWave[] = [
  { dir: [1.0, 0.0], steepness: 0.12, wavelength: 4.0, speed: 1.2 },
  { dir: [0.7, 0.7], steepness: 0.08, wavelength: 2.5, speed: 1.5 },
  { dir: [0.9, -0.4], steepness: 0.06, wavelength: 1.8, speed: 1.8 },
  { dir: [-0.3, 0.95], steepness: 0.04, wavelength: 1.2, speed: 2.2 },
]

// Pre-computed wave data
const WAVES_PROCESSED = GERSTNER_WAVES.map((w, i) => {
  const len = Math.sqrt(w.dir[0] ** 2 + w.dir[1] ** 2)
  const dx = w.dir[0] / len
  const dz = w.dir[1] / len
  const omega = (2 * Math.PI) / w.wavelength
  const amplitude = w.steepness / omega
  return { dx, dz, omega, amplitude, speed: w.speed, phase: i * 1.3 }
})

// Shaders

export const waterVertexShader = `
  uniform float uTime;
  uniform float uPhaseOffset;
  varying float vWaveHeight;
  varying vec3 vNormal;

  void main() {
    vec3 pos = position;
    vec3 tangent = vec3(1.0, 0.0, 0.0);
    vec3 binormal = vec3(0.0, 0.0, 1.0);

    ${WAVES_PROCESSED.map((w, i) => `
    {
      float phase${i} = ${w.omega.toFixed(4)} * (${w.dx.toFixed(4)} * position.x + ${w.dz.toFixed(4)} * position.z) + uTime * ${w.speed.toFixed(2)} + uPhaseOffset + ${w.phase.toFixed(2)};
      float s${i} = sin(phase${i});
      float c${i} = cos(phase${i});

      pos.x += ${(w.amplitude * w.dx).toFixed(5)} * c${i};
      pos.z += ${(w.amplitude * w.dz).toFixed(5)} * c${i};
      pos.y += ${w.amplitude.toFixed(5)} * s${i};

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

export const waterFragmentShader = `
  uniform vec3 uColor;
  uniform vec3 uHighlightColor;
  uniform vec3 uDeepColor;
  varying float vWaveHeight;
  varying vec3 vNormal;

  void main() {
    float depthFactor = clamp(vWaveHeight * 8.0 + 0.5, 0.0, 1.0);
    vec3 baseColor = mix(uDeepColor, uColor, depthFactor);

    float crestFactor = clamp(vWaveHeight * 12.0 - 0.3, 0.0, 1.0);
    baseColor = mix(baseColor, uHighlightColor, crestFactor * 0.6);

    float specular = pow(max(0.0, vNormal.y), 3.0);
    baseColor = mix(baseColor, uHighlightColor, specular * 0.3);

    gl_FragColor = vec4(baseColor, 1.0);
  }
`

// CPU-side wave calculations (mirrors shader for object positioning)

export function getGerstnerDisplacement(
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

export function getGerstnerNormal(
  x: number,
  z: number,
  time: number,
  phaseOffset: number
): { nx: number; ny: number; nz: number } {
  let tx = 1, ty = 0, tz = 0
  let bx = 0, by = 0, bz = 1

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

  const nx = by * tz - bz * ty
  const ny = bz * tx - bx * tz
  const nz = bx * ty - by * tx
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz)

  return { nx: nx / len, ny: ny / len, nz: nz / len }
}
