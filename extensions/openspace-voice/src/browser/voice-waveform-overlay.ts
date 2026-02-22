// extensions/openspace-voice/src/browser/voice-waveform-overlay.ts

const OVERLAY_ID = 'openspace-voice-waveform-overlay';
const WIDTH = 200;
const HEIGHT = 48;
const BAR_COUNT = 32;
const BAR_GAP = 3;
const BAR_COLOR = '#63b3ed';      // Light blue (matches Theia/our theme)
const BG_COLOR = 'rgba(40, 40, 40, 0.5)';  // Gray 50% opacity
const BORDER_RADIUS = '6px';

const NOISE_FLOOR = 10;           // Values below this are considered silence
const COMPRESSION_POWER = 0.5;    // Power law compression (0.5 = sqrt)

export class VoiceWaveformOverlay {
  private container: HTMLDivElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private smoothedValues: Float32Array = new Float32Array(BAR_COUNT);
  private smoothingFactor = 0.08;  // Much slower: 8% per frame (words "pass by")

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
      const sample = data[srcIndex];

      // Apply noise floor - treat quiet sounds as near-zero
      let deviation = Math.abs(sample - 128);
      if (deviation < NOISE_FLOOR) {
        // Very low response below noise floor (still shows a little for feedback)
        deviation = (deviation / NOISE_FLOOR) * 5;
      } else {
        // Above noise floor: apply power law compression to boost quiet sounds
        const normalized = (deviation - NOISE_FLOOR) / (255 - NOISE_FLOOR);
        const compressed = Math.pow(normalized, COMPRESSION_POWER);
        deviation = NOISE_FLOOR + compressed * (255 - NOISE_FLOOR);
      }

      const normalized = Math.min(1, deviation / 80); // Normalize, boost for visibility
      const target = Math.max(0.05, normalized);

      // Smoothing with much slower lerp (words "pass by" effect)
      this.smoothedValues[i] += (target - this.smoothedValues[i]) * this.smoothingFactor;

      const barH = Math.max(4, this.smoothedValues[i] * H * 0.85);
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
