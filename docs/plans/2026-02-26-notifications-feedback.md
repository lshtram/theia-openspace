# Notifications & Feedback: theia-openspace vs opencode
*Code-level analysis · 2026-02-26*

---

## 1. Architecture Comparison

### theia-openspace notification stack (current)
```
SessionService (openspace-core)
  ├─ notifySessionError(sessionId, errorMessage)
  │    └─ _sessionErrors.set(sessionId, msg)   ← stored but never surfaced as toast
  └─ appendMessage() — if non-active session:
       └─ notificationService.incrementUnseen(sessionId)

SessionNotificationServiceImpl (openspace-core/notification-service.ts)
  ├─ getUnseenCount(sessionId): number          ← persisted to localStorage
  ├─ markSeen(sessionId): void
  ├─ incrementUnseen(sessionId): void
  └─ onUnseenChanged: Event<void>

ChatWidget (openspace-chat)
  └─ [uses MessageService.error() for operation failures]
  └─ [NO turn-complete notifications]
  └─ [NO sound system]
  └─ [NO copy-to-clipboard feedback state]

Theia built-in:
  MessageService        ← .info(), .warn(), .error() → shows Theia toast popups
  NotificationManager   ← @theia/messages — renders toasts in bottom-right corner
```

### opencode notification stack (Solid.js)
```
NotificationContext (context/notification.tsx)
  ├─ Notification types: TurnCompleteNotification | ErrorNotification
  ├─ handleSessionIdle()
  │    ├─ playSound(soundSrc(settings.sounds.agent()))     ← sounds
  │    ├─ platform.notify(title, session.title, href)      ← OS notification
  │    └─ append({ type:"turn-complete", viewed, ... })    ← persisted 500 max, 30d TTL
  ├─ handleSessionError()
  │    ├─ playSound(soundSrc(settings.sounds.errors()))
  │    ├─ platform.notify(title, description, href)
  │    └─ append({ type:"error", error, viewed, ... })
  └─ session.markViewed(sessionId)                         ← clears unseen count

utils/sound.ts
  ├─ playSound(src: string|undefined): void    ← HTMLAudioElement
  └─ soundById: Record<SoundID, string>        ← 39 sounds across 5 categories

context/settings.tsx
  ├─ notifications: { agent, permissions, errors }: boolean
  └─ sounds: { agentEnabled, agent, permissionsEnabled, permissions, errorsEnabled, errors }

NotificationSettings:
  agent: boolean         (default: true)
  permissions: boolean   (default: true)
  errors: boolean        (default: false)

SoundSettings:
  agentEnabled: boolean      (default: true)
  agent: string              (default: "staplebops-01")
  permissionsEnabled: boolean (default: true)
  permissions: string        (default: "staplebops-02")
  errorsEnabled: boolean     (default: true)
  errors: string             (default: "nope-03")
```

---

## 2. Gap Analysis (Code Level)

### 2.1 Turn-Complete Notifications

| Feature | opencode reference | theia-openspace | Gap |
|---|---|---|---|
| Toast on turn complete (non-active session) | `handleSessionIdle()` → `platform.notify()` | absent | ❌ Missing |
| Toast on turn complete (active session) | subtle — streaming bar disappears, turn shows | streaming bar disappears | ✅ Equivalent |
| Deep-link "Open" button in notification | `href = /${base64(dir)}/session/${id}` → `platform.notify(title, body, href)` | absent | ❌ Missing |
| Turn-complete notification gated by settings | `settings.notifications.agent()` | absent | ❌ Missing |

### 2.2 Error Notifications

| Feature | opencode reference | theia-openspace | Gap |
|---|---|---|---|
| Toast on session error | `handleSessionError()` → `platform.notify()` | `notifySessionError()` stores error in map but shows no toast | ⚠️ Data stored, not surfaced |
| Error toast for non-active sessions | always fires even for non-active sessions | absent | ❌ Missing |
| Error toast for active session | fires on error even if active | `messageService.error()` not wired to SSE errors | ❌ Missing |
| "Go to session" action in error toast | `href` passed to `platform.notify()` | absent | ❌ Missing |

### 2.3 Sound System

| Feature | opencode reference | theia-openspace | Gap |
|---|---|---|---|
| Sound on turn complete | `playSound(settings.sounds.agent())` | absent | ❌ Missing entirely |
| Sound on permission request | `playSound(settings.sounds.permissions())` | absent | ❌ Missing |
| Sound on error | `playSound(settings.sounds.errors())` | absent | ❌ Missing |
| Sound selection (39 options) | `soundById: Record<SoundID, string>` — bundled files | absent | ❌ Missing |
| Per-sound-type enable/disable | `settings.sounds.agentEnabled()` etc. | absent | ❌ Missing |
| Sound settings UI | `context/settings.tsx` → stored in localStorage | absent | ❌ Missing |

### 2.4 Copy-to-Clipboard Feedback

| Feature | opencode reference | theia-openspace | Gap |
|---|---|---|---|
| "Copied ✓" transient state (3s) | `state.copied: boolean` + 3s timeout in `useSessionShare()` | absent | ❌ Missing — buttons change no state |
| Copy feedback on session share | `setState("copied", true); setTimeout(false, 3000)` | `messageService.info('Session shared — URL copied to clipboard')` | ✅ Using Theia toast |
| Copy feedback on message copy | (part of P1-A — not yet implemented) | not yet implemented | ❌ Out of scope here |

**Note:** theia-openspace already uses `messageService.info()` for the session share copy — this is the correct Theia approach. The inline "Copied ✓" button state is a secondary enhancement.

### 2.5 Context Usage Warning

| Feature | opencode reference | theia-openspace | Gap |
|---|---|---|---|
| Context usage progress indicator | `SessionContextUsage` component with progress circle | absent | ❌ Missing (tracked in chat-parity P1-E) |
| Warning when context > 80% | fires toast / changes indicator color | absent | ❌ Missing |

### 2.6 Unseen Count & Notification Wiring

| Feature | opencode reference | theia-openspace | Gap |
|---|---|---|---|
| Unseen count per session | `NotificationContext.session.unseenCount(id)` | `SessionNotificationServiceImpl.getUnseenCount()` | ✅ Service exists |
| Blue dot on session list item | `unseenCount > 0` → blue dot on `SessionRow` | service wired but dot **not yet rendered** | ⚠️ Partial — rendering gap (tracked in session-parity S3-B) |
| Mark seen on session switch | `notification.session.markViewed(id)` | `notificationService.markSeen(id)` in `setActiveSession()` | ✅ Wired |
| Increment unseen on new message | `appendToIndex()` on non-active session | `incrementUnseen()` in `appendMessage()` if non-active | ✅ Wired |
| Increment unseen on turn complete | linked to `TurnCompleteNotification` | **only increments on raw message SSE, not turn-complete event** | ⚠️ Different trigger |

### 2.7 Notification Preferences

| Feature | opencode reference | theia-openspace | Gap |
|---|---|---|---|
| "Notify on agent response" toggle | `settings.notifications.agent: boolean` in settings store | absent | ❌ Missing |
| "Notify on errors" toggle | `settings.notifications.errors: boolean` | absent | ❌ Missing |
| "Notify on permissions" toggle | `settings.notifications.permissions: boolean` | absent | ❌ Missing |
| Sound on/off toggle | `settings.sounds.agentEnabled` etc. | absent | ❌ Missing |
| Settings UI location | `context/settings.tsx` localStorage | **Theia approach: `PreferenceService` — appears in Settings panel** | Design difference |

---

## 3. Prioritised Implementation Plan

---

### Priority 1 — High Impact, Self-Contained

---

#### N1-A: Turn-Complete Toast (Non-Active Sessions)
**Effort:** Small (2–3 hours)

**What:** When an agent turn completes in a session that is NOT currently active, show a Theia toast notification with an "Open" action. When active, do nothing extra (the UI already shows streaming complete).

**Theia approach:** Use the existing `MessageService` (already injected everywhere). This is the correct Theia pattern — `MessageService.info(message, action)` shows a toast in the bottom-right corner via `@theia/messages`.

**Where to implement:**

1. **`extensions/openspace-core/src/browser/session-service.ts`** — fire a new event when a non-active session becomes idle:
   ```typescript
   // New event emitter (alongside existing onActiveSessionChanged)
   private readonly onBackgroundTurnCompleteEmitter = new Emitter<Session>();
   readonly onBackgroundTurnComplete = this.onBackgroundTurnCompleteEmitter.event;
   ```
   In `updateSessionStatus()` (where status transitions are handled):
   ```typescript
   // When a session transitions busy → idle and is NOT the active session:
   if (prevStatus.type === 'busy' && status.type === 'idle'
       && sessionId !== this._activeSession?.id) {
     const session = this._sessions.find(s => s.id === sessionId);
     if (session) this.onBackgroundTurnCompleteEmitter.fire(session);
   }
   ```

2. **`extensions/openspace-chat/src/browser/chat-view-contribution.ts`** — subscribe and show toast:
   ```typescript
   @inject(MessageService)
   protected readonly messageService!: MessageService;

   onStart(): void {
     // ... existing wiring
     this.sessionService.onBackgroundTurnComplete(async (session) => {
       const pref = this.preferenceService.get<boolean>('openspace.notifications.turnComplete', true);
       if (!pref) return;
       const title = session.title ?? `Session ${session.id.slice(0, 8)}`;
       const action = await this.messageService.info(`Agent turn complete: "${title}"`, 'Open');
       if (action === 'Open') {
         this.sessionService.setActiveSession(session.id);
       }
     });
   }
   ```

**Data flow:** `SessionService.updateSessionStatus()` → `onBackgroundTurnComplete` event → `ChatViewContribution` → `MessageService.info()` toast

---

#### N1-B: Error Notification Toast
**Effort:** Small (2 hours)

**What:** When a session SSE error fires, show a Theia error toast. Currently `notifySessionError()` stores the error but shows nothing.

**Where to implement:**

1. **`extensions/openspace-core/src/browser/session-service.ts`** — fire new event alongside existing error storage:
   ```typescript
   private readonly onSessionErrorEmitter = new Emitter<{ sessionId: string; message: string; session?: Session }>();
   readonly onSessionError = this.onSessionErrorEmitter.event;
   ```
   In `notifySessionError()`:
   ```typescript
   notifySessionError(sessionId: string, errorMessage: string): void {
     this._sessionErrors.set(sessionId, errorMessage);
     const session = this._sessions.find(s => s.id === sessionId);
     this.onSessionErrorEmitter.fire({ sessionId, message: errorMessage, session });
   }
   ```

2. **`extensions/openspace-chat/src/browser/chat-view-contribution.ts`** — subscribe and show error toast:
   ```typescript
   this.sessionService.onSessionError(async ({ session, message }) => {
     const pref = this.preferenceService.get<boolean>('openspace.notifications.errors', true);
     if (!pref) return;
     const title = session?.title ?? 'Unknown session';
     const action = await this.messageService.error(`Agent error in "${title}": ${message}`, 'Open');
     if (action === 'Open' && session) {
       this.sessionService.setActiveSession(session.id);
     }
   });
   ```

**Note on active vs background sessions:** The error toast fires for ALL sessions (including active), because errors in the active session are not always surfaced by inline UI. The user may have scrolled away from the error message.

---

#### N1-C: Notification Preferences in Theia Settings
**Effort:** Small (1–2 hours)

**What:** Add notification toggle preferences so users can disable toasts in **Settings → Features → OpenSpace**.

**Theia approach:** Extend the existing `openspace-preferences.ts` — no new UI needed; Theia's built-in Settings panel renders them automatically.

**Where to implement:**

1. **`extensions/openspace-settings/src/browser/openspace-preferences.ts`** — add entries:
   ```typescript
   export const OpenspacePreferences = {
     // ... existing
     NOTIFICATIONS_TURN_COMPLETE: 'openspace.notifications.turnComplete' as const,
     NOTIFICATIONS_ERRORS:         'openspace.notifications.errors' as const,
     SOUNDS_ENABLED:               'openspace.sounds.enabled' as const,
   };

   export const OpenspacePreferenceDefaults = {
     // ... existing
     [OpenspacePreferences.NOTIFICATIONS_TURN_COMPLETE]: true,
     [OpenspacePreferences.NOTIFICATIONS_ERRORS]: true,
     [OpenspacePreferences.SOUNDS_ENABLED]: false,  // opt-in for sound
   };

   // In OpenspacePreferenceSchema.properties:
   [OpenspacePreferences.NOTIFICATIONS_TURN_COMPLETE]: {
     type: 'boolean',
     default: true,
     description: 'Show a notification when an agent turn completes in a background session.',
   },
   [OpenspacePreferences.NOTIFICATIONS_ERRORS]: {
     type: 'boolean',
     default: true,
     description: 'Show a notification when an agent session encounters an error.',
   },
   [OpenspacePreferences.SOUNDS_ENABLED]: {
     type: 'boolean',
     default: false,
     description: 'Play a sound when an agent turn completes or an error occurs.',
   },
   ```

2. **Read in `ChatViewContribution`:** All preference reads use:
   ```typescript
   @inject(PreferenceService)
   protected readonly preferenceService!: PreferenceService;

   const enabled = this.preferenceService.get<boolean>('openspace.notifications.turnComplete', true);
   ```

**User experience:** The user opens Settings (`Ctrl+,`), searches "openspace notifications" or browses Features → OpenSpace, and sees the three toggles. No custom settings UI needed.

---

### Priority 2 — Medium Effort

---

#### N2-A: Sound System (Web Audio API)
**Effort:** Medium (4–6 hours)

**What:** Play a short audio cue on turn-complete and on errors, when `openspace.sounds.enabled` is true.

**Theia approach:** Web Audio API (`AudioContext.createOscillator()`) — generates tones programmatically, no audio files to bundle, works offline.

**Where to implement:**

1. **New file: `extensions/openspace-chat/src/browser/sound-service.ts`**
   ```typescript
   export type SoundEvent = 'turn-complete' | 'error' | 'permission';

   export class SoundService {
     private _ctx: AudioContext | undefined;

     private getCtx(): AudioContext | undefined {
       if (typeof AudioContext === 'undefined') return undefined;
       if (!this._ctx) this._ctx = new AudioContext();
       return this._ctx;
     }

     play(event: SoundEvent): void {
       const ctx = this.getCtx();
       if (!ctx) return;

       const freq = event === 'turn-complete' ? [880, 1047]  // A5 → C6 (pleasant chime)
                  : event === 'error'          ? [220, 185]   // A3 → F#3 (descending, warning)
                  : /* permission */             [660];        // E5 (single tone)

       let time = ctx.currentTime;
       for (const f of freq) {
         const osc  = ctx.createOscillator();
         const gain = ctx.createGain();
         osc.connect(gain);
         gain.connect(ctx.destination);
         osc.frequency.value = f;
         osc.type = 'sine';
         gain.gain.setValueAtTime(0.15, time);
         gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
         osc.start(time);
         osc.stop(time + 0.25);
         time += 0.18;
       }
     }
   }

   export const soundService = new SoundService();  // singleton, not DI
   ```

2. **Wire into `ChatViewContribution`:**
   ```typescript
   import { soundService } from './sound-service';

   // In onBackgroundTurnComplete handler:
   const soundEnabled = this.preferenceService.get<boolean>('openspace.sounds.enabled', false);
   if (soundEnabled) soundService.play('turn-complete');

   // In onSessionError handler:
   if (soundEnabled) soundService.play('error');
   ```

3. **Wire into permission request handler** (already in `chat-widget.tsx` or `chat-view-contribution.ts` where `onPendingQuestion` is handled):
   ```typescript
   if (soundEnabled) soundService.play('permission');
   ```

**Design rationale:** Web Audio API tones require no bundled files, work in all Chromium-based environments (Theia runs on Electron/Chrome), and avoid copyright/licensing issues with third-party sound files. The two-note chime pattern is immediately distinguishable from ambient IDE sounds.

**Note:** `AudioContext` requires a user gesture before first use (browser autoplay policy). The first sound after page load may be silently blocked; subsequent ones work fine. This matches opencode's behavior.

---

#### N2-B: Inline "Copied ✓" State for Action Buttons
**Effort:** Small (2 hours)

**What:** When a copy action succeeds (session share URL copy, future message copy), briefly show "Copied ✓" on the button instead of using only a toast.

**Where to implement:**

- **`extensions/openspace-chat/src/browser/chat-widget.tsx`** — `handleShareSession()`:
  ```typescript
  const [shareUrlCopied, setShareUrlCopied] = React.useState(false);

  const handleShareSession = React.useCallback(async () => {
    try {
      const shareResult = await sessionService.shareSession();
      if (shareResult?.share?.url) {
        await navigator.clipboard.writeText(shareResult.share.url);
        setShareUrlCopied(true);
        setTimeout(() => setShareUrlCopied(false), 2000);
        messageService.info('Session shared — URL copied to clipboard');
      }
    } catch (error) {
      messageService.error(`Failed to share session: ${error}`);
    }
  }, [sessionService, messageService]);
  ```
  In `ChatHeaderBar` "Share" menu item:
  ```tsx
  <button onClick={handleShareSession}>
    {shareUrlCopied ? 'Copied ✓' : 'Share Session'}
  </button>
  ```

- The same pattern applies to the message copy button (P1-A from chat parity plan), which should be implemented there.

---

#### N2-C: Context Usage Warning Toast
**Effort:** Small (1–2 hours)

**What:** When the context window is > 80% full, show a one-time warning toast per session suggesting a `/compact` command.

**Note:** This overlaps with chat parity plan P1-E (context usage indicator). The warning toast is the notification component; the visual indicator in the footer is separate.

**Where to implement:**

- **`extensions/openspace-chat/src/browser/chat-widget.tsx`** — in `ChatComponent`:
  ```typescript
  const contextWarnedRef = React.useRef<Set<string>>(new Set());  // sessionId set

  // After each message render update, check token usage:
  React.useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last) return;
    const stepFinish = last.parts?.find(p => p.type === 'step-finish');
    if (!stepFinish?.tokens || !activeSession) return;

    const { input = 0, output = 0 } = stepFinish.tokens;
    const totalUsed = input + output;
    const contextLimit = activeSession.model?.limit?.context ?? 0;
    if (!contextLimit) return;

    const usagePct = totalUsed / contextLimit;
    const warned = contextWarnedRef.current;
    if (usagePct >= 0.80 && !warned.has(activeSession.id)) {
      warned.add(activeSession.id);
      const pct = Math.round(usagePct * 100);
      messageService.warn(
        `Context window is ${pct}% full. Run /compact to summarise the session.`
      );
    }
  }, [messages, activeSession, messageService]);
  ```

**Note on data:** This requires `step-finish` parts to carry `tokens` data — verified in opencode SDK; the field exists in the theia-openspace message pipeline.

---

## 4. Summary Table

| ID | Feature | Files Affected | Effort | Priority |
|---|---|---|---|---|
| N1-A | Turn-complete toast (background sessions) | `session-service.ts`, `chat-view-contribution.ts` | S | 🔴 P1 |
| N1-B | Error notification toast | `session-service.ts`, `chat-view-contribution.ts` | S | 🔴 P1 |
| N1-C | Notification preferences in Theia Settings | `openspace-preferences.ts` | S | 🔴 P1 |
| N2-A | Sound system (Web Audio API tones) | new `sound-service.ts`, `chat-view-contribution.ts` | M | 🟡 P2 |
| N2-B | Inline "Copied ✓" state on action buttons | `chat-widget.tsx` | S | 🟡 P2 |
| N2-C | Context usage warning toast | `chat-widget.tsx` | S | 🟡 P2 |

*S = small (<4h), M = medium (4–8h)*

---

## 5. Theia-Specific Design Decisions

| Decision | Rationale |
|---|---|
| `MessageService.info/error()` instead of custom toast component | Theia's built-in toast system renders in the correct location, respects focus/a11y, and is already wired. No `toast-service.ts`/`toast-stack.tsx` needed. |
| New `onBackgroundTurnComplete` event on `SessionService` instead of coupling to NotificationContext | Keeps `SessionService` decoupled from UI. `ChatViewContribution` is the right place to bridge service events → UI notifications. |
| Preference schema in `openspace-preferences.ts` instead of custom settings store | Theia's PreferenceService persists to `settings.json`, syncs across workspace, and renders in the built-in Settings panel. No custom UI or localStorage needed. |
| Web Audio API tones instead of bundled sound files | No asset bundling needed; works offline; no copyright concerns. Tones are distinguishable and non-disruptive. |
| `onSessionError` event instead of calling MessageService directly from SessionService | `SessionService` (core) should not depend on `@theia/messages` (ui). Events keep the dependency direction correct. |
| Sound opt-in by default (`default: false`) | opencode defaults sound to on; in an IDE context, unexpected sounds during coding sessions are more intrusive — opt-in is safer. |

---

## 6. Already Implemented (No Action Needed)

The following feedback patterns are already correctly implemented in theia-openspace:

- `MessageService.info()` toast for session share URL copy (`chat-widget.tsx:914`)
- `MessageService.error()` for all synchronous user-initiated operation failures
- `MessageService.warn()` for delete confirmation dialogs
- Unseen count tracking: `SessionNotificationService.incrementUnseen()` wired in `appendMessage()`
- `markSeen()` called on `setActiveSession()` in `session-service.ts`
- Streaming-complete indicator in `TurnGroup` (spinner disappears, duration shown)
- Retry countdown banner for network errors
- Inline error display for SSE-delivered errors (via `renderErrorPart()`)

---

## 7. Relationship to Existing Plans

| This plan | Existing plan reference | Status |
|---|---|---|
| N1-A (turn-complete toast) | chat-parity P2-C "Toast / notification system" | **Supersedes** — uses `MessageService` directly, simpler |
| N1-B (error toast) | chat-parity P2-C "ErrorNotification" | **Supersedes** |
| N1-C (preferences) | session-parity — not covered | New |
| N2-A (sounds) | chat-parity P2-C "Sound system" | **Supersedes** |
| N2-B (Copied state) | chat-parity P2-C "Copy-to-clipboard feedback" | **Supersedes** |
| N2-C (context warning) | chat-parity P1-E "Context usage indicator" | **Complements** (P1-E is the visual bar; N2-C is the warning toast) |
