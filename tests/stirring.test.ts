import assert from 'node:assert/strict';
import test from 'node:test';
import { smoothTilt, stepStirring, type Tilt } from '../lib/tilt';

function gesture(path: (time: number) => Tilt, seconds = 4, hz = 60) {
  let tilt: Tilt = { x: 0, y: 0 }, drive = 0;
  for (let i = 0; i < seconds * hz; i++) {
    const next = smoothTilt(tilt, path(i / hz), 1 / hz);
    drive = stepStirring(drive, tilt, next, 1 / hz); tilt = next;
  }
  return { drive, tilt };
}

void test('clockwise and counterclockwise tray circles generate opposite GPU torque', () => {
  const clockwise = gesture(t => ({ x: .8 * Math.cos(t * 2.4), y: .8 * Math.sin(t * 2.4) }));
  const counterclockwise = gesture(t => ({ x: .8 * Math.cos(t * 2.4), y: -.8 * Math.sin(t * 2.4) }));
  assert.ok(clockwise.drive < -1 && counterclockwise.drive > 1);
  assert.ok(Math.abs(clockwise.drive + counterclockwise.drive) < 1e-12);
});

void test('held tilt and linear rocking do not create a motor', () => {
  assert.equal(gesture(() => ({ x: .7, y: .4 })).drive, 0);
  assert.equal(gesture(t => ({ x: .6 * Math.sin(t * 3), y: .3 * Math.sin(t * 3) })).drive, 0);
});

void test('torque decays at rest and reverses smoothly', () => {
  const { tilt } = gesture(t => ({ x: .8 * Math.cos(t * 2.4), y: .8 * Math.sin(t * 2.4) }));
  let drive = -1.4;
  for (let i = 0; i < 6 * 60; i++) drive = stepStirring(drive, tilt, tilt, 1 / 60);
  assert.ok(Math.abs(drive) < .0002);
  const next = stepStirring(-1.4, { x: .8, y: 0 }, { x: .8, y: -.04 }, 1 / 60);
  assert.ok(next > -1.4 && next < 0);
});

void test('same gesture is consistent across sensor/frame rates', () => {
  const path = (t: number) => ({ x: .8 * Math.cos(t * 2.4), y: .8 * Math.sin(t * 2.4) });
  const slow = gesture(path, 4, 30).drive, fast = gesture(path, 4, 120).drive;
  assert.ok(Math.abs(slow / fast - 1) < .015);
});
