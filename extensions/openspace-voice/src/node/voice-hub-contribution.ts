// extensions/openspace-voice/src/node/voice-hub-contribution.ts
import { injectable } from '@theia/core/shared/inversify';
import { BackendApplicationContribution } from '@theia/core/lib/node/backend-application';
import { Application, Request, Response } from 'express';
import * as http from 'http';
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
 *   POST /openspace/voice/stt       -- Speech-to-text transcription
 *   POST /openspace/voice/narrate   -- LLM narration preprocessing + TTS synthesis
 *   GET  /openspace/voice/utterances/:filename -- Serve utterance WAV files
 */
@injectable()
export class VoiceHubContribution implements BackendApplicationContribution {
    private voiceService!: VoiceBackendService;
    // M-5: Gate all handlers on provider initialization completing
    private readyPromise: Promise<void> = Promise.resolve();

    configure(app: Application): void {
        this.initVoiceService();

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const express = require('express');

        // POST /openspace/voice/stt -- Speech-to-text transcription
        app.post(
            '/openspace/voice/stt',
            express.raw({ type: 'audio/raw', limit: '50mb' }),
            async (req: Request, res: Response) => {
                try {
                    // M-5: Await provider initialization before handling requests
                    await this.readyPromise;
                    const audio = new Uint8Array(req.body as Buffer);
                    const rawLanguage = (req.headers['x-voice-language'] as string) ?? 'en-US';
                    // whisper.cpp uses ISO 639-1 two-letter codes (e.g. "en"), not BCP-47 (e.g. "en-US")
                    const language = rawLanguage.split('-')[0].split('_')[0].toLowerCase();
                    // M-5: Read X-Sample-Rate header and pass it to the STT provider
                    const sampleRateHeader = req.headers['x-sample-rate'] as string | undefined;
                    const parsedRate = sampleRateHeader ? parseInt(sampleRateHeader, 10) : NaN;
                    // Guard against NaN, non-finite, or out-of-range values
                    const sampleRate = Number.isFinite(parsedRate) && parsedRate > 0 && parsedRate <= 384000
                        ? parsedRate
                        : 16000;
                    const result = await this.voiceService.transcribeSpeech({ audio, language, sampleRate });
                    res.json(result);
                } catch (err) {
                    console.error('[VoiceHub] STT error:', err);
                    res.status(500).json({ error: String(err) });
                }
            }
        );

        // POST /openspace/voice/narrate -- LLM narration preprocessing + TTS synthesis
        app.post(
            '/openspace/voice/narrate',
            express.json(),
            async (req: Request, res: Response) => {
                try {
                    // M-5: Await provider initialization before handling requests
                    await this.readyPromise;
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

        // GET /openspace/voice/utterances/:filename -- Serve utterance WAV files
        app.get('/openspace/voice/utterances/:filename', (req: Request, res: Response) => {
            const filename = req.params['filename'];
            // Validate filename -- no path traversal
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
            const readStream = fs.createReadStream(filePath);
            readStream.on('error', (err) => {
                console.error('[VoiceHub] Stream error serving utterance:', err);
                if (!res.headersSent) {
                    res.status(500).send('Error reading audio file');
                } else {
                    res.destroy();
                }
            });
            readStream.pipe(res);
        });

        console.log('[VoiceHub] Voice routes configured (/openspace/voice/stt, /narrate, /utterances)');
    }

    onStop(): void {
        console.log('[VoiceHub] Voice hub stopped');
    }

    /**
     * Initialize VoiceBackendService with auto-selected STT/TTS providers.
     * Uses the real opencode LLM caller for narration preprocessing (Task 15).
     */
    private initVoiceService(): void {
        const sttSelector = new SttProviderSelector();
        const ttsSelector = new TtsProviderSelector();

        const realLlmCaller: LlmCaller = (prompt: string, text: string) =>
            callOpenCodeLlm(prompt, text);

        // M-5: Assign to readyPromise so handlers can await it
        this.readyPromise = Promise.all([sttSelector.selectProvider(), ttsSelector.selectProvider()])
            .then(([stt, tts]) => {
                this.voiceService = new VoiceBackendService({
                    sttProvider: stt,
                    ttsProvider: tts,
                    llmCaller: realLlmCaller,
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
                        synthesize: async () => ({ audio: new Uint8Array(0), sampleRate: 24000 }),
                        dispose: async () => { /* no-op */ },
                    },
                    llmCaller: realLlmCaller,
                });
            });
    }
}

/**
 * Call the opencode LLM with a one-shot session for narration preprocessing.
 * Creates an ephemeral session, posts the prompt+text, polls for the assistant
 * reply, deletes the session, and returns the assistant's text content.
 *
 * @throws on HTTP error, timeout, or if no assistant reply arrives within 30s.
 */
async function callOpenCodeLlm(
    prompt: string,
    text: string,
    baseUrl = process.env.OPENCODE_SERVER_URL ?? 'http://localhost:7890',
): Promise<string> {
    const POLL_INTERVAL_MS = 500;
    const TIMEOUT_MS = 30_000;

    // 1. Create ephemeral session
    const session = await httpPost<{ id: string }>(baseUrl, '/session', {});
    const sessionId = session.id;

    try {
        // 2. Post the user message
        await httpPost(baseUrl, `/session/${encodeURIComponent(sessionId)}/message`, {
            parts: [{ type: 'text', text: `${prompt}\n\n${text}` }],
        });

        // 3. Poll for assistant reply
        const deadline = Date.now() + TIMEOUT_MS;
        while (Date.now() < deadline) {
            await sleep(POLL_INTERVAL_MS);
            const messages = await httpGet<Array<{
                info: { id: string; role: string; time: { created: number; completed?: number } };
                parts: Array<{ type: string; content?: string; text?: string }>;
            }>>(baseUrl, `/session/${encodeURIComponent(sessionId)}/message`);

            const assistant = messages.find(
                (m) => m.info.role === 'assistant' && m.info.time.completed !== undefined,
            );
            if (assistant) {
                // Extract text from first text part
                const textPart = assistant.parts.find((p) => p.type === 'text');
                return textPart?.content ?? textPart?.text ?? '';
            }
        }
        throw new Error('[VoiceHub] LLM call timed out after 30s');
    } finally {
        // 4. Always delete the ephemeral session
        try {
            await httpDelete(baseUrl, `/session/${encodeURIComponent(sessionId)}`);
        } catch (e) {
            console.warn('[VoiceHub] Failed to delete ephemeral LLM session:', e);
        }
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function httpPost<T>(baseUrl: string, path: string, body: unknown): Promise<T> {
    const url = `${baseUrl}${path}`;
    const data = JSON.stringify(body);
    return new Promise<T>((resolve, reject) => {
        const parsedUrl = new URL(url);
        const req = http.request(
            {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port,
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            },
            (res: http.IncomingMessage) => {
                const chunks: Buffer[] = [];
                res.on('data', (c: Buffer) => chunks.push(c));
                res.on('end', () => {
                    const text = Buffer.concat(chunks).toString();
                    if ((res.statusCode ?? 0) < 200 || (res.statusCode ?? 0) >= 300) {
                        return reject(new Error(`HTTP ${res.statusCode}: ${text}`));
                    }
                    try { resolve(JSON.parse(text) as T); } catch (e) { reject(e); }
                });
                res.on('error', reject);
            },
        );
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function httpGet<T>(baseUrl: string, path: string): Promise<T> {
    const url = `${baseUrl}${path}`;
    return new Promise<T>((resolve, reject) => {
        const parsedUrl = new URL(url);
        http.get(
            {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port,
                path: parsedUrl.pathname + parsedUrl.search,
                headers: { 'Accept': 'application/json' },
            },
            (res: http.IncomingMessage) => {
                const chunks: Buffer[] = [];
                res.on('data', (c: Buffer) => chunks.push(c));
                res.on('end', () => {
                    const text = Buffer.concat(chunks).toString();
                    if ((res.statusCode ?? 0) < 200 || (res.statusCode ?? 0) >= 300) {
                        return reject(new Error(`HTTP ${res.statusCode}: ${text}`));
                    }
                    try { resolve(JSON.parse(text) as T); } catch (e) { reject(e); }
                });
                res.on('error', reject);
            },
        ).on('error', reject);
    });
}

async function httpDelete(baseUrl: string, path: string): Promise<void> {
    const url = `${baseUrl}${path}`;
    return new Promise<void>((resolve, reject) => {
        const parsedUrl = new URL(url);
        const req = http.request(
            {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port,
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'DELETE',
                headers: { 'Accept': 'application/json' },
            },
            (res: http.IncomingMessage) => {
                res.resume(); // drain
                res.on('end', () => {
                    if ((res.statusCode ?? 0) < 200 || (res.statusCode ?? 0) >= 300) {
                        return reject(new Error(`HTTP DELETE ${res.statusCode}`));
                    }
                    resolve();
                });
                res.on('error', reject);
            },
        );
        req.on('error', reject);
        req.end();
    });
}
