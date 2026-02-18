# Task 1.10: Chat Widget Implementation Contract

**Status:** IN_PROGRESS  
**Created:** 2026-02-16  
**Agent:** oracle_4f2a  
**Assignee:** Builder

---

## Objective

Create minimal chat widget with send/receive capability. This is the **FIRST VISIBLE WORKING FEATURE** of the OpenSpace project.

---

## Location

**Primary File:** `extensions/openspace-chat/src/browser/chat-widget.tsx`  
**Registration:** `extensions/openspace-chat/src/browser/openspace-chat-frontend-module.ts`

---

## Functional Requirements

### 1. Widget Base Class
- Extend Theia's `ReactWidget` class from `@theia/core/lib/browser/widgets/react-widget`
- Inject `SessionService` from `openspace-core`
- Handle dependency injection via Theia's DI container

### 2. Message List (Upper Section)
- Subscribe to `sessionService.onMessagesChanged` event
- Render all messages in chronological order
- Display message metadata:
  - Role: `user` or `assistant`
  - Message text content
- For multi-part messages, concatenate all text parts
- Implement auto-scroll to bottom on new message arrival
- Handle empty state gracefully

### 3. Text Input (Lower Section)
- Simple textarea or input field for user input
- Send button OR Enter key handler (Shift+Enter for newline)
- On send action:
  - Call `sessionService.sendMessage([{ type: 'text', text: userInput }])`
  - Clear input field immediately
  - Show optimistic update (user message appears instantly)
- Disable input while streaming response

### 4. Streaming Display
- Subscribe to `sessionService.onMessageStreaming` event
- Update last assistant message incrementally as deltas arrive
- Show "..." or typing indicator while streaming active
- Ensure smooth character-by-character or chunk-by-chunk rendering
- Handle streaming completion properly

### 5. Widget Registration (Frontend Module)
- Register widget in `openspace-chat-frontend-module.ts`
- Bind as singleton widget factory
- Register view container in left panel
- Register view with proper widget ID
- Configure to open on app startup (default visible)

### 6. Edge Case Handling
- **No Active Session:** Display "Create session first" or "No active session" message
- **Empty Messages:** Show welcome message or instructions
- **Long Messages:** Handle text overflow with scrolling
- **Rapid Sends:** Prevent duplicate sends, queue if needed

### 7. Styling
- Minimal CSS — focus on functionality over appearance
- Basic layout: message list (flex-grow) + input area (fixed bottom)
- Distinguish user vs assistant messages visually (simple background colors)
- Ensure readability and proper spacing

---

## Technical Specifications

### React Component Structure

```typescript
export class ChatWidget extends ReactWidget {
  static readonly ID = 'openspace-chat-widget';
  static readonly LABEL = 'Chat';

  @inject(SessionService)
  protected readonly sessionService!: SessionService;

  constructor() {
    super();
    this.id = ChatWidget.ID;
    this.title.label = ChatWidget.LABEL;
    this.title.caption = ChatWidget.LABEL;
    this.title.closable = true;
    this.title.iconClass = 'fa fa-comments'; // Optional icon
  }

  protected render(): React.ReactNode {
    return <ChatComponent sessionService={this.sessionService} />;
  }
}
```

### React Hooks Pattern

```typescript
const [messages, setMessages] = React.useState<Message[]>([]);
const [streamingDelta, setStreamingDelta] = React.useState<string>('');
const [isStreaming, setIsStreaming] = React.useState(false);

React.useEffect(() => {
  // Subscribe to message updates
  const disposable = sessionService.onMessagesChanged(msgs => {
    setMessages([...msgs]);
    // Auto-scroll logic
  });
  return () => disposable.dispose();
}, [sessionService]);

React.useEffect(() => {
  // Subscribe to streaming updates
  const disposable = sessionService.onMessageStreaming(delta => {
    setStreamingDelta(prev => prev + delta);
    setIsStreaming(true);
  });
  return () => disposable.dispose();
}, [sessionService]);
```

### SessionService Integration

**APIs to Use:**
- `sessionService.activeSession: Session | undefined` — Check if session exists
- `sessionService.messages: Message[]` — Initial message list
- `sessionService.onMessagesChanged: Event<Message[]>` — Subscribe to updates
- `sessionService.onMessageStreaming: Event<string>` — Subscribe to streaming deltas
- `sessionService.sendMessage(parts: MessagePart[]): Promise<void>` — Send user message

**Message Structure:**
```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant';
  parts: MessagePart[];
  timestamp: number;
}

interface MessagePart {
  type: 'text' | 'image';
  text?: string;
  data?: string;
  mimeType?: string;
}
```

### Widget Registration Code

```typescript
// In openspace-chat-frontend-module.ts
bind(ChatWidget).toSelf().inSingletonScope();
bind(WidgetFactory).toDynamicValue(ctx => ({
  id: ChatWidget.ID,
  createWidget: () => ctx.container.get<ChatWidget>(ChatWidget)
})).inSingletonScope();

// Register view container and view
bind(ViewContainerIdentifier).toConstantValue({
  id: 'openspace-chat-container',
  progressLocationId: 'openspace-chat'
});
```

---

## Acceptance Criteria

### Must Have
- [ ] Widget appears in left sidebar with "Chat" label
- [ ] User can type message in input field
- [ ] Pressing Enter or clicking Send button sends message
- [ ] User message appears immediately in message list
- [ ] Agent response streams in character by character (or chunk by chunk)
- [ ] No TypeScript compilation errors
- [ ] Widget opens on app startup by default
- [ ] Handle "no active session" gracefully

### Should Have
- [ ] Auto-scroll to bottom on new messages
- [ ] Disable input while streaming
- [ ] Show streaming indicator ("...")
- [ ] Visual distinction between user/assistant messages
- [ ] Clear input field after sending

### Nice to Have
- [ ] Shift+Enter for newline, Enter for send
- [ ] Message timestamps
- [ ] Error message display if send fails

---

## Testing Checklist

### Build & Compilation
```bash
cd /Users/Shared/dev/theia-openspace
yarn build
# Should complete without TypeScript errors
```

### Runtime Verification
1. Launch application: `yarn start:browser`
2. Verify widget appears in left sidebar
3. Click widget to open (should be open by default)
4. Type "hello" and press Enter
5. Verify user message appears
6. Verify assistant response streams in
7. Send multiple messages in sequence
8. Verify auto-scroll works
9. Check console for errors

### Edge Cases
- Launch app with no session → Should show "No active session" message
- Send empty message → Should be blocked or handled gracefully
- Send very long message → Should display with scrolling
- Rapid message sends → Should queue or disable input properly

---

## Implementation Notes

### File Structure
```
extensions/openspace-chat/src/browser/
├── chat-widget.tsx               (NEW - main widget implementation)
├── openspace-chat-frontend-module.ts (UPDATE - add widget bindings)
└── style/
    └── chat-widget.css          (NEW - minimal styling)
```

### Dependencies Already Available
- `@theia/core` (ReactWidget, Event, Disposable)
- `openspace-core` (SessionService)
- React (already in Theia)

### Key Implementation Steps
1. Create `chat-widget.tsx` with ChatWidget class and ChatComponent function
2. Update `openspace-chat-frontend-module.ts` with widget factory bindings
3. Add basic CSS for layout (message list + input area)
4. Build and verify TypeScript compilation
5. Test in running application

---

## Success Metrics

**Completion Criteria:**
- Widget compiles without errors
- Widget appears in UI and is interactive
- Message send/receive flow works end-to-end
- Streaming display updates smoothly
- No console errors during normal operation

**Definition of Done:**
- Builder confirms implementation complete
- TypeScript compilation passes
- Manual testing shows functional chat flow
- Result document created with evidence (code snippets, build output)

---

## Builder Instructions

1. **Read Contract:** Review all sections above
2. **Implement Files:** Create chat-widget.tsx and update frontend module
3. **Build:** Run `yarn build` and fix any TypeScript errors
4. **Document:** Create `result-1.10-chat-widget.md` with:
   - Implementation summary
   - Code snippets (key sections)
   - Build output (success confirmation)
   - Known limitations or follow-up items
5. **Report Back:** Notify Oracle when complete

---

**Contract Version:** 1.0  
**Last Updated:** 2026-02-16
