# Manage Models — Design Document

**Date:** 2026-02-21  
**Status:** Approved

---

## Goal

Allow users to curate which AI models appear in the chat model selector dropdown, by providing a "Manage Models" entry point that opens a dedicated section in Theia's Preferences panel with per-model on/off toggles grouped by provider.

---

## Problem

`GET /config/providers` returns the full universe of models from every configured provider (potentially dozens). The `ModelSelector` dropdown already shows them all, making the list unwieldy. Users need a way to hide models they never use.

---

## Architecture

### Preference Storage

A single new preference: `openspace.models.enabled`

- Type: `array` of strings, stored in Theia's user preferences (`~/.theia/settings.json`)
- Default: `[]` (empty array = **all models shown** — opt-out semantics, so a fresh install works without any configuration)
- Each entry is a `"providerId/modelId"` string, matching the existing `fullId` format in `ModelSelector`
- Provider-level "All/None" is a UI convenience only — it adds/removes all model IDs for that provider; no special sentinel values needed in storage

### Custom Preference Renderer

Theia's preference system has a `PreferenceNodeRendererContribution` extension point. We register a contribution that intercepts the `openspace.models.enabled` preference node and renders a custom React tree component instead of the default array-of-strings editor.

The renderer component:
1. Calls `sessionService.getAvailableModels()` on mount (same API call `ModelSelector` already uses) to get the live provider+model tree from the OpenCode server
2. Reads the current value of `openspace.models.enabled` from `PreferenceService`
3. Renders: global **All / None** buttons, then provider group headers each with provider-level **All / None**, then per-model toggle rows
4. On any toggle change, writes the updated array back via `preferenceService.set('openspace.models.enabled', newValue, PreferenceScope.User)`

### ModelSelector Filtering

`ModelSelector` is injected with `PreferenceService`. When building its dropdown list it filters to only include models whose `fullId` is in the enabled list — or all models if the list is empty (default).

### "Manage Models" Entry Point

A footer link added to the `ModelSelector` dropdown. Clicking it:
1. Closes the dropdown
2. Calls `CommandService.executeCommand(CommonCommands.OPEN_PREFERENCES.id, 'AI Models')` — Theia's built-in command accepts an optional search query string, which automatically scrolls the preference tree to the matching section

---

## Components Affected

| File | Change |
|---|---|
| `extensions/openspace-settings/src/browser/openspace-preferences.ts` | Add `MODELS_ENABLED` key, default `[]`, schema entry |
| `extensions/openspace-settings/src/browser/ai-models-preference-renderer.tsx` | **New** — custom React preference renderer |
| `extensions/openspace-settings/src/browser/openspace-settings-frontend-module.ts` | Bind new renderer contribution + inject SessionService |
| `extensions/openspace-chat/src/browser/model-selector.tsx` | Inject `PreferenceService` + `CommandService`; filter models; add "Manage Models" footer |
| `extensions/openspace-chat/src/browser/chat-widget.tsx` | Pass `CommandService` down to `ModelSelector` |
| `extensions/openspace-chat/src/browser/style/chat-widget.css` | Style for "Manage Models" footer row |

---

## Out of Scope

- Provider connection / API key management UI (deferred)
- Per-model metadata display (cost, context window, capabilities)
- Server-side persistence of the enabled list
