import { useEffect, useRef, useState, type ReactNode } from 'react';
import { calibrationKey, DISPLAY_DEFAULTS, normalizeCalibration, readCalibration, type DisplayCalibration, type DisplayRole } from '@/lib/display-calibration';
import type { TraySync } from '@/lib/native-host';

export function useDisplayCalibration(role: DisplayRole) {
  const [calibration, setCalibration] = useState(() => {
    try { return readCalibration(role, localStorage.getItem(calibrationKey(role))); }
    catch { return { ...DISPLAY_DEFAULTS[role] }; }
  });
  const [saved, setSaved] = useState(true);
  function update(value: DisplayCalibration) {
    const next = normalizeCalibration(value);
    setCalibration(next);
    try {
      localStorage.setItem(calibrationKey(role), JSON.stringify(next));
      setSaved(true);
    } catch { setSaved(false); }
  }
  return { calibration, update, saved };
}

export function CalibrationPanel({ role, sync, calibration, update, saved, children }: {
  role: DisplayRole;
  sync: TraySync;
  calibration: DisplayCalibration;
  update: (value: DisplayCalibration) => void;
  saved: boolean;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [dock, setDock] = useState(role === 'left' ? 'right' : 'left');
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const closeButton = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const show = () => setOpen(true);
    const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('michas:calibrate', show);
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('michas:calibrate', show);
      window.removeEventListener('resize', resize);
    };
  }, []);
  useEffect(() => { if (open) closeButton.current?.focus(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [open]);

  const close = () => { setOpen(false); trigger.current?.focus(); };
  const adjust = (key: keyof DisplayCalibration, delta: number) => update({ ...calibration, [key]: calibration[key] + delta });
  return <>
    <button ref={trigger} className="display-calibration-trigger" aria-label="Kalibrace bočního displeje" aria-expanded={open} onClick={() => setOpen(value => !value)} />
    {open && <section className="display-calibration" data-dock={dock} aria-label="Kalibrace displeje">
      <header><h1>{role === 'left' ? 'Levý' : 'Pravý'} displej</h1><button ref={closeButton} onClick={close}>Skrýt</button></header>
      {children}
      <p>Celá grafika · posun od středu displeje</p>
      <div className="calibration-options">
        <label>Krok <select value={step} onChange={event => setStep(Number(event.target.value))}><option value={1}>1 px / 0,1 %</option><option value={10}>10 px / 1 %</option><option value={50}>50 px / 5 %</option></select></label>
        <label>Panel <select value={dock} onChange={event => setDock(event.target.value)}><option value="left">Vlevo</option><option value="right">Vpravo</option></select></label>
      </div>
      {(['x', 'y', 'scale'] as const).map(key => {
        const isScale = key === 'scale';
        const label = isScale ? 'Velikost' : key.toUpperCase();
        const amount = isScale ? step / 1000 : step;
        const value = isScale ? Math.round(calibration.scale * 1000) / 10 : calibration[key];
        return <div className="calibration-value" key={key}>
          <label htmlFor={`calibration-${key}`}>{label}<span>{isScale ? '%' : 'px'}</span></label>
          <button aria-label={`Snížit ${label}`} onClick={() => adjust(key, -amount)}>−</button>
          <input id={`calibration-${key}`} type="number" inputMode="decimal" min={isScale ? 10 : -3000} max={isScale ? 400 : 3000} step={isScale ? 0.1 : 1} value={value} onChange={event => {
            const n = event.currentTarget.valueAsNumber;
            if (Number.isFinite(n)) update({ ...calibration, [key]: isScale ? n / 100 : n });
          }} />
          <button aria-label={`Zvýšit ${label}`} onClick={() => adjust(key, amount)}>+</button>
        </div>;
      })}
      <button className="calibration-reset" onClick={() => update({ ...DISPLAY_DEFAULTS[role] })}>Obnovit výchozí polohu a velikost</button>
      <output className="calibration-save">{saved ? 'Uloženo na tomto iPadu automaticky.' : 'Uložení není dostupné. Opište hodnoty před zavřením aplikace.'}</output>
      <label className="calibration-export">Hodnoty pro nastavení výchozího rozložení
        <textarea readOnly rows={10} value={JSON.stringify({ role, ...calibration, viewport }, null, 2)} onFocus={event => event.currentTarget.select()} />
      </label>
      <p className="calibration-status">{sync.preview ? 'Vizuální test bez propojení' : sync.message || 'Bez připojeného prostředního iPadu'}</p>
    </section>}
  </>;
}
