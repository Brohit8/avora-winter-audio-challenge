import { useEffect, useRef } from 'react'
import type { Screen } from '../types'
import { triggerJump, triggerDive, type PhysicsState } from '../game/physics'

// Keyboard controls for jump (spacebar) and dive (down arrow)
export function useKeyboardControls(
  screen: Screen,
  physicsStateRef: React.RefObject<PhysicsState>
) {
  const isDownKeyHeldRef = useRef<boolean>(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (screen !== 'race') return

      if (e.code === 'Space' && !e.repeat) {
        triggerJump(physicsStateRef.current!)
        e.preventDefault()
      } else if (e.code === 'ArrowDown') {
        triggerDive(physicsStateRef.current!)
        isDownKeyHeldRef.current = true
        e.preventDefault()
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowDown') {
        isDownKeyHeldRef.current = false
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [screen, physicsStateRef])

  return { isDownKeyHeldRef }
}
