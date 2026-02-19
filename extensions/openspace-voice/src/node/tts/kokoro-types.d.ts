// Type stub for optional kokoro-js dependency — not installed at build time,
// loaded at runtime only if available.
declare module 'kokoro-js' {
  export class KokoroTTS {
    static from_pretrained(model: string, options?: Record<string, unknown>): Promise<KokoroTTS>;
    generate(text: string, options?: Record<string, unknown>): Promise<{ data?: Float32Array | Uint8Array }>;
  }
}
