// extensions/openspace-voice/src/node/voice-hub-contribution.ts
import { injectable } from '@theia/core/shared/inversify';
import { BackendApplicationContribution } from '@theia/core/lib/node/backend-application';
import { Application, Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { VoiceBackendService } from './voice-backend-service';
import { SttProviderSelector } from './stt/stt-provider-selector';
import { TtsProviderSelector } from './tts/tts-provider-selector';
import type { LlmCaller } from './narration-preprocessor';

/**
 * Registers /openspace/voice/* HTTP routes on the Theia backend application.
 *
 * Routes:
 *   POST /openspace/voice/stt       — Speech-to-text transcription
 *   POST /openspace/voice/narrate   — LLM narration preprocessing + TTS synthesis
 *   GET  /openspace/voice/utterances/:filename — Serve utterance WAV files
 */
@injectable()
export class VoiceHubContribution implements BackendApplicationContribution {
    private voiceService!: VoiceBackendService;

    configure(app: Application): void {
        this.initVoiceService();

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const express = require('express');

        // POST /openspace/voice/stt — Speech-to-text transcription
        app.post(
            '/openspace/voice/stt',
            express.raw({ type: 'application/octet-stream', limit: '50mb' }),
            async (req: Request, res: Response) => {
                try {
                    const audio = new Uint8Array(req.body as Buffer);
                    const language = (req.headers['x-voice-language'] as string) ?? 'en-US';
                    const result = await this.voiceService.transcribeSpeech({ audio, language });
                    res.json(result);
                } catch (err) {
                    console.error('[VoiceHub] STT error:', err);
                    res.status(500).json({ error: String(err) });
                }
            }
        );

        // POST /openspace/voice/narrate — LLM narration preprocessing + TTS synthesis
        app.post(
            '/openspace/voice/narrate',
            express.json(),
            async (req: Request, res: Response) => {
                try {
                    const { text, mode, voice, speed } = req.body as {
                        text: string; mode: string; voice: string; speed: number;
                    };
                    const result = await this.voiceService.narrateText({
                        text,
                        mode: mode as 'narrate-off' | 'narrate-everything' | 'narrate-summary',
                        voice,
                        speed,
                    });
                    res.json(result);
                } catch (err) {
                    console.error('[VoiceHub] Narrate error:', err);
                    res.status(500).json({ error: String(err) });
                }
            }
        );

        // GET /openspace/voice/utterances/:filename — Serve utterance WAV files
        app.get('/openspace/voice/utterances/:filename', (req: Request, res: Response) => {
            const filename = req.params['filename'];
            // Validate filename — no path traversal
            if (!filename || !/^[\w-]+\.wav$/.test(filename)) {
                res.status(400).send('Invalid filename');
                return;
            }
            const utterancesDir = path.join(__dirname, '../../utterances');
            const filePath = path.join(utterancesDir, filename);
            if (!fs.existsSync(filePath)) {
                res.status(404).send('Utterance not found');
                return;
            }
            res.setHeader('Content-Type', 'audio/wav');
            fs.createReadStream(filePath).pipe(res);
        });

        console.log('[VoiceHub] Voice routes configured (/openspace/voice/stt, /narrate, /utterances)');
    }

    onStop(): void {
        console.log('[VoiceHub] Voice hub stopped');
    }

    /**
     * Initialize VoiceBackendService with auto-selected STT/TTS providers.
     * Uses a passthrough LLM caller by default (Task 15 wires the real opencode caller).
     */
    private initVoiceService(): void {
        const sttSelector = new SttProviderSelector();
        const ttsSelector = new TtsProviderSelector();

        // Passthrough LLM caller: wraps raw text as a speech segment without LLM preprocessing.
        // Task 15 will replace this with a real opencode session caller.
        const passthroughLlm: LlmCaller = async (_prompt: string, text: string): Promise<string> =>
            JSON.stringify({ segments: [{ type: 'speech', text, priority: 'normal' }] });

        Promise.all([sttSelector.selectProvider(), ttsSelector.selectProvider()])
            .then(([stt, tts]) => {
                this.voiceService = new VoiceBackendService({
                    sttProvider: stt,
                    ttsProvider: tts,
                    llmCaller: passthroughLlm,
                });
                console.log(`[VoiceHub] Providers ready (STT: ${stt.id}, TTS: ${tts.id})`);
            })
            .catch((err) => {
                console.error('[VoiceHub] Provider initialization failed, using error stubs:', err);
                this.voiceService = new VoiceBackendService({
                    sttProvider: {
                        kind: 'stt', id: 'error-stub',
                        isAvailable: async () => false,
                        transcribe: async () => ({ text: '[STT unavailable]' }),
                    },
                    ttsProvider: {
                        kind: 'tts', id: 'error-stub',
                        isAvailable: async () => false,
                        synthesize: async () => ({ audio: new Uint8Array(0) }),
                    },
                    llmCaller: passthroughLlm,
                });
            });
    }
}
