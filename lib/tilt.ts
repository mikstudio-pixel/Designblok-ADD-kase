export type Tilt = { x: number; y: number };

export function clampTilt(value: Tilt): Tilt {
  const x = Number.isFinite(value.x) ? value.x : 0;
  const y = Number.isFinite(value.y) ? value.y : 0;
  const length = Math.max(1, Math.hypot(x, y));
  return { x: x / length, y: y / length };
}

export function smoothTilt(current: Tilt, target: Tilt, dt: number): Tilt {
  const blend = 1 - Math.exp(-Math.max(0, dt) / 0.10);
  return { x: current.x + (target.x - current.x) * blend, y: current.y + (target.y - current.y) * blend };
}

export function tiltForces(previous: Tilt, current: Tilt, dt: number) {
  const seconds = Math.max(dt, 0.001);
  const dx = Math.max(-8, Math.min(8, (current.x - previous.x) / seconds));
  const dy = Math.max(-8, Math.min(8, (current.y - previous.y) / seconds));
  return {
    x: current.x * 0.7 + dx * 0.08,
    y: -current.y * 0.7 - dy * 0.08,
    // Screen Y points down; simulation Y points up.
    spin: Math.max(-3, Math.min(3, (previous.y * current.x - previous.x * current.y) / seconds)),
  };
}
