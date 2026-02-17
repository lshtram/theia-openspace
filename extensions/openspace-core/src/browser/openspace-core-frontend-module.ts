import { ContainerModule } from '@theia/core/shared/inversify';
import { FilterContribution } from '@theia/core/lib/common/contribution-filter';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { ServiceConnectionProvider } from '@theia/core/lib/browser/messaging/service-connection-provider';

// Existing
import { OpenSpaceFilterContribution } from './filter-contribution';

// Protocol
import { 
    OpenCodeService, 
    OpenCodeClient, 
    openCodeServicePath 
} from '../common/opencode-protocol';

// Services
import { SessionService, SessionServiceImpl } from './session-service';
import { OpenCodeSyncService, OpenCodeSyncServiceImpl } from './opencode-sync-service';
import { PermissionDialogContribution } from './permission-dialog-contribution';

export default new ContainerModule((bind, unbind, isBound, rebind) => {
    bind(FilterContribution).to(OpenSpaceFilterContribution).inSingletonScope();
    bind(SessionService).to(SessionServiceImpl).inSingletonScope();
    bind(OpenCodeSyncService).to(OpenCodeSyncServiceImpl).inSingletonScope();

    // RPC client implementation
    bind(OpenCodeClient).toService(OpenCodeSyncService);

    // RPC proxy to backend
    bind(OpenCodeService).toDynamicValue(ctx => {
        const provider = ctx.container.get(ServiceConnectionProvider);
        const proxy = provider.createProxy<OpenCodeService>(
            openCodeServicePath, 
            ctx.container.get(OpenCodeClient)
        );

        // Break circular DI dependency: wire SessionService → OpenCodeSyncService lazily.
        // At this point OpenCodeSyncServiceImpl is already created (no @inject(SessionService)),
        // and SessionService can now be safely resolved since OpenCodeService (this proxy) exists.
        queueMicrotask(() => {
            try {
                const syncService = ctx.container.get(OpenCodeSyncService) as OpenCodeSyncServiceImpl;
                const sessionService = ctx.container.get(SessionService) as SessionService;
                syncService.setSessionService(sessionService);
            } catch (err) {
                console.error('[OpenSpaceCore] Failed to wire SessionService → SyncService:', err);
            }
        });

        return proxy;
    }).inSingletonScope();

    console.log('[OpenSpaceCore] Frontend module loaded (services + RPC)');

    // Permission dialog
    bind(PermissionDialogContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(PermissionDialogContribution);
});
