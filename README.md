# Waveform Visualization Challenge

Create your own audio waveform visualization using real-time microphone input.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173 and allow microphone access when prompted.

## The Challenge

Edit `src/visualizers/Visualizer.jsx` to create your own visualization.

You receive three props:

| Prop | Type | Description |
|------|------|-------------|
| `frequencyData` | `Uint8Array` | FFT frequency bins (0-255 values) |
| `timeDomainData` | `Uint8Array` | Raw waveform samples (0-255 values) |
| `isActive` | `boolean` | Whether audio is streaming |

## Example

The default visualizer draws a simple waveform line:

```jsx
// Draw frequency bars instead
for (let i = 0; i < frequencyData.length; i++) {
  const barHeight = (frequencyData[i] / 255) * height
  ctx.fillStyle = `hsl(${i}, 100%, 50%)`
  ctx.fillRect(i * 3, height - barHeight, 2, barHeight)
}
```

## Project Structure

```
src/
├── audio/
│   └── useAudio.js      # Audio pipeline (do not modify)
├── visualizers/
│   └── Visualizer.jsx   # YOUR CODE GOES HERE
├── App.jsx
└── App.css
```

## Tips

- `frequencyData` is great for spectrum/bar visualizations
- `timeDomainData` is great for oscilloscope/waveform visualizations
- Canvas 2D is provided, but you can use WebGL, SVG, or any renderer
- The data updates at ~60fps via requestAnimationFrame
