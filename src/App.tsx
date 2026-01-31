import { useAudio } from './audio/useAudio'
import { Visualizer } from './visualizers/Visualizer'

import './App.css'

function App() {
  const { frequencyData, timeDomainData, isActive, start } = useAudio()

  return (
    <div className="app">
      <Visualizer
        frequencyData={frequencyData}
        timeDomainData={timeDomainData}
        isActive={isActive}
        onRequestMic={start}
      />
    </div>
  )
}

export default App
