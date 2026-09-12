import { clampTilt, type Tilt } from './tilt';

const RAD = Math.PI / 180;
const DEAD_ZONE = Math.sin(0.35 * RAD);
const FULL_TILT = Math.sin(18 * RAD);

export type SensorState = {
  phase: 'off' | 'requesting' | 'waiting' | 'active' | 'paused' | 'error';
  message: string;
};

export const SENSORS_OFF: SensorState = {
  phase: 'off', message: 'Polož iPad do klidové polohy na tácu a zapni pohyb.',
};

// Downward gravity projected onto the device's fixed x/right and y/top axes.
// The Z-X-Y orientation convention avoids angle wrapping and ignores compass yaw.
export function orientationGravity(beta: number | null, gamma: number | null): Tilt | null {
  if (beta === null || gamma === null || !Number.isFinite(beta) || !Number.isFinite(gamma)) return null;
  return { x: Math.cos(beta * RAD) * Math.sin(gamma * RAD), y: -Math.sin(beta * RAD) };
}

export function screenTilt(gravity: Tilt, neutral: Tilt, screenAngle: number): Tilt {
  const angle = screenAngle * RAD;
  const dx = gravity.x - neutral.x, dy = gravity.y - neutral.y;
  const x = dx * Math.cos(angle) - dy * Math.sin(angle);
  const y = -dx * Math.sin(angle) - dy * Math.cos(angle);
  const length = Math.hypot(x, y);
  const scale = length > DEAD_ZONE ? (length - DEAD_ZONE) / (length * (FULL_TILT - DEAD_ZONE)) : 0;
  return clampTilt({ x: x * scale, y: y * scale });
}

type OrientationAPI = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

export class DeviceTilt {
  private generation = 0;
  private timeout = 0;
  private sample: Tilt | null = null;
  private neutral: Tilt | null = null;
  private phase: SensorState['phase'] = 'off';

  constructor(private onTilt: (value: Tilt) => void, private onState: (state: SensorState) => void) {}

  private state(phase: SensorState['phase'], message: string) {
    this.phase = phase;
    this.onState({ phase, message });
  }

  // Call directly from a tap: Safari requires a user gesture for this permission.
  async start() {
    this.dispose();
    const generation = this.generation;
    this.onTilt({ x: 0, y: 0 });
    if (!window.isSecureContext) {
      this.fail('Pro pohyb otevři zabezpečenou HTTPS adresu aplikace.'); return;
    }
    const api = window.DeviceOrientationEvent as OrientationAPI | undefined;
    if (!api) { this.fail('Tento prohlížeč neposkytuje senzory. Zkus Safari na iPadu.'); return; }
    this.state('requesting', 'Povol aplikaci přístup k pohybu a orientaci.');
    try {
      const permission = api.requestPermission ? await api.requestPermission() : 'granted';
      if (generation !== this.generation) return;
      if (permission !== 'granted') {
        this.fail('Přístup k pohybu byl zamítnut. Povol ho pro tuto stránku v Safari a zkus to znovu.'); return;
      }
      window.addEventListener('deviceorientation', this.receive);
      document.addEventListener('visibilitychange', this.visibility);
      if (document.hidden) this.state('paused', 'Pohyb je pozastavený, dokud není aplikace vidět.');
      else this.waitForSample();
    } catch {
      if (generation === this.generation) this.fail('Pohyb se nepodařilo zapnout. Otevři aplikaci přímo v Safari a zkus to znovu.');
    }
  }

  private waitForSample() {
    window.clearTimeout(this.timeout);
    this.state('waiting', 'Čekám na senzory. Drž tác v klidové poloze.');
    this.timeout = window.setTimeout(() => {
      this.fail('Senzory neposílají data. Zkus iPadem lehce naklonit nebo znovu povolit pohyb v Safari.');
    }, 8000);
  }

  private receive = (event: DeviceOrientationEvent) => {
    if (document.hidden) return;
    const gravity = orientationGravity(event.beta, event.gamma);
    if (!gravity) return;
    this.sample = gravity;
    this.neutral ??= gravity;
    window.clearTimeout(this.timeout);
    if (this.phase !== 'active') this.state('active', 'Pohyb je zapnutý. Nakláněj tác; tlačítkem níže nastavíš novou rovinu.');
    // Safari's window angle shares the portrait-relative frame of its motion events.
    // Prefer it even when ScreenOrientation exists: its natural screen frame can differ.
    // eslint-disable-next-line typescript/no-deprecated -- Needed to align Safari motion axes with the displayed app.
    const legacyAngle = window.orientation;
    const screenAngle = window.screen.orientation?.angle;
    const angle = Number.isFinite(legacyAngle) ? legacyAngle : Number.isFinite(screenAngle) ? screenAngle! : 0;
    this.onTilt(screenTilt(gravity, this.neutral, angle));
  };

  calibrate() {
    if (!this.sample || this.phase !== 'active') return;
    this.neutral = this.sample;
    this.onTilt({ x: 0, y: 0 });
    this.state('active', 'Klidová poloha nastavena. Nakláněj tác.');
  }

  private visibility = () => {
    this.onTilt({ x: 0, y: 0 });
    window.clearTimeout(this.timeout);
    if (document.hidden) this.state('paused', 'Pohyb je pozastavený, dokud není aplikace vidět.');
    else this.waitForSample();
  };

  private fail(message: string) {
    this.dispose();
    this.onTilt({ x: 0, y: 0 });
    this.state('error', message);
  }

  stop() {
    this.dispose();
    this.onTilt({ x: 0, y: 0 });
    this.state('off', SENSORS_OFF.message);
  }

  dispose() {
    this.generation++;
    window.clearTimeout(this.timeout);
    window.removeEventListener('deviceorientation', this.receive);
    document.removeEventListener('visibilitychange', this.visibility);
    this.sample = null; this.neutral = null; this.phase = 'off';
  }
}
