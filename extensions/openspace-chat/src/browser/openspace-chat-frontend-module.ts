import { ContainerModule } from '@theia/core/shared/inversify';
import { ChatAgent } from '@theia/ai-chat/lib/common/chat-agents';
import {
    bindViewContribution,
    FrontendApplicationContribution,
    WidgetFactory
} from '@theia/core/lib/browser';
import { ColorContribution } from '@theia/core/lib/browser/color-application-contribution';
import { OpenspaceChatAgent } from './chat-agent';
import { ChatWidget } from './chat-widget';
import { ChatViewContribution } from './chat-view-contribution';
import { SessionsWidget, SessionsWidgetContribution } from './sessions-widget';
import { OpenspaceChatColorContribution } from './chat-color-contribution';

import './style/chat-widget.css';
import './style/message-timeline.css';
import './style/prompt-input.css';

export default new ContainerModule((bind, _unbind, _isBound, _rebind) => {
    // Chat agent
    bind(ChatAgent).to(OpenspaceChatAgent).inSingletonScope();
    console.log('[OpenSpaceChat] Chat agent registered');

    // Chat widget
    bind(ChatWidget).toSelf().inSingletonScope();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: ChatWidget.ID,
        createWidget: () => ctx.container.get<ChatWidget>(ChatWidget)
    })).inSingletonScope();

    // View contribution (registers widget in left panel)
    bindViewContribution(bind, ChatViewContribution);
    bind(FrontendApplicationContribution).toService(ChatViewContribution);

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
