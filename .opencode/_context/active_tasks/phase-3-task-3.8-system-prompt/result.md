# Phase 3 Task 3.8: System Prompt Generation - Result

## Status: COMPLETED ✅

---

## Summary

Implemented the system prompt generation functionality in the Hub's GET `/openspace/instructions` endpoint. The implementation includes all required sections as specified in the contract.

---

## Implementation Details

### Modified File
- `extensions/openspace-core/src/node/hub.ts` - Added Examples section to `generateInstructions()` method

### Sections Implemented

1. **Explanation of `%%OS{...}%%` pattern** (lines 224-225)
   - Describes how to emit IDE control commands in responses
   - States these blocks are invisible to the user

2. **Dynamic Command Inventory** (lines 227-256)
   - Generated from manifest commands
   - Includes command ID, description, arguments with types
   - Shows required vs optional arguments
   - Provides example format for each command

3. **Dynamic IDE State** (lines 258-286)
   - Main area: Shows active editor tabs with dirty markers
   - Right panel: Shows open panels
   - Bottom panel: Shows terminals and other bottom panels

4. **Command Format** (lines 288-292)
   - Explains the JSON structure
   - Notes multiple commands can be in one response
   - Notes sequential execution order

5. **Examples Section** (lines 294-327) - NEW
   - **Example 1:** Opening a file at specific line
   - **Example 2:** Executing terminal command
   - **Example 3:** Opening a pane
   - **Example 4:** Multiple commands in one response

---

## Acceptance Criteria

| ID | Criteria | Status |
|----|----------|--------|
| AC-3.8.1 | GET /openspace/instructions returns prompt | ✅ |
| AC-3.8.2 | Prompt includes command inventory | ✅ |
| AC-3.8.3 | Prompt includes current IDE state | ✅ |
| AC-3.8.4 | Examples section included | ✅ |
| AC-3.8.5 | Build passes | ✅ |

---

## Example Output Structure

```
# OpenSpace IDE Control Instructions

You are operating inside Theia OpenSpace IDE. You can control the IDE by emitting
`%%OS{...}%%` blocks in your response. These are invisible to the user.

## Available Commands
- **openspace.editor.open**: Opens a file in the editor
  - Arguments:
    - `path` (string, required): File path to open
    - `line` (number, optional): Line number to jump to
  - Example: `%%OS{"cmd":"openspace.editor.open","args":{...}}%%`

## Current IDE State
- Main area: [editor: src/index.ts *, editor: src/utils.ts]
- Bottom panel: [terminal-1, Problems]

## Command Format
Commands must be emitted as: `%%OS{"cmd":"command.id","args":{...}}%%`
Multiple commands can appear in a single response.
Commands are executed sequentially in order of appearance.

## Examples

Here are some examples of how to use %%OS{...}%% blocks:

### Opening a file
To open a file in the editor at a specific line:
```
%%OS{"cmd":"openspace.editor.open","args":{"path":"src/index.ts","line":42}}%%
```

### Executing a terminal command
To run a command in the terminal:
```
%%OS{"cmd":"openspace.terminal.execute","args":{"command":"npm run build","terminalId":"main-terminal"}}%%
```

### Opening a pane
To open a new pane (e.g., terminal, preview):
```
%%OS{"cmd":"openspace.pane.open","args":{"area":"bottom","type":"terminal","label":"Build Terminal"}}%%
```

### Multiple commands
You can include multiple commands in a single response:
```
I'll open the file and show you the relevant code.

%%OS{"cmd":"openspace.editor.open","args":{"path":"src/utils.ts"}}%%
%%OS{"cmd":"openspace.editor.goto","args":{"path":"src/utils.ts","line":15}}%%
```
```

---

## Build Verification

```
> openspace-core@0.1.0 build
> tsc
```

Build passes successfully.

---

## Notes

- The Examples section provides 4 concrete examples covering common use cases
- Command examples use generic command IDs that align with typical IDE commands
- The prompt dynamically includes available commands from the manifest
- IDE state shows actual open panes and tabs (or placeholder when empty)
