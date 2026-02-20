import { ContainerModule, injectable, inject } from '@theia/core/shared/inversify';
import { ConnectionHandler, JsonRpcConnectionHandler } from '@theia/core/lib/common/messaging';
import { BackendApplicationContribution } from '@theia/core/lib/node/backend-application';
import { OpenCodeService, OpenCodeClient, openCodeServicePath } from '../common/opencode-protocol';
import { OpenCodeProxy, OpenCodeServerUrl } from './opencode-proxy';
import { OpenSpaceHub } from './hub';

const DEFAULT_OPENCODE_URL = process.env.OPENCODE_SERVER_URL || 'http://localhost:7890';

/**
 * Lifecycle contribution to dispose OpenCodeProxy on server shutdown.
 * T2-6: Ensures SSE connections and timers are cleaned up on backend stop.
 */
@injectable()
class OpenCodeProxyLifecycle implements BackendApplicationContribution {
    @inject(OpenCodeProxy)
    private readonly proxy!: OpenCodeProxy;

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

  console.log('[OpenSpaceCore] Backend module loaded - OpenCodeService exposed at /services/opencode');
});
