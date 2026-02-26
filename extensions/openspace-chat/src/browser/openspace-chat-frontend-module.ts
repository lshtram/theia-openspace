import { ContainerModule } from '@theia/core/shared/inversify';
import { ChatAgent } from '@theia/ai-chat/lib/common/chat-agents';
import {
    bindViewContribution,
    FrontendApplicationContribution,
    WidgetFactory
} from '@theia/core/lib/browser';
import { ColorContribution } from '@theia/core/lib/browser/color-application-contribution';
import { CommandContribution } from '@theia/core/lib/common/command';
import { KeybindingContribution } from '@theia/core/lib/browser/keybinding';
import { OpenspaceChatAgent } from './chat-agent';
import { ChatWidget } from './chat-widget';
import { ChatViewContribution, ChatCommandContribution } from './chat-view-contribution';
import { SessionsWidget, SessionsWidgetContribution } from './sessions-widget';
import { OpenspaceChatColorContribution } from './chat-color-contribution';
import { SessionViewStore, SessionViewStoreImpl } from './session-view-store';

import './style/chat-widget.css';
import './style/message-timeline.css';
import './style/prompt-input.css';

export default new ContainerModule((bind, _unbind, _isBound, _rebind) => {
    // Chat agent
    bind(ChatAgent).to(OpenspaceChatAgent).inSingletonScope();
    if (process.env.NODE_ENV !== 'production') { console.log('[OpenSpaceChat] Chat agent registered'); }

    // Session view store (scroll position persistence, LRU 50 entries)
    bind(SessionViewStore).to(SessionViewStoreImpl).inSingletonScope();

    // Chat widget
    bind(ChatWidget).toSelf().inSingletonScope();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: ChatWidget.ID,
        createWidget: () => ctx.container.get<ChatWidget>(ChatWidget)
    })).inSingletonScope();

    // View contribution (registers widget in left panel)
    bindViewContribution(bind, ChatViewContribution);
    bind(FrontendApplicationContribution).toService(ChatViewContribution);

    // Session keyboard shortcuts (Mod+Shift+S = new session, Mod+Shift+N = rename)
    bind(ChatCommandContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(ChatCommandContribution);
    bind(KeybindingContribution).toService(ChatCommandContribution);

    // Sessions widget (left sidebar panel)
    bind(SessionsWidget).toSelf().inSingletonScope();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: SessionsWidget.ID,
        createWidget: () => ctx.container.get<SessionsWidget>(SessionsWidget)
    })).inSingletonScope();
    bindViewContribution(bind, SessionsWidgetContribution);
    bind(FrontendApplicationContribution).toService(SessionsWidgetContribution);

    // Color contributions — registers --theia-openspace-chat-* CSS variables
    bind(OpenspaceChatColorContribution).toSelf().inSingletonScope();
    bind(ColorContribution).toService(OpenspaceChatColorContribution);
});
