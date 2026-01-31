import * as THREE from 'three'

/**
 * Wind Swirl Generator
 * Creates procedural cartoon-style wind swirl textures using Archimedean spirals
 */

const TEXTURE_SIZE = 128

// Wind swirl configuration - tight spiral on left that unwinds into wavy tail
interface WindSwirlDef {
  spiralX: number      // X position of spiral center (0-1, left side)
  spiralY: number      // Y position of spiral center (0-1)
  spiralTurns: number  // How many turns in the tight curl
  spiralRadius: number // Max radius of spiral
  tailLength: number   // Length of the wavy tail
  tailWaves: number    // Number of waves in tail
  tailAmplitude: number // Wave amplitude
  lineWidth: number
}

// Different swirl variations - flowing curve → Archimedean spiral (left to right)
const WIND_SWIRL_DEFS: WindSwirlDef[][] = [
  // Variation 0: Medium
  [
    { spiralX: 0, spiralY: 0.65, spiralTurns: 1.5, spiralRadius: 0.1, tailLength: 0.38, tailWaves: 0, tailAmplitude: 0.2, lineWidth: 4 }
  ],
  // Variation 1: Larger coil
  [
    { spiralX: 0, spiralY: 0.7, spiralTurns: 1.5, spiralRadius: 0.11, tailLength: 0.35, tailWaves: 0, tailAmplitude: 0.24, lineWidth: 4.5 }
  ],
  // Variation 2: Smaller
  [
    { spiralX: 0, spiralY: 0.6, spiralTurns: 1.5, spiralRadius: 0.08, tailLength: 0.42, tailWaves: 0, tailAmplitude: 0.18, lineWidth: 4 }
  ],
  // Variation 3: Tight coil
  [
    { spiralX: 0, spiralY: 0.55, spiralTurns: 1.7, spiralRadius: 0.09, tailLength: 0.36, tailWaves: 0, tailAmplitude: 0.22, lineWidth: 3.5 }
  ],
  // Variation 4: Wide tail
  [
    { spiralX: 0, spiralY: 0.68, spiralTurns: 1.3, spiralRadius: 0.12, tailLength: 0.4, tailWaves: 0, tailAmplitude: 0.26, lineWidth: 4 }
  ]
]

/**
 * Draw a wind swirl: flowing curve on left → Archimedean spiral on right
 * The spiral curls inward with decreasing radius
 */
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

  // Spiral center - positioned so tail flows into bottom of spiral
  const spiralCenterX = margin + size * tailLength
  const spiralCenterY = startY - maxR

  // Tail ends at bottom of spiral (6 o'clock position)
  const tailEndX = spiralCenterX
  const tailEndY = spiralCenterY + maxR  // = startY

  ctx.beginPath()
  ctx.moveTo(startX, startY)

  // First segment: gentle S-curve flowing rightward to bottom of spiral
  const mid1X = startX + (tailEndX - startX) * 0.33
  const mid2X = startX + (tailEndX - startX) * 0.66

  ctx.bezierCurveTo(
    mid1X, startY - waveAmp * 0.5,
    mid2X, startY + waveAmp * 0.3,
    tailEndX, tailEndY
  )

  // Second segment: Archimedean spiral that curls inward
  // r = maxR - (maxR * t) where t goes from 0 to 1
  // This makes radius shrink from maxR to 0 as we spiral inward
  const totalAngle = Math.PI * 2 * spiralTurns
  const steps = Math.floor(spiralTurns * 40)  // More steps for smoother curve

  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const angle = Math.PI / 2 - (totalAngle * t)  // Start at bottom, go counter-clockwise
    const r = maxR * (1 - t * 0.85)  // Shrink radius as we spiral (keep 15% at center)

    const x = spiralCenterX + Math.cos(angle) * r
    const y = spiralCenterY + Math.sin(angle) * r
    ctx.lineTo(x, y)
  }

  // Draw with white cartoon style (outer glow + inner line)
  ctx.strokeStyle = 'rgba(200, 200, 200, 0.9)'
  ctx.lineWidth = lineWidth + 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.stroke()

  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = lineWidth
  ctx.stroke()
}

/**
 * Create a wind swirl texture
 */
function createSwirlTexture(variation: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = TEXTURE_SIZE
  canvas.height = TEXTURE_SIZE
  const ctx = canvas.getContext('2d')!

  // Transparent background
  ctx.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)

  // Draw the wind swirls for this variation
  const defs = WIND_SWIRL_DEFS[variation % WIND_SWIRL_DEFS.length]
  for (const def of defs) {
    drawWindSwirl(ctx, def, TEXTURE_SIZE)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

/**
 * Create a pool of wind swirl sprites for one boat
 */
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
    sprite.scale.set(1.2, 1.2, 1) // Base size
    sprite.visible = false
    sprites.push(sprite)
  }

  return sprites
}

// Pseudo-random based on index (deterministic per sprite)
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

/**
 * Update wind swirl sprites based on audio loudness
 * @param sprites - Array of swirl sprites
 * @param boatX - Boat's X position
 * @param boatY - Boat's Y position
 * @param boatZ - Boat's Z position
 * @param loudness - Normalized loudness (0-1)
 * @param time - Current time for animation
 */
export function updateWindSwirls(
  sprites: THREE.Sprite[],
  boatX: number,
  boatY: number,
  boatZ: number,
  loudness: number,
  time: number
): void {
  // Thresholds for showing 1, 2, 3, 4, 5 swirls based on loudness
  const loudnessThresholds = [0.03, 0.08, 0.15, 0.25, 0.35]

  // Sail width for positioning bounds
  const sailWidth = 0.3

  for (let i = 0; i < sprites.length; i++) {
    const sprite = sprites[i]
    const material = sprite.material as THREE.SpriteMaterial
    const threshold = loudnessThresholds[i] ?? 0.4
    const shouldShow = loudness > threshold

    // Randomized offsets based on sprite index (deterministic)
    const rand1 = seededRandom(i * 1.1)
    const rand2 = seededRandom(i * 2.3)
    const rand3 = seededRandom(i * 3.7)

    // Position behind the boat, near the sail
    // X: distance behind mast (-0.2 to -0.8, within sail width)
    const baseX = -0.2 - rand1 * sailWidth * 1.5
    const offsetX = baseX - Math.sin(time * 2 + i) * 0.08

    // Y: height variation (0.5 to 1.1, within sail height range)
    const maxHeight = 1.1  // Cap height to stay within sail bounds
    const baseY = 0.5 + rand2 * 0.5  // Reduced range
    const waveY = Math.sin(time * 3 + i * 1.5) * 0.08
    const offsetY = Math.min(baseY + waveY, maxHeight)

    // Z: depth spread (-0.25 to 0.25, near center of boat)
    const offsetZ = (rand3 - 0.5) * 0.5

    sprite.position.set(
      boatX + offsetX,
      boatY + offsetY,
      boatZ + offsetZ
    )

    // Target opacity based on loudness
    const targetOpacity = shouldShow
      ? Math.min(0.9, 0.4 + (loudness - threshold) * 2)
      : 0

    // Smooth fade: fast rise, slow decay
    const currentOpacity = material.opacity
    const fadeSpeed = shouldShow ? 0.3 : 0.02  // Fast in, slow out
    material.opacity = currentOpacity + (targetOpacity - currentOpacity) * fadeSpeed

    // Show sprite if opacity > 0
    sprite.visible = material.opacity > 0.01

    if (sprite.visible) {
      // Scale based on loudness (bigger when louder), with slight random variation
      const baseScale = 0.6 + rand1 * 0.4
      const loudnessScale = 1 + Math.max(0, loudness - threshold) * 2
      const scale = baseScale * loudnessScale
      sprite.scale.set(scale, scale, 1)

      // Slight rotation for variety
      material.rotation = Math.sin(time + i) * 0.2
    }
  }
}

/**
 * Dispose of wind swirl sprites and their resources
 */
export function disposeWindSwirls(sprites: THREE.Sprite[]): void {
  for (const sprite of sprites) {
    const material = sprite.material as THREE.SpriteMaterial
    if (material.map) {
      material.map.dispose()
    }
    material.dispose()
  }
}
