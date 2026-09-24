// Owns the scheduled callback so a sleeping renderer does not wake every frame.
export class FrameLoop {
  private frame: number | null = null;
  private lastTime: number | null = null;
  private enabled = false;

  constructor(
    private advance: (seconds: number) => void,
    private fps = 60,
    private request: (callback: FrameRequestCallback) => number = callback => requestAnimationFrame(callback),
    private cancel: (id: number) => void = id => cancelAnimationFrame(id),
  ) {}

  setEnabled(enabled: boolean) {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.lastTime = null;
    if (this.frame !== null) this.cancel(this.frame);
    this.frame = enabled ? this.request(this.tick) : null;
  }

  get running() { return this.enabled; }

  private tick = (time: number) => {
    this.frame = null;
    if (!this.enabled) return;
    if (this.lastTime === null) this.lastTime = time;
    else if (time - this.lastTime >= 1000 / this.fps - 0.5) {
      const seconds = (time - this.lastTime) / 1000;
      this.lastTime = time;
      this.advance(Math.min(seconds, 1 / 30));
    }
    if (this.enabled) this.frame = this.request(this.tick);
  };
}
