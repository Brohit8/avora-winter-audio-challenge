import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { VisualizerProps } from '../types'
import { COLORS } from '../constants'

/**
 * ThreeScene - Three.js version of the boat race visualizer
 *
 * This component sets up a basic Three.js scene with:
 * - Perspective camera
 * - WebGL renderer
 * - Water channel gutters
 * - Regatta boat models (loaded from GLB)
 */
export function ThreeScene({
  frequencyData: _frequencyData,
  timeDomainData: _timeDomainData,
  isActive: _isActive,
  width,
  height,
}: VisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // === Scene Setup ===
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(COLORS.background)

    // === Camera Setup ===
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
    camera.position.set(0, 5, 10)
    camera.lookAt(0, 0, 0)

    // === Renderer Setup ===
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    container.appendChild(renderer.domElement)

    // === Lighting ===
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(5, 10, 5)
    scene.add(directionalLight)

    // === Gutters (water channels) ===
    const gutterGeometry = new THREE.BoxGeometry(12, 0.5, 1.5)
    const gutterMaterial = new THREE.MeshStandardMaterial({ color: COLORS.water })

    const gutter1 = new THREE.Mesh(gutterGeometry, gutterMaterial)
    gutter1.position.set(0, 0, -2)
    scene.add(gutter1)

    const gutter2 = new THREE.Mesh(gutterGeometry, gutterMaterial)
    gutter2.position.set(0, 0, 2)
    scene.add(gutter2)

    // === Load Boat Models ===
    const loader = new GLTFLoader()

    // Materials for the sails (hull keeps original GLB colors)
    const redSailMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.red.primary,
      metalness: 0.0,
      roughness: 0.9,
    })
    const blueSailMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.blue.primary,
      metalness: 0.0,
      roughness: 0.9,
    })

    // Track loaded boats for cleanup
    let redBoat: THREE.Group | null = null
    let blueBoat: THREE.Group | null = null

    loader.load(
      '/models/regatta_boat.glb',
      (gltf) => {
        // Debug: log all mesh names and their parents
        console.log('=== GLB Scene Structure ===')
        gltf.scene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            console.log(`Mesh: "${child.name}", Parent: "${child.parent?.name}"`)
          }
        })

        // Helper to check if mesh is part of the sail
        const isSailMesh = (mesh: THREE.Mesh) => {
          return mesh.name.includes('Sail') || mesh.parent?.name.includes('Sail')
        }

        // Red boat (top gutter)
        redBoat = gltf.scene.clone()
        redBoat.traverse((child) => {
          if (child instanceof THREE.Mesh && isSailMesh(child)) {
            child.material = redSailMaterial
          }
        })
        redBoat.position.set(-4, 0.5, -2)
        redBoat.scale.set(0.5, 0.5, 0.5)
        redBoat.rotation.y = Math.PI / 2 // 90 degrees - face racing direction
        scene.add(redBoat)

        // Blue boat (bottom gutter)
        blueBoat = gltf.scene.clone()
        blueBoat.traverse((child) => {
          if (child instanceof THREE.Mesh && isSailMesh(child)) {
            child.material = blueSailMaterial
          }
        })
        blueBoat.position.set(-4, 0.5, 2)
        blueBoat.scale.set(0.5, 0.5, 0.5)
        blueBoat.rotation.y = Math.PI / 2 // 90 degrees - face racing direction
        scene.add(blueBoat)
      },
      undefined,
      (error) => {
        console.error('Error loading boat model:', error)
      }
    )

    // === Animation Loop ===
    let frameId: number

    function animate() {
      frameId = requestAnimationFrame(animate)
      renderer.render(scene, camera)
    }
    animate()

    // === Cleanup ===
    return () => {
      cancelAnimationFrame(frameId)

      // Dispose geometries and materials
      gutterGeometry.dispose()
      gutterMaterial.dispose()
      redSailMaterial.dispose()
      blueSailMaterial.dispose()

      // Remove boats from scene
      if (redBoat) scene.remove(redBoat)
      if (blueBoat) scene.remove(blueBoat)

      // Dispose renderer and remove from DOM
      renderer.dispose()
      container.removeChild(renderer.domElement)
    }
  }, [width, height])

  return (
    <div
      ref={containerRef}
      style={{ width, height }}
    />
  )
}
