/* oxlint-disable next/no-img-element -- Offline WKWebView has no Next image server. */
import { useEffect, useSyncExternalStore } from 'react';
import Home from '@/app/page';
import { DisplaySwitcher } from '@/components/display-switcher';
import { isNativeHost, nativeCommand, type TraySync } from '@/lib/native-host';
import type { DisplayRole } from '@/lib/display-calibration';
import type { ScenarioStage } from '@/lib/mixing-scenario';
import { CalibrationPanel, useDisplayCalibration } from './display-calibration';
import { useSideScenario } from './use-side-scenario';
import { RightDisplay, SCREENS } from './right-display';
import leftArtwork from './artwork/left-standby.svg';
import './installation.css';

const fallback: TraySync = { role: 'standalone', code: '', message: '', peers: 0 };
const previewRole = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('display');
const browserPreview: TraySync = previewRole === 'left' || previewRole === 'right'
  ? { ...fallback, role: previewRole, preview: true } : fallback;
const snapshot = () => window.__michasNative?.sync ?? browserPreview;
const subscribe = (callback: () => void) => {
  window.addEventListener('michas:sync', callback);
  return () => window.removeEventListener('michas:sync', callback);
};

function SideDisplay({ role, sync }: { role: DisplayRole; sync: TraySync }) {
  const settings = useDisplayCalibration(role);
  const motion = useSideScenario(sync);
  const { x, y, scale } = settings.calibration;
  const source = motion.demo !== 'live' ? 'Ukázka scénáře' : motion.input.source === 'bluetooth' ? 'Bluetooth · prostřední iPad' : motion.input.source === 'local' ? 'Vlastní gyroskop tohoto iPadu' : 'Čekám na pohybová data';
  return <main className="tray-display" aria-label={role === 'left' ? 'Levý displej · informace o misi' : 'Pravý displej · instrukce'}>
    {!isNativeHost() && <DisplaySwitcher current={role} sidePreview />}
    <div className="tray-artwork" style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})` }}>
      {role === 'left'
        ? <img src={leftArtwork} width={744} height={1073} draggable={false} alt="DIGITÁL — Ateliér digitální design. Informace o misi: 20 let, bakalářské studium 3 roky, magisterské 2 roky. Cílová destinace ADD Zlín. Kolonie ADD." />
        : <RightDisplay scenario={motion.scenario} sample={motion.input.sample} />}
    </div>
    <CalibrationPanel role={role} sync={sync} {...settings}>
      <section className="scenario-controls" aria-label="Pohyb a scénář">
        <output className="scenario-source">Zdroj dat: {source}</output>
        {motion.sensorError && motion.input.source === 'none' && <p>{motion.sensorError}</p>}
        {!isNativeHost() && <button onClick={motion.enableBrowserMotion}>Povolit gyroskop</button>}
        {role === 'right' && <>
          <label>Scénář <select aria-label="Fáze scénáře" value={motion.frozen ?? ''} onChange={event => motion.freeze(event.target.value ? event.target.value as ScenarioStage : null)}>
            <option value="">Automaticky podle pohybu</option>
            {(Object.entries(SCREENS) as [ScenarioStage, typeof SCREENS[ScenarioStage]][]).map(([stage, screen]) => <option key={stage} value={stage}>{screen.title}</option>)}
          </select></label>
          <div className="scenario-demo-buttons"><button onClick={() => motion.start('mix')}>Ukázka: mícháš</button><button onClick={() => motion.start('still')}>Ukázka: nemícháš</button></div>
          <button onClick={() => motion.start('live')}>Znovu podle gyroskopu</button>
          <p>{motion.frozen ? 'Zastavený náhled pro kalibraci.' : SCREENS[motion.scenario.stage].title}</p>
        </>}
      </section>
    </CalibrationPanel>
  </main>;
}

export function InstallationApp() {
  const sync = useSyncExternalStore(subscribe, snapshot, () => fallback);
  useEffect(() => { nativeCommand('ready'); }, []);
  if (sync.role === 'standalone') return <Home sidePreview />;
  if (sync.role === 'host') return <>{!sync.preview && <output className="tray-connection">{sync.message}</output>}<Home sidePreview /></>;
  return <SideDisplay key={sync.role} role={sync.role} sync={sync} />;
}
