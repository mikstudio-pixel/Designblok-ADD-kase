# Pravý displej — scénář

Source: Figma Designblok 26, file `sUxmZReZMJJuCFsxLwVYp6`, section
`Interakce_FlowMap` (`205:2702`), exported 2026-09-25. The final welcome
screen uses the visible topmost right panel of frame `6` (`205:2198`).

Each SVG retains the full 744 × 1073 artboard at 1×. Global Figma export
coordinates are retained in the viewBox; the app positions all screens with
the same calibration transform. Text is outlined (Geist Mono / PP Neue
Machina). No runtime font request or external image dependency is needed.

Removed: green manufacturing safe-zone path, numeric gyro rows/online state,
clumpiness and mixing-state rows, analysis countdown/progress group. Those
fields are rendered by `right-display.tsx` at the original local coordinates.
All other vectors and the original QR code are unchanged. The welcome card
uses the final mockup's variant without the older outline around the message.

The editable and outlined FlowMap exports both contain the following named
standalone right panels (the suffixes are export IDs, not Figma node IDs):

| Stage | Exported right panel suffix |
| --- | --- |
| detected | 4 |
| authorized | 29 |
| decision | 6 |
| countdown | 27 |
| analysis | 8 |
| mixing | 10 |
| keep-mixing | 12 |
| not-mixing | 14 |
| stir-prompt | 16 |
| success | 18 |
| failure | 20 |
| connecting | 22 |

Dynamic baselines: timer 450.97, clumpiness 711.11, overall state 749.11,
gyro rows 870.11 / 889.11 / 908.11, sensor status 978.05. Main column x=396,
width=311. These coordinates should change only with a revised design.
