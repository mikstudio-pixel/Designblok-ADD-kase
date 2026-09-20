// Art-directed solubility: sustained faster stirring progressively removes
// phase separation. The gesture drive measures swept tilt area per second.
// Quiet periods slowly restore immiscibility; strong stirring keeps the
// original dissolving rate. The exact exponential update is timestep invariant.
export function stepMiscibility(current: number, stirring: number, dt: number): number {
  const activity = Math.min(1, Math.max(0, (Math.abs(stirring) - 0.15) / 1.85));
  const dissolve = activity ** 2 / 25;
  const separate = (1 - activity) ** 4 / 45;
  const rate = dissolve + separate;
  const target = dissolve / rate;
  return target + (current - target) * Math.exp(-Math.max(0, dt) * rate);
}
