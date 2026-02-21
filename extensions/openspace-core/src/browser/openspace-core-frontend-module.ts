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
import { PermissionDialogContribution } from './permission-dialog-contribution';

/**
 * SessionServiceWiring Symbol for DI binding.
 * This binding wires the SessionService to OpenCodeSyncService to break the circular dependency.
 */
export const SessionServiceWiring = Symbol('SessionServiceWiring');

export default new ContainerModule((bind, _unbind, _isBound, _rebind) => {
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

    // 5. SessionService wiring - Wire SessionService to SyncService to break circular DI dependency
    // This MUST happen after both services are bound, so we use a separate binding that depends on both
    bind(SessionServiceWiring).toDynamicValue(ctx => {
        const syncService = ctx.container.get<OpenCodeSyncServiceImpl>(OpenCodeSyncService);
        const sessionService = ctx.container.get<SessionService>(SessionService);
        
        // Use queueMicrotask to ensure DI is fully resolved before wiring
        queueMicrotask(() => {
            syncService.setSessionService(sessionService);
        });
        
        return null;
    }).inSingletonScope();

    // 6. Application contributions
    // BridgeContribution runs on app startup (collects commands, publishes manifest, connects to Hub)
    bind(FrontendApplicationContribution).to(OpenSpaceBridgeContribution).inSingletonScope();
    bind(FrontendApplicationContribution).to(PermissionDialogContribution).inSingletonScope();

    // 7. Command contributions
    bind(CommandContribution).to(PaneCommandContribution).inSingletonScope();
    bind(CommandContribution).to(EditorCommandContribution).inSingletonScope();
    bind(CommandContribution).to(TerminalCommandContribution).inSingletonScope();
    bind(CommandContribution).to(FileCommandContribution).inSingletonScope();

    console.log('[OpenSpaceCore] Frontend module loaded');
});
