import type { FluidTelemetry } from '@/lib/fluid-telemetry';

const percent = (value: number) => `${Math.round(value * 100)} %`;
const number = (value: number) => value.toFixed(4).replace('.', ',');
const effectNames: Record<string, string> = { contours: 'Vrstevnice', height: 'Výška', grid: 'Mřížka', dots: 'Body', flow: 'Částice proudu' };

export function FluidReadout({ value }: { value: FluidTelemetry | null }) {
  const rows = [
    ['Promísení', value && percent(value.mixed), 'Sjednocení skutečné barvy: 0 % = oddělené barvy, 100 % = jednolitá směs. Měřeno z rozptylu koncentrace.'],
    ['Paměť míchání', value && percent(value.exposure), 'Průměr místní rozpustitelnosti uložené v kapalině. Po zvolnění pozvolna klesá.'],
    ['Paměť min–max', value && `${percent(value.exposureMin)} – ${percent(value.exposureMax)}`, 'Nejméně a nejvíce rozpustná část kapaliny.'],
    ['Tmavá / světlá', value && `${percent(value.darkFraction)} / ${percent(1 - value.darkFraction)}`, 'Plošný poměr obou složek.'],
    ['Síla míchání', value && percent(Math.abs(value.stirring) / 2), 'Síla pohonu cirkulace; skutečný doznívající proud je měřen zvlášť níže.'],
    ['Obnova fází', value && percent(value.recovery), 'Síla obnovy nerozpustnosti, nikoli její dokončení. Drobné pohyby ji nezastavují.'],
    ['Širší spojování', value && percent(value.grouping), 'Průměrná síla širšího spojování, včetně místního útlumu podle paměti. Nejde o míru dokončení.'],
    ['Proud RMS', value && `${number(value.flowRms)} /s`, 'Skutečná rychlost proudu: kvadratický průměr, v šířkách výpočetního pole za sekundu.'],
    ['Proud max', value && `${number(value.flowMax)} /s`, 'Nejvyšší rychlost proudu ve výpočetním poli.'],
    ['Vlnění RMS', value && number(value.waveRms), 'Kvadratický průměr výšky hladiny v jednotkách modelu, nikoli v centimetrech.'],
  ];
  return (
    <section className="fluid-readout" aria-label="Živé parametry kapaliny" aria-live="off">
      <header><span>KAPALINA</span><span className="readout-live">{value ? 'LIVE · 5 Hz' : 'MĚŘÍM…'}</span></header>
      <dl>{rows.map(([label, text, title]) => <div key={label} title={title ?? undefined}><dt>{label}</dt><dd>{text ?? '—'}</dd></div>)}</dl>
      <h2>EFEKTY</h2>
      <dl>
        <div><dt>Hřebeny</dt><dd>{value ? value.crestsMode === 'off' ? 'VYP' : `${value.crestsMode === 'auto' ? 'AUTO' : 'ZAP'} · ${percent(value.crests)}` : '—'}</dd></div>
        <div title="Dostupná síla jemného náhodného proudění. Jednotlivé víry se dál pozvolna mění."><dt>Jemné víry</dt><dd>{value ? value.driftEnabled ? `ZAP · ${percent(value.drift)}` : 'VYP' : '—'}</dd></div>
        <div><dt>Tvarová protiváha</dt><dd>{value ? value.organicEnabled ? 'ZAP' : 'VYP' : '—'}</dd></div>
        <div><dt>Rozpouštění</dt><dd>{value ? value.dissolvingEnabled ? 'ZAP' : 'VYP' : '—'}</dd></div>
        {value?.effects.map(effect => <div key={effect}><dt>{effectNames[effect] ?? effect}</dt><dd>ZAP</dd></div>)}
      </dl>
      <p className="readout-note">Proud a vlnění: jednotky modelu. RMS = průměrná intenzita.</p>
    </section>
  );
}
