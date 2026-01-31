import { useEffect } from 'react'
import { useAudio } from './audio/useAudio'
import { Visualizer } from './visualizers/Visualizer'

import './App.css'

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
      />
    </div>
  )
}

export default App
