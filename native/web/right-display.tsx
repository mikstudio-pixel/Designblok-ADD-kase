/* oxlint-disable next/no-img-element -- SVG artwork is bundled for offline WKWebView. */
import type { MotionSample, ScenarioSnapshot, ScenarioStage } from '@/lib/mixing-scenario';
import standby from './artwork/right-standby.svg';
import detected from './artwork/scenario/detected.svg';
import authorized from './artwork/scenario/authorized.svg';
import decision from './artwork/scenario/decision.svg';
import countdown from './artwork/scenario/countdown.svg';
import analysis from './artwork/scenario/analysis.svg';
import mixing from './artwork/scenario/mixing.svg';
import keepMixing from './artwork/scenario/keep-mixing.svg';
import notMixing from './artwork/scenario/not-mixing.svg';
import stirPrompt from './artwork/scenario/stir-prompt.svg';
import success from './artwork/scenario/success.svg';
import failure from './artwork/scenario/failure.svg';
import connecting from './artwork/scenario/connecting.svg';
import welcome from './artwork/scenario/welcome.svg';

export const SCREENS: Record<ScenarioStage, { artwork: string; title: string }> = {
  standby: { artwork: standby, title: 'Mícháš nebo nemícháš? Zvedni tác.' },
  detected: { artwork: detected, title: 'Posádka detekována. Autorizace přídělu…' },
  authorized: { artwork: authorized, title: 'Posádka detekována. Autorizace udělena.' },
  decision: { artwork: decision, title: 'Rozhodni se. Mícháš nebo nemícháš?' },
  countdown: { artwork: countdown, title: '3… 2… 1… START' },
  analysis: { artwork: analysis, title: 'Probíhá analýza míchání.' },
  mixing: { artwork: mixing, title: 'Instantní míchač, to se pozná!' },
  'keep-mixing': { artwork: keepMixing, title: 'Jde ti to dobře!!' },
  'not-mixing': { artwork: notMixing, title: 'Takže ty nechceš míchat???' },
  'stir-prompt': { artwork: stirPrompt, title: 'Tak míchej ne?!?' },
  success: { artwork: success, title: 'Domícháno. Dobrou chuť.' },
  failure: { artwork: failure, title: 'Selhání míchání. Budeš o hladu, ale kolonie tě stále vítá!' },
  connecting: { artwork: connecting, title: 'Navazuji kontakt s kolonií. Probíhá spojení…' },
  welcome: { artwork: welcome, title: 'Spojení navázáno. Vítejte na Digitálu. Nová zpráva od Boba Stránského.' },
};
const dataStages: ScenarioStage[] = ['detected', 'authorized', 'decision', 'countdown', 'analysis', 'mixing', 'keep-mixing', 'not-mixing', 'stir-prompt'];
const analysisStages: ScenarioStage[] = ['analysis', 'mixing', 'keep-mixing', 'not-mixing', 'stir-prompt'];

export function RightDisplay({ scenario, sample }: { scenario: ScenarioSnapshot; sample: MotionSample | null }) {
  const { stage, progress, mixed, remaining } = scenario;
  const hasData = dataStages.includes(stage), analyzing = analysisStages.includes(stage);
  const gyro = sample?.gyro;
  return <div className="right-display" data-stage={stage}>
    <img src={SCREENS[stage].artwork} width={744} height={1073} draggable={false} alt="" />
    <output className="sr-only">{SCREENS[stage].title}</output>
    <svg className="scenario-readings" viewBox="0 0 744 1073" aria-label="Živá data míchání">
      {hasData && <>
        <text x="396" y="711.11" fontSize="13">HRUDKOVITOST <tspan opacity=".2">{'//////////////////////'}</tspan></text>
        <rect x="666" y="698" width="42" height="16" fill="#0d0d0d" />
        <text x="707" y="711.11" textAnchor="end" fontSize="13">{Math.round((1 - mixed) * 100)}%</text>
        <text x="396" y="749.11" fontSize="13" fill="#c4432b">CELKOVÝ STAV <tspan opacity=".2">{'/////////////////'}</tspan></text>
        <rect x="622" y="736" width="86" height="16" fill="#0d0d0d" />
        <text x="707" y="749.11" textAnchor="end" fontSize="13" fill="#c4432b">{analyzing && mixed > 0 ? 'MÍCHÁNÍ' : 'NEDOTČENO'}</text>
        {(['x', 'y', 'z'] as const).map((axis, i) => <text key={axis} x={396 + i * 7.8} y={870.11 + i * 19} fontSize="13">
          {axis.toUpperCase()}-AXIS <tspan opacity=".2">/</tspan> {gyro ? `${gyro[axis].toFixed(2)}°` : '—'}
        </text>)}
        <text x="437" y="978.05" fontSize="10" opacity=".5">GYROSKOP</text>
        <text x="485" y="978.05" fontSize="10">{gyro ? '.ONLINE' : '.OFFLINE'}</text>
      </>}
      {analyzing && <>
        <text x="396" y="450.97" fontSize="14">{remaining.toFixed(1)} SEKUND DO HOTOVÉ KAŠE</text>
        <rect x="396.25" y="461.25" width="310.5" height="7.5" fill="none" stroke="#ccc" strokeWidth=".5" />
        <rect x="396" y="461" width={311 * progress} height="8" fill="#5500ff" />
      </>}
      {stage === 'countdown' && <rect x={[396, 455, 513, 561][3 - scenario.countdown]} y="341" width={[24, 24, 16, 125][3 - scenario.countdown]} height="3" fill="#5500ff" />}
    </svg>
  </div>;
}
