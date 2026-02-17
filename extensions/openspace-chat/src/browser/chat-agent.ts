import { injectable, inject } from '@theia/core/shared/inversify';
import { ChatAgent, ChatAgentLocation } from '@theia/ai-chat/lib/common/chat-agents';
import { MutableChatRequestModel, TextChatResponseContentImpl } from '@theia/ai-chat/lib/common/chat-model';
import { SessionService, StreamingUpdate } from 'openspace-core/lib/browser/session-service';
import { MessagePart } from 'openspace-core/lib/common/opencode-protocol';

@injectable()
export class OpenspaceChatAgent implements ChatAgent {
  readonly id = 'openspace';
  readonly name = 'Openspace';
  readonly description = 'AI assistant with full IDE control';
  readonly iconClass = 'codicon codicon-comment-discussion';
  readonly locations: ChatAgentLocation[] = [ChatAgentLocation.Panel];
  readonly tags: string[] = ['chat', 'openspace'];
  readonly variables: string[] = [];
  readonly prompts = [];
  readonly languageModelRequirements = [];
  readonly agentSpecificVariables = [];
  readonly functions: string[] = [];

  @inject(SessionService)
  private sessionService!: SessionService;

  async invoke(request: MutableChatRequestModel): Promise<void> {
    // Extract text
    let userMessage = request.request?.text || '';
    userMessage = userMessage.replace(/^@\w+\s*/i, '').trim();
    
    // Send via SessionService
    const parts: MessagePart[] = [{ type: 'text', text: userMessage }];
    await this.sessionService.sendMessage(parts);
    
    // Subscribe to streaming updates
    const disposable = this.sessionService.onMessageStreaming((update: StreamingUpdate) => {
      request.response.response.addContent(new TextChatResponseContentImpl(update.delta));
      if (update.isDone) {
        request.response.complete();
        disposable.dispose();
      }
    });
  }
}
