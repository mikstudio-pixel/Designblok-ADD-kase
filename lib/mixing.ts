// Art-directed solubility: sustained faster stirring progressively removes
// phase separation. The gesture drive measures swept tilt area per second.
// A portion remembers its mixing history; only a new portion resets it.
export function stepMiscibility(current: number, stirring: number, dt: number): number {
  const activity = Math.min(1, Math.max(0, (Math.abs(stirring) - 0.15) / 1.85));
  return current + (1 - current) * (1 - Math.exp(-Math.max(0, dt) * activity ** 2 / 25));
}
