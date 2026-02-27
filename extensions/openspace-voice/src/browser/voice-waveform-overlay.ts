// extensions/openspace-voice/src/browser/voice-waveform-overlay.ts
import type { EmotionKind } from '../common/narration-types';

const OVERLAY_ID = 'openspace-voice-waveform-overlay';
const WIDTH = 200;
const HEIGHT = 48;
const BAR_COUNT = 32;
const BAR_GAP = 3;
const BORDER_RADIUS = '8px';

const NOISE_FLOOR = 10;
const COMPRESSION_POWER = 0.5;

export type VoiceMode = 'recording' | 'speaking' | 'waiting';

const EMOTION_COLORS: Record<EmotionKind, string> = {
  excited: '#f6ad55',
  concerned: '#fc8181',
  happy: '#68d391',
  thoughtful: '#63b3ed',
  neutral: '#a0aec0',
};

const DEFAULT_RECORDING_COLOR = '#63b3ed';
const RECORDING_BG = 'rgba(40, 40, 40, 0.85)';
const SPEAKING_BG = 'rgba(49, 130, 206, 0.9)';
const SPEAKING_BAR_COLOR = '#ffffff';
const WAITING_BG = 'rgba(40, 40, 40, 0.85)';

export class VoiceWaveformOverlay {
  private container: HTMLDivElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private smoothedValues: Float32Array = new Float32Array(BAR_COUNT);
  private smoothingFactor = 0.08;
  private currentEmotion: EmotionKind | null = null;
  private currentMode: VoiceMode = 'recording';
  private waitingAnimationId: number | null = null;
  private _onCancel: (() => void) | null = null;
  private _boundCancel: (() => void) | null = null;

  setOnCancel(cb: (() => void) | null): void {
    // If overlay is currently visible, update the live container
    if (this.container && this._boundCancel) {
      this.container.removeEventListener('click', this._boundCancel);
      this.container.style.pointerEvents = 'none';
      this.container.style.cursor = '';
      this._boundCancel = null;
    }
    this._onCancel = cb;
    if (this.container && cb) {
      this.container.style.pointerEvents = 'auto';
      this.container.style.cursor = 'pointer';
      this.container.addEventListener('click', cb);
      this._boundCancel = cb;
    }
  }

  get barColor(): string {
    if (this.currentMode === 'speaking') {
      return SPEAKING_BAR_COLOR;
    }
    return this.currentEmotion ? EMOTION_COLORS[this.currentEmotion] : DEFAULT_RECORDING_COLOR;
  }

  get backgroundColor(): string {
    switch (this.currentMode) {
      case 'speaking': return SPEAKING_BG;
      case 'waiting': return WAITING_BG;
      default: return RECORDING_BG;
    }
  }

  get glowColor(): string {
    switch (this.currentMode) {
      case 'speaking': return 'rgba(49, 130, 206, 0.4)';
      case 'waiting': return 'rgba(104, 211, 145, 0.3)';
      default: return 'rgba(99, 179, 237, 0.15)';
    }
  }

  get borderColor(): string {
    switch (this.currentMode) {
      case 'speaking': return 'rgba(255, 255, 255, 0.4)';
      case 'waiting': return 'rgba(104, 211, 145, 0.4)';
      default: return 'rgba(99, 179, 237, 0.3)';
    }
  }

  setEmotion(emotion: EmotionKind | null): void {
    this.currentEmotion = emotion;
  }

  setMode(mode: VoiceMode): void {
    if (this.currentMode === mode) return;
    
    const wasVisible = this.container !== null;
    if (wasVisible) {
      this.hide();
    }
    
    this.currentMode = mode;
    
    if (wasVisible) {
      this.show();
    }
  }

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
      background: this.backgroundColor,
      borderRadius: BORDER_RADIUS,
      zIndex: '99999',
      pointerEvents: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: `0 4px 12px rgba(0,0,0,0.5), 0 0 20px ${this.glowColor}`,
      border: `1px solid ${this.borderColor}`,
      transition: 'background 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease',
    });

    if (this._onCancel) {
      container.style.pointerEvents = 'auto';
      container.style.cursor = 'pointer';
      container.addEventListener('click', this._onCancel);
      this._boundCancel = this._onCancel;
    }

    if (this.currentMode === 'waiting') {
      container.appendChild(this.createWaitingIndicator());
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = WIDTH;
      canvas.height = HEIGHT;
      Object.assign(canvas.style, {
        display: 'block',
        borderRadius: BORDER_RADIUS,
      });

      container.appendChild(canvas);
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.smoothedValues.fill(0);
      this._drawFlat();
    }

    document.body.appendChild(container);
    this.container = container;
  }

  private createWaitingIndicator(): HTMLDivElement {
    const indicator = document.createElement('div');
    Object.assign(indicator.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '4px',
      width: '100%',
      height: '100%',
    });

    for (let i = 0; i < 5; i++) {
      const dot = document.createElement('div');
      Object.assign(dot.style, {
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: '#68d391',
        animation: `voiceWaitingPulse 1.2s ease-in-out ${i * 0.15}s infinite`,
      });
      indicator.appendChild(dot);
    }

    const style = document.createElement('style');
    style.textContent = `
      @keyframes voiceWaitingPulse {
        0%, 100% { transform: scale(0.8); opacity: 0.5; }
        50% { transform: scale(1.2); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    return indicator;
  }

  push(data: Uint8Array): void {
    if (!this.ctx || !this.canvas || this.currentMode === 'waiting') return;

    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    ctx.clearRect(0, 0, W, H);

    const totalGap = BAR_GAP * (BAR_COUNT - 1);
    const barW = (W - totalGap) / BAR_COUNT;

    ctx.fillStyle = this.barColor;

    for (let i = 0; i < BAR_COUNT; i++) {
      const srcIndex = Math.floor((i / BAR_COUNT) * data.length);
      const sample = data[srcIndex];

      let deviation = Math.abs(sample - 128);
      if (deviation < NOISE_FLOOR) {
        deviation = (deviation / NOISE_FLOOR) * 5;
      } else {
        const normalized = (deviation - NOISE_FLOOR) / (255 - NOISE_FLOOR);
        const compressed = Math.pow(normalized, COMPRESSION_POWER);
        deviation = NOISE_FLOOR + compressed * (255 - NOISE_FLOOR);
      }

      const normalized = Math.min(1, deviation / 80);
      const target = Math.max(0.05, normalized);

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
    if (this.waitingAnimationId !== null) {
      cancelAnimationFrame(this.waitingAnimationId);
      this.waitingAnimationId = null;
    }
    if (this.container) {
      if (this._boundCancel) {
        this.container.removeEventListener('click', this._boundCancel);
        this._boundCancel = null;
      }
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
    ctx.fillStyle = this.barColor;

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
