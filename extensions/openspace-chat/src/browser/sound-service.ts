/**
 * SoundService — plays synthesized sounds using Web Audio API.
 * No audio files bundled. Uses oscillators only.
 * Gated by openspace.sounds.enabled preference.
 */
export type SoundEvent = 'turn-complete' | 'error' | 'permission';

export class SoundService {
    private enabled = false;

    setEnabled(enabled: boolean): void { this.enabled = enabled; }

    play(event: SoundEvent): void {
        if (!this.enabled) { return; }
        try {
            const ctx = new AudioContext();
            switch (event) {
                case 'turn-complete': this.playChime(ctx, [880, 1047]); break; // A5 → C6
                case 'error':         this.playChime(ctx, [220, 185]); break;  // A3 → F#3
                case 'permission':    this.playChime(ctx, [659]); break;       // E5
            }
        } catch { /* AudioContext not available (e.g., test env) */ }
    }

    private playChime(ctx: AudioContext, freqs: number[]): void {
        freqs.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = freq;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.15);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.4);
            osc.start(ctx.currentTime + i * 0.15);
            osc.stop(ctx.currentTime + i * 0.15 + 0.4);
        });
    }
}
