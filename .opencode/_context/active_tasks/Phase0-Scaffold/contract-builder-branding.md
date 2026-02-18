# Contract: Builder - Custom Branding

**Task ID:** Phase0.6-CustomBranding  
**Assigned to:** Builder  
**Priority:** P1  
**Created:** 2026-02-16  
**Oracle:** oracle_e3f7

---

## Objective

Apply custom branding to Theia Openspace: window title, favicon, and minimal CSS overrides.

## Implementation

### 1. Window Title

Already set in `browser-app/package.json`:
```json
"theia": {
  "frontend": {
    "config": {
      "applicationName": "Theia Openspace"
    }
  }
}
```

Verify this works and appears in:
- Browser tab title
- Window title bar

### 2. Favicon

Create a simple favicon for Theia Openspace.

**Option A:** Use a simple colored circle or initial
**Option B:** Use Theia's default favicon with a twist
**Option C:** Create a minimal SVG favicon

Place favicon in `browser-app/resources/` and reference it in the build.

### 3. CSS Overrides (Optional for Phase 0)

Create minimal CSS for header/title bar styling in `openspace-layout`:

**extensions/openspace-layout/src/browser/style/index.css:**

```css
/* Theia Openspace Custom Styles */

/* Header styling */
#theia-top-panel {
  background: var(--theia-titleBar-activeBackground);
}

/* Ensure our branding is visible */
.theia-app-name::before {
  content: '🚀 ';
}
```

**Update openspace-layout-frontend-module.ts to import CSS:**

```typescript
import '../../src/browser/style/index.css';
```

## Success Criteria

- [ ] Browser tab shows "Theia Openspace" (not "Theia" or "Eclipse Theia")
- [ ] Window title bar shows "Theia Openspace"
- [ ] Custom favicon is visible in browser tab (if implemented)
- [ ] No console errors related to branding

## Testing

1. Build: `yarn build`
2. Start: `yarn start:browser`
3. Verify:
   - Browser tab title shows "Theia Openspace"
   - Look for any branding elements

## Time Bound

Complete within 30 minutes. This is cosmetic — don't spend too long on it.

## Output

Write `result-branding.md` in this task directory with:
- What branding was applied
- Files modified/created
- Verification results

---

**Oracle Note:** Keep it simple for Phase 0. Full theming comes in Phase 5. Just ensure the name is correct and there's some minimal branding visible.
