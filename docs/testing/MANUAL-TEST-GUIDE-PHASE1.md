# Manual Test Guide: Phase 1 Complete

**Date**: 2026-02-17  
**Purpose**: Verify all Phase 1 accomplishments manually before approval

---

## Prerequisites

### 1. Start OpenCode Server

```bash
# Terminal 1: Start OpenCode server (from OpenCode installation)
cd /path/to/opencode
./opencode serve --port 7890
```

### 2. Start Theia Openspace

```bash
# Terminal 2: Build and start Theia
cd /Users/Shared/dev/theia-openspace
yarn start:browser
```

### 3. Open Browser

Navigate to: **http://localhost:3000**

Wait for Theia to fully load (should see sidebar, editor area, chat widget).

---

## Test Suite A: Core Infrastructure (Should Already Work)

### A1. App Loading

**Expected**:
- ✅ Theia UI loads within 30 seconds
- ✅ No infinite loading spinner
- ✅ Sidebar visible (left panel)
- ✅ Editor area visible (center)
- ✅ Chat widget visible (bottom-right corner)
- ✅ Menu bar at top
- ✅ No console errors in browser DevTools (F12)

**If fails**: This is a critical blocker — report immediately

---

### A2. Chat Widget

**Expected**:
- ✅ Chat widget opens when clicked (bottom-right)
- ✅ Can type messages
- ✅ Messages appear in chat history
- ✅ Send button works

**Test**:
1. Click chat widget icon (bottom-right)
2. Type: "Hello AI"
3. Click Send or press Enter
4. Verify message appears in chat history

---

### A3. Settings Panel

**Expected**:
- ✅ Settings accessible via File > Settings (or gear icon)
- ✅ Settings panel opens
- ✅ Can modify settings

**Test**:
1. Click File → Settings (or gear icon)
2. Verify settings panel opens
3. Close panel

---

## Test Suite B: Permission Dialog UI (Task 1.14)

### B1. Permission Dialog Display

**Setup**: Requires OpenCode server running with an active session

**Test**:
1. Ensure Theia is connected to OpenCode server (chat widget should show connection status)
2. Trigger an AI action requiring permission (e.g., "Write a file called test.txt")
3. **Verify**:
   - ✅ Permission dialog appears within 1-2 seconds
   - ✅ Dialog is centered with dark overlay
   - ✅ Shows "Permission Required" header
   - ✅ Shows Agent ID (e.g., "Agent-1")
   - ✅ Shows Action Type (e.g., "file:write")
   - ✅ Shows Details/Message (e.g., "Writing to: test.txt")
   - ✅ Shows "Grant" and "Deny" buttons
   - ✅ 60-second timeout countdown visible (optional, depends on implementation)

**Screenshots**: Take screenshots of dialog

---

### B2. Grant Permission

**Test**:
1. Trigger permission request (as above)
2. Click "Grant" button
3. **Verify**:
   - ✅ Dialog closes immediately
   - ✅ Action proceeds (file is written, command runs, etc.)
   - ✅ No console errors

---

### B3. Deny Permission

**Test**:
1. Trigger permission request
2. Click "Deny" button
3. **Verify**:
   - ✅ Dialog closes immediately
   - ✅ Action is blocked
   - ✅ No console errors

---

### B4. Keyboard Shortcuts

**Test - Enter key**:
1. Trigger permission request
2. Press **Enter** key (don't click button)
3. **Verify**: Permission granted (same as clicking Grant)

**Test - Escape key**:
1. Trigger another permission request
2. Press **Escape** key
3. **Verify**: Permission denied (same as clicking Deny)

---

### B5. Queue Processing (Multiple Requests)

**Test**:
1. Trigger 3 permission requests in rapid succession (e.g., "Write file1.txt", "Write file2.txt", "Write file3.txt")
2. **Verify**:
   - ✅ First dialog shows "Request 1 of 3" (or similar queue indicator)
   - ✅ First request details shown
3. Click Grant
4. **Verify**:
   - ✅ First dialog closes
   - ✅ Second dialog appears automatically ("Request 2 of 3")
5. Click Grant
6. **Verify**:
   - ✅ Second dialog closes
   - ✅ Third dialog appears ("Request 3 of 3")
7. Click Deny
8. **Verify**:
   - ✅ Third dialog closes
   - ✅ No more dialogs (all processed)

---

### B6. Timeout (Auto-Deny)

**Test** (takes 60 seconds):
1. Trigger permission request
2. **DO NOT** click Grant or Deny
3. Wait 60 seconds
4. **Verify**:
   - ✅ Dialog auto-closes after 60 seconds
   - ✅ Permission automatically denied
   - ✅ No console errors

**Alternative** (faster verification):
- Check that timeout countdown is visible (e.g., "Auto-deny in 58s...")
- Verify countdown decreases over time

---

### B7. Browser Health Check

**During all permission dialog tests, verify**:
- ✅ No infinite loading spinner
- ✅ No browser freeze/hang
- ✅ UI remains responsive (can click buttons, type)
- ✅ No console error loops in DevTools

---

## Test Suite C: Session Management

### C1. Session Creation

**Test**:
1. In chat widget, send a message to start a conversation
2. **Verify**:
   - ✅ Session created
   - ✅ Session indicator shows (e.g., "Session active" or session ID)

---

### C2. Session Continuity

**Test**:
1. Send multiple messages in sequence
2. **Verify**:
   - ✅ All messages use same session
   - ✅ Context maintained across messages

---

### C3. Multiple Sessions (if supported)

**Test**:
1. Start new conversation (new session)
2. Switch between sessions if UI supports
3. **Verify**:
   - ✅ Sessions are independent
   - ✅ Can have multiple conversations

---

## Test Suite D: Integration Points

### D1. OpenCode Server Connection

**Test**:
1. Verify Theia is connected to OpenCode server
2. **Verify**:
   - ✅ Chat messages sent to server
   - ✅ Responses received from server
   - ✅ Connection status indicator (if any)

---

### D2. File Operations (if permission granted)

**Test**:
1. Grant permission for file write
2. **Verify**:
   - ✅ File is created in workspace
   - ✅ File appears in file explorer

---

### D3. Terminal Commands (if permission granted)

**Test**:
1. Grant permission for terminal command
2. **Verify**:
   - ✅ Command executes
   - ✅ Output displayed

---

## Test Suite E: Visual/UI Verification

### E1. Theia Dark Theme

**Expected**:
- ✅ Dark theme applied consistently
- ✅ All UI elements readable
- ✅ No white/light elements breaking theme

---

### E2. Responsive Layout

**Test**:
1. Resize browser window
2. **Verify**:
   - ✅ Layout adapts to window size
   - ✅ No horizontal scrollbar (unless necessary)
   - ✅ All elements remain accessible

---

### E3. No Console Errors

**Test**:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Perform various actions (load app, chat, permissions)
4. **Verify**:
   - ✅ No red error messages
   - ✅ No stack traces
   - ✅ Warnings are acceptable (yellow), errors are not (red)

---

## Summary Checklist

### Must Pass (Blocking)
- [ ] A1. App loads without hanging
- [ ] B1. Permission dialog displays correctly
- [ ] B2. Grant button works
- [ ] B3. Deny button works
- [ ] B4. Keyboard shortcuts work
- [ ] B5. Queue processing works
- [ ] E3. No console errors

### Should Pass (Non-Blocking)
- [ ] A2. Chat widget works
- [ ] A3. Settings panel works
- [ ] B6. Timeout auto-deny works
- [ ] C1-C3. Session management works
- [ ] D1-D3. Integration points work
- [ ] E1-E2. Visual/UI quality

---

## Reporting Results

### If All Tests Pass ✅

Reply with:
```
✅ MANUAL TESTS PASSED

All critical tests passed:
- App loads: ✅
- Permission dialog: ✅
- Grant/Deny: ✅
- Keyboard shortcuts: ✅
- Queue processing: ✅
- No console errors: ✅

Ready for Phase 1 approval and commit.
```

### If Tests Fail ❌

Reply with:
```
❌ MANUAL TEST FAILURE

Failed tests:
1. [Test name]: [What happened]
2. [Test name]: [What happened]

Screenshot attached: [yes/no]
Browser console errors: [yes/no - if yes, paste errors]

Requesting fixes before approval.
```

---

## Debugging Tips

### If Permission Dialog Doesn't Appear

1. **Check OpenCode server is running**: Is Terminal 1 still running?
2. **Check connection**: Chat widget should show connection status
3. **Check console**: Any errors in DevTools Console?
4. **Trigger more explicitly**: Ask AI "Please write a file called test.js"

### If App Hangs/Freezes

1. **Check console**: Look for error loops
2. **Check terminal**: Any errors in Theia terminal?
3. **Refresh browser**: Press Cmd+R / Ctrl+R

### If Chat Doesn't Work

1. **Check OpenCode server**: Is it responding?
2. **Check network**: Any failed requests in DevTools Network tab?
3. **Check console**: Any connection errors?

---

**Good luck! Report your results when complete.**
