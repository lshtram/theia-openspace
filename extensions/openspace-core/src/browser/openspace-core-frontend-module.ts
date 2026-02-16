import { ContainerModule } from '@theia/core/shared/inversify';
import { FilterContribution } from '@theia/core/lib/common/contribution-filter';
import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application-contribution';
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
import { OpenSpaceBridgeContribution } from './bridge-contribution';
import { PermissionDialogContribution } from './permission-dialog-contribution';

export default new ContainerModule((bind, unbind, isBound, rebind) => {
    // 1. Filter contribution (existing - Phase 0)
    bind(FilterContribution).to(OpenSpaceFilterContribution).inSingletonScope();

    // 2. Core frontend services (Phase 1)
    bind(SessionService).to(SessionServiceImpl).inSingletonScope();
    bind(OpenCodeSyncService).to(OpenCodeSyncServiceImpl).inSingletonScope();

    // 3. RPC client implementation (callback handler)
    // This makes SyncService receive callbacks from backend
    bind(OpenCodeClient).toService(OpenCodeSyncService);

    // 4. RPC proxy to backend
    // Creates proxy that forwards calls to backend OpenCodeProxy
    bind(OpenCodeService).toDynamicValue(ctx => {
        const provider = ctx.container.get(ServiceConnectionProvider);
        return provider.createProxy<OpenCodeService>(
            openCodeServicePath, 
            ctx.container.get(OpenCodeClient)
        );
    }).inSingletonScope();

    // 5. Application contributions
    // BridgeContribution runs on app startup (collects commands, publishes manifest, connects to Hub)
    bind(FrontendApplicationContribution).to(OpenSpaceBridgeContribution).inSingletonScope();
    
    // PermissionDialogContribution renders permission dialog UI
    bind(FrontendApplicationContribution).to(PermissionDialogContribution).inSingletonScope();

    console.log('[OpenSpaceCore] Frontend module loaded');
});
