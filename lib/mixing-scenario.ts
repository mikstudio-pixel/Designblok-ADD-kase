import type { GyroAngles, TrayTelemetry } from './native-host';

export const SCENARIO = {
  liftThreshold: 0.25, liftSeconds: 0.25, mixingThreshold: 0.18,
  detected: 2, authorized: 1.2, decision: 2, countdown: 3.6,
  analysis: 7, successRatio: 0.5, result: 3, connecting: 2.5,
  welcome: 12, resetQuiet: 8,
} as const;

export type ScenarioStage = 'standby' | 'detected' | 'authorized' | 'decision' | 'countdown'
  | 'analysis' | 'mixing' | 'keep-mixing' | 'not-mixing' | 'stir-prompt'
  | 'success' | 'failure' | 'connecting' | 'welcome';
export type MotionSample = { gyro: GyroAngles | null; activity: number; receivedAt: number };
export type MotionInput = { source: 'bluetooth' | 'local' | 'none'; sample: MotionSample | null };

export function selectMotion(remote: (MotionSample & { phase: TrayTelemetry['phase'] }) | null, local: MotionSample | null, now: number): MotionInput {
  // Match the native inbox's three-second heartbeat timeout. A stale host must
  // never freeze the exhibition when the local sensor is still available.
  if (remote && now - remote.receivedAt < 3 && remote.phase !== 'unavailable') return { source: 'bluetooth', sample: remote };
  if (local && now - local.receivedAt < 1) return { source: 'local', sample: local };
  return { source: 'none', sample: null };
}

export type ScenarioSnapshot = {
  stage: ScenarioStage;
  countdown: number;
  remaining: number;
  progress: number;
  mixed: number;
};

/** One right-hand screen owns the timeline; changing sensor source preserves it. */
export class MixingScenario {
  private phase: 'standby' | 'detected' | 'authorized' | 'decision' | 'countdown' | 'analysis' | 'success' | 'failure' | 'connecting' | 'welcome' = 'standby';
  private elapsed = 0;
  private lifted = 0;
  private activeSeconds = 0;
  private quiet = 0;
  private lastMovement = -Infinity;
  private clock = 0;
  private previousTime: number | null = null;

  reset() {
    this.phase = 'standby'; this.elapsed = 0; this.lifted = 0;
    this.activeSeconds = 0; this.quiet = 0; this.lastMovement = -Infinity;
    this.clock = 0; this.previousTime = null;
  }

  private enter(phase: typeof this.phase) { this.phase = phase; this.elapsed = 0; }

  step(now: number, sample: MotionSample | null): ScenarioSnapshot {
    const delta = this.previousTime === null ? 0 : Math.max(0, Math.min(0.25, now - this.previousTime));
    this.previousTime = now;
    // Pause on missing samples or suspended app, rather than inventing a result.
    if (!sample || !Number.isFinite(sample.activity)) return this.snapshot();
    this.clock += delta;
    this.elapsed += delta;
    const moving = sample.activity >= SCENARIO.mixingThreshold;
    if (moving) this.lastMovement = this.clock;
    this.quiet = moving ? 0 : this.quiet + delta;
    switch (this.phase) {
      case 'standby':
        this.lifted = sample.activity >= SCENARIO.liftThreshold ? this.lifted + delta : 0;
        if (this.lifted >= SCENARIO.liftSeconds) this.enter('detected');
        break;
      case 'detected': if (this.elapsed >= SCENARIO.detected) this.enter('authorized'); break;
      case 'authorized': if (this.elapsed >= SCENARIO.authorized) this.enter('decision'); break;
      case 'decision': if (this.elapsed >= SCENARIO.decision) this.enter('countdown'); break;
      case 'countdown': if (this.elapsed >= SCENARIO.countdown) this.enter('analysis'); break;
      case 'analysis':
        if (moving) this.activeSeconds += delta;
        if (this.elapsed >= SCENARIO.analysis) this.enter(this.activeSeconds >= SCENARIO.analysis * SCENARIO.successRatio ? 'success' : 'failure');
        break;
      case 'success': case 'failure': if (this.elapsed >= SCENARIO.result) this.enter('connecting'); break;
      case 'connecting': if (this.elapsed >= SCENARIO.connecting) this.enter('welcome'); break;
      case 'welcome': if (this.elapsed >= SCENARIO.welcome && this.quiet >= SCENARIO.resetQuiet) this.reset(); break;
    }
    return this.snapshot();
  }

  snapshot(): ScenarioSnapshot {
    let stage: ScenarioStage = this.phase;
    if (this.phase === 'analysis' && this.elapsed >= 2) {
      const recentMovement = this.clock - this.lastMovement < 0.6;
      stage = this.elapsed < 4.5 ? (recentMovement ? 'mixing' : 'not-mixing') : (recentMovement ? 'keep-mixing' : 'stir-prompt');
    }
    const analyzing = this.phase === 'analysis';
    const finished = ['success', 'failure', 'connecting', 'welcome'].includes(this.phase);
    return {
      stage,
      countdown: Math.max(0, 3 - Math.floor(this.elapsed)),
      remaining: analyzing ? Math.max(0, SCENARIO.analysis - this.elapsed) : finished ? 0 : SCENARIO.analysis,
      progress: analyzing ? Math.min(1, this.elapsed / SCENARIO.analysis) : finished ? 1 : 0,
      mixed: Math.min(1, this.activeSeconds / (SCENARIO.analysis * SCENARIO.successRatio)),
    };
  }
}
