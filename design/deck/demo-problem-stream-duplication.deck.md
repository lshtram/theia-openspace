---
title: "The Problem: Chat Stream Duplication Bug"
theme: black
transition: slide
controls: true
progress: true
slideNumber: "c/t"
---

<!-- .slide: data-background-gradient="linear-gradient(135deg, #1a0a0a 0%, #3b0000 60%, #0f0f0f 100%)" -->

<div class="inc-pulse-indicator">
  <div class="inc-pulse-dot"></div>
  <span class="inc-pulse-label">Active Incident</span>
</div>

# The Problem:
## Chat Stream Duplication Bug

<div class="inc-rule"></div>

<p style="font-size: 0.85em; color: #94a3b8;">Every chat message displayed twice — a subtle SSE listener leak that only surfaced under real traffic.</p>

<p style="font-size: 0.62em; color: #64748b; letter-spacing: 0.12em; text-transform: uppercase; margin-top: 2.5em;">Postmortem · OpenSpace Chat · 2026-02-14</p>

Note:
Welcome. This is a postmortem for a bug that hit production two weeks ago. Every message the AI sent appeared twice in the chat panel — identical duplicates, side by side. The root cause was a single missing cleanup line, but the path to finding it required understanding how SSE EventSource instances work. We'll walk through the symptom, the investigation, the fix, and what we changed to prevent it happening again.

---

<!-- .slide: data-background-gradient="linear-gradient(135deg, #1a0a0a 0%, #2d0a0a 100%)" -->

## The Problem

<span class="tag tag-danger">P1 Incident</span>
<span class="tag tag-warning">UX Regression</span>

<div class="inc-status-block inc-status-open" style="margin-top: 1em;">
  <div class="inc-status-header">
    <span class="inc-status-badge badge-open">[OPEN]</span>
    <span>"Every AI response appears twice in the chat panel"</span>
  </div>
  <div class="inc-status-meta">Filed by 6 users in the first 20 minutes after deploy · 2026-02-14 14:22 UTC</div>
</div>

<ul style="margin-top: 1.2em;">
  <li>All chat messages were duplicated — two identical response streams rendered in parallel</li>
  <li>The bug appeared on the first message after each page reload or panel open/close cycle</li>
  <li>No errors in the console — just silent, doubled output that confused every user</li>
  <li>Rolled back within 8 minutes, but the cause was not immediately obvious</li>
</ul>

Note:
Read each bullet aloud. The key detail is "no errors in the console." This is the dangerous kind of bug — there's no stack trace to follow. The only signal is wrong output. Also note the trigger: "first message after each page reload" is a strong clue that the bug is lifecycle-related, not data-related.

---

<!-- .slide: data-background-gradient="linear-gradient(135deg, #1a0a0a 0%, #2d0a0a 100%)" -->

## Impact

<div class="metrics-row" style="margin-top: 0.8em;">
  <div class="metric metric-danger">
    <span class="metric-value">2×</span>
    <span class="metric-label">Every AI Response</span>
  </div>
  <div class="metric metric-danger">
    <span class="metric-value">6</span>
    <span class="metric-label">User Reports (20 min)</span>
  </div>
  <div class="metric metric-danger">
    <span class="metric-value">8 min</span>
    <span class="metric-label">Time to Rollback</span>
  </div>
</div>

<p style="margin-top: 1.2em; font-size: 0.88em; color: #94a3b8;">
  Every streamed token was appended to <em>two</em> message elements simultaneously. The chat panel rendered duplicate paragraphs for the full duration of each response. Users had no way to dismiss the duplicate — both continued streaming in real time.
</p>

<div class="inc-danger-box" style="margin-top: 0.8em; font-size: 0.84em;">
  <strong>Business impact:</strong> Demo session for a prospective enterprise customer ran during the 8-minute window. The contact reported "the AI seems broken" in their follow-up email.
</div>

Note:
The enterprise demo impact is worth dwelling on — a single incident in an 8-minute window hit the worst possible moment. This is why production monitoring and fast rollback matters more than a perfect first deploy. The technical impact was bounded, but the business cost was disproportionate.

---

<!-- .slide: data-background-gradient="linear-gradient(135deg, #0f0f0f 0%, #1e0a0a 100%)" -->

<!-- .slide: data-auto-animate -->

## Root Cause

<span class="tag tag-danger">EventSource Leak</span>

<pre data-id="bug-code"><code data-trim data-line-numbers="[1-8|10-18]" class="language-typescript">
// chat-widget.tsx — BEFORE the fix (simplified)
// The component re-registered the SSE listener on every render
// without removing the previous one first.

useEffect(() => {
  const source = new EventSource('/api/chat/stream')

  source.onmessage = (e) => {
    appendToken(e.data)  // called once per listener registered
  }

  // ❌ Missing: return () => source.close()
  // Without this cleanup, each render adds another listener.
  // On the second render (e.g. panel re-open), there are two
  // EventSource instances both subscribed to the same stream.
  // Every token fires both → two identical appends per token.

}, [sessionId])  // re-runs when sessionId changes
</code></pre>

Note:
Lines 1–8: the EventSource is created and a message handler is attached. This looks correct in isolation. Lines 10–18: the missing return function is the entire bug. In React, useEffect cleanup runs before the effect re-fires and on unmount. Without it, the old EventSource keeps its connection open and keeps calling appendToken. The second render adds a second EventSource — now both are active. Every token fires both handlers, and you get two appends.

---

<!-- .slide: data-background-gradient="linear-gradient(135deg, #0f0f0f 0%, #1e0a0a 100%)" -->

<!-- .slide: data-auto-animate -->

## Root Cause — Deep Dive

<pre data-id="bug-code"><code data-trim data-line-numbers="12-13" class="language-typescript">
// chat-widget.tsx — BEFORE the fix (simplified)
// The component re-registered the SSE listener on every render
// without removing the previous one first.

useEffect(() => {
  const source = new EventSource('/api/chat/stream')

  source.onmessage = (e) => {
    appendToken(e.data)  // called once per listener registered
  }

  // ❌ Missing: return () => source.close()   ◄── HERE
  // Each render creates a NEW EventSource without closing the old one.

}, [sessionId])  // re-runs when sessionId changes
</code></pre>

<div class="inc-danger-box" style="font-size: 0.82em; margin-top: 0.8em;">
  <strong>The mechanism:</strong> <code>EventSource</code> does not automatically close when a React component re-renders. Each call to <code>useEffect</code> created a new live connection. After two renders: two connections, two <code>onmessage</code> handlers, two <code>appendToken</code> calls per token. The stream was fine — the listener management was broken.
</div>

Note:
The important distinction: the SSE server was working perfectly. The bug was entirely on the client — in React lifecycle management, not in the streaming protocol. This is worth making explicit to the audience: investigating the server side was a dead end and cost 15 minutes of the incident window.

---

<!-- .slide: data-background-gradient="linear-gradient(135deg, #0f0f0f 0%, #1e293b 100%)" -->

## The Fix — Approach

<span class="tag tag-primary">Strategy</span>

<p style="margin-top: 0.8em;">The fix requires two changes: close the EventSource on cleanup, and check <code>source.readyState</code> (not <code>e.readyState</code>) in the error handler.</p>

<ul>
  <li class="fragment fade-up"><strong>Add cleanup return to useEffect</strong> — <code>return () => source.close()</code> closes the SSE connection when the effect re-runs or the component unmounts</li>
  <li class="fragment fade-up"><strong>Fix the readyState reference in the error handler</strong> — <code>e.readyState</code> is always <code>undefined</code> on the event object; use <code>source.readyState</code> (the EventSource instance)</li>
  <li class="fragment fade-up"><strong>Move source into a ref if needed across renders</strong> — if you need to read <code>source.readyState</code> outside the effect, store it in <code>useRef</code> so React doesn't trigger re-renders</li>
  <li class="fragment fade-up"><strong>Add a regression test</strong> — mount the component twice, verify <code>appendToken</code> is called exactly once per token after the second mount</li>
</ul>

Note:
The readyState bug is subtle and easy to miss in code review. If your error handler says "if the connection is closed, reconnect" but checks e.readyState, it will always see undefined and the branch will never fire. The fix is one word: source.readyState instead of e.readyState. Emphasise this — it's the kind of bug that looks like something else entirely in logs.

---

<!-- .slide: data-background-gradient="linear-gradient(135deg, #0f0f0f 0%, #001a0a 100%)" -->

## Implementation

<div class="two-column">
<div>

<p class="col-label bad">Before (leaked listener)</p>

```typescript
useEffect(() => {
  const source =
    new EventSource('/api/chat/stream')

  source.onmessage = (e) => {
    appendToken(e.data)
  }

  source.onerror = (e) => {
    // ❌ Bug: e.readyState is undefined
    if (e.readyState === EventSource.CLOSED) {
      reconnect()
    }
  }
  // ❌ No cleanup
}, [sessionId])
```

</div>
<div>

<p class="col-label good">After (cleaned up)</p>

```typescript
useEffect(() => {
  const source =
    new EventSource('/api/chat/stream')

  source.onmessage = (e) => {
    appendToken(e.data)
  }

  source.onerror = () => {
    // ✅ Fix: use source, not e
    if (source.readyState ===
        EventSource.CLOSED) {
      reconnect()
    }
  }

  // ✅ Close on cleanup
  return () => source.close()
}, [sessionId])
```

</div>
</div>

Note:
The diff is two lines. That's the whole fix. Everything else stayed the same. The return cleanup closes the old connection before the effect re-runs. The source.readyState fix makes the error handler actually work. Both were missing from the original — one caused the visible bug, one was a latent bug waiting for a reconnect scenario.

---

<!-- .slide: data-background-gradient="linear-gradient(135deg, #001a00 0%, #003b00 100%)" -->

## After the Fix

<span class="tag tag-success">Resolved</span>

<div class="metrics-row" style="margin-top: 0.8em;">
  <div class="metric metric-success">
    <span class="metric-value">1×</span>
    <span class="metric-label">Token per Append</span>
  </div>
  <div class="metric metric-success">
    <span class="metric-value">0</span>
    <span class="metric-label">Duplicate Reports</span>
  </div>
  <div class="metric metric-success">
    <span class="metric-value">2 lines</span>
    <span class="metric-label">Size of Fix</span>
  </div>
</div>

<blockquote style="margin-top: 1.2em; font-size: 0.88em; border-left-color: #22c55e;">
  "Back to normal — messages look right again."<br>
  <span style="font-size: 0.85em; color: #94a3b8;">— Support ticket closure note, 2026-02-14 15:10 UTC</span>
</blockquote>

<p style="font-size: 0.82em; color: #94a3b8; margin-top: 0.6em;">
  Deploy time: 4 minutes. Rollback risk: zero (two-line additive change). Zero recurrence in the 11 days since the fix shipped.
</p>

Note:
The contrast with the problem slide is intentional — same metric labels, green numbers instead of red. The fix was trivially small. The lesson is not about code complexity; it's about lifecycle discipline. Two missing lines caused an 8-minute outage that hit a prospective enterprise customer during a demo. That's the cost of skipping cleanup functions.

---

<!-- .slide: data-background-gradient="linear-gradient(135deg, #0f0f0f 0%, #1e293b 100%)" -->

## What We Learned

<ul>
  <li class="fragment fade-up"><strong>Always return cleanup from useEffect when creating subscriptions.</strong> EventSource, WebSocket, and setInterval all need explicit teardown — React does not close them automatically.</li>
  <li class="fragment fade-up"><strong>Check the instance, not the event object.</strong> <code>e.readyState</code> on an EventSource error event is always <code>undefined</code>. Use <code>source.readyState</code>. MDN documents this, but it is counterintuitive.</li>
  <li class="fragment fade-up"><strong>Streaming bugs look like data bugs.</strong> "Duplicate messages" points attention at the server (is it sending twice?). We spent 15 minutes investigating the SSE server before checking the client lifecycle. The server was innocent.</li>
  <li class="fragment fade-up"><strong>No console errors ≠ no bug.</strong> Silent wrong output is harder to debug than a thrown exception. Structured output assertions in tests are the only reliable detector.</li>
</ul>

Note:
Each lesson here should land before the next appears. The "streaming bugs look like data bugs" insight is the most transferable — any time you see doubled output, check for double subscriptions before checking the data source. It applies to WebSocket, polling intervals, and pub-sub channels as much as SSE.

---

<!-- .slide: data-background-gradient="linear-gradient(135deg, #0f0f0f 0%, #1e293b 100%)" -->

## Prevention

<span class="tag tag-primary">Action Items</span>

<table class="inc-action-table" style="margin-top: 1em;">
<thead>
<tr>
  <th>Action</th>
  <th>Owner</th>
  <th>Status</th>
</tr>
</thead>
<tbody>
<tr class="fragment fade-up">
  <td>Add ESLint rule: <code>useEffect</code> with <code>EventSource</code>, <code>WebSocket</code>, or <code>setInterval</code> must return a cleanup function</td>
  <td>Frontend Guild</td>
  <td><span class="tag tag-success">Done</span></td>
</tr>
<tr class="fragment fade-up">
  <td>Add regression test: mount <code>ChatWidget</code> twice, assert <code>appendToken</code> called exactly once per token after second mount</td>
  <td>QA</td>
  <td><span class="tag tag-success">Done</span></td>
</tr>
<tr class="fragment fade-up">
  <td>Code review checklist item: verify cleanup return in all <code>useEffect</code> hooks that open connections</td>
  <td>All reviewers</td>
  <td><span class="tag tag-warning">In Progress</span></td>
</tr>
<tr class="fragment fade-up">
  <td>Update onboarding guide: add <code>EventSource</code> lifecycle gotchas section with the <code>source.readyState</code> pitfall</td>
  <td>Docs</td>
  <td><span class="tag">Planned</span></td>
</tr>
</tbody>
</table>

Note:
Close with action. The ESLint rule is the highest-leverage item — it turns a runtime bug into a compile-time warning. The regression test ensures we won't accidentally revert the fix. The review checklist item is the highest-friction one; checklists work only if reviewers are disciplined about using them. Assign an owner and a date or it won't ship.

<!-- ══════════════════════════════════════════════════════════════
     INCIDENT RESPONSE THEME — CSS
     IMPORTANT: This block MUST remain at the END of the file.
     Placing <style> before the first slide separator creates an
     empty first slide and breaks the presentation structure.
     ══════════════════════════════════════════════════════════════ -->
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

/* ── Color Tokens ───────────────────────────────────────────── */
:root {
  --inc-bg:        #1a0a0a;
  --inc-bg-green:  #0a1a0a;
  --inc-surface:   #1f0c0c;
  --inc-red:       #ef4444;
  --inc-orange:    #f97316;
  --inc-amber:     #f59e0b;
  --inc-green:     #22c55e;
  --inc-calm:      #16a34a;
  --inc-text:      #f8fafc;
  --inc-muted:     #94a3b8;
  --inc-dim:       #64748b;
  --inc-font-head: 'Inter', system-ui, -apple-system, sans-serif;
  --inc-font-body: 'Inter', system-ui, -apple-system, sans-serif;
  --inc-font-mono: 'JetBrains Mono', 'SF Mono', Consolas, 'Courier New', monospace;

  /* RevealJS overrides */
  --r-background-color: var(--inc-bg);
  --r-main-color:       var(--inc-text);
  --r-heading-color:    var(--inc-red);
  --r-main-font:        var(--inc-font-body);
  --r-heading-font:     var(--inc-font-head);
  --r-code-font:        var(--inc-font-mono);
  --r-main-font-size:   28px;
}

/* ── Base ────────────────────────────────────────────────────── */
.reveal {
  font-family: var(--inc-font-body);
  font-size: 28px;
  color: var(--inc-text);
  background: var(--inc-bg);
}

.reveal .slides {
  text-align: left;
}

.reveal .slides section {
  padding: 40px 64px;
}

/* ── Progress Bar ─────────────────────────────────────────────── */
.reveal .progress {
  color: var(--inc-red);
}

/* ── Slide Number ─────────────────────────────────────────────── */
.reveal .slide-number {
  background: var(--inc-surface);
  color: var(--inc-dim);
  font-family: var(--inc-font-mono);
  font-size: 11px;
  padding: 4px 12px;
  border-radius: 4px 0 0 0;
  border-top: 1px solid rgba(239, 68, 68, 0.2);
  border-left: 1px solid rgba(239, 68, 68, 0.2);
}

/* ── Headings ─────────────────────────────────────────────────── */
.reveal h1,
.reveal h2,
.reveal h3,
.reveal h4 {
  text-transform: none;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.reveal h1 {
  font-family: var(--inc-font-head);
  font-size: 3.0em;
  font-weight: 800;
  color: var(--inc-red);
  margin-bottom: 0.1em;
  text-shadow: 0 0 40px rgba(239, 68, 68, 0.2);
}

.reveal h2 {
  font-family: var(--inc-font-head);
  font-size: 1.9em;
  font-weight: 700;
  color: var(--inc-orange);
  margin-bottom: 0.3em;
  padding-bottom: 0.3em;
  border-bottom: 1px solid rgba(249, 115, 22, 0.25);
}

.reveal h3 {
  font-family: var(--inc-font-head);
  font-size: 1.3em;
  font-weight: 600;
  color: var(--inc-green);
  margin-bottom: 0.4em;
}

.reveal h4 {
  font-family: var(--inc-font-head);
  font-size: 0.75em;
  font-weight: 400;
  color: var(--inc-dim);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 1em;
}

/* ── Body Text ────────────────────────────────────────────────── */
.reveal p {
  font-size: 1em;
  line-height: 1.7;
  color: var(--inc-text);
  margin-bottom: 0.8em;
}

/* ── Inline Code ──────────────────────────────────────────────── */
.reveal code {
  font-family: var(--inc-font-mono);
  font-size: 0.83em;
  background: rgba(245, 158, 11, 0.1);
  padding: 0.12em 0.45em;
  border-radius: 3px;
  color: var(--inc-amber);
  border: 1px solid rgba(245, 158, 11, 0.22);
}

/* ── Code Blocks ──────────────────────────────────────────────── */
.reveal pre {
  background: #0d0808;
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 6px;
  padding: 0;
  margin: 0.8em 0;
  font-size: 0.68em;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(239, 68, 68, 0.05);
  width: 100%;
}

.reveal pre code {
  background: none;
  border: none;
  padding: 1em 1.2em;
  font-size: 1em;
  color: var(--inc-text);
  line-height: 1.65;
}

/* Syntax tokens */
.reveal .token.keyword  { color: #f97316; }
.reveal .token.type     { color: #fbbf24; }
.reveal .token.string   { color: #86efac; }
.reveal .token.number   { color: #f59e0b; }
.reveal .token.function { color: #ef4444; }
.reveal .token.comment  { color: var(--inc-dim); font-style: italic; }
.reveal .token.operator { color: var(--inc-muted); }

/* ── Lists ────────────────────────────────────────────────────── */
.reveal ul,
.reveal ol {
  margin: 0 0 1em 0;
  padding-left: 0;
  list-style: none;
  text-align: left;
  font-size: 0.88em;
  line-height: 1.65;
}

.reveal ul li,
.reveal ol li {
  position: relative;
  padding-left: 1.8em;
  margin-bottom: 0.6em;
  color: var(--inc-text);
}

.reveal ul li::before {
  content: '▸';
  position: absolute;
  left: 0;
  color: var(--inc-red);
  font-size: 0.85em;
  top: 0.1em;
}

/* ── Emphasis ─────────────────────────────────────────────────── */
.reveal strong {
  font-weight: 700;
  color: var(--inc-text);
}

.reveal em {
  font-style: italic;
  color: var(--inc-amber);
}

/* ── Blockquote ───────────────────────────────────────────────── */
.reveal blockquote {
  margin: 1em 0;
  padding: 1em 1.5em;
  background: rgba(239, 68, 68, 0.06);
  border-left: 3px solid var(--inc-red);
  border-radius: 0 4px 4px 0;
  font-style: italic;
  color: var(--inc-muted);
}

.reveal blockquote p {
  margin: 0;
  font-size: 1em;
  line-height: 1.6;
  color: var(--inc-text);
}

/* ── Tags ─────────────────────────────────────────────────────── */
/* Base .tag (fallback/default for bare .tag) must come BEFORE variants */
.tag {
  display: inline-block;
  font-family: var(--inc-font-head);
  font-size: 0.54em;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 0.22em 0.75em;
  border-radius: 999px;
  margin: 0 0.25em 0.3em 0;
  vertical-align: middle;
  border: 1px solid transparent;
  line-height: 1.5;
  /* fallback "Planned" style — overridden by variants below */
  background: rgba(100, 116, 139, 0.15);
  color: var(--inc-dim);
  border-color: rgba(100, 116, 139, 0.3);
}

/* Variants come AFTER .tag so same-specificity cascade wins */
.tag-danger {
  background: rgba(239, 68, 68, 0.15);
  color: var(--inc-red);
  border-color: rgba(239, 68, 68, 0.35);
}

.tag-warning {
  background: rgba(249, 115, 22, 0.12);
  color: var(--inc-orange);
  border-color: rgba(249, 115, 22, 0.3);
}

.tag-primary {
  background: rgba(99, 102, 241, 0.15);
  color: #818cf8;
  border-color: rgba(99, 102, 241, 0.35);
}

.tag-success {
  background: rgba(34, 197, 94, 0.12);
  color: var(--inc-green);
  border-color: rgba(34, 197, 94, 0.3);
}

/* ── Metrics ──────────────────────────────────────────────────── */
.metrics-row {
  display: flex;
  gap: 1.2em;
  justify-content: center;
  flex-wrap: wrap;
  margin: 0.8em 0;
}

.metric {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2em;
  background: rgba(31, 12, 12, 0.8);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 10px;
  padding: 0.8em 1.4em;
  min-width: 120px;
  text-align: center;
}

.metric-value {
  font-family: var(--inc-font-head);
  font-size: 2.4em;
  font-weight: 800;
  color: var(--inc-red);
  letter-spacing: -0.03em;
  line-height: 1;
}

.metric-label {
  font-family: var(--inc-font-head);
  font-size: 0.62em;
  color: var(--inc-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 500;
}

.metric.metric-success {
  border-color: rgba(34, 197, 94, 0.25);
  background: rgba(10, 26, 10, 0.8);
}

.metric.metric-success .metric-value {
  color: var(--inc-green);
}

.metric.metric-danger .metric-value {
  color: var(--inc-red);
}

/* ── Two-Column Layout ────────────────────────────────────────── */
.two-column {
  display: flex;
  gap: 2em;
  align-items: flex-start;
  text-align: left;
}

.two-column > * {
  flex: 1;
  min-width: 0;
}

.col-label {
  font-family: var(--inc-font-head);
  font-size: 0.7em;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 0.4em;
}

.col-label.bad  { color: var(--inc-red); }
.col-label.good { color: var(--inc-green); }

/* ── Status Blocks ────────────────────────────────────────────── */
.inc-status-block {
  padding: 0.85em 1.2em;
  border-radius: 0 6px 6px 0;
}

.inc-status-open {
  background: rgba(239, 68, 68, 0.08);
  border-left: 3px solid var(--inc-red);
}

.inc-status-header {
  display: flex;
  align-items: center;
  gap: 0.7em;
  font-size: 0.9em;
  color: var(--inc-text);
}

.inc-status-meta {
  font-size: 0.65em;
  color: var(--inc-dim);
  margin-top: 0.3em;
  font-family: var(--inc-font-head);
}

.inc-status-badge {
  font-size: 0.72em;
  font-weight: 700;
  font-family: var(--inc-font-head);
  letter-spacing: 0.08em;
}

.badge-open   { color: var(--inc-red); }
.badge-inprog { color: var(--inc-orange); }
.badge-resolved { color: var(--inc-green); }

/* ── Danger Box ───────────────────────────────────────────────── */
.inc-danger-box {
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-left: 3px solid var(--inc-red);
  background: rgba(239, 68, 68, 0.07);
  border-radius: 0 6px 6px 0;
  padding: 0.9em 1.2em;
  margin: 0.6em 0;
  line-height: 1.65;
  color: var(--inc-text);
}

/* ── Pulse Indicator (title slide) ───────────────────────────── */
.inc-pulse-indicator {
  display: flex;
  align-items: center;
  gap: 0.6em;
  margin-bottom: 1.5em;
}

.inc-pulse-dot {
  width: 12px;
  height: 12px;
  background: var(--inc-red);
  border-radius: 50%;
  box-shadow: 0 0 8px var(--inc-red);
  animation: pulse 1.5s infinite;
  flex-shrink: 0;
}

.inc-pulse-label {
  font-family: var(--inc-font-head);
  font-size: 0.65em;
  font-weight: 700;
  color: var(--inc-red);
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

/* ── Inc Rule ─────────────────────────────────────────────────── */
.inc-rule {
  height: 2px;
  background: linear-gradient(90deg, var(--inc-red) 0%, var(--inc-orange) 50%, transparent 100%);
  margin: 0.5em 0 1em;
  border-radius: 1px;
}

/* ── Action Table ─────────────────────────────────────────────── */
.inc-action-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.75em;
}

.inc-action-table th {
  background: rgba(239, 68, 68, 0.1);
  color: var(--inc-muted);
  font-weight: 600;
  text-align: left;
  padding: 0.75em 1em;
  border-bottom: 1px solid rgba(239, 68, 68, 0.25);
  text-transform: uppercase;
  font-size: 0.82em;
  letter-spacing: 0.08em;
}

.inc-action-table td {
  padding: 0.65em 1em;
  border-bottom: 1px solid rgba(239, 68, 68, 0.1);
  color: var(--inc-text);
  vertical-align: middle;
}

/* ── Status Utilities ─────────────────────────────────────────── */
.status-red    { color: var(--inc-red);    font-weight: 700; }
.status-orange { color: var(--inc-orange); font-weight: 700; }
.status-green  { color: var(--inc-green);  font-weight: 700; }
.status-amber  { color: var(--inc-amber);  font-weight: 700; }

/* ── Fragment Transitions ─────────────────────────────────────── */
.reveal .fragment {
  transition: opacity 0.4s ease, transform 0.4s ease;
}

.reveal .fragment.fade-up {
  transform: translateY(16px);
}

.reveal .fragment.visible.fade-up {
  transform: translateY(0);
}

/* ── Animations ───────────────────────────────────────────────── */
@keyframes pulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 8px var(--inc-red); }
  50%       { opacity: 0.5; box-shadow: 0 0 16px var(--inc-red), 0 0 32px rgba(239,68,68,0.35); }
}
</style>
