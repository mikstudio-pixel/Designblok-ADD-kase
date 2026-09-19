# Mícháš? — virtual tray prototype

[Open the application](https://mikstudio-pixel.github.io/Designblok-ADD-kase/)

[Stručná teorie hladkého okraje (česky)](docs/HLADKY-OKRAJ.md)

Monochrome WebGL 2 experiment for an iPad fixed to a dining tray. Control it with device orientation or dragging directly on the bowl.

## Use

The exhibition view contains a centered round bowl, 24 orange LED segments and a quiet corner switcher for surface effects. Its diameter is 13/18 of the previous viewport-fitting size, calibrated to the user's measured 18 cm outer diameter to target approximately 13 cm including the rim on the same iPad and display mode. This is a measured proportional adjustment, not a claim that CSS centimeters match physical centimeters on every device.

The LEDs are thicker curved rectangles with gently rounded corners: both long edges follow the bowl circumference, and the segments sit closer to the inner edge. The nearest segment to the downhill direction uses a power curve (tilt magnitude to the power 0.3) to lift subtle tilts. The warm core and broad orange glow increase continuously from the first nonzero tilt (power 0.85), rather than waiting until 75% tilt. Both layers reach full strength at maximum tilt, with a short 140 ms fade smoothing changes. All lights are off at neutral. This only changes feedback: sensor sensitivity and fluid forces stay the same.

On an iPad, tap the bowl while it is resting flat and grant motion permission. Double-tap the bowl to establish a new neutral position. On a desktop, drag directly on the bowl to simulate tilt; release returns the tray to neutral while the porridge settles. Arrow keys adjust manual tilt. Escape disables sensors and levels the tray. With the bowl focused, C recalibrates, O rotates the sensor axes by 90 degrees and R starts a new portion. Errors appear only if graphics or sensor access fails.

Quiet buttons in the upper-right corner switch the surface effect. **Hřebeny** is the default: local convex wave ridges receive a soft white-blue glow. **Vrstevnice**, **Výška**, **Síť** and **Proudění** show height contours, an elevation palette, a surface-following grid and moving flow tracers with signed-vorticity tint. **Původní** restores the original appearance for comparison. Switching preserves the current mixture, motion, LEDs and sensor input. The effect choice lasts until the page is reloaded. Buttons have at least 44 × 44 CSS pixel touch targets and wrap into two rows on small screens.

The lower-left rim switch compares four treatments without reseeding the
portion or resetting sensors. **Plynulý okraj** is the default: it uses fractional
circle geometry, conservative merging of tiny boundary cells and reflected ghost
values in the physics, plus a regularized
height field for crest lighting. **Kompromis** retains the previous approach: its physical wall
coincides with the visible opening, while display-only ghost values extend
height and pigment beneath the rim for continuous surface lighting.
**Pod okrajem** also lets the simulation move beneath the rim. **U okraje**
aligns the unpadded simulation with the visible opening. All four keep the
same bowl/LED size and have no edge blur. The choice lasts until reload.

For an A/B comparison of **Plynulý okraj**, append `?boundary=previous` to use
the earlier flux-limited solver from `caefb13`; the ordinary URL uses the new
merged-cell solver. The appearance and controls are identical. `?sim=256` and
`?sim=384` are diagnostic resolution overrides; the default remains 192.
Combine parameters with `&`. Remove the parameters to return to the default.

The small **Vlny** slider adjusts tray forcing live from **1×** (original) to
**2×**, in 0.05 steps, without resetting the portion. It starts at **1.25×**;
reloading restores that default. On narrow screens it moves above the rim controls.

Waves default to 1.25× the tray forcing in the actual height/velocity solver,
including the matching pressure condition at the circular wall. Damping,
viscosity, sensors, LED response and rendering are unchanged. Add
`?waves=original` to restore the earlier amplitude while keeping the smooth
merged boundary; combine it with `boundary=previous` for the full earlier
boundary/amplitude comparison. The older rim modes retain their original height
clamp and can cap high waves; the default merged mode conserves the height update
without clipping.

The initial surface has sharp cocoa dust, irregular melted chocolate patches and 1,024 persistent particles, including angular chocolate chips. Powder gradually disperses; the solid grains and chips never dissolve. Stylized oil patches reappear after the contents settle. The earlier ASCII study remains in the source for future use but is not mounted in the exhibition view.

An occasional red optical scan sweeps down the bowl and returns to the top, with a brief segmented focus ring and a glow that follows the surface. Each pass takes about 2.33 seconds (20% faster than the original). A faint mesh is visible only in a narrow, softly fading band around the laser in both directions. The first scan starts after three seconds; subsequent round trips have an 11–18 second pause. It only changes rendering and is disabled when reduced motion is preferred.

## iPad setup

Open the HTTPS application URL in Safari or from the Home Screen, put the iPad in its resting position on the tray, and tap the bowl. Allow motion/orientation access when Safari asks. The first valid reading establishes neutral; double-tapping the bowl recalibrates it. USB is not required for sensor input. Previously saved axis correction is preserved.

`DeviceOrientationEvent` provides fused orientation, rather than raw gyroscope integration. Gravity projected onto the tray controls the existing tilt input, with a 0.35-degree dead zone, approximately 18-degree full scale and the engine's existing smoothing. Permission is requested only from the button tap. Invalid/missing readings never count as active sensors; waiting times out after eight seconds. Hidden pages neutralize the input until fresh data arrives. Stopping cancels pending permission results and detaches listeners. Sensor readings stay on the device. Translational accelerometer input is not implemented yet.

Automatic screen alignment prefers a finite `window.orientation`, falling back to `screen.orientation.angle`. A reported 90-degree mismatch on an iPad Pro M4 running beta iPadOS is handled by a local correction saved on the device. The exhibition view keeps this preference; with a hardware keyboard and the bowl focused, O cycles it through left → down → right → up → left. Correction remains separate from neutral calibration. The source controller still exposes diagnostics, but the visitor view does not display them.

To check alignment, enable motion while the iPad is flat, then lift it into the keyboard position and check all four directions. Do not recalibrate while upright if you expect that position to show a downward tilt: calibration makes the current position neutral.

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

The 512 × 512 dye texture follows the resulting velocity. Particles use midpoint flow sampling and a damped velocity response, with wall contact but no particle-to-particle collisions. Elevation and particle positions use full float precision; other simulation textures use half float with explicit bilinear sampling. Surface lighting uses the simulated slope as well as ingredient texture. Rendering keeps bilinear texture taps inside the circular domain. The visible
opening stays at 93% of the bowl diameter. In **Pod okrajem**, a canvas at 110%
of the opening width hides about 7.8 cells of the 192-cell grid beneath the rim:
the visible radius is 0.5/1.1 ≈ 0.455, whereas its physical wall remains at 0.495.
In **U okraje**, a 101.0101% canvas aligns that 0.495 wall with the opening.
A circular `overflow:hidden` window clips the finished canvas, including
particles, flow tracers and laser. No backdrop blur or pigment edge blur is used.

**Kompromis** keeps the 110% canvas but moves its physical wall to 0.5/1.1.
Mass flux across that wall is zero. A one-sided gradient preserves the correct
pressure slope at the boundary. Shared-face fluxes include a pressure correction
that damps the alternating elevation mode a centered, collocated grid cannot
otherwise resolve. The correction cancels on an affine surface, so hydrostatic
balance is preserved. Normal velocity is constrained only in the last 0.75
simulation cell, and particles collide just inside the visible wall.
Two display-only passes extend pigment and surface elevation into the hidden
margin (a third extends tangential velocity for the flow effect). Pigment holds
the nearest safe interior value; height continues a bounded local slope. These padded textures are used for rendering and laser sampling only;
they never feed the solver's depth, velocity or particle steps. They therefore
add no moving liquid or reservoir outside the visible bowl. This is a numerical
boundary treatment, not a claim of eliminating every possible GPU artifact.

Switching physical radius remaps existing dye, height, velocity and particles
instead of generating a new portion; oil/scan timing and sensor calibration remain.
The remap is for visual comparison and is not a physical volume-conserving resize.
The two original modes retain their previous forces and contact rules. The ridge
highlight keeps its four-cell stencil and strength. In **Kompromis**, only that
highlight fades within four to six simulation cells of the physical wall:
second derivatives of extrapolated ghost heights are not reliable crests.
This also applies to the grid's crest highlight. Pigment, ordinary surface
lighting and particle motion still reach the opening; no image blur is applied.
In **Pod okrajem**, the highlight fade stays hidden beneath the rim.

**Plynulý okraj** uses the same visible radius and canvas crop as **Kompromis**,
but its finite-volume fluxes use exact circle/face intersections and fractional
cell areas (32-strip quadrature in cut cells). One shared face aperture is used
on both sides of each flux. Cut cells smaller than half a full cell are assigned
to a larger face-adjacent neighbor. The solver first updates integrated height
using the unmodified face apertures, then sums the disjoint group's updates and
reconstructs a linear surface about its volume-weighted center. This preserves
volume and a tilted plane without slowing the flow through individual faces.
Offsets are stored in cell units to avoid accumulating round-off from absolute
texture coordinates. No height clipping occurs in this merged update.
`boundary=previous` retains the earlier symmetric face-flux reduction and height
clamp for comparison. Momentum/advection and the ghost reflection are still the
existing approximations: this is not a complete published cut-cell SWE solver.
Outside active cells, momentum samples reflected velocities along the actual
circle normal. Ghost heights impose the normal pressure slope that balances
tray acceleration. These values participate in pressure/viscosity calculations.
Partial cells whose centers lie just outside the circle represent their in-bowl
area only; they are not a liquid reservoir under the rim.

For **Hřebeny** and the grid's highlights, a 5×5 binomial reconstruction of height
suppresses cell-scale noise before curvature is evaluated. It is a separate
render field: pigment, normal lighting, particles and the solver are untouched.
Unlike **Kompromis**, the new mode does not fade crest highlights at the visible
wall. The earlier three modes remain selectable and keep their previous solver.
Background on these boundary techniques: [Bridson, §4.5](https://www.cs.ubc.ca/~rbridson/fluidsimulation/fluids_notes.pdf#page=50),
[Liang–Borthwick, 2008](https://doi.org/10.1002/fld.1615), and
[Batty's face-weight implementation](https://github.com/christopherbatty/FluidRigidCoupling2D).
The merging principle is described by [Causon–Ingram–Mingham, §3.4](https://www.pure.ed.ac.uk/ws/files/1724618/paper_new.pdf).

This is inspired by the [shallow-water equations](https://www.clawpack.org/riemann_book/html/Shallow_water.html), with art-directed viscosity, scales and limits for porridge. It is not calibrated food rheology or a 3D splashing simulation. Oil separation is a timed visual effect. No TouchDesigner runtime is needed. Device orientation requires sensor permission; mouse input does not.

## Development and deployment

`npm install`, then `npm run dev` at `http://127.0.0.1:3000/`. Build and preview use separate Vite caches. `npm run build` creates the static export in `dist/client/`.

GitHub Actions builds and deploys `main` to GitHub Pages. It sets `NEXT_PUBLIC_BASE_PATH=/Designblok-ADD-kase` for asset URLs. The export keeps the single application route at its output root; using Vinext's router `basePath` currently causes that route to be skipped during prerendering, so the project path is set via Vite's asset base instead. The workflow requires `dist/client/index.html` before deploying.

Input mapping is in `lib/tilt.ts`; device orientation and permission handling are in `lib/device-tilt.ts`. The engine exposes `setTilt({x,y})`, `setEffect(...)`, `setRimMode(...)`, `getMotion()`, `reset()` and `dispose()`. Ridge curvature and flow features are evaluated in a separate 192 × 192 render pass. A tilted plane produces no ridge glow. The glow is a local highlight without a full-screen bloom pass. Tune the response on the mounted iPad before exhibition use. WebGL 2 and EXT_color_buffer_float are required. The unused ASCII study's JetBrains Mono asset and OFL license remain in `public/fonts/`.

## Validation

Type checking and production export are checked. Native GPU checks exercise the actual solver shaders: undisturbed stillness, held-tilt equilibrium, mass conservation, bounded circular input and settling after release. At a steady force of 0.128, the measured surface slope was 0.1065 versus the hydrostatic target 0.1067. After ten seconds of rest, RMS speed was below 0.00003. These checks are not a Safari/iPad performance certification or full visual QA.

Lint of the custom app and engine passes; repository-wide lint reports existing issues in unused scaffold components. Browser startup recovery was checked after a preview-cache conflict. Optional WebMCP tools (`set_tray_tilt`, `reset_bowl`) share the visible actions and were exercised in the supporting preview browser.

Sensor tests cover coordinate directions for screen rotations, calibration, noise rejection, invalid values, permission denial/cancellation, missing data and background suspension. Run them by compiling `tests/device-tilt.test.ts` with TypeScript to CommonJS in a temporary directory outside this ESM package, then using `node --test` on the emitted test file. These simulated events do not certify physical iPad sensors, WebGL performance, Home Screen installation or Guided Access; those still need a device check.

Run `npm run test:gpu` and open
`http://127.0.0.1:3003/tests/rim-boundary.html` for the actual WebGL shader checks.
The standalone Vite config serves the production TypeScript engine without the
app shell and uses a separate cache. The harness checks affine-height ghost
extension, no false ridge on a tilted plane, edge-noise highlight rejection,
stillness, checkerboard-pressure damping, hydrostatic equilibrium,
height conservation, zero exterior velocity/depth, forced particle collisions,
settling, and mode/effect switching without reseeding. It reports PASS/FAIL in
the page and disposes its WebGL resources when done. It is a development test;
it is not included in the static application export.

`http://127.0.0.1:3003/tests/curved-boundary.html` compares hybrid, previous
curved and merged boundaries under identical abrupt tilt/reversal inputs and
timestamps. It measures angular second differences of raw height on a fixed
physical circle two baseline cells inside the rim, before rendering. It also
checks hydrostatic balance, conservation, settling, a linear reconstruction,
unchanged dye, crest visibility, all effects and mode switching. Add `?long` for
two simulated minutes of circular stirring; `?impact&n=256`, `?impact&n=384` or
`?impact&half` measure a finer grid or half the usual time step. These tests run
production shaders on the browser GPU; they are not included in the build.

Observed development-browser results (same 192-cell grid and time sequence):

| Boundary | Rim roughness | RMS velocity after reversal |
| --- | ---: | ---: |
| Hybrid | 0.001201 | 0.07989 |
| Previous curved | 0.000354 | 0.08018 |
| Merged curved | 0.0000195 | 0.07993 |

This is about 94% less measured rim roughness than the previous curved mode,
with less than 1% difference in bulk speed in this case; it is not a percentage
of all visible artifacts. Mean height drift after two simulated minutes of
stirring was below 5e-8. Linear reconstruction error was below 6e-9.

Resolution probes gave roughness about 1.7e-5 at 256 and 2.0e-5 at 384. Finer
grids use smaller time steps to respect explicit diffusion stability; they also
changed bulk speed (about 0.073 and 0.062 respectively). Halving the time step at
192 changed speed to about 0.072. The solver therefore has unresolved timestep/
resolution dependence; these runs do not establish numerical convergence.
The 192 default preserves the accepted motion and avoids the larger workload.
The existing 16-bit velocity storage, per-substep wall treatment and advection
remain candidates for a later convergence investigation. Physical iPad
performance and appearance still require a device check.

Run `tests/curved-boundary.html?waves` on the GPU test server to compare original
and higher waves, maximum held tilt, one simulated minute of full-strength
stirring, settling and all rim modes. The boundary-only suite explicitly uses
original amplitude so its historical comparisons remain meaningful. In the
wave test the peak absolute elevation rose from 0.05481 to 0.07022 (about 28%);
maximum held-tilt transients retained depth above 0.033. The merged mode's mean
height drift after the stirring test was below 3e-8, and rim roughness stayed
below 0.00003 in the comparison impact. These are dimensionless simulation
measurements, not physical centimeters or a guarantee for every input.

`tests/curved-boundary.html?slider` checks the 2× endpoint, a simulated minute
of stirring and changing strength during motion. At 2× the impact's rim roughness
was 0.000050 and mean height drift remained below 3e-8. This upper range is
deliberately exaggerated: strong transients can reach the solver's existing
minimum-depth floor, so it is a styling control, not a physically accurate dry-bed
or overflowing-fluid model.
