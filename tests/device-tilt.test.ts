import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { DeviceTilt, orientationGravity, screenTilt, type SensorState } from '../lib/device-tilt';
import type { Tilt } from '../lib/tilt';

const flat = { x: 0, y: 0 };
const close = (actual: Tilt, expected: Tilt) => {
  assert.ok(Math.abs(actual.x - expected.x) < 1e-8, `x: ${actual.x} vs ${expected.x}`);
  assert.ok(Math.abs(actual.y - expected.y) < 1e-8, `y: ${actual.y} vs ${expected.y}`);
};

void test('orientation follows downhill motion in portrait and all landscape rotations', () => {
  close(screenTilt(orientationGravity(0, 18)!, flat, 0), { x: 1, y: 0 });
  close(screenTilt(orientationGravity(18, 0)!, flat, 0), { x: 0, y: 1 });
  close(screenTilt(orientationGravity(18, 0)!, flat, 90), { x: 1, y: 0 });
  close(screenTilt(orientationGravity(0, 18)!, flat, 90), { x: 0, y: -1 });
  close(screenTilt(orientationGravity(18, 0)!, flat, 270), { x: -1, y: 0 });
  close(screenTilt(orientationGravity(0, 18)!, flat, 180), { x: -1, y: 0 });
});

void test('calibration, noise rejection, missing readings and large tilts are bounded', () => {
  const rest = orientationGravity(9, -6)!;
  close(screenTilt(rest, rest, 90), flat);
  close(screenTilt(orientationGravity(0.1, -0.1)!, flat, 0), flat);
  assert.equal(orientationGravity(null, 0), null);
  assert.equal(orientationGravity(0, NaN), null);
  assert.equal(orientationGravity(Infinity, 0), null);
  const steep = screenTilt(orientationGravity(70, 80)!, flat, 0);
  assert.ok(Math.hypot(steep.x, steep.y) <= 1.0000001);
});

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
afterEach(() => {
  for (const [key, descriptor] of [['window', originalWindow], ['document', originalDocument]] as const) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

function environment(permission: () => Promise<'granted' | 'denied'> = async () => 'granted') {
  let timerId = 0;
  const timers = new Map<number, () => void>();
  const win = Object.assign(new EventTarget(), {
    isSecureContext: true,
    DeviceOrientationEvent: { requestPermission: permission },
    screen: { orientation: { angle: 0 } },
    setTimeout: (callback: () => void) => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: (id: number) => { timers.delete(id); },
  });
  const doc = Object.assign(new EventTarget(), { hidden: false });
  Object.defineProperty(globalThis, 'window', { value: win, configurable: true });
  Object.defineProperty(globalThis, 'document', { value: doc, configurable: true });
  const tilts: Tilt[] = [], states: SensorState[] = [];
  const controller = new DeviceTilt((value) => tilts.push(value), (state) => states.push(state));
  const reading = (beta: number | null, gamma: number | null) => {
    win.dispatchEvent(Object.assign(new Event('deviceorientation'), { beta, gamma }));
  };
  return { win, doc, timers, tilts, states, controller, reading };
}

void test('permission is requested synchronously and active status requires valid sensor data', async () => {
  let requested = false;
  const e = environment(async () => { requested = true; return 'granted'; });
  const pending = e.controller.start();
  assert.equal(requested, true);
  await pending;
  assert.equal(e.states.at(-1)?.phase, 'waiting');
  e.reading(null, null);
  assert.equal(e.states.at(-1)?.phase, 'waiting');
  e.reading(0, 0);
  assert.equal(e.states.at(-1)?.phase, 'active');
  e.reading(0, 18); close(e.tilts.at(-1)!, { x: 1, y: 0 });
  e.controller.calibrate(); close(e.tilts.at(-1)!, flat);
  e.reading(0, 18); close(e.tilts.at(-1)!, flat);
  e.controller.stop();
  const count = e.tilts.length;
  e.reading(18, 0);
  assert.equal(e.tilts.length, count);
  assert.equal(e.timers.size, 0);
});

void test('iPad landscape uses the portrait-relative window angle when screen angle differs', async () => {
  const e = environment();
  // Safari can expose landscape as screen angle 0 while its motion axes remain portrait-based.
  Object.assign(e.win, { orientation: 90 });
  e.win.screen.orientation.angle = 0;
  await e.controller.start(); e.reading(0, 0);
  e.reading(0, -65);
  close(e.tilts.at(-1)!, { x: 0, y: 1 });
  e.controller.dispose();
});

void test('both landscape directions and portrait remain aligned when orientation APIs disagree', async () => {
  const e = environment();
  const win = Object.assign(e.win, { orientation: -90 });
  e.win.screen.orientation.angle = 90;
  await e.controller.start(); e.reading(0, 0);
  e.reading(0, 65); close(e.tilts.at(-1)!, { x: 0, y: 1 });
  win.orientation = 0;
  e.reading(65, 0); close(e.tilts.at(-1)!, { x: 0, y: 1 });
  e.controller.dispose();
});

void test('screen orientation remains the fallback when the window angle is unavailable', async () => {
  const e = environment();
  e.win.screen.orientation.angle = 270;
  await e.controller.start(); e.reading(0, 0);
  e.reading(0, 65); close(e.tilts.at(-1)!, { x: 0, y: 1 });
  e.controller.dispose();
});

void test('denied permissions leave manual control available', async () => {
  const e = environment(async () => 'denied');
  await e.controller.start();
  assert.equal(e.states.at(-1)?.phase, 'error');
  e.reading(0, 18);
  close(e.tilts.at(-1)!, flat);
  assert.equal(e.timers.size, 0);
});

void test('leaving sensor mode while permission is pending cannot re-enable it', async () => {
  let grant!: (value: 'granted') => void;
  const e = environment(() => new Promise((resolve) => { grant = resolve; }));
  const pending = e.controller.start();
  e.controller.stop(); grant('granted'); await pending;
  e.reading(0, 18);
  assert.equal(e.states.at(-1)?.phase, 'off');
  assert.equal(e.timers.size, 0);
});

void test('hidden pages neutralize tilt and resume only after a fresh reading', async () => {
  const e = environment();
  await e.controller.start(); e.reading(0, 0); e.reading(0, 18);
  e.doc.hidden = true; e.doc.dispatchEvent(new Event('visibilitychange'));
  close(e.tilts.at(-1)!, flat);
  e.reading(0, 18); close(e.tilts.at(-1)!, flat);
  assert.equal(e.states.at(-1)?.phase, 'paused');
  e.doc.hidden = false; e.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(e.states.at(-1)?.phase, 'waiting');
  e.reading(0, 18); close(e.tilts.at(-1)!, { x: 1, y: 0 });
  assert.equal(e.states.at(-1)?.phase, 'active');
  e.controller.dispose();
});

void test('a device exposing the API without readings times out and detaches', async () => {
  const e = environment();
  await e.controller.start();
  for (const timeout of e.timers.values()) timeout();
  assert.equal(e.states.at(-1)?.phase, 'error');
  const count = e.tilts.length;
  e.reading(0, 18);
  assert.equal(e.tilts.length, count);
});

void test('insecure pages do not request permission', async () => {
  let requested = false;
  const e = environment(async () => { requested = true; return 'granted'; });
  e.win.isSecureContext = false;
  await e.controller.start();
  assert.equal(requested, false);
  assert.equal(e.states.at(-1)?.phase, 'error');
});
