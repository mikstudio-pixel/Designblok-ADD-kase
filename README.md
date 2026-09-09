# Mícháš? — virtual tray prototype

[Open the application](https://mikstudio-pixel.github.io/Designblok-ADD-kase/)

Monochrome WebGL 2 experiment for an iPad fixed to a dining tray. This version uses a mouse/touch pad in place of device sensors.

## Use

Drag the point on the pad. Position represents virtual tilt, capped at a unit circle (18 degrees in the readout). Tilting shifts the contents downhill; changing direction sends a wave back across the bowl. Circular gestures move the tray through successive tilts. Release returns the tray to neutral while the porridge settles. Holding a steady tilt lets it settle on the lower side. Keyboard arrows change tilt; Space/Escape levels it. “Nová porce” resets the contents.

The initial surface has sharp cocoa dust, irregular melted chocolate patches and 1,024 persistent particles, including angular chocolate chips. Powder gradually disperses; the solid grains and chips never dissolve. Stylized oil patches reappear after the contents settle. The coarse JetBrains Mono thumbnail consists entirely of text glyphs and follows a simplified displacement model, not a pixel-for-pixel copy of the GPU fluid.

## Simulation

A damped depth-averaged model evolves velocity and free-surface elevation on a 192 × 192 circular grid. A uniform downhill force represents tilt, with a small opposing gesture impulse as a proxy for tray movement. There is no imposed central torque. Hydrostatic surface pressure opposes the force as material piles up. Semi-Lagrangian momentum advection, viscosity and drag damp the motion; conservative face fluxes update depth. Closed walls prevent escape. Time steps are capped at 1/240 second to resolve gravity waves, with speed/depth limits for the stylized prototype.

The 512 × 512 dye texture follows the resulting velocity. Particles use midpoint flow sampling and a damped velocity response, with wall contact but no particle-to-particle collisions. Elevation and particle positions use full float precision; other simulation textures use half float with explicit bilinear sampling. Surface lighting uses the simulated slope as well as ingredient texture.

This is inspired by the [shallow-water equations](https://www.clawpack.org/riemann_book/html/Shallow_water.html), with art-directed viscosity, scales and limits for porridge. It is not calibrated food rheology, a 3D splashing simulation or a real gyroscope test. Oil separation is a timed visual effect. No motion permissions, device sensors, network services or TouchDesigner runtime are needed.

## Development and deployment

`npm install`, then `npm run dev` at `http://127.0.0.1:3000/`. Build and preview use separate Vite caches. `npm run build` creates the static export in `dist/client/`.

GitHub Actions builds and deploys `main` to GitHub Pages. It sets `NEXT_PUBLIC_BASE_PATH=/Designblok-ADD-kase` for asset URLs. The export keeps the single application route at its output root; using Vinext's router `basePath` currently causes that route to be skipped during prerendering, so the project path is set via Vite's asset base instead. The workflow requires `dist/client/index.html` before deploying.

Input mapping is in `lib/tilt.ts`. The engine exposes `setTilt({x,y})`, `getMotion()`, `reset()` and `dispose()`. For the actual tray, replace the pad input with filtered orientation and accelerometer input and tune it on the mounted iPad. WebGL 2 and EXT_color_buffer_float are required. JetBrains Mono is served locally with its OFL license in `public/fonts/`.

## Validation

Type checking and production export are checked. Native GPU checks exercise the actual solver shaders: undisturbed stillness, held-tilt equilibrium, mass conservation, bounded circular input and settling after release. At a steady force of 0.128, the measured surface slope was 0.1065 versus the hydrostatic target 0.1067. After ten seconds of rest, RMS speed was below 0.00003. These checks are not a Safari/iPad performance certification or full visual QA.

Lint of the custom app and engine passes; repository-wide lint reports existing issues in unused scaffold components. Browser startup recovery was checked after a preview-cache conflict. Optional WebMCP tools (`set_tray_tilt`, `reset_bowl`) share the visible actions; registration was observed in the supporting preview browser, while tool execution remains unverified.
