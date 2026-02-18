# Theia Openspace - Manual Testing Guide

**Date:** 2026-02-18  
**Version:** Phase 1C Complete (54 issues fixed, 412/412 tests passing)  
**Status:** Ready for Manual Testing

---

## Prerequisites

Before starting, ensure you have:

1. **Node.js** >= 18.0.0
2. **Yarn** >= 1.7.0 and < 2.0.0
3. **Build is complete** - Run `yarn build` if you haven't already

---

## Step 1: Start the Application (5 minutes)

### 1.1 Open Terminal

Open a terminal in the project root (`/Users/Shared/dev/theia-openspace`)

### 1.2 Start the Browser App

```bash
cd /Users/Shared/dev/theia-openspace
yarn start:browser
```

### 1.3 Expected Console Output

You should see output like:
```
[OpenSpaceCore] Backend module loaded - OpenCodeService exposed at /services/opencode
[Hub] OpenSpace Hub configured
Theia app listening on http://127.0.0.1:3000
```

### 1.4 Open Browser

Navigate to: **http://localhost:3000**

Wait 10-20 seconds for Theia to fully load. You should see:
- ✅ Theia IDE interface (dark theme)
- ✅ Menu bar at top (File, Edit, View, Terminal, Help)
- ✅ Left sidebar with icons
- ✅ Main editor area in center
- ✅ Status bar at bottom (blue)

---

## Step 2: Basic IDE Verification (5 minutes)

### 2.1 Check App Loading

**What to verify:**
- [ ] Theia UI loads within 30 seconds
- [ ] No infinite loading spinner
- [ ] Window title shows "Theia Openspace"
- [ ] Sidebar visible (left panel)
- [ ] Editor area visible (center)

**Troubleshooting:**
- If stuck on loading: Check terminal for errors
- If blank screen: Open browser DevTools (F12) and check Console

### 2.2 Check Filtered Features

**What to verify:**
- [ ] **NO Debug panel** in sidebar
- [ ] **NO SCM (Source Control)** panel
- [ ] **NO Notebook** options in menus

These features were intentionally removed.

---

## Step 3: Chat Widget Testing (10 minutes)

### 3.1 Open Chat Panel

**Steps:**
1. Look at the **left sidebar** (vertical panel on left)
2. Click the **chat icon** (speech bubble icon, usually the first icon)
3. The chat panel should open in the left sidebar

**What to verify:**
- [ ] Chat panel opens when clicking icon
- [ ] Panel shows "Chat" or "OpenSpace Chat" header
- [ ] Input field at bottom is visible
- [ ] Session dropdown visible (top of chat panel)

### 3.2 Send a Message (Echo Agent)

**Steps:**
1. Click in the message input field at bottom
2. Type: `Hello AI`
3. Press **Enter** or click Send button

**What to verify:**
- [ ] Message appears in chat history
- [ ] "Echo: Hello AI" appears as response
- [ ] Response appears within 2-3 seconds
- [ ] No errors in browser console (F12 → Console)

### 3.3 Session Management

**Steps:**
1. Look for the **session dropdown** at top of chat panel
2. Click the dropdown
3. Look for options like "New Session" or existing sessions

**What to verify:**
- [ ] Dropdown shows session list
- [ ] Can select different sessions
- [ ] Can create new session
- [ ] Messages persist per session

### 3.4 Model Selection (if available)

**Steps:**
1. Look for model selector (may be near session dropdown)
2. Click to see available models

**What to verify:**
- [ ] Model dropdown opens
- [ ] Shows available AI models
- [ ] Can switch between models

---

## Step 4: Permission Dialog Testing (10 minutes)

**Note:** This requires the OpenCode server to be running. If you don't have it running, skip this section.

### 4.1 Trigger a Permission Request

**Steps:**
1. In the chat input, type: `Write a file called test.txt with content "Hello World"`
2. Press Enter

**What to verify:**
- [ ] Permission dialog appears within 1-2 seconds
- [ ] Dialog shows "Permission Required" header
- [ ] Shows Agent ID (e.g., "Agent-1")
- [ ] Shows Action Type (e.g., "file:write")
- [ ] Shows Details (file path)
- [ ] Shows **Grant** and **Deny** buttons

### 4.2 Grant Permission

**Steps:**
1. Click **Grant** button

**What to verify:**
- [ ] Dialog closes immediately
- [ ] File is created in workspace
- [ ] File appears in file explorer (left panel)
- [ ] No console errors

### 4.3 Deny Permission

**Steps:**
1. Request another file write
2. Click **Deny** button

**What to verify:**
- [ ] Dialog closes immediately
- [ ] Action is blocked (file not created)
- [ ] No console errors

### 4.4 Keyboard Shortcuts

**Steps:**
1. Trigger a permission request
2. Press **Enter** key (without clicking)

**What to verify:**
- [ ] Permission granted (same as clicking Grant)

**Steps:**
1. Trigger another permission request
2. Press **Escape** key

**What to verify:**
- [ ] Permission denied (same as clicking Deny)

---

## Step 5: IDE Features Testing (10 minutes)

### 5.1 File Explorer

**Steps:**
1. Click **Explorer icon** in left sidebar (looks like files/documents)
2. Look at file tree

**What to verify:**
- [ ] File tree is visible
- [ ] Can expand/collapse folders
- [ ] Can click on files to open

### 5.2 Editor

**Steps:**
1. Click on any file in Explorer
2. File opens in editor

**What to verify:**
- [ ] File opens in main editor area
- [ ] Syntax highlighting works
- [ ] Can edit file
- [ ] Can save file (Ctrl+S)

### 5.3 Terminal

**Steps:**
1. Click **Terminal** menu
2. Select **New Terminal**

**What to verify:**
- [ ] Terminal opens at bottom
- [ ] Can type commands
- [ ] Commands execute

### 5.4 Settings

**Steps:**
1. Click **File** menu
2. Select **Settings** (or **Preferences**)

**What to verify:**
- [ ] Settings panel opens
- [ ] Can modify settings
- [ ] Changes persist

---

## Step 6: Hub Endpoint Testing (5 minutes)

Open a **new terminal** (keep the Theia server running):

### 6.1 Test Instructions Endpoint

```bash
curl http://localhost:3000/openspace/instructions
```

**Expected:** Returns JSON with instructions content

### 6.2 Test Manifest Endpoint

```bash
curl -X POST http://localhost:3000/openspace/manifest \
  -H "Content-Type: application/json" \
  -d '{"commands": [], "timestamp": "2026-02-18T00:00:00Z"}'
```

**Expected:** Returns JSON response

### 6.3 Test State Endpoint

```bash
curl http://localhost:3000/openspace/state
```

**Expected:** Returns current IDE state as JSON

---

## Step 7: Advanced Features (Optional - 10 minutes)

### 7.1 Pane Management

**Steps:**
1. Open multiple files
2. Click **View** menu
3. Try pane options (Split Editor, etc.)

**What to verify:**
- [ ] Can split editor
- [ ] Can navigate between panes

### 7.2 Search

**Steps:**
1. Click **Search icon** in left sidebar (magnifying glass)
2. Type a search term
3. Press Enter

**What to verify:**
- [ ] Search results appear
- [ ] Can click results to open files

### 7.3 Command Palette

**Steps:**
1. Press **F1** or **Cmd+Shift+P** (Mac) / **Ctrl+Shift+P** (Linux/Windows)
2. Type a command name

**What to verify:**
- [ ] Command palette opens
- [ ] Can search commands
- [ ] Can execute commands

---

## Step 8: Browser Console Check (5 minutes)

### 8.1 Open DevTools

1. Press **F12** or **Cmd+Option+I** (Mac) / **Ctrl+Shift+I** (Windows/Linux)
2. Click **Console** tab

### 8.2 Check for Errors

**What to verify:**
- [ ] **No red error messages**
- [ ] No stack traces
- [ ] Yellow warnings are OK

**Expected normal messages:**
```
[OpenSpaceFilter] Filtering out contribution: DebugPrefixConfiguration
[BridgeContribution] Starting...
[OpenCodeProxy] SSE connection failed: ECONNREFUSED (OpenCode not running - expected)
```

---

## Summary Checklist

### Must Pass (Blocking)
- [ ] App loads without hanging
- [ ] Chat widget opens
- [ ] Can send/receive messages
- [ ] Permission dialog displays correctly (if OpenCode running)
- [ ] Grant/Deny buttons work
- [ ] File explorer works
- [ ] Editor opens files
- [ ] Terminal opens
- [ ] No console errors (red)

### Should Pass (Non-Blocking)
- [ ] Session management works
- [ ] Model selection works
- [ ] Keyboard shortcuts work
- [ ] Hub endpoints respond
- [ ] Settings panel works
- [ ] Search works

---

## Troubleshooting

### Issue: App hangs on loading

**Solution:**
1. Check terminal for errors
2. Clear browser cache: **Cmd+Shift+R** (Mac) or **Ctrl+Shift+R** (Windows/Linux)
3. Restart server: Ctrl+C, then `yarn start:browser`

### Issue: Port 3000 already in use

```bash
# Find process
lsof -i :3000

# Kill process
kill -9 <PID>
```

### Issue: Chat doesn't respond

**Solution:**
1. Check if OpenCode server is running (if required)
2. Check browser console for errors
3. Refresh page

### Issue: Permission dialog doesn't appear

**Solution:**
1. Ensure OpenCode server is running
2. Check connection status in chat
3. Try explicit command: "Write a file called test.js"

---

## Reporting Results

After testing, report back with:

```
✅ MANUAL TESTS COMPLETED

Passed:
- [List passing tests]

Failed/Issues:
- [List any failures with details]

Browser: [Chrome/Firefox/Safari, version]
Console Errors: [Yes/No - if yes, paste key errors]
```

---

**Good luck! Let me know if you encounter any issues or have questions during testing.**
