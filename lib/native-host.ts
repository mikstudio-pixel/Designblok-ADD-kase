export type GyroAngles = { x: number; y: number; z: number };
export type NativeMotion = { x: number; y: number; angle: number; gyro?: GyroAngles; activity?: number };
export type TrayRole = 'standalone' | 'host' | 'left' | 'right';
export type TrayPhase = 'ready' | 'mixing' | 'settling' | 'sleeping' | 'unavailable';
export type TrayTelemetry = {
  phase: TrayPhase;
  tiltX: number;
  tiltY: number;
  activity: number;
  oil: number;
  elapsed: number;
  gyro?: GyroAngles;
};
export type TraySync = {
  role: TrayRole;
  code: string;
  preview?: boolean;
  message: string;
  peers: number;
  telemetry?: TrayTelemetry | null;
};
type NativeMessage = { command: 'ready' | 'tilt'; enabled?: boolean } | { command: 'tray-state'; state: TrayTelemetry } | { command: 'benchmark-result'; result: unknown };

declare global {
  interface Window {
    __michasNative?: { paused: boolean; sync?: TraySync; benchmark?: boolean };
    webkit?: { messageHandlers?: { michas?: { postMessage: (message: NativeMessage) => void } } };
  }
}

export const isNativeHost = () => typeof window !== 'undefined' && !!window.__michasNative;
export const isNativePaused = () => window.__michasNative?.paused === true;
export function nativeCommand(command: 'ready' | 'tilt', enabled?: boolean) {
  window.webkit?.messageHandlers?.michas?.postMessage({ command, enabled });
}
export function publishTrayState(state: TrayTelemetry) {
  if (window.__michasNative?.sync?.role === 'host') {
    window.webkit?.messageHandlers?.michas?.postMessage({ command: 'tray-state', state });
  }
}
