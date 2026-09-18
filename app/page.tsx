'use client';

import { useEffect, useRef, useState } from 'react';
import { FluidBowl } from '@/lib/fluid';
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
  const [tilt, setTilt] = useState<Tilt>({ x: 0, y: 0 });
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [sensor, setSensor] = useState<SensorState>(SENSORS_OFF);
  const sensorEngaged = sensor.phase !== 'off' && sensor.phase !== 'error';
  const strength = Math.min(1, Math.hypot(tilt.x, tilt.y));
  const brightness = Math.pow(strength, 0.45);
  const peakRamp = Math.max(0, (strength - 0.75) / 0.25);
  const peakGlow = peakRamp * peakRamp * (3 - 2 * peakRamp);
  const direction = (Math.atan2(tilt.x, -tilt.y) + Math.PI * 2) % (Math.PI * 2);
  const activeLed = strength > 0.001 ? Math.round(direction / (Math.PI * 2) * LED_COUNT) % LED_COUNT : -1;

  const updateTilt = (next: Tilt) => {
    const value = clampTilt(next);
    setTilt(value);
    engineRef.current?.setTilt(value);
  };
  const release = () => {
    activePointer.current = null;
    if (!sensorEngaged) updateTilt({ x: 0, y: 0 });
  };
  const movePointer = (clientX: number, clientY: number) => {
    const box = bowlRef.current?.getBoundingClientRect();
    if (box) updateTilt({ x: ((clientX - box.left) / box.width - 0.5) * 2.25, y: ((clientY - box.top) / box.height - 0.5) * 2.25 });
  };

  useEffect(() => {
    const device = new DeviceTilt((value) => { setTilt(value); engineRef.current?.setTilt(value); }, setSensor);
    deviceTiltRef.current = device;
    return () => { device.dispose(); deviceTiltRef.current = null; };
  }, []);

  useEffect(() => registerPrototypeTools(
    (value) => { deviceTiltRef.current?.stop(); setTilt(value); engineRef.current?.setTilt(value); },
    () => { if (!engineRef.current || error) throw new Error('Simulace není připravená.'); engineRef.current.reset(); },
  ), [error]);

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
      activePointer.current = null; setTilt({ x: 0, y: 0 }); engine?.setTilt({ x: 0, y: 0 });
    };
    try {
      engine = new FluidBowl(canvas); engineRef.current = engine;
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
  }, []);

  return (
    <main className="installation" data-version="2026.09.18.4">
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
          const brightness = Math.pow(strength, 0.45);
  const peakRamp = Math.max(0, (strength - 0.75) / 0.25);
  const peakGlow = peakRamp * peakRamp * (3 - 2 * peakRamp);
  const direction = directions[event.key];
          if (direction && !sensorEngaged) { event.preventDefault(); updateTilt({ x: tilt.x + direction.x, y: tilt.y + direction.y }); }
          if (event.key === 'Escape') { event.preventDefault(); deviceTiltRef.current?.stop(); updateTilt({ x: 0, y: 0 }); }
          if (event.key.toLowerCase() === 'c') deviceTiltRef.current?.calibrate();
          if (event.key.toLowerCase() === 'o') deviceTiltRef.current?.rotateAxes();
          if (event.key.toLowerCase() === 'r') engineRef.current?.reset();
        }}
      >
        <canvas ref={canvasRef} className="fluid-canvas" aria-label="Monochromatická krupicová kaše s kakaem, čokoládou a olejem." />
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
      <span className="sr-only" role="status">{!ready ? 'Připravuji porci.' : sensorEngaged ? sensor.message : 'Klepni na mísu a povol pohyb. Myší můžeš táhnout přímo po míse.'}</span>
    </main>
  );
}
