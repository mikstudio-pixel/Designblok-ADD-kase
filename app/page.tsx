'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowDownRight, MoveUpRight, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FluidBowl } from '@/lib/fluid';
import { clampTilt, type Tilt } from '@/lib/tilt';
import { registerPrototypeTools } from '@/lib/prototype-tools';
import { AsciiBowl } from '@/components/ascii-bowl';

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<FluidBowl | null>(null);
  const padRef = useRef<HTMLButtonElement>(null);
  const activePointer = useRef<number | null>(null);
  const [tilt, setTilt] = useState<Tilt>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  const updateTilt = (next: Tilt) => {
    const value = clampTilt(next);
    setTilt(value);
    engineRef.current?.setTilt(value);
  };
  const release = () => {
    activePointer.current = null;
    setDragging(false);
    updateTilt({ x: 0, y: 0 });
  };

  useEffect(() => registerPrototypeTools(
    (value) => { setTilt(value); engineRef.current?.setTilt(value); },
    () => { if (!engineRef.current || error) throw new Error('Simulace není připravená.'); engineRef.current.reset(); },
  ), [error]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let engine: FluidBowl | null = null;
    const lost = (event: Event) => {
      event.preventDefault(); engine?.dispose(); setReady(false);
      setError('Grafika byla přerušena. Obnov stránku a zkus to znovu.');
    };
    const blurred = () => {
      activePointer.current = null; setDragging(false); setTilt({ x: 0, y: 0 });
      engine?.setTilt({ x: 0, y: 0 });
    };
    try {
      engine = new FluidBowl(canvas); engineRef.current = engine;
      // eslint-disable-next-line react/react-compiler -- Reflect successful initialization of the external WebGL engine.
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

  const movePointer = (clientX: number, clientY: number) => {
    const box = padRef.current?.getBoundingClientRect();
    if (!box) return;
    updateTilt({ x: ((clientX - box.left) / box.width - 0.5) * 2.25, y: ((clientY - box.top) / box.height - 0.5) * 2.25 });
  };

  return (
    <main className="lab">
      <header className="masthead">
        <Link href={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/`} className="wordmark" aria-label="Mícháš, úvod">MÍCHÁŠ<span>?</span></Link>
        <div className="edition"><span className="status-dot" />POHYBOVÁ STUDIE <span className="edition-no">/ 01</span></div>
      </header>
      <div className="experiment">
        <section className="bowl-section" aria-label="Interaktivní mísa kaše">
          <div className="section-caption"><span>01 / OBSAH TÁCU</span><span>POHLED SHORA <ArrowDownRight size={14} /></span></div>
          <div className="bowl-stage">
            <div className="bowl-frame" style={{ transform: `perspective(1100px) rotateX(${-tilt.y * 5}deg) rotateY(${tilt.x * 5}deg)` }}>
              <div className="bowl-rim">
                <canvas ref={canvasRef} className="fluid-canvas" aria-label="Monochromatická kaše s trvalými hrudkami a olejovou vrstvou, která se objevuje po zklidnění." />
                {!ready && !error && <output className="canvas-message">Připravuji porci…</output>}
                {error && <div className="canvas-message error" role="alert"><p>{error}</p><p>Prototyp potřebuje WebGL 2 a zapnutou hardwarovou akceleraci.</p></div>}
              </div>
            </div>
            <span className="bowl-mark mark-top" aria-hidden="true">N</span><span className="bowl-mark mark-bottom" aria-hidden="true">S</span><span className="bowl-mark mark-left" aria-hidden="true">W</span><span className="bowl-mark mark-right" aria-hidden="true">E</span>
          </div>
          <div className="bowl-footer"><span className="material-label"><i />KRUPICE / HRUDKY / OLEJ</span><Button variant="ghost" onClick={() => engineRef.current?.reset()} disabled={!ready} className="portion-button"><RotateCcw size={16} />Nová porce</Button></div>
        </section>
        <section className="control-section" aria-labelledby="control-title">
          <div className="section-caption">02 / VIRTUÁLNÍ NÁKLON</div>
          <div className="control-intro"><h1 id="control-title">Rozhýbej<br />kaši<span>.</span></h1><p>Táhni bodem po plošce.<br />Kroužením tácu ji promícháš.</p></div>
          <button
            ref={padRef} type="button" disabled={!ready} className={`tilt-pad ${dragging ? 'is-dragging' : ''}`}
            aria-label="Ovládání náklonu tácu. Táhni myší nebo použij šipky. Mezerník náklon vyrovná." aria-describedby="pad-help"
            onPointerDown={(event) => {
              if ((event.pointerType === 'mouse' && event.button !== 0) || activePointer.current !== null) return;
              event.preventDefault(); activePointer.current = event.pointerId;
              event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.focus();
              setDragging(true); movePointer(event.clientX, event.clientY);
            }}
            onPointerMove={(event) => { if (event.pointerId === activePointer.current) movePointer(event.clientX, event.clientY); }}
            onPointerUp={(event) => { if (event.pointerId === activePointer.current) release(); }}
            onPointerCancel={release} onLostPointerCapture={release} onBlur={release}
            onKeyDown={(event) => {
              const directions: Record<string, Tilt> = { ArrowLeft: { x: -0.13, y: 0 }, ArrowRight: { x: 0.13, y: 0 }, ArrowUp: { x: 0, y: -0.13 }, ArrowDown: { x: 0, y: 0.13 } };
              const direction = directions[event.key];
              if (direction) { event.preventDefault(); updateTilt({ x: tilt.x + direction.x, y: tilt.y + direction.y }); }
              if (event.key === ' ' || event.key === 'Escape') { event.preventDefault(); release(); }
            }}
          >
            <span className="pad-axis axis-x" /><span className="pad-axis axis-y" /><span className="pad-orbit" /><span className="pad-center" />
            <svg className="pad-vector" viewBox="0 0 100 100" aria-hidden="true"><line x1="50" y1="50" x2={50 + tilt.x * 43} y2={50 + tilt.y * 43} /></svg>
            <span className="pad-label pad-north">VPŘED</span><span className="pad-label pad-south">K SOBĚ</span>
            <span className="pad-handle" style={{ left: `${50 + tilt.x * 43}%`, top: `${50 + tilt.y * 43}%` }}><MoveUpRight size={21} /></span>
          </button>
          <div className="tilt-readings" aria-hidden="true"><div><span>OSA X</span><strong>{tilt.x >= 0 ? '+' : '−'}{Math.abs(tilt.x * 18).toFixed(1)}<small>°</small></strong></div><div><span>OSA Y</span><strong>{tilt.y >= 0 ? '+' : '−'}{Math.abs(tilt.y * 18).toFixed(1)}<small>°</small></strong></div></div>
          <p id="pad-help" className="pad-help">Po puštění se tác vyrovná.<br />Hrudky zůstávají. Olej vyplouvá.</p>
          <AsciiBowl engine={engineRef} />
        </section>
      </div>
      <footer className="lab-footer"><span>DESIGNBLOK / INTERAKČNÍ PROTOTYP</span><span>NÁKLON MYŠÍ <span className="footer-separator">·</span> FYZICKÉ SENZORY ZATÍM VYPNUTÉ</span></footer>
    </main>
  );
}
