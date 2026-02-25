import { ContainerModule, injectable, inject } from '@theia/core/shared/inversify';
import { ConnectionHandler, JsonRpcConnectionHandler } from '@theia/core/lib/common/messaging';
import { BackendApplicationContribution } from '@theia/core/lib/node/backend-application';
import { OpenCodeService, OpenCodeClient, openCodeServicePath } from '../common/opencode-protocol';
import { OpenCodeProxy, OpenCodeServerUrl } from './opencode-proxy';
import { OpenSpaceHub } from './hub';

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
 * Lifecycle contribution to manage OpenCodeProxy startup and shutdown.
 * T2-6: Ensures SSE connections and timers are cleaned up on backend stop.
 * Fix: On start, reconnects openspace-hub in case OpenCode started before Theia
 *      and marked the MCP server as failed due to ECONNREFUSED.
 */
@injectable()
class OpenCodeProxyLifecycle implements BackendApplicationContribution {
    @inject(OpenCodeProxy)
    private readonly proxy!: OpenCodeProxy;

    onStart(): void {
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

  // Bind the OpenCodeProxy as itself AND as OpenCodeService
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
