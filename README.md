# Avora Winter Audio Challenge 2026

Create your own novel audio visualization using real-time microphone input.

## Rohit's Visualization #2: Sonic Surf

Summary: A real-time audio visualizer where your boat rides an endless wave while obstacles approach. Use your voice to control the boat — higher pitched sounds make the boat jump over obstacles, while lower pitched sounds make the boat duck under them. Dodge as many obstacles as possible to achieve the highest score!

How to Play:
1. **Setup** — Drag the sliders to configure which frequency ranges make the boat jump and duck. Hit "Start" to begin surfing.
2. **Surf** — Obstacles will approach your boat. Make high-pitched sounds to jump over low obstacles, or low-pitched sounds to duck under high obstacles.
3. **Game Over** — See how far you made it. Hit "Play Again" to try for a higher score!

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