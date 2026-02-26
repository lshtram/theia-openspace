import { ContainerModule, injectable, inject } from '@theia/core/shared/inversify';
import { ConnectionHandler, JsonRpcConnectionHandler } from '@theia/core/lib/common/messaging';
import { BackendApplicationContribution } from '@theia/core/lib/node/backend-application';
import { OpenCodeService, OpenCodeClient, openCodeServicePath } from '../common/opencode-protocol';
import { OpenCodeProxy, OpenCodeServerUrl } from './opencode-proxy/opencode-proxy';
import { HttpClient } from './opencode-proxy/http-client';
import { RestApiFacade } from './opencode-proxy/rest-api';
import { SseConnectionManager } from './opencode-proxy/sse-connection';
import { SseEventRouter } from './opencode-proxy/sse-event-router';
import { NodeUtils } from './opencode-proxy/node-utils';
import { OpenSpaceHub } from './hub';
import { execSync } from 'child_process';

const DEFAULT_OPENCODE_URL = process.env.OPENCODE_SERVER_URL || 'http://localhost:7890';

/**
 * Validate that a URL string is well-formed. Called at server startup so that
 * a malformed OPENCODE_SERVER_URL produces a clear error immediately rather than
 * cryptic "Invalid URL" errors on every API call.
 *
 * @throws if the string is not a valid URL.
 */
export function validateOpenCodeServerUrl(url: string): void {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        throw new Error(
            `OPENCODE_SERVER_URL is an invalid URL: "${url}". ` +
            `Expected a well-formed http or https URL (e.g. http://localhost:7890).`
        );
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error(
            `OPENCODE_SERVER_URL is an invalid URL: "${url}". ` +
            `Expected a well-formed http or https URL (e.g. http://localhost:7890).`
        );
    }
}

validateOpenCodeServerUrl(DEFAULT_OPENCODE_URL);

/**
 * Kill all direct child processes of this Node process.
 * Used as a safety-net on SIGTERM / SIGINT to prevent terminal process leaks
 * when Theia is shut down non-gracefully (Bug #3).
 *
 * Uses pgrep (macOS/Linux) to enumerate children and sends SIGTERM to each.
 * Failures are swallowed — this is best-effort cleanup only.
 */
function killChildProcesses(): void {
    try {
        const out = execSync(`pgrep -P ${process.pid}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        if (!out) { return; }
        const pids = out.split('\n').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
        for (const pid of pids) {
            try { process.kill(pid, 'SIGTERM'); } catch { /* already dead */ }
        }
    } catch {
        // pgrep exits 1 when no children found — that's fine
    }
}

/** Whether cleanup has already been initiated (avoid double-kill on re-entrant signals). */
let _cleanupInitiated = false;

/**
 * Register process-level signal handlers to kill terminal child processes before
 * Theia exits. This is the safety-net for SIGTERM / SIGINT — the normal graceful
 * shutdown path is handled by Theia's ProcessManager.onStop().
 *
 * SIGKILL cannot be caught; that case remains a known limitation.
 */
function registerTerminalCleanupHandlers(): void {
    const cleanup = (signal: NodeJS.Signals): void => {
        if (_cleanupInitiated) { return; }
        _cleanupInitiated = true;
        console.info(`[TerminalCleanup] Received ${signal} — killing child terminal processes`);
        killChildProcesses();
        // Re-raise the signal with default handling so the process actually exits
        process.removeAllListeners(signal);
        process.kill(process.pid, signal);
    };

    process.once('SIGTERM', () => cleanup('SIGTERM'));
    process.once('SIGINT',  () => cleanup('SIGINT'));
}

/**
 * Lifecycle contribution to manage OpenCodeProxy startup and shutdown.
 * T2-6: Ensures SSE connections and timers are cleaned up on backend stop.
 * Fix: On start, reconnects openspace-hub in case OpenCode started before Theia
 *      and marked the MCP server as failed due to ECONNREFUSED.
 * Bug #3: Registers terminal child-process cleanup handlers to prevent zsh leaks
 *         on non-graceful shutdown.
 */
@injectable()
class OpenCodeProxyLifecycle implements BackendApplicationContribution {
    @inject(OpenCodeProxy)
    private readonly proxy!: OpenCodeProxy;

    onStart(): void {
        // Bug #3: Register signal handlers to kill child terminal processes on shutdown.
        // This prevents zsh process leaks when Theia is stopped via SIGTERM/SIGINT.
        registerTerminalCleanupHandlers();

        // OpenCode may have started before Theia and failed to connect to
        // openspace-hub (ECONNREFUSED). Trigger a reconnect after a short
        // delay to allow Theia's own HTTP server to be fully ready.
        setTimeout(() => {
            console.info('[OpenCodeProxyLifecycle] Triggering openspace-hub reconnect...');
            this.proxy.connectMcpServer('openspace-hub').catch(err => {
                console.warn('[OpenCodeProxyLifecycle] openspace-hub reconnect failed:', err);
            });
        }, 3000);
    }

    onStop(): void {
        console.debug('[OpenCodeProxyLifecycle] Disposing OpenCodeProxy...');
        this.proxy.dispose();
    }
}

export default new ContainerModule((bind, _unbind, _isBound, _rebind) => {
  // Bind the OpenCode server URL
  bind<string>(OpenCodeServerUrl).toConstantValue(DEFAULT_OPENCODE_URL).whenTargetIsDefault();

  // 1. Bind sub-services for the decomposed OpenCodeProxy
  bind(HttpClient).toSelf().inSingletonScope();
  bind(RestApiFacade).toSelf().inSingletonScope();
  bind(SseEventRouter).toSelf().inSingletonScope();
  bind(SseConnectionManager).toSelf().inSingletonScope();
  bind(NodeUtils).toSelf().inSingletonScope();

  // 2. Bind the OpenCodeProxy facade as itself AND as OpenCodeService
  // This allows both direct injection (for lifecycle) and interface-based injection
  bind<OpenCodeProxy>(OpenCodeProxy).toSelf().inSingletonScope();
  bind<OpenCodeService>(OpenCodeService).toService(OpenCodeProxy);

  // T2-6: Bind lifecycle contribution to dispose OpenCodeProxy on server stop
  bind(BackendApplicationContribution).to(OpenCodeProxyLifecycle).inSingletonScope();

  // Register JSON-RPC connection handler for frontend-backend communication
  bind(ConnectionHandler).toDynamicValue(ctx =>
    new JsonRpcConnectionHandler<OpenCodeClient>(
      openCodeServicePath,
      client => {
        const service = ctx.container.get<OpenCodeService>(OpenCodeService);
        service.setClient(client);
        // Wire the RPC client into the Hub's MCP bridge so that agent commands
        // dispatched via MCP tools are forwarded to the browser frontend.
        const hub = ctx.container.get<OpenSpaceHub>(OpenSpaceHub);
        hub.setClientCallback(command => client.onAgentCommand(command));
        return service;
      }
    )
  ).inSingletonScope();

  // Bind OpenSpace Hub as BackendApplicationContribution
  bind(OpenSpaceHub).toSelf().inSingletonScope();
  bind(BackendApplicationContribution).toService(OpenSpaceHub);

  if (process.env.NODE_ENV !== 'production') { console.log('[OpenSpaceCore] Backend module loaded - OpenCodeService exposed at /services/opencode'); }
});
