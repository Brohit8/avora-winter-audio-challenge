import { useState, useCallback } from 'react'
import type { Screen } from '../types'
import { HIGH_SCORE_KEY, SCORE_COEFFICIENT } from '../constants'
import { DEFAULT_DIVISION_BIN } from '../components/FrequencyDivisionSlider'

// Game state management for screen transitions, scoring, and settings
export function useGameState() {
  const [screen, setScreen] = useState<Screen>('setup')
  const [divisionBin, setDivisionBin] = useState<number>(DEFAULT_DIVISION_BIN)
  const [score, setScore] = useState<number>(0)
  const [highScore, setHighScore] = useState<number>(() => {
    const saved = localStorage.getItem(HIGH_SCORE_KEY)
    return saved ? parseInt(saved, 10) : 0
  })
  const [isNewHighScore, setIsNewHighScore] = useState<boolean>(false)

  // Start countdown (called after reset logic)
  const startCountdown = useCallback(() => {
    setScore(0)
    setScreen('countdown')
  }, [])

  // Transition to race screen
  const startRace = useCallback(() => {
    setScreen('race')
  }, [])

  // Handle game over with high score check
  const triggerGameOver = useCallback((worldOffset: number) => {
    const currentScore = Math.floor(worldOffset * SCORE_COEFFICIENT)
    if (currentScore > highScore) {
      setHighScore(currentScore)
      setIsNewHighScore(true)
      localStorage.setItem(HIGH_SCORE_KEY, currentScore.toString())
    } else {
      setIsNewHighScore(false)
    }
    setScreen('gameOverAnimation')
  }, [highScore])

  // Transition to final game over screen
  const showGameOver = useCallback(() => {
    setScreen('gameOver')
  }, [])

  // Update score during race
  const updateScore = useCallback((worldOffset: number) => {
    setScore(Math.floor(worldOffset * SCORE_COEFFICIENT))
  }, [])

  return {
    // State
    screen,
    divisionBin,
    score,
    highScore,
    isNewHighScore,

    // Setters
    setDivisionBin,

    // Actions
    startCountdown,
    startRace,
    triggerGameOver,
    showGameOver,
    updateScore,
  }
}
