// Fractional face apertures and cell areas for a fixed circular finite-volume
// domain. Shared faces are stored once (east/north), so fluxes cancel exactly.
export function circleBoundary(size: number, radius: number) {
  const data = new Float32Array(size * size * 4), h = 1 / size;
  const span = (fixed: number, low: number, high: number) => {
    const extent = Math.sqrt(Math.max(0, radius * radius - fixed * fixed));
    return Math.max(0, Math.min(high, extent) - Math.max(low, -extent));
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const left = x * h - .5, bottom = y * h - .5, i = (y * size + x) * 4;
    data[i] = span(left + h, bottom, bottom + h) / h;
    data[i + 1] = span(bottom + h, left, left + h) / h;
    // Only cut cells need quadrature; 32 strips give a stable sub-cell area.
    const center = Math.hypot(left + h / 2, bottom + h / 2);
    if (center < radius - h * Math.SQRT1_2) data[i + 2] = 1;
    else if (center < radius + h * Math.SQRT1_2) {
      for (let k = 0; k < 32; k++) data[i + 2] += span(left + h * (k + .5) / 32, bottom, bottom + h) / (32 * h);
    }
    data[i + 3] = center - radius;
  }
  return data;
}
