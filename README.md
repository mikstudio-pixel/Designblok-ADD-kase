# Mícháš? — virtual tray prototype

[Open the application](https://mikstudio-pixel.github.io/Designblok-ADD-kase/)

[Stručná teorie hladkého okraje (česky)](docs/HLADKY-OKRAJ.md) · [Nový materiál: emulze (česky)](docs/EMULZE.md)

Monochrome WebGL 2 experiment for an iPad fixed to a dining tray. Control it with device orientation or dragging directly on the bowl.

## Use

The exhibition view contains a centered round bowl, 24 orange LED segments and a quiet corner switcher for surface effects. Its diameter is 13/18 of the previous viewport-fitting size, calibrated to the user's measured 18 cm outer diameter to target approximately 13 cm including the rim on the same iPad and display mode. This is a measured proportional adjustment, not a claim that CSS centimeters match physical centimeters on every device.

The LEDs are thicker curved rectangles with gently rounded corners: both long edges follow the bowl circumference, and the segments sit closer to the inner edge. The nearest segment to the downhill direction uses a power curve (tilt magnitude to the power 0.3) to lift subtle tilts. The warm core and broad orange glow increase continuously from the first nonzero tilt (power 0.85), rather than waiting until 75% tilt. Both layers reach full strength at maximum tilt, with a short 140 ms fade smoothing changes. All lights are off at neutral. This only changes feedback: sensor sensitivity and fluid forces stay the same.

On an iPad, tap the bowl while it is resting flat and grant motion permission. Double-tap the bowl to establish a new neutral position. On a desktop, drag directly on the bowl to simulate tilt; release returns the tray to neutral while the porridge settles. Arrow keys adjust manual tilt. Escape disables sensors and levels the tray. With the bowl focused, C recalibrates, O rotates the sensor axes by 90 degrees and R starts a new portion. Errors appear only if graphics or sensor access fails.

Quiet checkboxes in the upper-right corner combine surface effects independently. **Hřebeny** adds a highlight: local convex wave ridges receive a soft white-blue glow. **Vrstevnice**, **Výška**, **Síť** and **Proudění** show height contours, an elevation palette, a surface-following grid and moving flow tracers with signed-vorticity tint. **Tečky** adds a denser 72-cell lattice of dots that follows the surface and brightens with elevation and convex crests. It shares the existing crest features and needs no extra particle simulation or render target. **Původní** clears all six checkboxes and restores the original appearance for comparison. Color layers are applied first, then contours and the grid, with crest light on top; selection order does not matter. Switching preserves the current mixture, motion, LEDs and sensor input. The selected combination lasts until the page is reloaded. The emulsion starts with these optional overlays off so the liquid material is visible on its own. Checkbox labels and buttons have at least 44 × 44 CSS pixel touch targets and wrap into multiple rows on small screens.

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
merged-cell solver. The appearance and controls are identical. `?sim=160`, `?sim=192`, `?sim=256` and
`?sim=384` are diagnostic resolution overrides; the automatic profile uses 160
on multitouch devices and 192 on desktop.
Combine parameters with `&`. Remove the parameters to return to the default.

The small **Vlny** slider adjusts tray forcing live from **1×** (original) to
**3×**, in 0.05 steps, without resetting the portion. It starts at **1.25×**;
reloading restores that default. On narrow screens it moves above the rim controls.

**Viskozita** controls momentum diffusion from **1×** (the original 0.0005)
to **4×** (0.002), with the original value as default. Higher values spread
sharp crests and damp small ripples; they also reduce peak height, which can be
compensated with **Vlny**. It changes the fluid solver, not the pigment texture
or a display blur. The explicit diffusion timestep tightens automatically at
higher viscosity, and forcing above 2× also uses more substeps for steep waves
(up to twice as many at 3×). Both controls apply immediately and keep the current portion.

Waves default to 1.25× the tray forcing in the actual height/velocity solver,
including the matching pressure condition at the circular wall. Linear drag,
sensors, LED response and rendering are unchanged. Add
`?waves=original` to restore the earlier amplitude while keeping the smooth
merged boundary; combine it with `boundary=previous` for the full earlier
boundary/amplitude comparison. The older rim modes retain their original height
clamp and can cap high waves; the default merged mode conserves the height update
without clipping.

The surface is now a light/dark emulsion, with no chocolate chips, semolina
sprites, decorative bubbles or timed oil-film overlay. An active concentration
field is transported by tray-driven flow; chemical-potential exchange rounds and
reconnects its interfaces. Wet lighting follows both the wave slope and the
phase boundary. The field starts as irregular pools and evolves into filaments
and drops. Sustained faster stirring progressively increases solubility, letting
concentration diffuse into one gray mixture. Slow stirring mostly preserves the
separated pools. Quiet periods gradually restore immiscibility, so the mixture
can separate and be mixed again without resetting the portion.
Both materials remain present through a GPU-only area correction.
The flow diagnostic retains its optional moving tracers; they are not ingredients.
The earlier ASCII study remains in the source but is not mounted.

## Performance profiles

This material prototype deliberately defaults to **Detailní**, prioritizing
visual evaluation. It does not automatically reduce resolution in this mode.
The emulsion and independent wave/current fields add new GPU passes; the older timing results below do not describe
its cost. Optimization of this material is deferred.

**Režim → Automaticky** selects **Úsporný** on devices reporting more than one
touch point (including iPads with a keyboard), and **Detailní** otherwise.
The selector permits manual comparison. Switching rebuilds the portion, while
retaining slider values, effect, boundary choice and sensor calibration.
Reloading restores **Detailní** for this visual prototype.

The performance profile uses a 160² physics grid and a maximum 900² rendering
buffer, compared with 192² and 1300² in detail mode. The material field remains 512² in full precision, and the fractional/merged
circular boundary and full-precision height storage are preserved. Time steps respect both gravity-wave and diffusion
limits at the chosen resolution. This trades some small-scale motion and display
sharpness for less work; it is not identical numerical output at both resolutions.

Where `OES_texture_float_linear` is available, render passes use hardware linear
sampling; physics retains its existing sampling. Unsupported devices use the
manual fallback. Unchanged WebGL uniforms are cached. The sensor still supplies
every sample to the solver; React/LED updates from sensors are limited to 30 Hz.

The small FPS counter measures completed animation-loop iterations over about
one second, not a GPU timer or independently measured display presentation.
In performance mode, three consecutive readings below 50 FPS reduce only the
rendering buffer, in 15% steps down to 600². The simulation is not reset, its grid
is unchanged, and no stable physics steps are skipped. Reload or a mode change
restores the initial rendering limit. Background pauses do not count as slow frames.

For the presentation iPad, compare **Vlny 1.25× / Viskozita 1×** with **3× / 4×**
while moving the tray, and watch FPS for at least a minute. The actual iPad 10
still needs this check; desktop results cannot certify iPad/Safari performance.

## iPad setup

Open the HTTPS application URL in Safari or from the Home Screen, put the iPad in its resting position on the tray, and tap the bowl. Allow motion/orientation access when Safari asks. The first valid reading establishes neutral; double-tapping the bowl recalibrates it. USB is not required for sensor input. Previously saved axis correction is preserved.

`DeviceOrientationEvent` provides fused orientation, rather than raw gyroscope integration. Gravity projected onto the tray controls the existing tilt input, with a 0.35-degree dead zone, approximately 18-degree full scale and the engine's existing smoothing. Permission is requested only from the button tap. Invalid/missing readings never count as active sensors; waiting times out after eight seconds. Hidden pages neutralize the input until fresh data arrives. Stopping cancels pending permission results and detaches listeners. Sensor readings stay on the device. Translational accelerometer input is not implemented yet.

Automatic screen alignment prefers a finite `window.orientation`, falling back to `screen.orientation.angle`. A reported 90-degree mismatch on an iPad Pro M4 running beta iPadOS is handled by a local correction saved on the device. The exhibition view keeps this preference; with a hardware keyboard and the bowl focused, O cycles it through left → down → right → up → left. Correction remains separate from neutral calibration. The source controller still exposes diagnostics, but the visitor view does not display them.

To check alignment, enable motion while the iPad is flat, then lift it into the keyboard position and check all four directions. Do not recalibrate while upright if you expect that position to show a downward tilt: calibration makes the current position neutral.

For a Home Screen launch, use Safari's **Add to Home Screen**, enabling **Open as Web App** where offered. The manifest and Apple web-app metadata request a standalone window. It still needs internet for initial loading; offline caching is not implemented. Permission may need to be granted again when launched from the Home Screen.

The **Obnovit** button shows the installed build and reloads the current address with a fresh cache key, preserving diagnostic URL parameters. On launch, return to the foreground or reconnection, the app checks for a newer deployment and offers **Nová verze · obnovit**; it does not interrupt a running simulation automatically. Reloading resets the portion and session controls. Each Pages build stamps its commit into the app, `version.json` and the manifest launch URL. An old Home Screen copy that predates this button must load the new page once; adding a new icon from the current Safari page uses the stamped launch URL.

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

Two copies of the damped depth-averaged solver run on the same 160 × 160
(performance) or 192 × 192 (detail) circular geometry. The **wave field** keeps
the original downhill tray force, gesture impulse and timestep (baseline 1/240 s).
It supplies visible elevation, normals, crests, contours, grid and dots.
The **material current** also receives the gesture-controlled rotational force
and uses half that timestep for stability. It carries concentration and flow
tracers. The fields share tilt, wave/viscosity controls and wall geometry, but do
not modify one another. This restores the wave character from `dc8c149` while
retaining the mixing introduced in `377bd22`.

The signed swept area of the smoothed tilt gesture drives differential rotation
and a moving off-center recirculation. A static tilt supplies no sustained torque;
reversal changes its direction and release lets it decay. Both solvers use
semi-Lagrangian velocity transport, viscous drag, hydrostatic pressure and
conservative depth fluxes. This separation is deliberate art direction, not a
single physically coupled multiphase fluid.
The 512 × 512 material texture holds a full-precision dark-phase fraction;
the light phase is its complement. Bounded MacCormack transport preserves thin
filaments better than a single semi-Lagrangian pass. Material uses the same
current field and elapsed time as flow tracers; visible waves evolve independently. A Cahn–Hilliard-inspired
relaxation uses a double-well potential, an isotropic nine-point Laplacian and
bounded equal/opposite exchanges across neighbor pairs. Accumulated fast stirring
blends that separating potential into a convex mixing potential and increases
exchange mobility. This diffuses the actual concentration locally rather than
fading the rendered image. Quiet periods reduce miscibility with a 45-second
time constant, suppressed during strong stirring. Smooth, faint chemical-potential
fluctuations seed new domains while the mixture recovers; they exchange concentration
conservatively and vanish as the phases separate. They never reload the starting
image. A new portion resets the history and randomizes the nucleation seed. Concentration maps continuously to light/dark color. A GPU reduction and
interface-weighted correction preserve the initial mean phase fraction after
transport. This preserves 2D area ratio, not depth-weighted 3D material mass.
The material current receives the gesture force; concentration is still a
one-way coupled surface material, not two independently solved densities
or capillary forces fed back into momentum. Optional flow tracers use midpoint
sampling; solid ingredient sprites are removed. Surface lighting uses simulated
slope and a narrow meniscus at the evolving phase interface. Rendering keeps bilinear texture taps inside the circular domain. The visible
opening stays at 93% of the bowl diameter. In **Pod okrajem**, a canvas at 110%
of the opening width hides about 7.8 cells of the 192-cell grid beneath the rim:
the visible radius is 0.5/1.1 ≈ 0.455, whereas its physical wall remains at 0.495.
In **U okraje**, a 101.0101% canvas aligns that 0.495 wall with the opening.
A circular `overflow:hidden` window clips the finished canvas, including
particles and flow tracers. No backdrop blur or pigment edge blur is used.

**Kompromis** keeps the 110% canvas but moves its physical wall to 0.5/1.1.
Mass flux across that wall is zero. A one-sided gradient preserves the correct
pressure slope at the boundary. Shared-face fluxes include a pressure correction
that damps the alternating elevation mode a centered, collocated grid cannot
otherwise resolve. The correction cancels on an affine surface, so hydrostatic
balance is preserved. Normal velocity is constrained only in the last 0.75
simulation cell, and particles collide just inside the visible wall.
Two display-only passes extend pigment and surface elevation into the hidden
margin (a third extends tangential velocity for the flow effect). Pigment holds
the nearest safe interior value; height continues a bounded local slope. These padded textures are used for rendering only;
they never feed the solver's depth, velocity or particle steps. They therefore
add no moving liquid or reservoir outside the visible bowl. This is a numerical
boundary treatment, not a claim of eliminating every possible GPU artifact.

Switching physical radius remaps existing dye, height, velocity and particles
instead of generating a new portion; mixing state and sensor calibration remain; the material area target is recalculated after the remap.
The remap is for visual comparison and is not a physical volume-conserving resize.
The two original modes retain their previous forces and contact rules. The ridge
highlight keeps its strength and physical stencil width (four cells at the
192 reference resolution). In **Kompromis**, only that highlight fades within
four to six reference cells of the physical wall:
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

This is inspired by the [shallow-water equations](https://www.clawpack.org/riemann_book/html/Shallow_water.html), with art-directed viscosity, scales and limits for porridge. It is not calibrated food rheology or a 3D splashing simulation. Phase separation is an evolving stylized surface field, without a timer-driven pattern reset. No TouchDesigner runtime is needed. Device orientation requires sensor permission; mouse input does not.

## Development and deployment

`npm install`, then `npm run dev` at `http://127.0.0.1:3000/`. Build and preview use separate Vite caches. `npm run build` creates the static export in `dist/client/`.

GitHub Actions builds and deploys `main` to GitHub Pages. It sets `NEXT_PUBLIC_BASE_PATH=/Designblok-ADD-kase` for asset URLs. The export keeps the single application route at its output root; using Vinext's router `basePath` currently causes that route to be skipped during prerendering, so the project path is set via Vite's asset base instead. The workflow requires `dist/client/index.html` before deploying.

Input mapping is in `lib/tilt.ts`; device orientation and permission handling are in `lib/device-tilt.ts`. The engine exposes `setTilt({x,y})`, `setEffects(...)`, `setRimMode(...)`, `getMotion()`, `reset()` and `dispose()`. Ridge curvature and flow features are evaluated in a separate render pass at the selected simulation resolution. A tilted plane produces no ridge glow. The glow is a local highlight without a full-screen bloom pass. Tune the response on the mounted iPad before exhibition use. WebGL 2 and EXT_color_buffer_float are required. The unused ASCII study's JetBrains Mono asset and OFL license remain in `public/fonts/`.

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
The detail profile retains the accepted 192-grid motion; the performance profile
uses 160 with a correspondingly adjusted time step.
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

`tests/curved-boundary.html?slider` checks the 3× endpoint, a simulated minute
of stirring and changing both controls during motion; add `&viscosity=4` to
stress both maxima together. This upper range is
deliberately exaggerated: strong transients can reach the solver's existing
minimum-depth floor, so it is a styling control, not a physically accurate dry-bed
or overflowing-fluid model.
At 3× forcing, measured impact roughness was 0.000207 with original viscosity
and 0.0000945 at viscosity 4×; sharpness is intentionally higher than in the
original-amplitude boundary test. Both minute-long runs remained finite with
mean height drift below 3e-8 and settled after release. The original 1× boundary
regression retained its previous 0.0000195 roughness.

`tests/curved-boundary.html?viscosity-test` sends the same small circular pulse
through the solver at viscosity 1× and 4×. Its outgoing crest's half-height width
increased from 0.0383 to 0.0609 (about 59%) after 0.25 simulated seconds, while
the peak decreased. This is a controlled comparison, not a universal wavelength
multiplier. The underlying momentum-diffusion term is described in
[Bridson's shallow-water notes](https://www.cs.ubc.ca/~rbridson/courses/533b-winter-2004/cs533b_slides_mar11.pdf).


Performance regression checks also run at `?n=160`, `?n=160&manual`,
`?n=160&slider` and `?n=160&slider&viscosity=4`. The full boundary/effect suite
passed with both hardware and manual display sampling. At 160, original-amplitude
rim roughness was 0.0000344; at 3× it was 0.000283 with viscosity 1× and 0.000166
with viscosity 4×. Both maximum-strength minute-long runs remained finite,
conserved mean height to within 2e-7 and settled after release, using the existing
test tolerances. The 192-grid baseline retained its previous 0.0000195 roughness.

`tests/performance.html?n=160&pixels=900` measures batches of simulated 60 Hz
frames with GPU synchronization before/after each batch. Readback is used only
in this development harness, never in the application. A local Mac/browser run
compared the previous `a6a5f3c` at 192/1300 against the optimized 160/900 profile:

| Settings | Previous ms/frame | Optimized ms/frame |
| --- | ---: | ---: |
| Waves 1.25×, viscosity 1× | 0.825 | 0.560 |
| Waves 3×, viscosity 4× | 1.240 | 0.730 |

These are median amortized batch timings (about 32–41% less time in this run),
not live FPS or a forecast for an A14 iPad. The benchmark excludes sensor/React
updates and browser frame presentation. Production export and TypeScript checks
also pass. On-device sustained performance remains to be measured.


### Emulsion validation

`tests/emulsion.html` disables dissolution to isolate the original immiscible material. It transports a fixed initial pattern for 16 simulated seconds
of circular tray motion, then lets it settle for 12 seconds. It checks bounded
fractions, no material outside the circle, a changing pattern and mean phase
ratio within 2e-5 of its starting value. An isolated two-drop test checks neck
thickening and decreasing interfacial energy at zero flow. `?max&manual` repeats
with waves 3×, viscosity 4× and manual render filtering. It captures initial,
stirred and settled images for visual review. The separate surface-effects suite
checks all 64 overlay combinations; the boundary suite checks conservation and smooth circular-wall impacts. The visible wave solver again uses its original timestep and measured raw-height
impact roughness of 0.0000195. These are prototype checks, not a validation
of food chemistry or a physically calibrated multiphase flow solver.


### Tray circulation validation

`tests/stirring.html` compares the same seeded material and 16-second circular
gesture with circulation disabled/enabled and dissolution off. It checks increased interface length,
actual angular momentum, reversal, decay after release, bounded phase fractions
and conserved phase area and integrated height. Snapshots show transport rather
than just lighting. `?max&manual` uses waves 3×, viscosity 4× and manual filtering;
`?performance` exercises the coarser grid; `&long` extends circular motion to
60 seconds. The test also requires identical visible height fields with and
without material circulation. `tests/stirring.test.ts` checks gesture
direction, static tilt/linear rocking, release and 30/120 Hz consistency.

App diagnostic `?stir=0` disables the extra material current. `?dissolve=0`
keeps the circulating material immiscible. Both leave the original wave field intact. Material still uses 1×
transport time, so this is not an exact reproduction of release `dc8c149`, which
amplified passive texture travel. The circulation change is isolated in Git for
rollback.

Before dissolution was added (`377bd22`), the 16-second comparison increased threshold interface
length from 5,052 to 14,452 grid edges (2.86×); fluid angular momentum changed
from −0.0668 to +0.0663 after reversing. The 60-second coarser-grid run retained
phase mean within 6e-9 and integrated height within 1.6e-7. Maximum wave/viscosity
settings and droplet coalescence also passed. These are numerical/visual checks
on the desktop GPU, not an on-device iPad performance measurement.


### Independent waves and dissolving validation

`tests/dissolving.html` compares 60 seconds of slow and fast circular gestures,
captures 10/30/60-second stages and checks mean concentration, bounds and exterior
containment. It then rests for 120 seconds and remixes for 60 seconds to verify
the complete reversible cycle. Fast stirring reduced concentration variance from about 0.24 to
0.00161; slow stirring retained 0.222. The first 20 seconds of rest remain softly mixed; later the concentration
contrast grows again without losing either constituent. Reset and rim switching are checked.
`?performance&max&manual` exercises the 160 grid, maximum sliders and manual
render filtering. `tests/stirring.test.ts` checks speed dependence, direction
symmetry, gradual recovery and timestep independence of the solubility history.
These are visual-prototype checks, not a physical model of oil becoming soluble.

`tests/separation.html` starts with exactly uniform `c = 0.5` and zero flow.
It verifies nucleation without any leftover image, bounded concentration and
conserved phase ratio at 30/60/90/150 seconds. At full stirring the dissolving
rate is unchanged; quiet recovery is continuous and cannot abruptly reset a portion.

Recovery validation: the real mix/rest/remix cycle produced concentration
variances 0.00161 → 0.17278 → 0.000384, with mean drift below 1e-7.
The exactly uniform test reached variance 0.19183 after 150 seconds, with
mean 0.499999996 and no out-of-domain concentration.
