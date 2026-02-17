---
id: REQ-MESSAGE-TIMELINE
title: Message Timeline with Streaming (Task 2.3)
author: oracle_e3f7
status: READY
date: 2026-02-17
task_id: Task-2.3
phase: Phase 2 (Chat & Prompt System)
dependencies: Task-2.2
---

# Requirements: Message Timeline with Streaming

## 1. Introduction

### 1.1 Background

Currently, the chat widget displays messages in a basic list format without proper styling or streaming support. Users need a modern, intuitive conversation interface that clearly distinguishes between user and assistant messages, shows streaming progress, and handles scrolling intelligently.

### 1.2 Goals

1. Replace basic message list with a proper conversation timeline
2. Distinct visual styling for user vs assistant messages
3. Real-time streaming indicator during AI response
4. Smart auto-scroll that respects user navigation

## 2. User Stories

### US-1: Clear Conversation Layout
**As a** developer  
**I want to** see my messages and AI responses clearly distinguished  
**So that** I can easily follow the conversation flow

**Acceptance:**
- User messages appear on the right (or with distinct styling)
- Assistant messages appear on the left (or with distinct styling)
- Each message shows the sender role ("You" / "Assistant")
- Timestamps visible on hover or inline

### US-2: Real-Time Streaming
**As a** developer  
**I want to** see AI responses appear character-by-character  
**So that** I know the AI is working and can read partial responses immediately

**Acceptance:**
- Streaming text appears incrementally
- Blinking cursor or progress indicator during streaming
- Smooth animation of new text appearing
- No flickering or jumping during stream

### US-3: Scroll Control
**As a** developer  
**I want to** scroll up to read previous messages while new ones arrive  
**So that** I can review context without losing my place

**Acceptance:**
- Auto-scroll keeps view at bottom when I'm already there
- If I scroll up, auto-scroll pauses
- Clear indicator when new messages arrive while scrolled up
- Easy way to jump back to bottom

## 3. Functional Requirements

### FR-1: Message Timeline Layout
**ID:** FR-1  
**Description:** Render messages in a proper conversation timeline

**Requirements:**
- Container with vertical layout for messages
- User messages: right-aligned, different background color (e.g., blue tint)
- Assistant messages: left-aligned, different background color (e.g., gray tint)
- Message bubbles with padding, border-radius, shadows
- Avatar/icon for each role (user: person icon, assistant: robot icon)
- Timestamp below each message (on hover or always visible)
- Group consecutive messages from same sender

**Design:**
```
┌─────────────────────────────────────┐
│           🤖 Assistant              │
│ ┌───────────────────────────────┐   │
│ │ Hello! How can I help you?    │   │
│ └───────────────────────────────┘   │
│                          2:34 PM    │
│                           👤 You    │
│   ┌─────────────────────────────┐   │
│   │ Can you explain this code?  │   │
│   └─────────────────────────────┘   │
│                           2:35 PM   │
├─────────────────────────────────────┤
│ [Streaming...]          🤖 Assistant│
│ ┌───────────────────────────────┐   │
│ │ Here's the explanation... ▋   │   │
│ └───────────────────────────────┘   │
└─────────────────────────────────────┘
```

### FR-2: Streaming Response Display
**ID:** FR-2  
**Description:** Show streaming responses with visual indicators

**Requirements:**
- Display streaming text incrementally as it arrives
- Show blinking cursor (▋) or typing indicator during stream
- Smooth text updates without layout shifts
- Optional: Progress bar or spinner for long responses
- Distinguish streaming message from completed message (slightly different opacity or border)

**Implementation:**
- Use `streamingData` from SessionService
- Subscribe to `onMessageStream` events
- Append streaming delta to current message text
- Show cursor indicator when `isStreaming` is true

### FR-3: Smart Auto-Scroll
**ID:** FR-3  
**Description:** Auto-scroll to new messages with user override

**Requirements:**
- Scroll to bottom when new message arrives (if already near bottom)
- Detect user scroll position (scroll spy)
- Pause auto-scroll when user scrolls up (threshold: >100px from bottom)
- Show "New messages" button/indicator when scrolled up
- Resume auto-scroll when user clicks indicator or scrolls to bottom
- Smooth scroll animation

**Scroll Thresholds:**
- Within 50px of bottom: Auto-scroll enabled
- >100px from bottom: Auto-scroll paused
- New message arrives while scrolled up: Show notification

### FR-4: Message Grouping
**ID:** FR-4  
**Description:** Group consecutive messages from same sender

**Requirements:**
- Don't show avatar/header for consecutive messages from same role
- Reduce margin between grouped messages
- Show timestamp only on first message in group (or on hover)
- Clear visual separation between groups from different senders

### FR-5: Empty State
**ID:** FR-5  
**Description:** Show appropriate empty state

**Requirements:**
- When no messages: "No messages yet" with helpful hint
- Show prompt suggestions or welcome message
- Different styling from message list

## 4. Non-Functional Requirements

### NFR-1: Performance
- Message list handles 100+ messages without lag
- Virtual scrolling for very long conversations (optional)
- Smooth 60fps animations

### NFR-2: Accessibility
- ARIA labels for message roles
- Keyboard navigation between messages
- Screen reader announces new messages (respect reduced motion)

### NFR-3: Responsive Design
- Works on various panel sizes
- Messages reflow gracefully
- Minimum width: 300px

## 5. Acceptance Criteria

### AC-1: Message Styling
- User and assistant messages visually distinct
- Proper padding, margins, border-radius
- Avatar/icon for each role

### AC-2: Streaming Display
- Streaming text appears incrementally
- Blinking cursor visible during stream
- No text duplication or corruption

### AC-3: Auto-Scroll Behavior
- Scrolls to bottom when at bottom and new message arrives
- Does NOT scroll when user has scrolled up
- "New messages" indicator appears when applicable
- Clicking indicator jumps to bottom

### AC-4: Message Grouping
- Consecutive messages from same sender grouped visually
- Reduced spacing between grouped messages
- Timestamps displayed appropriately

### AC-5: Empty State
- Clear message when no conversation
- Helpful hint or suggestions shown

## 6. Technical Design

### Components Needed

1. **MessageTimeline.tsx** - Main timeline container
2. **MessageBubble.tsx** - Individual message component
3. **StreamingIndicator.tsx** - Cursor/typing indicator
4. **ScrollController.ts** - Scroll spy and auto-scroll logic
5. **message-timeline.css** - All styling

### State Management

```typescript
interface TimelineState {
    messages: Message[];
    streamingMessageId?: string;
    streamingText: string;
    isUserScrolledUp: boolean;
    hasNewMessages: boolean;
    autoScrollEnabled: boolean;
}
```

### Scroll Detection Logic

```typescript
const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;
    
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    
    setIsUserScrolledUp(distanceFromBottom > 100);
    setAutoScrollEnabled(distanceFromBottom < 50);
};

useEffect(() => {
    if (autoScrollEnabled && !isUserScrolledUp) {
        scrollToBottom();
    } else if (newMessageArrived) {
        setHasNewMessages(true);
    }
}, [messages, streamingText]);
```

## 7. Files to Create/Modify

### New Files
- `extensions/openspace-chat/src/browser/message-timeline.tsx`
- `extensions/openspace-chat/src/browser/message-bubble.tsx`
- `extensions/openspace-chat/src/browser/style/message-timeline.css`

### Modified Files
- `extensions/openspace-chat/src/browser/chat-widget.tsx` - Replace message list with MessageTimeline

## 8. CSS Design Tokens

```css
/* Message bubbles */
--message-user-bg: var(--theia-button-background);
--message-user-fg: var(--theia-button-foreground);
--message-assistant-bg: var(--theia-editor-background);
--message-assistant-fg: var(--theia-editor-foreground);
--message-border-radius: 12px;
--message-padding: 12px 16px;
--message-max-width: 85%;

/* Spacing */
--message-gap: 16px;
--message-group-gap: 4px;

/* Streaming indicator */
--cursor-color: var(--theia-editor-foreground);
--cursor-blink-duration: 1s;

/* Scroll indicator */
--new-messages-bg: var(--theia-button-background);
--new-messages-fg: var(--theia-button-foreground);
```

## 9. Out of Scope (Future Tasks)

- Message reactions/feedback
- Message editing
- Message search/filter
- Message deletion
- Threading/replies

## 10. Dependencies

- Task 2.2 complete (multi-part prompt input)
- SessionService streaming events
- Theia CSS variables for theming

## 11. Estimated Effort

**4-6 hours**
- Component structure: 1 hour
- Message styling: 1 hour
- Streaming integration: 1 hour
- Scroll controller: 1.5 hours
- Polish & testing: 0.5-1.5 hours
