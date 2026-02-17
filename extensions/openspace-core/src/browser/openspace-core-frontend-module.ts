import { ContainerModule } from '@theia/core/shared/inversify';
import { FilterContribution } from '@theia/core/lib/common/contribution-filter';
import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application-contribution';
import { ServiceConnectionProvider } from '@theia/core/lib/browser/messaging/service-connection-provider';
import { CommandContribution } from '@theia/core/lib/common/command';

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
import { PaneService, PaneServiceImpl } from './pane-service';
import { PaneCommandContribution } from './pane-command-contribution';
import { EditorCommandContribution } from './editor-command-contribution';
import { TerminalCommandContribution } from './terminal-command-contribution';
import { FileCommandContribution } from './file-command-contribution';

export default new ContainerModule((bind, unbind, isBound, rebind) => {
    // 1. Filter contribution (existing - Phase 0)
    bind(FilterContribution).to(OpenSpaceFilterContribution).inSingletonScope();

    // 2. Core frontend services (Phase 1)
    bind(SessionService).to(SessionServiceImpl).inSingletonScope();
    bind(OpenCodeSyncService).to(OpenCodeSyncServiceImpl).inSingletonScope();
    bind(PaneService).to(PaneServiceImpl).inSingletonScope();

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

    // 6. Command contributions
    bind(CommandContribution).to(PaneCommandContribution).inSingletonScope();
    bind(CommandContribution).to(EditorCommandContribution).inSingletonScope();
    bind(CommandContribution).to(TerminalCommandContribution).inSingletonScope();
    bind(CommandContribution).to(FileCommandContribution).inSingletonScope();

    console.log('[OpenSpaceCore] Frontend module loaded');
});
