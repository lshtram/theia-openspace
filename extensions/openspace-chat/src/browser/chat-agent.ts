import { injectable, inject } from '@theia/core/shared/inversify';
import { ChatAgent, ChatAgentLocation } from '@theia/ai-chat/lib/common/chat-agents';
import { MutableChatRequestModel, TextChatResponseContentImpl } from '@theia/ai-chat/lib/common/chat-model';
import { Disposable } from '@theia/core/lib/common/disposable';
import { SessionService, StreamingUpdate } from 'openspace-core/lib/browser/session-service';
import { MessagePartInput } from 'openspace-core/lib/common/opencode-protocol';

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
    
    // Send via SessionService - use MessagePartInput for creating new parts
    const parts: MessagePartInput[] = [{ type: 'text', text: userMessage }];
    
    // T2-12: Track subscription for proper cleanup
    let subscription: Disposable | undefined;
    
    try {
      await this.sessionService.sendMessage(parts);
      
      // Subscribe to streaming updates
      subscription = this.sessionService.onMessageStreaming((update: StreamingUpdate) => {
        request.response.response.addContent(new TextChatResponseContentImpl(update.delta));
        if (update.isDone) {
          request.response.complete();
          // T2-12: Clean up subscription when streaming completes
          subscription?.dispose();
        }
      });
    } catch (error) {
      // T2-12: Clean up subscription on error
      console.error('[OpenspaceChatAgent] Error invoking agent:', error);
      subscription?.dispose();
      request.response.complete();
      throw error;
    }
  }
}
