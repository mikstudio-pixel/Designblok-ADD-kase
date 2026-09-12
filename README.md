# Mícháš? — virtual tray prototype

[Open the application](https://mikstudio-pixel.github.io/Designblok-ADD-kase/)

Monochrome WebGL 2 experiment for an iPad fixed to a dining tray. Control it with device orientation or the mouse/touch pad.

## Use

Drag the point on the pad. Position represents virtual tilt, capped at a unit circle (18 degrees in the readout). Tilting shifts the contents downhill; changing direction sends a wave back across the bowl. Circular gestures move the tray through successive tilts. Release returns the tray to neutral while the porridge settles. Holding a steady tilt lets it settle on the lower side. Keyboard arrows change tilt; Space/Escape levels it. “Nová porce” resets the contents.

The initial surface has sharp cocoa dust, irregular melted chocolate patches and 1,024 persistent particles, including angular chocolate chips. Powder gradually disperses; the solid grains and chips never dissolve. Stylized oil patches reappear after the contents settle. The coarse JetBrains Mono thumbnail consists entirely of text glyphs and follows a simplified displacement model, not a pixel-for-pixel copy of the GPU fluid.

An occasional red optical scan sweeps down the bowl and returns to the top, with a brief segmented focus ring and a glow that follows the surface. Each pass takes about 2.33 seconds (20% faster than the original). A faint mesh is visible only in a narrow, softly fading band around the laser in both directions. The first scan starts after three seconds; subsequent round trips have an 11–18 second pause. It only changes rendering and is disabled when reduced motion is preferred.

## iPad setup

Open the HTTPS application URL in Safari, put the iPad in its resting position on the tray, and tap **Zapnout pohyb iPadu**. Allow motion/orientation access when Safari asks. The first valid reading establishes neutral; **Nastavit rovinu** recalibrates it. The indicator follows actual screen-relative tilt in portrait and landscape. **Ovládat dotykem** switches back to the pad. USB is not required for sensor input.

`DeviceOrientationEvent` provides fused orientation, rather than raw gyroscope integration. Gravity projected onto the tray controls the existing tilt input, with a 0.35-degree dead zone, approximately 18-degree full scale and the engine's existing smoothing. Permission is requested only from the button tap. Invalid/missing readings never count as active sensors; waiting times out after eight seconds. Hidden pages neutralize the input until fresh data arrives. Stopping cancels pending permission results and detaches listeners. Sensor readings stay on the device. Translational accelerometer input is not implemented yet.

For a Home Screen launch, use Safari's **Add to Home Screen**, enabling **Open as Web App** where offered. The manifest and Apple web-app metadata request a standalone window. It still needs internet for initial loading; offline caching is not implemented. Permission may need to be granted again when launched from the Home Screen.

For an attended exhibition, enable **Settings → Accessibility → Guided Access**, set an operator-only passcode, then open the web app, enable sensors and calibrate. Start Guided Access with the accessibility shortcut. Keep **Motion enabled**; optionally disable Touch and hardware buttons, and configure Display Auto-Lock for the installation. Check the sensor response and the inability to leave the app on the actual iPad before visitors use it. If that iPadOS version cannot lock a standalone web app, use Safari and disable the address/tab toolbar areas with Guided Access. This is an operating-system setting; the website cannot lock the device by itself.

USB debugging is optional: enable **Web Inspector** in the iPad's Safari advanced settings and web developer features in Safari on the Mac. Connect with a data-capable cable, unlock/trust the Mac if prompted, then select the iPad's page from Safari's Develop menu. See Apple's [Home Screen web apps](https://support.apple.com/cs-cz/guide/ipad/ipad8f1f7a29/ipados), [Guided Access](https://support.apple.com/cs-cz/guide/ipad/ipada16d1374/ipados) and WebKit's [Web Inspector setup](https://webkit.org/web-inspector/enabling-web-inspector/).

## Preparing hand-painted materials

Artwork integration is planned; the current surface is still procedural. Prepare raster layers on one aligned 2048 × 2048 px RGB/sRGB canvas, viewed from above. Export each layer as a separate PNG, preserving the full canvas size and transparency. Keep the layered Procreate or PSD source for editing. Do not paint the bowl, its rim, or strong directional highlights into the surface.

- `kase.png`: opaque porridge base, with brushwork and irregular lumps; intended to stretch slowly and retain fine detail.
- `kakao.png`: cocoa marks on transparency; intended to disperse into streaks more readily.
- `cokolada.png`: separated chocolate pieces on transparency, with clear gaps; intended to become individual particles that retain their shape. Individual transparent chip images are also suitable.
- Optional `olej.png`: oil patches on transparency; intended as a separate surface film that can reappear after rest.

PNG stores appearance and transparency. Flow response, diffusion and shape preservation will be configured separately in the engine for each ingredient. Export the visible appearance of each layer, including any clipping masks or effects it depends on; avoid relying on cross-layer blend modes to reproduce the intended color.

## Simulation

A damped depth-averaged model evolves velocity and free-surface elevation on a 192 × 192 circular grid. A uniform downhill force represents tilt, with a small opposing gesture impulse as a proxy for tray movement. There is no imposed central torque. Hydrostatic surface pressure opposes the force as material piles up. Semi-Lagrangian momentum advection, viscosity and drag damp the motion; conservative face fluxes update depth. Closed walls prevent escape. Time steps are capped at 1/240 second to resolve gravity waves, with speed/depth limits for the stylized prototype.

The 512 × 512 dye texture follows the resulting velocity. Particles use midpoint flow sampling and a damped velocity response, with wall contact but no particle-to-particle collisions. Elevation and particle positions use full float precision; other simulation textures use half float with explicit bilinear sampling. Surface lighting uses the simulated slope as well as ingredient texture.

This is inspired by the [shallow-water equations](https://www.clawpack.org/riemann_book/html/Shallow_water.html), with art-directed viscosity, scales and limits for porridge. It is not calibrated food rheology or a 3D splashing simulation. Oil separation is a timed visual effect. No TouchDesigner runtime is needed. Device orientation requires sensor permission; the manual pad does not.

## Development and deployment

`npm install`, then `npm run dev` at `http://127.0.0.1:3000/`. Build and preview use separate Vite caches. `npm run build` creates the static export in `dist/client/`.

GitHub Actions builds and deploys `main` to GitHub Pages. It sets `NEXT_PUBLIC_BASE_PATH=/Designblok-ADD-kase` for asset URLs. The export keeps the single application route at its output root; using Vinext's router `basePath` currently causes that route to be skipped during prerendering, so the project path is set via Vite's asset base instead. The workflow requires `dist/client/index.html` before deploying.

Input mapping is in `lib/tilt.ts`; device orientation and permission handling are in `lib/device-tilt.ts`. The engine exposes `setTilt({x,y})`, `getMotion()`, `reset()` and `dispose()`. Tune the response on the mounted iPad before exhibition use. WebGL 2 and EXT_color_buffer_float are required. JetBrains Mono is served locally with its OFL license in `public/fonts/`.

## Validation

Type checking and production export are checked. Native GPU checks exercise the actual solver shaders: undisturbed stillness, held-tilt equilibrium, mass conservation, bounded circular input and settling after release. At a steady force of 0.128, the measured surface slope was 0.1065 versus the hydrostatic target 0.1067. After ten seconds of rest, RMS speed was below 0.00003. These checks are not a Safari/iPad performance certification or full visual QA.

Lint of the custom app and engine passes; repository-wide lint reports existing issues in unused scaffold components. Browser startup recovery was checked after a preview-cache conflict. Optional WebMCP tools (`set_tray_tilt`, `reset_bowl`) share the visible actions; registration was observed in the supporting preview browser, while tool execution remains unverified.

Sensor tests cover coordinate directions for screen rotations, calibration, noise rejection, invalid values, permission denial/cancellation, missing data and background suspension. Run them by compiling `tests/device-tilt.test.ts` with TypeScript to CommonJS in a temporary directory outside this ESM package, then using `node --test` on the emitted test file. These simulated events do not certify physical iPad sensors, WebGL performance, Home Screen installation or Guided Access; those still need a device check.
