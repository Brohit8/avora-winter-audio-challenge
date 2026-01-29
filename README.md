# Avora Winter Audio Challenge 2026

Create your own novel audio visualization using real-time microphone input.

## Rohit's Visualization: Sonic Raingutter Regatta

Summary: A real-time audio visualizer where two boats race down parallel rain gutters. Each boat is mapped to a frequency range. When the microphone detects sound in a particular boat's range, it generates "wind" that propels the respective boat forward. The louder the signal, the faster the boat. The first boat to cross the finish line wins.

How to Play:
1. **Setup** — Drag the sliders to assign each boat (Red and Blue) a frequency range. Hit "Start" to begin racing. 
2. **Race** — Sound in a boat's frequency range creates "wind" which propels it forward. The first boat to cross the finish line wins. 
3. **Winner** — See which boat won. Hit "Race Again" to rematch.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173 and allow microphone access when prompted.

## The Challenge

Edit `src/visualizers/Visualizer.tsx` to create your own visualization. You have been given a default starter template that shows audio visualized in the frequency and time domains.

## Audio Pipeline

The `useAudio` hook captures microphone input.

From the hook, you will receive:
- **frequencyData** — 1024 FFT frequency bins from low to high.
- **timeDomainData** — 2048 raw waveform samples. A value of 128 is silence, and 0 and 255 are the lowest and highest values respectively.

You SHOULD NOT update useAudio, and should instead focus on using its return values for your visualization.

## Project Structure

```
src/
├── audio/
│   └── useAudio.ts      # Audio pipeline (do not modify)
├── visualizers/
│   └── Visualizer.tsx   # YOUR CODE GOES HERE
├── App.tsx
├── App.css
├── index.css
└── main.tsx
```

## Submissions

Fork this repo and get nerdy with a visualization that you find super cool.

When you're ready, deploy your solution and send the URL + link to your submission's github repo to careers@getavora.ai

We evaluate solutions on craft and novelty. You may use any AI tools that you like in this process.

Have fun!