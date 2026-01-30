# Kinetic Heart - Interactive 3D Particle System

A high-performance interactive 3D particle system visualizing a volumetric heart that responds to real-time hand gestures. Built with Three.js (WebGL) and MediaPipe Hands.

## Features
- **3,000+ Particles**: Uses parametric heart equations for volumetric formation.
- **Gesture Control**:
  - **Expand (Open Hands)**: Particles explode outwards.
  - **Contract (Fist)**: Particles implode into a singularity.
  - **Rotate**: Move your hand horizontally to rotate the heart.
- **Physics**: Real-time spring dynamics, damping, and velocity-based color shifts (Crimson to Neon Pink).
- **Post-Processing**: Unreal Bloom Pass for a premium neon glow.
- **Responsive**: Adapts to any screen size.

## How to Run
This project uses ES Modules and Webcam access, which requires a local server (opening `index.html` directly will **not** work).

### Option 1: Python (Pre-installed on macOS/Linux/some Windows)
1. Open a terminal in this folder.
2. Run:
   ```bash
   python -m http.server 8000
   ```
3. Open `http://localhost:8000` in your browser.

### Option 2: VS Code Live Server
1. Install the "Live Server" extension in VS Code.
2. Right-click `index.html` and select "Open with Live Server".

### Option 3: Node.js (If installed)
1. Install dependencies (optional, for local dev): `npm install`
2. Run via npx: `npx serve .`

## Controls
- **Particle Count**: Adjust standard performance.
- **Bloom Strength**: Control the glow intensity.
- **Color**: Pick base color.
- **Reset**: Re-initialize the particle cloud.
