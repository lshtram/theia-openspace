import { ContainerModule } from '@theia/core/shared/inversify';
import { ConnectionHandler, JsonRpcConnectionHandler } from '@theia/core/lib/common/messaging';
import { BackendApplicationContribution } from '@theia/core/lib/node/backend-application';
import { OpenCodeService, OpenCodeClient, openCodeServicePath } from '../common/opencode-protocol';
import { OpenCodeProxy, OpenCodeServerUrl } from './opencode-proxy';
import { OpenSpaceHub } from './hub';

const DEFAULT_OPENCODE_URL = 'http://localhost:8080';

export default new ContainerModule((bind, unbind, isBound, rebind) => {
  // Bind the OpenCode server URL
  bind<string>(OpenCodeServerUrl).toConstantValue(DEFAULT_OPENCODE_URL).whenTargetIsDefault();

  // Bind the OpenCodeProxy as the OpenCodeService
  // InversifyJS will handle @inject decorators and @postConstruct automatically
  bind<OpenCodeService>(OpenCodeService).to(OpenCodeProxy).inSingletonScope();

  // Register JSON-RPC connection handler for frontend-backend communication
  bind(ConnectionHandler).toDynamicValue(ctx =>
    new JsonRpcConnectionHandler<OpenCodeClient>(
      openCodeServicePath,
      client => {
        const service = ctx.container.get<OpenCodeService>(OpenCodeService);
        service.setClient(client);
        
        // CRITICAL: Register disposal hook to clean up SSE connection
        // when frontend disconnects (tab close, reload, etc.)
        client.onDidCloseConnection(() => {
          service.setClient(undefined);
        });
        
        return service;
      }
    )
  ).inSingletonScope();

  // Bind OpenSpace Hub as BackendApplicationContribution
  bind(OpenSpaceHub).toSelf().inSingletonScope();
  bind(BackendApplicationContribution).toService(OpenSpaceHub);

  console.log('[OpenSpaceCore] Backend module loaded - OpenCodeService exposed at /services/opencode');
});
