import * as THREE from 'three'

// Procedural wind swirl texture generator

const TEXTURE_SIZE = 128

interface WindSwirlDef {
  spiralX: number
  spiralY: number
  spiralTurns: number
  spiralRadius: number
  tailLength: number
  tailWaves: number
  tailAmplitude: number
  lineWidth: number
}

// Swirl variations
const WIND_SWIRL_DEFS: WindSwirlDef[][] = [
  [{ spiralX: 0, spiralY: 0.65, spiralTurns: 1.5, spiralRadius: 0.1, tailLength: 0.38, tailWaves: 0, tailAmplitude: 0.2, lineWidth: 4 }],
  [{ spiralX: 0, spiralY: 0.7, spiralTurns: 1.5, spiralRadius: 0.11, tailLength: 0.35, tailWaves: 0, tailAmplitude: 0.24, lineWidth: 4.5 }],
  [{ spiralX: 0, spiralY: 0.6, spiralTurns: 1.5, spiralRadius: 0.08, tailLength: 0.42, tailWaves: 0, tailAmplitude: 0.18, lineWidth: 4 }],
  [{ spiralX: 0, spiralY: 0.55, spiralTurns: 1.7, spiralRadius: 0.09, tailLength: 0.36, tailWaves: 0, tailAmplitude: 0.22, lineWidth: 3.5 }],
  [{ spiralX: 0, spiralY: 0.68, spiralTurns: 1.3, spiralRadius: 0.12, tailLength: 0.4, tailWaves: 0, tailAmplitude: 0.26, lineWidth: 4 }],
]

function drawWindSwirl(
  ctx: CanvasRenderingContext2D,
  def: WindSwirlDef,
  size: number
): void {
  const { spiralY, spiralTurns, spiralRadius, tailLength, tailAmplitude, lineWidth } = def

  const margin = size * 0.08
  const startX = margin
  const startY = size * spiralY

  const maxR = size * spiralRadius
  const waveAmp = size * tailAmplitude

  const spiralCenterX = margin + size * tailLength
  const spiralCenterY = startY - maxR
  const tailEndX = spiralCenterX
  const tailEndY = spiralCenterY + maxR

  ctx.beginPath()
  ctx.moveTo(startX, startY)

  // S-curve tail
  const mid1X = startX + (tailEndX - startX) * 0.33
  const mid2X = startX + (tailEndX - startX) * 0.66

  ctx.bezierCurveTo(
    mid1X, startY - waveAmp * 0.5,
    mid2X, startY + waveAmp * 0.3,
    tailEndX, tailEndY
  )

  // Archimedean spiral
  const totalAngle = Math.PI * 2 * spiralTurns
  const steps = Math.floor(spiralTurns * 40)

  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const angle = Math.PI / 2 - (totalAngle * t)
    const r = maxR * (1 - t * 0.85)

    const x = spiralCenterX + Math.cos(angle) * r
    const y = spiralCenterY + Math.sin(angle) * r
    ctx.lineTo(x, y)
  }

  // Outer glow + inner line
  ctx.strokeStyle = 'rgba(200, 200, 200, 0.9)'
  ctx.lineWidth = lineWidth + 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.stroke()

  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = lineWidth
  ctx.stroke()
}

function createSwirlTexture(variation: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = TEXTURE_SIZE
  canvas.height = TEXTURE_SIZE
  const ctx = canvas.getContext('2d')!

  ctx.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
  const defs = WIND_SWIRL_DEFS[variation % WIND_SWIRL_DEFS.length]
  for (const def of defs) {
    drawWindSwirl(ctx, def, TEXTURE_SIZE)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

export function createWindSwirlSprites(count: number = 3): THREE.Sprite[] {
  const sprites: THREE.Sprite[] = []

  for (let i = 0; i < count; i++) {
    const texture = createSwirlTexture(i)
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })

    const sprite = new THREE.Sprite(material)
    sprite.scale.set(1.2, 1.2, 1)
    sprite.visible = false
    sprites.push(sprite)
  }

  return sprites
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

// Update sprite positions and opacity based on audio loudness
export function updateWindSwirls(
  sprites: THREE.Sprite[],
  boatX: number,
  boatY: number,
  boatZ: number,
  loudness: number,
  time: number
): void {
  const loudnessThresholds = [0.03, 0.08, 0.15, 0.25, 0.35]
  const sailWidth = 0.3

  for (let i = 0; i < sprites.length; i++) {
    const sprite = sprites[i]
    const material = sprite.material as THREE.SpriteMaterial
    const threshold = loudnessThresholds[i] ?? 0.4
    const shouldShow = loudness > threshold

    const rand1 = seededRandom(i * 1.1)
    const rand2 = seededRandom(i * 2.3)
    const rand3 = seededRandom(i * 3.7)

    const baseX = -0.2 - rand1 * sailWidth * 1.5
    const offsetX = baseX - Math.sin(time * 2 + i) * 0.08

    const maxHeight = 1.1
    const baseY = 0.5 + rand2 * 0.5
    const waveY = Math.sin(time * 3 + i * 1.5) * 0.08
    const offsetY = Math.min(baseY + waveY, maxHeight)

    const offsetZ = (rand3 - 0.5) * 0.5

    sprite.position.set(
      boatX + offsetX,
      boatY + offsetY,
      boatZ + offsetZ
    )

    const targetOpacity = shouldShow
      ? Math.min(0.9, 0.4 + (loudness - threshold) * 2)
      : 0

    const currentOpacity = material.opacity
    const fadeSpeed = shouldShow ? 0.3 : 0.02
    material.opacity = currentOpacity + (targetOpacity - currentOpacity) * fadeSpeed
    sprite.visible = material.opacity > 0.01

    if (sprite.visible) {
      const baseScale = 0.6 + rand1 * 0.4
      const loudnessScale = 1 + Math.max(0, loudness - threshold) * 2
      const scale = baseScale * loudnessScale
      sprite.scale.set(scale, scale, 1)
      material.rotation = Math.sin(time + i) * 0.2
    }
  }
}

export function disposeWindSwirls(sprites: THREE.Sprite[]): void {
  for (const sprite of sprites) {
    const material = sprite.material as THREE.SpriteMaterial
    if (material.map) {
      material.map.dispose()
    }
    material.dispose()
  }
}
