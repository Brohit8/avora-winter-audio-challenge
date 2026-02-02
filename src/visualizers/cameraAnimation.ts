import * as THREE from 'three'
import { CAMERA_ANIMATION_DURATION } from './constants'

// Reusable Vector3 objects (avoids GC pressure)
const _targetPos = new THREE.Vector3()
const _targetLookAt = new THREE.Vector3()
const _currentLookAt = new THREE.Vector3()

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export interface CameraAnimationResult {
  progress: number
  isComplete: boolean
}

// Animate camera to focus on boat during game-over
export function updateGameOverCamera(
  camera: THREE.PerspectiveCamera,
  boat: THREE.Group,
  animationStartTime: number,
  defaultPos: THREE.Vector3,
  defaultTarget: THREE.Vector3
): CameraAnimationResult {
  const animationElapsed = performance.now() - animationStartTime
  const progress = Math.min(animationElapsed / CAMERA_ANIMATION_DURATION, 1)
  const easedProgress = easeOutCubic(progress)

  // Target camera position: close to boat, slightly elevated, from the side
  _targetPos.set(
    boat.position.x + 1.5,
    boat.position.y + 0.8,
    boat.position.z + 2.5
  )

  // Look at the boat
  _targetLookAt.set(
    boat.position.x,
    boat.position.y + 0.2,
    boat.position.z
  )

  // Lerp camera position
  camera.position.lerpVectors(defaultPos, _targetPos, easedProgress)

  // Lerp lookAt target
  _currentLookAt.lerpVectors(defaultTarget, _targetLookAt, easedProgress)
  camera.lookAt(_currentLookAt)

  return {
    progress,
    isComplete: progress >= 1,
  }
}

// Reset camera to default position
export function resetCamera(
  camera: THREE.PerspectiveCamera,
  defaultPos: THREE.Vector3,
  defaultTarget: THREE.Vector3
): void {
  camera.position.copy(defaultPos)
  camera.lookAt(defaultTarget)
}
