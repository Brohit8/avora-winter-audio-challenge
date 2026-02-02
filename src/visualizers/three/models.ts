import * as THREE from 'three'

// Model setup helpers

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

export function makeUnlit(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.material = new THREE.MeshBasicMaterial({ vertexColors: true })
    }
  })
}
