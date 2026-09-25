/* oxlint-disable next/no-img-element -- Offline WKWebView has no Next image server. */
import { useEffect, useSyncExternalStore } from 'react';
import Home from '@/app/page';
import { nativeCommand, type TrayPhase, type TraySync } from '@/lib/native-host';
import type { DisplayRole } from '@/lib/display-calibration';
import { CalibrationPanel, useDisplayCalibration } from './display-calibration';
import leftArtwork from './artwork/left-standby.svg';
import rightArtwork from './artwork/right-standby.svg';
import './installation.css';

const fallback: TraySync = { role: 'standalone', code: '', message: '', peers: 0 };
// Serve the offline build locally with ?display=left or ?display=right.
// A native role always takes precedence over this browser preview.
const previewRole = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('display');
const browserPreview: TraySync = previewRole === 'left' || previewRole === 'right'
  ? { ...fallback, role: previewRole, preview: true } : fallback;
const snapshot = () => window.__michasNative?.sync ?? browserPreview;
const subscribe = (changed: () => void) => {
  window.addEventListener('michas:sync', changed);
  return () => window.removeEventListener('michas:sync', changed);
};

const liveInstructions: Partial<Record<TrayPhase, { title: string; action: string }>> = {
  mixing: { title: 'MÍCHÁŠ.', action: 'NAKLÁNĚJ TÁC' },
  settling: { title: 'NECH TO\nUSTÁLIT.', action: 'VRAŤ TÁC DO ROVINY' },
  unavailable: { title: 'ČEKÁM NA\nSPOJENÍ.', action: 'CHVILKU STRPENÍ' },
};

function SideDisplay({ role, sync }: { role: DisplayRole; sync: TraySync }) {
  const settings = useDisplayCalibration(role);
  const { x, y, scale } = settings.calibration;
  const phase = sync.preview ? 'ready' : sync.telemetry?.phase ?? 'unavailable';
  const instruction = liveInstructions[phase];
  const detected = phase === 'mixing' || phase === 'settling';
  return <main className="tray-display" aria-label={role === 'left' ? 'Levý displej · informace o misi' : 'Pravý displej · instrukce'}>
    <div className="tray-artwork" style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})` }}>
      <img src={role === 'left' ? leftArtwork : rightArtwork} width={744} height={1073} draggable={false}
        alt={role === 'left' ? 'DIGITÁL — Ateliér digitální design. Informace o misi: 20 let; BcA 3 roky, MgA 2 roky. Cílová destinace ADD Zlín, 253 km. Přijímačky za 3 měsíce. Kolonie ADD: motivace vysoká, inspirace fantastická, průměrný spánek 5 hodin, stav kuchyňky kritický, vybavení top strop, stav kávovaru plesnivý.' : 'Biosignál nedetekován. Instrukce: Mícháš nebo nemícháš? Zvedni tác.'}
        aria-hidden={role === 'right' && !!instruction ? true : undefined} />
      {role === 'right' && instruction && <>
        <div className="tray-live-biosignal">BIOSIGNÁL <span>{'/////'}</span> {detected ? 'DETEKOVÁN' : 'NEDETEKOVÁN'}<small>++++++++++++++++----------------------</small></div>
        <section className="tray-live-instruction" aria-live="polite">
          <div className="tray-section-label">INSTRUKCE</div>
          <h1>{instruction.title}</h1>
          <p><span>&gt;&gt;&gt;</span> {instruction.action} <span>&lt;&lt;&lt;</span></p>
        </section>
      </>}
    </div>
    <CalibrationPanel role={role} sync={sync} {...settings} />
  </main>;
}

export function InstallationApp() {
  const sync = useSyncExternalStore(subscribe, snapshot, () => fallback);
  useEffect(() => { nativeCommand('ready'); }, []);
  if (sync.role === 'standalone') return <Home />;
  if (sync.role === 'host') return <>
    {!sync.preview && <output className="tray-connection">{sync.message}</output>}
    <Home />
  </>;
  return <SideDisplay key={sync.role} role={sync.role} sync={sync} />;
}
