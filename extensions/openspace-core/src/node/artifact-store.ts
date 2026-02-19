import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';
import PQueue from 'p-queue';
import chokidar from 'chokidar';

// p-queue v6 CJS/ESM compat
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PQueueCtor = ((PQueue as any).default || PQueue) as new (opts: { concurrency: number }) => PQueue<any, any>;

const now = () => new Date().toISOString();

export interface WriteOptions {
    actor: 'user' | 'agent';
    reason: string;
    tool_call_id?: string;
}

export interface ArtifactEvent {
    ts: string;
    artifact: string;
    action: 'CREATE' | 'UPDATE';
    actor: 'user' | 'agent';
    reason: string;
    tool_call_id?: string;
    size_bytes?: number;
}

export class ArtifactStore extends EventEmitter {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private queue: PQueue<any, any>;
    private projectRoot: string;
    private watcher: ReturnType<typeof chokidar.watch> | null = null;
    private internalWriteInProgress = new Set<string>();

    constructor(projectRoot: string) {
        super();
        this.projectRoot = path.resolve(projectRoot);
        this.queue = new PQueueCtor({ concurrency: 1 });
        this.initWatcher();
    }

    private initWatcher(): void {
        this.watcher = chokidar.watch(this.projectRoot, {
            ignoreInitial: true,
            persistent: false,
            ignored: [
                /node_modules/,
                /\.git/,
                /\.openspace[/\\]artifacts/,
                /\.tmp$/,
            ],
            awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
        });

        this.watcher.on('change', (absolutePath: string) => {
            const rel = path.relative(this.projectRoot, absolutePath).replace(/\\/g, '/');
            if (this.internalWriteInProgress.has(rel)) {
                return; // self-write — suppress
            }
            this.emit('FILE_CHANGED', { path: rel, actor: 'user' });
        });

        this.watcher.on('error', (err: unknown) => {
            console.error('[ArtifactStore] watcher error:', err);
        });
    }

    close(): void {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
    }

    private assertInsideRoot(absolutePath: string): void {
        const normalized = path.resolve(absolutePath);
        const withSep = this.projectRoot + path.sep;
        if (normalized !== this.projectRoot && !normalized.startsWith(withSep)) {
            throw new Error(`Path escapes project root: ${absolutePath}`);
        }
    }

    private resolvePath(filePath: string): string {
        const abs = path.isAbsolute(filePath)
            ? filePath
            : path.join(this.projectRoot, filePath);
        this.assertInsideRoot(abs);
        return abs;
    }

    async read(filePath: string): Promise<Buffer> {
        const abs = this.resolvePath(filePath);
        return fsPromises.readFile(abs);
    }

    async write(filePath: string, content: string | Buffer, opts: WriteOptions): Promise<void> {
        return this.queue.add(async () => {
            const abs = this.resolvePath(filePath);
            const normalizedFilePath = filePath.replace(/\\/g, '/');
            this.internalWriteInProgress.add(normalizedFilePath);
            try {
                const exists = await fsPromises.access(abs).then(() => true).catch(() => false);
                await fsPromises.mkdir(path.dirname(abs), { recursive: true });

                if (exists) {
                    await this.createBackup(filePath, abs);
                }

                // Atomic write: tmp -> rename
                const tmp = `${abs}.tmp`;
                await fsPromises.writeFile(tmp, content);
                const fh = await fsPromises.open(tmp, 'r+');
                await fh.sync();
                await fh.close();
                await fsPromises.rename(tmp, abs);

                await this.logEvent(filePath, abs, opts, exists ? 'UPDATE' : 'CREATE');

                this.emit('FILE_CHANGED', { path: filePath, actor: opts.actor });
            } finally {
                setTimeout(() => this.internalWriteInProgress.delete(normalizedFilePath), 500);
            }
        });
    }

    private async createBackup(filePath: string, abs: string): Promise<void> {
        try {
            const histDir = path.join(this.projectRoot, '.openspace', 'artifacts', 'history', filePath);
            await fsPromises.mkdir(histDir, { recursive: true });
            const ts = now().replace(/[:.]/g, '-');
            await fsPromises.copyFile(abs, path.join(histDir, `v${ts}.bak`));

            // Rolling window: keep last 20
            const entries = await fsPromises.readdir(histDir);
            if (entries.length > 20) {
                const sorted = entries.sort();
                for (const f of sorted.slice(0, entries.length - 20)) {
                    await fsPromises.unlink(path.join(histDir, f));
                }
            }
        } catch (err) {
            console.error('[ArtifactStore] backup failed:', err);
        }
    }

    private async logEvent(filePath: string, abs: string, opts: WriteOptions, action: 'CREATE' | 'UPDATE'): Promise<void> {
        try {
            const stats = await fsPromises.stat(abs);
            const event: ArtifactEvent = {
                ts: now(),
                artifact: filePath,
                action,
                actor: opts.actor,
                reason: opts.reason,
                tool_call_id: opts.tool_call_id,
                size_bytes: stats.size,
            };
            const logPath = path.join(this.projectRoot, '.openspace', 'artifacts', 'events.ndjson');
            await fsPromises.mkdir(path.dirname(logPath), { recursive: true });
            await fsPromises.appendFile(logPath, JSON.stringify(event) + '\n');
        } catch (err) {
            console.error('[ArtifactStore] audit log failed:', err);
        }
    }
}
