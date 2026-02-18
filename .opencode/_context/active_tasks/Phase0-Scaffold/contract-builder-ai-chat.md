# Contract: Builder - Verify Theia AI Chat Panel

**Task ID:** Phase0.7-VerifyAIChat  
**Assigned to:** Builder  
**Priority:** P0  
**Created:** 2026-02-16  
**Oracle:** oracle_e3f7

---

## Objective

Verify that the @theia/ai-chat-ui panel is visible and functional. Register a minimal chat agent that echoes input.

## Background

Theia AI framework provides chat UI out of the box. We need to:
1. Ensure the chat panel is visible in the UI
2. Register a placeholder agent so the chat is functional
3. Verify message send/receive works

## Implementation

### 1. Chat Agent Registration

Create a simple echo agent in `openspace-chat`:

**extensions/openspace-chat/src/browser/chat-agent.ts:**

```typescript
import { injectable } from '@theia/core/shared/inversify';
import { AbstractStreamParsingChatAgent } from '@theia/ai-chat/lib/common/chat-agents';
import { ChatRequest, ChatResponse } from '@theia/ai-chat/lib/common/chat-model';

@injectable()
export class OpenspaceChatAgent extends AbstractStreamParsingChatAgent {
  id = 'openspace';
  name = 'Openspace';
  description = 'AI assistant with full IDE control';
  
  protected async invoke(request: ChatRequest): Promise<ChatResponse> {
    const userMessage = request.messages[request.messages.length - 1]?.content || '';
    
    return {
      type: 'markdown',
      content: `Echo: ${userMessage}`
    };
  }
}
```

**extensions/openspace-chat/src/browser/openspace-chat-frontend-module.ts:**

```typescript
import { ContainerModule } from '@theia/core/shared/inversify';
import { ChatAgent } from '@theia/ai-chat/lib/common/chat-agents';
import { OpenspaceChatAgent } from './chat-agent';

export default new ContainerModule((bind, unbind, isBound, rebind) => {
  bind(ChatAgent).to(OpenspaceChatAgent).inSingletonScope();
  console.log('[OpenSpaceChat] Chat agent registered');
});
```

### 2. Chat Widget Visibility

The chat widget should appear:
- In the left sidebar (icon)
- In the View menu
- Via command palette (Cmd+Shift+P → "Open Chat")

### 3. Test the Chat

1. Open Theia in browser
2. Look for chat icon in sidebar (usually a speech bubble icon)
3. Click to open chat panel
4. Type a message and press Enter
5. Verify you see "Echo: [your message]" in response

## Success Criteria

- [ ] Chat panel icon visible in sidebar
- [ ] Chat panel opens when clicked
- [ ] Can type a message in the input box
- [ ] Pressing Enter sends the message
- [ ] Echo response appears in the chat
- [ ] No errors in browser console

## Troubleshooting

If chat panel is not visible:

1. Check that @theia/ai-chat and @theia/ai-chat-ui are in browser-app dependencies
2. Verify the agent is bound correctly in the DI module
3. Check browser console for errors
4. Try opening via command palette: Cmd+Shift+P → "Open Chat"

If agent doesn't respond:

1. Check that ChatAgent is bound in openspace-chat module
2. Verify agent ID is unique
3. Check console for agent registration logs

## Testing

1. Build: `yarn build`
2. Start: `yarn start:browser`
3. Verify:
   - Open http://localhost:3000
   - Look for chat icon in left sidebar
   - Click chat icon → panel opens
   - Type "hello" → press Enter
   - See "Echo: hello" in response

## Time Bound

Complete within 1 session.

## Output

Write `result-ai-chat.md` in this task directory with:
- Agent implementation details
- How to open/use the chat
- Verification results (screenshots or description)
- Any issues encountered and how resolved

---

**Oracle Note:** This is a critical verification. The chat panel is our primary UI for Phase 1+. If it doesn't work, we need to know immediately. The echo agent is just for testing — real opencode integration comes in Phase 1.
