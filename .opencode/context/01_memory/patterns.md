# Memory Patterns

## Discovered Issues & Solutions

### Session Management UI Patterns (Task 1.11)
- **Dropdown State Management**: Use separate state for dropdown visibility (`showSessionList`) and session data (`sessions`). Click-outside detection via `.closest()` checks if click target is within dropdown container.
- **Active Session Cleanup**: When deleting active session, automatically clear all related state: `_activeSession`, `_messages`, localStorage entry, and fire both `onActiveSessionChanged(undefined)` and `onMessagesChanged([])` events.
- **Event-Driven UI Updates**: Use event subscriptions (`onActiveSessionChanged`, `onMessagesChanged`) to trigger UI re-renders. Store disposables in ref and clean up on unmount.
- **Loading State Management**: Set loading flags before async operations, clear in finally block. Prevents race conditions and enables UI to show loading indicators.

### Documentation Structure Patterns (Task 1.12)
- **Multi-Tier Verification**: Document verification in 3 tiers: (1) Manual endpoint check (curl), (2) Log verification (OpenCode logs), (3) Agent behavior test (ask agent about commands).
- **Troubleshooting by Failure Mode**: Organize troubleshooting by specific error messages (404, connection refused, empty list) with solutions for each.
- **Advanced Configuration Section**: After basic setup, provide advanced scenarios (multiple sources, remote instances, custom ports) for power users.
- **Testing Checklist**: Include concrete checklist with expected outputs (not just "test it works").

## Critical Project Rules (Phase 0)

### Rule 1: Never Modify OpenCode Server Code
- **Scope:** Any files in `/Users/Shared/dev/opencode/` or equivalent
- **Rationale:** OpenCode server is an external dependency; modifications create maintenance burden and may break on updates
- **Enforcement:** Janitor validates this in every validation pass

### Rule 2: Never Modify Theia Core Code
- **Scope:** Any files in `@theia/*` packages in `node_modules/`
- **Rationale:** Theia is a dependency; modifications create forks that are hard to maintain and upgrade
- **Enforcement:** All custom work must use proper Theia extension APIs (ContributionProvider, FilterContribution, etc.)
- **Extension Pattern:** Use `ContainerModule` with inversify for dependency injection

## Architecture Patterns
- Follow NSO BUILD workflow for features
- Follow NSO DEBUG workflow for bugs

## Best Practices
- Keep context files <200 lines
- Update memory at end of every session
- Use exact version pins for @theia/* packages (e.g., "1.68.2" not "^1.68.0")
- Delegate to Scout for research, Builder for implementation, Janitor for validation
