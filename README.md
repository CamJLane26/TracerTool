# Tracer Tool

A Cesium-based browser application for drawing ground and air routes on Earth, with click-to-place markers that compute accurate offset times from position along the route.

## Setup

```bash
npm install
npm run dev
```

## Usage

1. **Create a route**: Click "+ Ground" or "+ Air" to add a new route.
2. **Add waypoints**: Select a route and click "+ Add waypoint" in the Route Editor. Edit waypoint positions by removing and re-adding, or adjust leg speeds.
3. **Add markers**: Click anywhere along a route on the map to place a marker. The marker's offset time is calculated from its position along the route.
4. **Edit legs**: Adjust leg speeds (m/s) in the Route Editor. Waypoint offset times update automatically.

## Tech Stack

- React 18 + TypeScript + Vite
- Cesium (imperative API, no Resium)
