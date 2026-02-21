// extensions/openspace-voice/src/browser/voice-waveform-overlay.ts

const OVERLAY_ID = 'openspace-voice-waveform-overlay';
const WIDTH = 200;
const HEIGHT = 48;
const BAR_COLOR = '#e53e3e';
const BG_COLOR = 'rgba(20, 20, 20, 0.85)';
const BORDER_RADIUS = '6px';

export class VoiceWaveformOverlay {
  private container: HTMLDivElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  show(): void {
    if (this.container) return; // already visible

    const container = document.createElement('div');
    container.id = OVERLAY_ID;
    Object.assign(container.style, {
      position: 'fixed',
      bottom: '28px',       // sit just above the status bar (~22px tall)
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

    // Draw a flat silent waveform as initial state
    this._drawFlat();
  }

  push(data: Uint8Array): void {
    if (!this.ctx || !this.canvas) return;

    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Draw the bar-chart waveform.
    // data[i] is a byte (0–255); 128 = zero-crossing (silence).
    // We draw each sample as a vertical bar centred on H/2,
    // height proportional to how far it deviates from 128.
    const barCount = data.length;
    const barW = W / barCount;

    ctx.fillStyle = BAR_COLOR;

    for (let i = 0; i < barCount; i++) {
      const deviation = Math.abs(data[i] - 128) / 128; // 0.0 – 1.0
      const barH = Math.max(2, deviation * H);
      const x = i * barW;
      const y = (H - barH) / 2;
      ctx.fillRect(x, y, Math.max(1, barW - 1), barH);
    }
  }

  hide(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
      this.canvas = null;
      this.ctx = null;
    }
  }

  private _drawFlat(): void {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = BAR_COLOR;
    ctx.fillRect(0, H / 2 - 1, W, 2); // thin flat line at silence
  }
}
