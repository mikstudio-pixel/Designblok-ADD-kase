import { useEffect, useRef, useState } from 'react';
import { isNativeHost, isNativePaused, nativeCommand, type GyroAngles, type NativeMotion, type TraySync } from '@/lib/native-host';
import { MixingScenario, selectMotion, type MotionInput, type MotionSample, type ScenarioStage } from '@/lib/mixing-scenario';

type Demo = 'live' | 'mix' | 'still';
const time = () => performance.now() / 1000;
const angleDifference = (a: number, b: number) => ((a - b + 540) % 360) - 180;

export function useSideScenario(sync: TraySync) {
  const machine = useRef(new MixingScenario());
  const local = useRef<MotionSample | null>(null);
  const remote = useRef<(MotionSample & { phase: NonNullable<TraySync['telemetry']>['phase'] }) | null>(null);
  const mode = useRef<{ demo: Demo; started: number; frozen: ScenarioStage | null }>({ demo: 'live', started: 0, frozen: null });
  const [view, setView] = useState(() => ({ scenario: new MixingScenario().snapshot(), input: { source: 'none', sample: null } as MotionInput, demo: 'live' as Demo, frozen: null as ScenarioStage | null }));
  const [sensorError, setSensorError] = useState('');

  useEffect(() => {
    remote.current = sync.telemetry ? { gyro: sync.telemetry.gyro ?? null, activity: sync.telemetry.activity, phase: sync.telemetry.phase, receivedAt: time() } : null;
  }, [sync]);

  useEffect(() => {
    const nativeMotion = (event: Event) => {
      const sample = (event as CustomEvent<NativeMotion>).detail;
      if (sample.gyro && Object.values(sample.gyro).every(Number.isFinite) && Number.isFinite(sample.activity)) {
        local.current = { gyro: sample.gyro, activity: Math.max(0, Math.min(1, sample.activity!)), receivedAt: time() };
      }
    };
    const orientation = (event: DeviceOrientationEvent) => {
      if (isNativeHost() || event.beta === null || event.gamma === null || event.alpha === null) return;
      const gyro: GyroAngles = { x: event.beta, y: event.gamma, z: ((event.alpha + 180) % 360) - 180 };
      if (!Object.values(gyro).every(Number.isFinite)) return;
      const now = time(), previous = local.current;
      const dt = previous ? now - previous.receivedAt : 0;
      const speed = previous?.gyro && dt > 0 && dt < 0.5 ? Math.hypot(...(['x', 'y', 'z'] as const).map(axis => angleDifference(gyro[axis], previous.gyro![axis]))) / dt : 0;
      local.current = { gyro, activity: Math.min(1, speed / 45), receivedAt: now };
    };
    const error = () => { local.current = null; setSensorError('Gyroskop není dostupný.'); };
    const resetAfterPause = () => {
      local.current = null;
      if (document.hidden || isNativePaused()) machine.current.reset();
    };
    window.addEventListener('michas:motion', nativeMotion);
    window.addEventListener('michas:motion-error', error);
    window.addEventListener('deviceorientation', orientation);
    window.addEventListener('michas:power', resetAfterPause);
    document.addEventListener('visibilitychange', resetAfterPause);
    nativeCommand('tilt', true);
    const timer = window.setInterval(() => {
      const now = time();
      const input = selectMotion(remote.current, local.current, now);
      const { demo, started, frozen } = mode.current;
      let sample = input.sample;
      if (demo !== 'live') {
        const elapsed = now - started;
        const activity = elapsed < 0.8 || (demo === 'mix' && elapsed > 8) ? 0.7 : 0;
        sample = { gyro: { x: Math.sin(elapsed * 3) * activity * 20, y: Math.cos(elapsed * 3) * activity * 15, z: Math.sin(elapsed) * activity * 12 }, activity, receivedAt: now };
      }
      const paused = document.hidden || isNativePaused();
      const scenario = machine.current.step(now, paused || frozen ? null : sample);
      setView({ scenario: frozen ? { ...scenario, stage: frozen } : scenario, input: { ...input, sample }, demo, frozen });
    }, 100);
    return () => {
      clearInterval(timer);
      nativeCommand('tilt', false);
      window.removeEventListener('michas:motion', nativeMotion);
      window.removeEventListener('michas:motion-error', error);
      window.removeEventListener('deviceorientation', orientation);
      window.removeEventListener('michas:power', resetAfterPause);
      document.removeEventListener('visibilitychange', resetAfterPause);
    };
  }, []);

  async function enableBrowserMotion() {
    try {
      const orientation = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };
      if (!orientation) { setSensorError('Tento prohlížeč nemá gyroskop. Použijte ukázku scénáře.'); return; }
      if (orientation.requestPermission && await orientation.requestPermission() !== 'granted') { setSensorError('Přístup k pohybu nebyl povolen.'); return; }
      setSensorError('');
    } catch { setSensorError('Gyroskop se nepodařilo povolit.'); }
  }
  function start(demo: Demo) {
    machine.current.reset();
    mode.current = { demo, started: time(), frozen: null };
  }
  function freeze(stage: ScenarioStage | null) {
    machine.current.reset();
    mode.current = { demo: 'live', started: 0, frozen: stage };
  }
  return { ...view, sensorError, enableBrowserMotion, start, freeze };
}
