import * as THREE from 'three'

/**
 * Model setup helpers
 * Provides consistent patterns for configuring 3D objects in the scene
 */

/**
 * Enable shadow casting and/or receiving on all meshes in an object
 */
export function enableShadows(
  object: THREE.Object3D,
  cast = true,
  receive = true
): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = cast
      child.receiveShadow = receive
    }
  })
}

/**
 * Replace sail meshes with a custom material (for boat color theming)
 */
export function applySailMaterial(
  boat: THREE.Object3D,
  material: THREE.Material
): void {
  boat.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const isSail = child.name.includes('Sail') || child.parent?.name.includes('Sail')
      if (isSail) {
        child.material = material
      }
    }
  })
}

/**
 * Convert all meshes to unlit vertex-colored material
 * Useful for objects that should ignore scene lighting (e.g., checkered buoys)
 */
export function makeUnlit(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.material = new THREE.MeshBasicMaterial({ vertexColors: true })
    }
  })
}
