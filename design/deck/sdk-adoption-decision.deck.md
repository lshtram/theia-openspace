---
title: "OpenCode SDK Adoption Decision"
theme: openspace-sunset
transition: slide
transitionSpeed: default
slideNumber: "c/t"
---

<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

  :root {
    --os-primary:        #f59e0b;
    --os-primary-light:  #fbbf24;
    --os-accent:         #ef4444;
    --os-accent-light:   #f87171;
    --os-bg-primary:     #0f172a;
    --os-bg-secondary:   #1e293b;
  }

  .reveal { font-size: 38px; }

  .reveal h1, .reveal h2, .reveal h3, .reveal h4 {
    text-transform: none;
    letter-spacing: -0.02em;
    line-height: 1.15;
  }

  .reveal h1 { font-size: 2.2em; }
  .reveal h2 { font-size: 1.5em; }
  .reveal h3 { font-size: 1.1em; color: var(--os-primary-light); }

  .reveal ul, .reveal ol {
    text-align: left;
    font-size: 0.82em;
    line-height: 1.7;
    margin-left: 1.2em;
  }

  .reveal li { margin-bottom: 0.3em; }

  .reveal pre {
    width: 100%;
    font-size: 0.68em;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
  }

  .reveal code {
    background: rgba(255,255,255,0.08);
    border-radius: 4px;
    padding: 0.1em 0.35em;
    font-size: 0.9em;
  }

  .reveal table {
    font-size: 0.72em;
    width: 100%;
    border-collapse: collapse;
  }

  .reveal table th {
    background: var(--os-bg-secondary);
    color: var(--os-primary);
    padding: 0.6em 0.8em;
    font-weight: 700;
    border-bottom: 2px solid var(--os-primary);
  }

  .reveal table td {
    padding: 0.55em 0.8em;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    vertical-align: middle;
  }

  .reveal table tr:nth-child(even) td {
    background: rgba(255,255,255,0.03);
  }

  .reveal blockquote {
    background: rgba(245,158,11,0.1);
    border-left: 4px solid var(--os-primary);
    border-radius: 0 8px 8px 0;
    padding: 0.8em 1.2em;
    font-style: normal;
    font-size: 0.8em;
    color: #e2e8f0;
    width: 90%;
    margin: 1em auto;
    text-align: left;
  }

  .highlight-box {
    background: rgba(245,158,11,0.12);
    border: 1px solid rgba(245,158,11,0.35);
    border-radius: 10px;
    padding: 0.8em 1.2em;
    margin: 0.6em 0;
    text-align: left;
    font-size: 0.78em;
  }

  .highlight-box-red {
    background: rgba(239,68,68,0.12);
    border: 1px solid rgba(239,68,68,0.35);
    border-radius: 10px;
    padding: 0.8em 1.2em;
    margin: 0.6em 0;
    text-align: left;
    font-size: 0.78em;
  }

  .highlight-box-green {
    background: rgba(34,197,94,0.12);
    border: 1px solid rgba(34,197,94,0.35);
    border-radius: 10px;
    padding: 0.8em 1.2em;
    margin: 0.6em 0;
    text-align: left;
    font-size: 0.78em;
  }

  .metric {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2em;
    margin: 0 0.6em;
  }

  .metric-value {
    font-size: 2.8em;
    font-weight: 800;
    color: var(--os-primary);
    line-height: 1;
    text-shadow: 0 0 30px rgba(245,158,11,0.5);
  }

  .metric-label {
    font-size: 0.65em;
    color: rgba(255,255,255,0.55);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .tag {
    display: inline-block;
    font-size: 0.55em;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 0.25em 0.7em;
    border-radius: 999px;
    margin: 0 0.2em;
    vertical-align: middle;
    border: 1px solid transparent;
  }

  .tag-primary {
    background: rgba(245,158,11,0.2);
    color: var(--os-primary-light);
    border-color: var(--os-primary);
  }

  .tag-success {
    background: rgba(34,197,94,0.15);
    color: #86efac;
    border-color: #22c55e;
  }

  .tag-warning {
    background: rgba(239,68,68,0.15);
    color: var(--os-accent-light);
    border-color: var(--os-accent);
  }

  .two-column {
    display: flex;
    gap: 2em;
    text-align: left;
    align-items: flex-start;
  }

  .two-column > * { flex: 1; min-width: 0; }

  .gradient-text {
    background: linear-gradient(90deg, var(--os-primary) 0%, var(--os-accent-light) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .reveal .fragment { opacity: 0.15; }
  .reveal .fragment.visible { opacity: 1; }
  .reveal .fragment.current-fragment { opacity: 1; }
</style>

<!-- .slide: data-background-gradient="linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" -->

# <span class="gradient-text">OpenCode SDK</span> Adoption

### Architectural Decision: **6 Options Evaluated**

<br>

Type Safety · ESM/CJS Conflict · Type Drift

<br>

<small style="opacity: 0.5;">After this: you'll understand why we chose the hybrid approach</small>

---

## The Problem We're Solving

<div class="two-column">
<div>

**Current Situation**

- ~4,000 lines of hand-rolled integration code
- 7 field name mismatches causing runtime bugs
- 9 missing message Part types blocking Phase 3
- 11 missing SSE event types limiting integration
- Code diverging from actual OpenCode API

</div>
<div>

**Critical Constraint**

- `@opencode-ai/sdk` is **ESM-only** (`"type": "module"`)
- Theia extensions require **CommonJS** (`"module": "commonjs"`)
- TypeScript cannot import ESM in CommonJS projects
- **Direct SDK adoption is technically blocked**

</div>
</div>

<br>

> The official SDK provides type-safe HTTP client, SSE streaming, and full API coverage — but we can't use it directly due to module system incompatibility.

---

## What We Built (Current State)

<div class="two-column">
<div>

| Component | LOC |
|-----------|-----|
| HTTP Client | 931 |
| Type Definitions | 313 |
| SSE Event Types | 135 |
| Command Types | 138 |
| RPC Sync | 555 |
| Session State | 856 |
| Hub Server | 211 |
| Bridge | 150 |
| DI Wiring | 95 |
| Permission UI | 413 |
| **TOTAL** | **~4,027** |

</div>
<div>

<div class="highlight-box">
<strong>Transport Complexity</strong><br>
<small style="opacity:0.7;">6 abstraction layers × 4 transport mechanisms</small>
</div>

<br>

**6 Layers:** User → ChatAgent → SessionService → RPC Proxy → JSON-RPC → HTTP

<br>

**4 Transports:** HTTP REST, SSE, JSON-RPC over WebSocket, HTTP fetch

</div>
</div>

---

## The Blocker: ESM vs CommonJS

<div class="two-column">
<div>

<div class="highlight-box">
<strong>SDK Package</strong><br>
<small style="opacity:0.7;">@opencode-ai/sdk v1.2.6</small>
</div>

- `"type": "module"` in package.json
- `exports` map with `"import"` condition only
- NO `"require"` or `"default"` export
- **ESM-only — cannot be required by CJS**

</div>
<div>

<div class="highlight-box">
<strong>Theia Extensions</strong><br>
<small style="opacity:0.7;">tsconfig.base.json</small>
</div>

- `"module": "commonjs"`
- `"moduleResolution": "node"`
- **Cannot import ESM modules**
- TypeScript: `TS2307: Cannot find module`

</div>
</div>

<br>

<div class="highlight-box-red">
<strong>Empirical Discovery:</strong> Tested 6 approaches to resolve ESM/CJS incompatibility. Four failed. Only hybrid approach works within Theia constraints.
</div>

---

## Option A: Direct Import — ❌ BLOCKED

<div class="highlight-box-red">
<strong>Strategy:</strong> Direct SDK import with existing `module: "commonjs"`
</div>

```typescript
import { createOpencodeClient } from "@opencode-ai/sdk"
```

<br>

**Result:** ❌ `TS2307: Cannot find module '@opencode-ai/sdk'`

<br>

**Why it fails:**
- `moduleResolution: "node"` doesn't understand `exports` maps
- TypeScript cannot locate the SDK package

---

## Option B: node16 Resolution — ❌ BLOCKED

<div class="highlight-box-red">
<strong>Strategy:</strong> Change to `moduleResolution: "node16"`
</div>

```json
{ "moduleResolution": "node16" }
```

<br>

**Result:** ❌ `TS1479: The current file is a CommonJS module whose imports will produce 'require' calls; however, the referenced file is an ECMAScript module and cannot be imported with 'require'.`

<br>

**Why it fails:**
- TypeScript correctly detects ESM/CJS mismatch
- Blocks even `import type` statements
- Theia's CJS requirement is hard constraint

---

## Option C: Bundler Resolution — ❌ BLOCKED

<div class="highlight-box-red">
<strong>Strategy:</strong> Change to `moduleResolution: "bundler"`
</div>

```json
{ "moduleResolution": "bundler" }
```

<br>

**Result:** ❌ `TS5095: Option 'bundler' can only be used when 'module' is set to 'es2015' or later.`

<br>

**Why it fails:**
- Bundler resolution requires ESM output
- Incompatible with Theia's CJS requirement

---

## Option D: Hybrid — ✅ APPROVED

<div class="highlight-box-green">
<strong>Strategy:</strong> Copy SDK types locally + keep hand-rolled HTTP client
</div>

<div class="two-column">
<div>

**Type Layer:**
```typescript
// Extract SDK's gen/types.gen.d.ts (3,380 lines)
// Copy to: src/common/opencode-sdk-types.ts
export * from "./opencode-sdk-types"
```

<br>

<span class="tag tag-primary">APPROVED</span>
<span class="tag tag-success">Type-Safe</span>
<span class="tag tag-success">Minimal Risk</span>

</div>
<div>

**Runtime Layer:**
```typescript
// Keep existing httpPost/httpGet in opencode-proxy.ts
// BUT: Use SDK types instead of hand-written types
async listSessions(): Promise<Session[]> {
  return this.httpGet<Session[]>("/session")
}
```

</div>
</div>

<br>

**Result:** ✅ **VERIFIED WORKING**
- Types work perfectly with `moduleResolution: "node"`
- Zero runtime changes = zero transport bugs
- Manually re-extract types on SDK updates (scriptable)

---

## Option E: Fork SDK — ⚠️ NOT RECOMMENDED

<div class="highlight-box">
<strong>Strategy:</strong> Fork `@opencode-ai/sdk`, modify build to output CJS
</div>

<br>

**Result:** ✅ Would technically work

<br>

**Why rejected:**
- High maintenance burden
- Must sync fork with upstream daily releases (~3,798 versions published)
- Loses auto-update benefit
- Creates permanent technical debt

---

## Option F: Wait for CJS — ❓ NOT RECOMMENDED

<div class="highlight-box">
<strong>Strategy:</strong> Request OpenCode team add dual ESM/CJS builds
</div>

<br>

**Result:** ❓ Unknown timeline

<br>

**Why rejected:**
- Type drift is **happening now**
- 7 field name mismatches cause runtime bugs
- 9 missing Part types block Phase 3 tasks
- 11 missing event types limit SSE integration
- Blocks Phase 2B indefinitely

---

## Decision Matrix

<style>
  .decision-matrix td:nth-child(4),
  .decision-matrix th:nth-child(4) {
    background: rgba(34,197,94,0.12) !important;
    border-left: 2px solid #22c55e;
    border-right: 2px solid #22c55e;
  }
</style>

<table class="decision-matrix">
<thead>
<tr>
  <th>Criteria</th>
  <th>Direct Import</th>
  <th>node16</th>
  <th>Hybrid ✅</th>
  <th>Fork SDK</th>
  <th>Wait for CJS</th>
</tr>
</thead>
<tbody>
<tr><td>Feasible in Theia</td><td>❌ No</td><td>❌ No</td><td>✅ Yes</td><td>✅ Yes</td><td>❓ Unknown</td></tr>
<tr><td>Fixes type drift</td><td>✅ Yes</td><td>✅ Yes</td><td>✅ Yes</td><td>✅ Yes</td><td>⏸️ Deferred</td></tr>
<tr><td>Runtime risk</td><td>Low</td><td>Low</td><td>✅ Zero</td><td>Low</td><td>Zero</td></tr>
<tr><td>Maintenance burden</td><td>Low</td><td>Low</td><td>✅ Low</td><td>❌ High</td><td>✅ None</td></tr>
<tr><td>Future-proof</td><td>✅ Yes</td><td>✅ Yes</td><td>✅ Yes</td><td>⚠️ Fork drift</td><td>⏸️ Blocked</td></tr>
<tr><td>Time to implement</td><td>N/A</td><td>N/A</td><td>✅ 6-8 hrs</td><td>⚠️ 2-3 days</td><td>❌ Indefinite</td></tr>
<tr><td>Code reduction</td><td>~1,450 LOC</td><td>~1,450 LOC</td><td>~263 LOC</td><td>~1,450 LOC</td><td>0 LOC</td></tr>
</tbody>
</table>

---

## What Matters For Us

<br>

<ul style="font-size: 0.85em; line-height: 2.2;">
  <li class="fragment fade-up">🔧 <strong>Type compatibility</strong> — Must fix 7 field name mismatches immediately <!-- .element: class="fragment fade-up" --></li>
  <li class="fragment fade-up">🚀 <strong>Unblock Phase 3</strong> — Need 9 missing Part types for command manifest</li>
  <li class="fragment fade-up">⚡ <strong>Zero runtime risk</strong> — No changes to HTTP/SSE transport layer</li>
  <li class="fragment fade-up">🔄 <strong>Future-proof</strong> — Can adopt runtime SDK when ESM/CJS blocker resolved</li>
  <li class="fragment fade-up">⏱️ <strong>Speed</strong> — 6-8 hours vs 12-18 for full SDK adoption</li>
</ul>

<br>

<p class="fragment fade-up" style="text-align: center; color: var(--os-primary); font-weight: 700;">
  → These criteria point to one clear answer.
</p>

---

<!-- .slide: data-background-gradient="linear-gradient(135deg, #0f3460 0%, #533483 100%)" -->

## We're Going With

<br>

<div style="text-align: center;">
  <div class="metric">
    <span class="metric-value">Hybrid</span>
    <span class="metric-label">Types-Only Approach</span>
  </div>
</div>

<br>

<div class="two-column" style="font-size: 0.75em; margin-top: 1em;">
<div>

**Why Hybrid wins here**
- Fixes type drift immediately (primary goal achieved)
- Zero runtime changes = no transport bugs
- Works within Theia's CJS constraints
- Reversible — can upgrade to runtime SDK later
- 90% of value with 10% of risk

</div>
<div>

**What changes**
- Install SDK as devDependency (exact version)
- Extract types.gen.d.ts → opencode-sdk-types.ts
- Replace hand-written types (~263 LOC eliminated)
- Update consumers for field renames (projectId → projectID)

</div>
</div>

---

## If We'd Chosen Differently

<div class="two-column" style="font-size: 0.78em; margin-top: 0.5em;">
<div>

<div class="highlight-box-red">

**Full SDK adoption would be right if...**

Theia supported ESM or the SDK provided CJS builds. Would eliminate ~1,450 LOC (HTTP + types + SSE). Currently blocked by technical constraints.

</div>

<br>

<div class="highlight-box">

**Forking SDK would be right if...**

We needed full runtime SDK benefits immediately and could accept permanent fork maintenance burden.

</div>

</div>
<div>

<div class="highlight-box">

**Waiting for CJS would be right if...**

Timeline was flexible and type drift wasn't causing immediate runtime bugs. Currently 7 field mismatches are live issues.

</div>

</div>
</div>

<br>

> The best choice isn't universal — it's context-specific. **Our context: type drift is happening NOW and must be fixed before Phase 3 completion.**

---

## Next Steps

<br>

<ol style="font-size: 0.82em; line-height: 2.2;">
  <li><strong>Install SDK</strong> — <code>npm install --save-dev @opencode-ai/sdk@1.2.6</code> — exact version</li>
  <li><strong>Extract types</strong> — Copy <code>dist/gen/types.gen.d.ts</code> → <code>src/common/opencode-sdk-types.ts</code></li>
  <li><strong>Create type bridge</strong> — Import SDK types in <code>opencode-protocol.ts</code>, create aliases</li>
  <li><strong>Update consumers</strong> — Fix field renames (projectId → projectID, sessionId → sessionID)</li>
  <li><strong>Add npm script</strong> — <code>npm run extract-sdk-types</code> for future updates</li>
  <li><strong>Run full test suite</strong> — Verify zero TypeScript errors</li>
</ol>

<br>

<p style="text-align: center; font-size: 0.7em; opacity: 0.5;">
  Questions? · Objections? · Edge cases? → Now is the time.
</p>
