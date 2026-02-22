declare module 'node-record-lpcm16' {
  import { Readable } from 'stream';

  interface RecordOptions {
    sampleRate?: number;
    channels?: number;
    audioType?: string;
    recorder?: string;
    silence?: string;
    threshold?: number;
    endOnSilence?: boolean;
    thresholdStart?: number | null;
    thresholdEnd?: number | null;
    recordProgram?: string;
    verbose?: boolean;
  }

  interface Recording {
    stream(): Readable;
    stop(): void;
    pause(): void;
    resume(): void;
  }

  export function record(options?: RecordOptions): Recording;
}
