import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import type { VisualizerProps } from '../types'
import { COLORS } from '../constants'

/**
 * ThreeScene - Three.js version of the boat race visualizer
 *
 * This component sets up a basic Three.js scene with:
 * - Perspective camera
 * - WebGL renderer
 * - Placeholder gutters (blue boxes)
 * - Placeholder boats (red/blue spheres)
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

    // === Placeholder Objects ===

    // Gutters (water channels) - two blue boxes
    const gutterGeometry = new THREE.BoxGeometry(12, 0.5, 1.5)
    const gutterMaterial = new THREE.MeshStandardMaterial({ color: COLORS.water })

    const gutter1 = new THREE.Mesh(gutterGeometry, gutterMaterial)
    gutter1.position.set(0, 0, -2)
    scene.add(gutter1)

    const gutter2 = new THREE.Mesh(gutterGeometry, gutterMaterial)
    gutter2.position.set(0, 0, 2)
    scene.add(gutter2)

    // Boats - two spheres (red and blue)
    const boatGeometry = new THREE.SphereGeometry(0.5, 32, 32)

    const redBoatMaterial = new THREE.MeshStandardMaterial({ color: COLORS.red.primary })
    const redBoat = new THREE.Mesh(boatGeometry, redBoatMaterial)
    redBoat.position.set(-4, 0.5, -2)
    scene.add(redBoat)

    const blueBoatMaterial = new THREE.MeshStandardMaterial({ color: COLORS.blue.primary })
    const blueBoat = new THREE.Mesh(boatGeometry, blueBoatMaterial)
    blueBoat.position.set(-4, 0.5, 2)
    scene.add(blueBoat)

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
      boatGeometry.dispose()
      redBoatMaterial.dispose()
      blueBoatMaterial.dispose()

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
