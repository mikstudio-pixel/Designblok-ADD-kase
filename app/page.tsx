'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FluidBowl, WAVE_STRENGTH, WAVE_VISCOSITY, type FluidStats, type RimMode } from '@/lib/fluid';
import { AppRefresh } from '@/components/app-refresh';
import { APP_VERSION } from '@/lib/app-version';
import { clampTilt, type Tilt } from '@/lib/tilt';
import { registerPrototypeTools } from '@/lib/prototype-tools';
import { DeviceTilt, SENSORS_OFF, type SensorState } from '@/lib/device-tilt';

const LED_COUNT = 24;
const LED_ANGLES = Array.from({ length: LED_COUNT }, (_, index) => index * 360 / LED_COUNT);
// Rounded annular rectangles: both long sides follow the bowl's circumference.
const LED_SHAPE = (() => {
  const outer = 97.3, inner = 93.7, corner = 0.7;
  const halfAngle = Math.PI / LED_COUNT * 0.91, cornerAngle = corner / 95.5;
  const point = (radius: number, angle: number) => `${(100 + radius * Math.sin(angle)).toFixed(4)} ${(100 - radius * Math.cos(angle)).toFixed(4)}`;
  return [
    `M ${point(outer, -halfAngle + cornerAngle)}`,
    `A ${outer} ${outer} 0 0 1 ${point(outer, halfAngle - cornerAngle)}`,
    `Q ${point(outer, halfAngle)} ${point(outer - corner, halfAngle)}`,
    `L ${point(inner + corner, halfAngle)}`,
    `Q ${point(inner, halfAngle)} ${point(inner, halfAngle - cornerAngle)}`,
    `A ${inner} ${inner} 0 0 0 ${point(inner, -halfAngle + cornerAngle)}`,
    `Q ${point(inner, -halfAngle)} ${point(inner + corner, -halfAngle)}`,
    `L ${point(outer - corner, -halfAngle)}`,
    `Q ${point(outer, -halfAngle)} ${point(outer, -halfAngle + cornerAngle)} Z`,
  ].join(' ');
})();

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<FluidBowl | null>(null);
  const deviceTiltRef = useRef<DeviceTilt | null>(null);
  const bowlRef = useRef<HTMLButtonElement>(null);
  const activePointer = useRef<number | null>(null);
  const pointerType = useRef('');
  const liveTilt = useRef<Tilt>({ x: 0, y: 0 });
  const tiltUiTime = useRef(0);
  const waveSettings = useRef({ strength: WAVE_STRENGTH.default as number, viscosity: WAVE_VISCOSITY.default as number });
  const initialized = useRef(false);
  const [tilt, setTilt] = useState<Tilt>({ x: 0, y: 0 });
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [rimMode, setRimMode] = useState<RimMode>('curved');
  const [waveStrength, setWaveStrength] = useState<number>(WAVE_STRENGTH.default);
  const [waveViscosity, setWaveViscosity] = useState<number>(WAVE_VISCOSITY.default);
  const [quality, setQuality] = useState<'auto' | 'performance' | 'detail'>('detail');
  const [stats, setStats] = useState<FluidStats | null>(null);
  const [sensor, setSensor] = useState<SensorState>(SENSORS_OFF);
  const sensorEngaged = sensor.phase !== 'off' && sensor.phase !== 'error';
  const strength = Math.min(1, Math.hypot(tilt.x, tilt.y));
  // Lift subtle tilts without a fixed on/off brightness jump. Both layers
  // grow continuously from neutral, so the halo also communicates small motion.
  const brightness = Math.pow(strength, 0.3);
  const peakGlow = Math.pow(strength, 0.85);
  const direction = (Math.atan2(tilt.x, -tilt.y) + Math.PI * 2) % (Math.PI * 2);
  const activeLed = strength > 0 ? Math.round(direction / (Math.PI * 2) * LED_COUNT) % LED_COUNT : -1;

  const updateTilt = useCallback((next: Tilt, throttleUi = false) => {
    const value = clampTilt(next);
    liveTilt.current = value;
    engineRef.current?.setTilt(value);
    const now = performance.now();
    // Sensors still feed every sample to the solver. LED/UI updates need
    // only 30 Hz; avoid rerendering the whole React tree for every sensor event.
    if (!throttleUi || now - tiltUiTime.current >= 1000 / 30 || (value.x === 0 && value.y === 0)) {
      tiltUiTime.current = now; setTilt(value);
    }
  }, []);
  const release = () => {
    activePointer.current = null;
    if (!sensorEngaged) updateTilt({ x: 0, y: 0 });
  };
  const movePointer = (clientX: number, clientY: number) => {
    const box = bowlRef.current?.getBoundingClientRect();
    if (box) updateTilt({ x: ((clientX - box.left) / box.width - 0.5) * 2.25, y: ((clientY - box.top) / box.height - 0.5) * 2.25 });
  };

  useEffect(() => {
    const device = new DeviceTilt((value) => updateTilt(value, true), setSensor);
    deviceTiltRef.current = device;
    return () => { device.dispose(); deviceTiltRef.current = null; };
  }, [updateTilt]);

  useEffect(() => registerPrototypeTools(
    (value) => { deviceTiltRef.current?.stop(); updateTilt(value); },
    () => { if (!engineRef.current || error) throw new Error('Simulace není připravená.'); engineRef.current.reset(); },
  ), [error, updateTilt]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let engine: FluidBowl | null = null;
    const lost = (event: Event) => {
      event.preventDefault(); engine?.dispose(); setReady(false);
      deviceTiltRef.current?.stop();
      setError('Grafika byla přerušena. Obnov aplikaci.');
    };
    const blurred = () => {
      activePointer.current = null; updateTilt({ x: 0, y: 0 });
    };
    try {
      const params = new URLSearchParams(window.location.search);
      const resolution = params.get('sim') === '160' ? 160 : params.get('sim') === '192' ? 192 : params.get('sim') === '256' ? 256 : params.get('sim') === '384' ? 384 : undefined;
      const profile = quality === 'auto' ? (navigator.maxTouchPoints > 1 ? 'performance' : 'detail') : quality;
      if (!initialized.current) {
        waveSettings.current.strength = params.get('waves') === 'original' ? WAVE_STRENGTH.min : WAVE_STRENGTH.default;
        initialized.current = true;
      }
      engine = new FluidBowl(canvas, {
        resolution, quality: profile, onStats: setStats, automaticCrests: true, stirring: params.get('stir') !== '0', dissolving: params.get('dissolve') !== '0', organicSeparation: params.get('organic') !== '0',
        boundary: params.get('boundary') === 'previous' ? 'previous' : 'merged',
        waves: params.get('waves') === 'original' ? 'original' : 'higher',
      });
      engine.setWaveStrength(waveSettings.current.strength);
      engine.setWaveViscosity(waveSettings.current.viscosity);
      engine.setTilt(liveTilt.current);
      engineRef.current = engine;
      // eslint-disable-next-line react/react-compiler -- Match the control to the initial URL setting used by the external engine.
      setWaveStrength(waveSettings.current.strength);
      // eslint-disable-next-line react/react-compiler -- Reflect initialization of the external WebGL engine.
      setReady(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Simulaci se nepodařilo spustit.');
    }
    canvas.addEventListener('webglcontextlost', lost);
    window.addEventListener('blur', blurred);
    return () => {
      engine?.dispose(); engineRef.current = null;
      canvas.removeEventListener('webglcontextlost', lost);
      window.removeEventListener('blur', blurred);
    };
  }, [quality, updateTilt]);

  useEffect(() => { engineRef.current?.setRimMode(rimMode); }, [rimMode, ready, quality]);

  return (
    <main className="installation" data-version={APP_VERSION}>
      <AppRefresh />
      <div className="wave-control">
        <label htmlFor="wave-strength">Vlny <output htmlFor="wave-strength">{waveStrength.toFixed(2).replace('.', ',')}×</output></label>
        <input
          id="wave-strength" type="range" min={WAVE_STRENGTH.min} max={WAVE_STRENGTH.max} step={WAVE_STRENGTH.step}
          value={waveStrength} disabled={!ready} aria-valuetext={`${waveStrength.toFixed(2).replace('.', ',')} násobek původní síly`}
          onChange={(event) => {
            const value = event.currentTarget.valueAsNumber;
            waveSettings.current.strength = value; setWaveStrength(value); engineRef.current?.setWaveStrength(value);
          }}
        />
        <label htmlFor="wave-viscosity" title="Vyšší viskozita zjemňuje drobné vlny a rozšiřuje hřebeny.">Viskozita <output htmlFor="wave-viscosity">{waveViscosity.toFixed(1).replace('.', ',')}×</output></label>
        <input
          id="wave-viscosity" type="range" min={WAVE_VISCOSITY.min} max={WAVE_VISCOSITY.max} step={WAVE_VISCOSITY.step}
          value={waveViscosity} disabled={!ready} aria-valuetext={`${waveViscosity.toFixed(1).replace('.', ',')} násobek původní viskozity`}
          onChange={(event) => {
            const value = event.currentTarget.valueAsNumber;
            waveSettings.current.viscosity = value; setWaveViscosity(value); engineRef.current?.setWaveViscosity(value);
          }}
        />
        <label className="quality-control" htmlFor="fluid-quality">Režim
          <select id="fluid-quality" value={quality} title="Změna režimu připraví novou porci; hodnoty sliderů zůstanou." onChange={(event) => {
            setStats(null); setQuality(event.currentTarget.value as typeof quality);
          }}>
            <option value="auto">Automaticky</option><option value="performance">Úsporný</option><option value="detail">Detailní</option>
          </select>
        </label>
        <output className="performance-status" aria-live="off">{stats ? `${stats.fps} FPS · ${stats.quality === 'performance' ? 'úsporný' : 'detailní'}` : 'Měřím FPS…'}</output>
      </div>
      <fieldset className="rim-switcher" aria-label="Okraj hladiny" disabled={!ready}>
        <button type="button" aria-pressed={rimMode === 'curved'} onClick={() => setRimMode('curved')}>Plynulý okraj</button>
        <button type="button" aria-pressed={rimMode === 'under'} onClick={() => setRimMode('under')}>Pod okrajem</button>
        <button type="button" aria-pressed={rimMode === 'hybrid'} onClick={() => setRimMode('hybrid')}>Kompromis</button>
        <button type="button" aria-pressed={rimMode === 'edge'} onClick={() => setRimMode('edge')}>U okraje</button>
      </fieldset>
      <button
        ref={bowlRef} type="button" className="bowl" disabled={!ready}
        aria-label="Interaktivní mísa kaše. Klepnutím zapni pohyb iPadu, dvojím klepnutím nastav rovinu. Myší táhni po míse nebo použij šipky."
        onClick={() => {
          // Keep the iOS permission request directly inside the user gesture.
          if (!sensorEngaged && pointerType.current !== 'mouse') void deviceTiltRef.current?.start();
        }}
        onDoubleClick={() => { if (sensor.phase === 'active') deviceTiltRef.current?.calibrate(); }}
        onPointerDown={(event) => {
          pointerType.current = event.pointerType;
          if (sensorEngaged || (event.pointerType === 'mouse' && event.button !== 0) || activePointer.current !== null) return;
          // Touch starts motion through click; a desktop mouse controls the tray directly.
          if (event.pointerType !== 'mouse' && window.DeviceOrientationEvent) return;
          event.preventDefault(); activePointer.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.focus();
          movePointer(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => { if (event.pointerId === activePointer.current) movePointer(event.clientX, event.clientY); }}
        onPointerUp={(event) => { if (event.pointerId === activePointer.current) release(); }}
        onPointerCancel={release} onLostPointerCapture={release} onBlur={release}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') pointerType.current = '';
          const directions: Record<string, Tilt> = { ArrowLeft: { x: -0.13, y: 0 }, ArrowRight: { x: 0.13, y: 0 }, ArrowUp: { x: 0, y: -0.13 }, ArrowDown: { x: 0, y: 0.13 } };
          const direction = directions[event.key];
          if (direction && !sensorEngaged) { event.preventDefault(); updateTilt({ x: liveTilt.current.x + direction.x, y: liveTilt.current.y + direction.y }); }
          if (event.key === 'Escape') { event.preventDefault(); deviceTiltRef.current?.stop(); updateTilt({ x: 0, y: 0 }); }
          if (event.key.toLowerCase() === 'c') deviceTiltRef.current?.calibrate();
          if (event.key.toLowerCase() === 'o') deviceTiltRef.current?.rotateAxes();
          if (event.key.toLowerCase() === 'r') engineRef.current?.reset();
        }}
      >
        <span className="fluid-window" data-rim-mode={rimMode}>
          <canvas ref={canvasRef} className="fluid-canvas" aria-label="Světlá a tmavá kapalina se mícháním postupně spojují." />
        </span>
        <svg className="tilt-ring" viewBox="0 0 200 200" aria-hidden="true">
          {LED_ANGLES.map((angle, index) => (
            <g key={index} transform={`rotate(${angle} 100 100)`}>
              <path d={LED_SHAPE} className="led-housing" />
              <path d={LED_SHAPE} className="led-light" data-led={index} opacity={index === activeLed ? brightness : 0} />
              <path d={LED_SHAPE} className="led-peak" opacity={index === activeLed ? peakGlow : 0} />
            </g>
          ))}
        </svg>
      </button>
      {error && <p className="installation-error" role="alert">{error}</p>}
      {!error && sensor.phase === 'error' && <p className="installation-error" role="alert">{sensor.message} Klepnutím na mísu zkus přístup znovu.</p>}
      <output className="sr-only">{!ready ? 'Připravuji porci.' : sensorEngaged ? sensor.message : 'Klepni na mísu a povol pohyb. Myší můžeš táhnout přímo po míse.'}</output>
    </main>
  );
}
