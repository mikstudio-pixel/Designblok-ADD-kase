import { useEffect, useSyncExternalStore } from 'react';
import Home from '@/app/page';
import { nativeCommand, type TrayPhase, type TraySync } from '@/lib/native-host';
import './installation.css';

const fallback: TraySync = { role: 'standalone', code: '', message: '', peers: 0 };
const snapshot = () => window.__michasNative?.sync ?? fallback;
const subscribe = (changed: () => void) => {
  window.addEventListener('michas:sync', changed);
  return () => window.removeEventListener('michas:sync', changed);
};
const phases: Record<TrayPhase, { label: string; instruction: string }> = {
  ready: { label: 'Připraveno', instruction: 'Zvedni tác a pomalu ho nakláněj.' },
  mixing: { label: 'Mícháš', instruction: 'Sleduj, jak se kaše pohybuje s tácem.' },
  settling: { label: 'Zklidnění', instruction: 'Vrať tác do roviny a nech kaši ustálit.' },
  sleeping: { label: 'Odpočinek', instruction: 'Pohybem tácu nebo dotykem probudíš instalaci.' },
  unavailable: { label: 'Čekám na simulaci', instruction: 'Zkontrolujte prostřední iPad.' },
};
const percent = (value: number) => `${Math.round(value * 100)} %`;
const signed = (value: number) => value.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function InstallationApp() {
  const sync = useSyncExternalStore(subscribe, snapshot, () => fallback);
  useEffect(() => { nativeCommand('ready'); }, []);

  if (sync.role === 'standalone') return <Home />;
  if (sync.role === 'host') return (
    <>
      <output className="tray-connection">{sync.message}</output>
      <Home />
    </>
  );

  const state = sync.telemetry;
  const available = state && state.phase !== 'unavailable' && state.phase !== 'sleeping';
  const phase = state ? phases[state.phase] : { label: 'Čekám na spojení', instruction: 'Přibližte prostřední iPad. Propojení se obnoví automaticky.' };
  return (
    <main className="tray-display">
      <header className="tray-header">
        <span className="wordmark">MÍCHÁŠ<span>?</span></span>
        <span>{sync.role === 'left' ? '01 / POHYB' : '03 / PRŮBĚH'}</span>
      </header>
      {sync.role === 'left' ? (
        <section className="tray-metrics" aria-label="Hodnoty simulace prostředního iPadu">
          <div className="tray-primary-metric">
            <p>AKTIVITA MÍCHÁNÍ</p>
            <strong>{available ? percent(state.activity) : '—'}</strong>
          </div>
          <dl className="tray-values">
            <div><dt>Náklon X</dt><dd>{available ? signed(state.tiltX) : '—'}</dd></div>
            <div><dt>Náklon Y</dt><dd>{available ? signed(state.tiltY) : '—'}</dd></div>
            <div><dt>Čas simulace</dt><dd>{available ? `${Math.floor(state.elapsed)} s` : '—'}</dd></div>
          </dl>
          <p className="tray-note">Náklon −1 až 1 · Aktivita je relativní ukazatel simulace.</p>
        </section>
      ) : (
        <section className="tray-phase" aria-live="polite">
          <p>FÁZE</p>
          <h1>{phase.label}</h1>
          <p className="tray-instruction">{phase.instruction}</p>
        </section>
      )}
      <footer className="tray-footer">
        <output>{sync.message}</output>
        {sync.role === 'left' && <span>{phase.label}</span>}
      </footer>
    </main>
  );
}
