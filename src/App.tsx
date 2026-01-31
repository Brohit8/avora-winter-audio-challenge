import { useEffect } from 'react'
import { useAudio } from './audio/useAudio'
import { Visualizer } from './visualizers/Visualizer'

import './App.css'

const CANVAS_WIDTH = 640
const CANVAS_HEIGHT = 480

function App() {
  const { frequencyData, timeDomainData, isActive, start } = useAudio()

  useEffect(() => {
    start()
  }, [start])

  return (
    <div className="app">
      <Visualizer
        frequencyData={frequencyData}
        timeDomainData={timeDomainData}
        isActive={isActive}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
      />
    </div>
  )
}

export default App
