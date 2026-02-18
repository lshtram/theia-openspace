import { ContainerModule } from '@theia/core/shared/inversify';
import { ChatAgent } from '@theia/ai-chat/lib/common/chat-agents';
import {
    bindViewContribution,
    FrontendApplicationContribution,
    WidgetFactory
} from '@theia/core/lib/browser';
import { OpenspaceChatAgent } from './chat-agent';
import { ChatWidget } from './chat-widget';
import { ChatViewContribution } from './chat-view-contribution';

import './style/chat-widget.css';
import './style/message-timeline.css';

export default new ContainerModule((bind, unbind, isBound, rebind) => {
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
});
