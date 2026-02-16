import { injectable } from '@theia/core/shared/inversify';
import { ChatAgent, ChatAgentLocation } from '@theia/ai-chat/lib/common/chat-agents';
import { MutableChatRequestModel, TextChatResponseContentImpl } from '@theia/ai-chat/lib/common/chat-model';

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

  async invoke(request: MutableChatRequestModel): Promise<void> {
    // Get the last user message
    let userMessage = request.request?.text || '';
    
    // Strip @agent mention if present
    userMessage = userMessage.replace(/^@\w+\s*/i, '').trim();
    
    // Create echo response
    const responseContent = new TextChatResponseContentImpl(`Echo: ${userMessage}`);
    
    // Add the response to the request (response.response gets the ChatResponseImpl)
    request.response.response.addContent(responseContent);
    
    // Mark response as complete
    request.response.complete();
  }
}
