import assert from 'node:assert/strict';
import test from 'node:test';
import { MixingScenario, SCENARIO, selectMotion, type MotionSample, type ScenarioStage } from '../lib/mixing-scenario';

const sample = (activity: number, receivedAt = 0): MotionSample => ({ gyro: { x: 1, y: 2, z: 3 }, activity, receivedAt });
function fixture() {
  const scenario = new MixingScenario();
  let now = 0;
  scenario.step(now, sample(0));
  return {
    scenario,
    advance(seconds: number, activity: number | null) {
      for (let i = 0; i < Math.round(seconds * 20); i++) {
        now += 0.05;
        scenario.step(now, activity === null ? null : sample(activity, now));
      }
      return scenario.snapshot();
    },
    until(stage: ScenarioStage, activity: number) {
      for (let i = 0; i < 1000; i++) {
        now += 0.05;
        const state = scenario.step(now, sample(activity, now));
        if (state.stage === stage) return state;
      }
      assert.fail(`Stage ${stage} not reached`);
    },
  };
}

void test('standby ignores sensor noise and a brief bump, then confirms a lift', () => {
  const f = fixture();
  assert.equal(f.advance(2, 0.1).stage, 'standby');
  assert.equal(f.advance(0.1, 1).stage, 'standby');
  assert.equal(f.advance(1, 0).stage, 'standby');
  assert.equal(f.advance(0.3, 0.7).stage, 'detected');
});

void test('moving visitor follows the full Figma sequence and resets after the welcome', () => {
  const f = fixture();
  for (const stage of ['detected', 'authorized', 'decision', 'countdown', 'analysis', 'mixing', 'keep-mixing', 'success', 'connecting', 'welcome'] as const) f.until(stage, 0.7);
  assert.equal(f.advance(SCENARIO.welcome - 1, 0).stage, 'welcome');
  assert.equal(f.advance(2, 0).stage, 'standby');
  assert.equal(f.advance(2, 0).stage, 'standby');
});

void test('not moving after the lift follows both prompts and the failure branch', () => {
  const f = fixture();
  f.until('detected', 0.7);
  f.until('analysis', 0);
  f.until('not-mixing', 0);
  f.until('stir-prompt', 0);
  assert.equal(f.until('failure', 0).mixed, 0);
  f.until('connecting', 0);
  f.until('welcome', 0);
});

void test('resuming movement changes the prompt and can still reach success', () => {
  const f = fixture();
  f.until('detected', 0.7);
  f.until('not-mixing', 0);
  assert.equal(f.advance(0.2, 0.7).stage, 'mixing');
  assert.equal(f.until('success', 0.7).mixed, 1);
});

void test('missing sensor data and a suspended clock do not invent mixing or skip steps', () => {
  const f = fixture();
  f.until('analysis', 0.7);
  const before = f.scenario.snapshot();
  assert.deepEqual(f.advance(30, null), before);
  assert.equal(f.advance(0.1, 0).stage, 'analysis');
  assert.equal(f.scenario.step(10_000, sample(0)).stage, 'analysis');
});

void test('fresh Bluetooth wins, stale/unavailable host falls back and recovery takes priority', () => {
  const local = sample(0.7, 12.9);
  const remote = { ...sample(0, 10), phase: 'ready' as const };
  assert.equal(selectMotion(remote, local, 12.99).source, 'bluetooth');
  assert.equal(selectMotion(remote, local, 13).source, 'local');
  assert.equal(selectMotion({ ...remote, phase: 'unavailable', receivedAt: 13 }, local, 13).source, 'local');
  assert.equal(selectMotion({ ...remote, receivedAt: 13.1 }, local, 13.1).source, 'bluetooth');
  assert.equal(selectMotion(null, local, 14).source, 'none');
});
