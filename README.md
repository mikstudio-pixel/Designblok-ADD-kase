# Mícháš? — virtual tray prototype

Monochrome WebGL 2 experiment for an iPad fixed to a dining tray. This version uses a mouse/touch pad in place of device sensors.

## Use

Drag the point on the pad. Position represents virtual tilt, capped at a unit circle (18 degrees in the readout). Circular gestures stir around the centre of the bowl, with only a small sideways disturbance. Release returns the tray to neutral while the fluid settles. Keyboard arrows change tilt; Space/Escape levels it. “Nová porce” resets the contents.

The bowl retains 1,024 discrete grains, including larger clumps: they do not dissolve as the surface mixes. After the tray rests, stylized oil patches gradually return to the surface. The small JetBrains Mono study is animated entirely with text glyphs and follows the same stirring phase and settling state; it is not a pixel-for-pixel copy of the fluid.

## Simulation

The solver uses a 192 × 192 velocity/pressure grid and a 512 × 512 dye texture. Each step performs midpoint semi-Lagrangian advection, applied forces, vorticity confinement, divergence calculation, 24 Jacobi pressure iterations and gradient subtraction. The circular boundary is part of the solver, with reflected velocity samples and a no-penetration projection. Three scalar dye channels produce irregular monochrome cocoa patches. Persistent particles follow the flow using polar integration, which avoids artificial drift towards the rim. They do not perform particle-to-particle collision detection.

The force mapping and surface lighting are deliberately stylized. Oil separation is a timed shader effect, not a buoyancy simulation. This is a 2D visual prototype, not calibrated fluid dynamics or a real gyroscope test. No motion permissions, device sensors, network services or TouchDesigner runtime are needed. The original solver uses the standard projection/advection approach described in [GPU Gems, chapter 38](https://developer.nvidia.com/gpugems/gpugems/part-vi-beyond-triangles/chapter-38-fast-fluid-dynamics-simulation-gpu).

## Development

`npm install`, then `npm run dev` at `http://127.0.0.1:3000/`. Build and preview use separate Vite caches so a production export cannot replace the live preview's optimized React modules. `npm run build` creates the static export in `dist/client/`. The standard Sites scaffold and its lockfile are retained.

Input mapping is isolated in `lib/tilt.ts`. The rendering engine exposes `setTilt({x,y})`, `getMotion()`, `reset()` and `dispose()`. Later replace the pad input with filtered acceleration/orientation from the actual iPad; tune the force mapping on the mounted tray. Graphics requires WebGL 2 and EXT_color_buffer_float. Half-float sampling uses explicit bilinear interpolation, avoiding a float-linear-filter extension dependency. JetBrains Mono is served locally with its OFL license in `public/fonts/`.

## Validation

Production export and lint of the custom app/engine pass. Repository-wide lint also reports pre-existing issues in unused scaffold components. Type checking, shader compilation/linking on the local graphics driver (desktop GLSL version preamble), bounded input, gesture direction, frame-independent smoothing, and neutral return are checked during development. These are not a Safari/iPad performance certification. Browser startup recovery was checked after a preview-cache conflict: the simulation initialized and reported no console errors. Full interaction/visual QA and real sensors have not been tested in this version.

Optional WebMCP tools (`set_tray_tilt`, `reset_bowl`) feature-detect `document.modelContext` and share the visible actions. Registration was observed in the supporting preview browser; tool execution remains unverified.
