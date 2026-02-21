// extensions/openspace-voice/src/browser/voice-waveform-overlay.ts

const OVERLAY_ID = 'openspace-voice-waveform-overlay';
const WIDTH = 200;
const HEIGHT = 48;
const BAR_COUNT = 32;
const BAR_GAP = 3;
const BAR_COLOR = '#e53e3e';
const BG_COLOR = 'rgba(20, 20, 20, 0.85)';
const BORDER_RADIUS = '6px';

export class VoiceWaveformOverlay {
  private container: HTMLDivElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private smoothedValues: Float32Array = new Float32Array(BAR_COUNT);
  private smoothingFactor = 0.3;

  show(): void {
    if (this.container) return;

    const container = document.createElement('div');
    container.id = OVERLAY_ID;
    Object.assign(container.style, {
      position: 'fixed',
      bottom: '28px',
      right: '12px',
      width: `${WIDTH}px`,
      height: `${HEIGHT}px`,
      background: BG_COLOR,
      borderRadius: BORDER_RADIUS,
      zIndex: '99999',
      pointerEvents: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
    });

    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    Object.assign(canvas.style, {
      display: 'block',
      borderRadius: BORDER_RADIUS,
    });

    container.appendChild(canvas);
    document.body.appendChild(container);

    this.container = container;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this.smoothedValues.fill(0);
    this._drawFlat();
  }

  push(data: Uint8Array): void {
    if (!this.ctx || !this.canvas) return;

    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    ctx.clearRect(0, 0, W, H);

    const totalGap = BAR_GAP * (BAR_COUNT - 1);
    const barW = (W - totalGap) / BAR_COUNT;

    ctx.fillStyle = BAR_COLOR;

    for (let i = 0; i < BAR_COUNT; i++) {
      const srcIndex = Math.floor((i / BAR_COUNT) * data.length);
      const rawDeviation = Math.abs(data[srcIndex] - 128) / 128;
      const target = Math.max(0.05, rawDeviation);

      this.smoothedValues[i] += (target - this.smoothedValues[i]) * this.smoothingFactor;

      const barH = Math.max(4, this.smoothedValues[i] * H * 0.9);
      const x = i * (barW + BAR_GAP);
      const y = (H - barH) / 2;

      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, barW / 3);
      ctx.fill();
    }
  }

  hide(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
      this.canvas = null;
      this.ctx = null;
      this.smoothedValues.fill(0);
    }
  }

  private _drawFlat(): void {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = BAR_COLOR;

    const totalGap = BAR_GAP * (BAR_COUNT - 1);
    const barW = (W - totalGap) / BAR_COUNT;

    for (let i = 0; i < BAR_COUNT; i++) {
      const x = i * (barW + BAR_GAP);
      const barH = 4;
      const y = (H - barH) / 2;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, barW / 3);
      ctx.fill();
    }
  }
}
