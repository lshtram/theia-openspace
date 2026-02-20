---
title: "Server-Sent Events (SSE): Real-Time Without WebSockets"
theme: openspace-modern
transition: slide
transitionSpeed: default
backgroundTransition: fade
controls: true
progress: true
slideNumber: "c/t"
---

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --os-primary:       #6366f1;
  --os-primary-light: #818cf8;
  --os-primary-dark:  #4f46e5;
  --os-accent:        #e94560;
  --os-accent-light:  #ff6b6b;
  --os-bg-primary:    #0f172a;
  --os-bg-secondary:  #1e293b;
  --os-text-primary:  #f8fafc;
  --os-text-secondary:#cbd5e1;
  --os-text-muted:    #94a3b8;
  --os-success:       #10b981;
  --os-warning:       #f59e0b;
  --os-error:         #ef4444;
  --os-info:          #3b82f6;

  --r-main-font:        'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --r-heading-font:     'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --r-code-font:        'JetBrains Mono', 'Fira Code', monospace;
  --r-background-color: var(--os-bg-primary);
  --r-main-color:       var(--os-text-primary);
  --r-heading-color:    var(--os-text-primary);
  --r-link-color:       var(--os-primary-light);
  --r-link-color-hover: var(--os-primary);
}

.reveal { font-family: var(--r-main-font); font-size: var(--r-main-font-size); color: var(--r-main-color); }
.reveal .slides section { text-align: left; padding: 0 1.5em; }
.reveal h1, .reveal h2, .reveal h3, .reveal h4 { font-family: var(--r-heading-font); font-weight: 700; letter-spacing: -0.02em; color: var(--r-heading-color); margin-bottom: 0.5em; line-height: 1.15; text-transform: none; text-shadow: none; }
.reveal h1 { font-size: 2.4em; font-weight: 800; background: linear-gradient(135deg, var(--os-text-primary) 0%, var(--os-primary-light) 60%, var(--os-accent-light) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.reveal h2 { font-size: 1.6em; }
.reveal h3 { font-size: 1.2em; color: var(--os-text-secondary); }
.reveal p { color: var(--os-text-secondary); line-height: 1.7; margin: 0 0 0.8em; }

.reveal ul, .reveal ol { display: block; text-align: left; color: var(--os-text-secondary); line-height: 1.8; margin-left: 1.2em; list-style: none; }
.reveal ul li { margin-bottom: 0.3em; position: relative; padding-left: 1.2em; }
.reveal ul li::before { content: '▸'; position: absolute; left: 0; color: var(--os-primary-light); font-size: 0.85em; top: 0.1em; }
.reveal li strong { color: var(--os-text-primary); }

.reveal code { font-family: var(--r-code-font); font-size: 0.88em; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 5px; padding: 0.15em 0.45em; color: var(--os-accent-light); }
.reveal pre { background: var(--os-bg-secondary); border: 1px solid rgba(99, 102, 241, 0.25); border-radius: 10px; padding: 1em 1.2em; font-size: 0.78em; box-shadow: 0 4px 24px rgba(0,0,0,0.35); width: 100%; margin: 0.5em 0; }
.reveal pre code { background: transparent; border: none; padding: 0; font-size: 1em; color: var(--os-text-primary); }

.reveal .highlight-box { background: linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(233, 69, 96, 0.08) 100%); border: 1px solid rgba(99, 102, 241, 0.35); border-left: 4px solid var(--os-primary); border-radius: 10px; padding: 1.2em 1.5em; margin: 0.8em 0; color: var(--os-text-primary); font-size: 0.95em; line-height: 1.6; }
.reveal .highlight-box strong { color: var(--os-primary-light); display: block; margin-bottom: 0.4em; font-size: 0.8em; text-transform: uppercase; letter-spacing: 0.05em; }

.reveal .metric { text-align: center; padding: 0.8em 1.2em; }
.reveal .metric-value { font-size: 2.8em; font-weight: 800; line-height: 1.1; letter-spacing: -0.03em; background: linear-gradient(135deg, var(--os-primary-light), var(--os-accent-light)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.reveal .metric-label { font-size: 0.65em; color: var(--os-text-muted); text-transform: uppercase; letter-spacing: 0.12em; margin-top: 0.3em; font-weight: 500; }

.reveal .tag { display: inline-block; padding: 0.2em 0.7em; border-radius: 999px; font-size: 0.6em; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; vertical-align: middle; margin: 0 0.2em; line-height: 1.8; }
.reveal .tag-primary { background: rgba(99, 102, 241, 0.18); color: var(--os-primary-light); border: 1px solid rgba(99, 102, 241, 0.4); }
.reveal .tag-success { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35); }
.reveal .tag-warning { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35); }

.reveal .two-column { display: flex; gap: 2.5em; align-items: flex-start; text-align: left; width: 100%; }
.reveal .two-column .column { flex: 1; min-width: 0; }
.reveal .two-column .column h3 { font-size: 1em; font-weight: 700; margin-bottom: 0.6em; padding-bottom: 0.4em; border-bottom: 2px solid rgba(99, 102, 241, 0.3); color: var(--os-primary-light); }

.reveal .gradient-text { background: linear-gradient(135deg, var(--os-primary-light), var(--os-accent-light)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.reveal .fragment { opacity: 0; transition: opacity 0.4s ease, transform 0.4s ease; }
.reveal .fragment.visible { opacity: 1; }
.reveal .fragment.fade-up { transform: translateY(20px); }
.reveal .fragment.fade-up.visible { transform: translateY(0); }
.reveal .progress { background: rgba(255,255,255,0.08); }
.reveal .progress span { background: var(--os-primary); }
.reveal .slide-number { background: rgba(99, 102, 241, 0.15); color: var(--os-text-muted); font-size: 0.55em; border-radius: 6px; padding: 3px 8px; }
.reveal .centered { text-align: center; width: 100%; }
.reveal .slide-subtitle { font-size: 0.7em; color: var(--os-text-muted); font-weight: 400; margin-top: -0.3em; margin-bottom: 1em; letter-spacing: 0.01em; }

.reveal .sse-event { display: inline-block; padding: 0.15em 0.6em; border-radius: 6px; font-family: var(--r-code-font); font-size: 0.9em; font-weight: 600; background: rgba(59, 130, 246, 0.2); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.45); }
.reveal .sse-data { display: inline-block; padding: 0.15em 0.6em; border-radius: 6px; font-family: var(--r-code-font); font-size: 0.9em; font-weight: 600; background: rgba(16, 185, 129, 0.2); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.45); }
</style>

---

<!-- .slide: data-background-gradient="linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)" -->

<div class="centered" style="padding-top: 0.5em;">

# Server-Sent Events (SSE)

<p class="slide-subtitle">After this you'll understand: what SSE is, how it differs from WebSockets, and why we use it in this project.</p>

<div style="margin-top: 1.5em;">
  <span class="tag tag-primary">One-Way Stream</span>
  <span class="tag tag-success">HTTP-Based</span>
  <span class="tag tag-warning">Real-Time</span>
</div>

</div>

Note: SSE is everywhere in our project — it powers the real-time chat, the session sync, the model streaming. Most devs use it without understanding the mechanics. By the end, you'll be able to explain it and debug it.

---

## Why This Matters

<div class="highlight-box">
  <strong>The Problem It Solves</strong>
  Sometimes the server needs to push data to the client WITHOUT the client asking. Think: live chat messages, progress updates, model streaming, notifications. HTTP normally only goes client → server.
</div>

**You'll hit SSE in real projects when:**

- Building a chat interface that shows messages as they arrive <!-- .element: class="fragment fade-up" -->
- Streaming LLM responses word-by-word as they're generated <!-- .element: class="fragment fade-up" -->
- Showing real-time progress for long-running operations <!-- .element: class="fragment fade-up" -->
- Keeping multiple clients in sync with server state <!-- .element: class="fragment fade-up" -->

Note: Show of hands — who's tried to poll a server every second to get updates? That's the "before" SSE. Now let's see the "after."

---

## The Core Idea

<div class="highlight-box">
  <strong>The Newsletter Analogy</strong>
  Think of SSE like signing up for a newsletter. You (the client) open a connection to the publisher once. The publisher (server) then pushes new issues to you whenever they come out. You never had to ask "any new issues today?" — it just arrived. And the connection stays open indefinitely.
</div>

This maps directly onto SSE's key properties:

- **Server pushes, client receives** — the server decides when to send data <!-- .element: class="fragment fade-up" -->
- **Single, long-lived HTTP connection** — no polling, no reconnecting for each message <!-- .element: class="fragment fade-up" -->
- **One-way street** — server → client only. For two-way, you'd need WebSockets. <!-- .element: class="fragment fade-up" -->

Note: Keep coming back to the newsletter. Every SSE mechanic maps to it — the "subscription" is opening the EventSource, the "delivery" is the server writing to the stream.

---

<!-- .slide: data-auto-animate -->

## How It Works <span class="tag tag-primary">Part 1: The Protocol</span>

SSE is a simple text-based protocol over HTTP. Each event is a block of lines:

<div style="font-family: var(--r-code-font); font-size: 0.72em; background: var(--os-bg-secondary); border: 1px solid rgba(99, 102, 241, 0.25); border-radius: 10px; padding: 1em; margin: 0.8em 0;">

<span class="sse-event">event:</span> message<span style="color: var(--os-text-muted);">← event type (optional)</span>
<br><span class="sse-data">data:</span> Hello, world!<span style="color: var(--os-text-muted);">← the payload</span>
<br>id: 42<span style="color: var(--os-text-muted);">← optional identifier</span>
<br><span style="color: var(--os-text-muted);">← blank line SEPARATES events</span>

</div>

Key headers from the server:

<div style="font-family: var(--r-code-font); font-size: 0.7em; background: var(--os-bg-secondary); border: 1px solid rgba(99, 102, 241, 0.25); border-radius: 10px; padding: 0.8em; margin: 0.5em 0;">
Content-Type: text/event-stream
<br>Cache-Control: no-cache
<br>Connection: keep-alive
</div>

Note: Each event is separated by a blank line. That's the entire protocol — just text with prefixes. No binary, no complex framing.

---

<!-- .slide: data-auto-animate -->

## How It Works <span class="tag tag-success">Part 2: Client-Side</span>

The browser provides a built-in API — no library needed:

```javascript
const eventSource = new EventSource('/events');

// Listen for a specific event type
eventSource.addEventListener('message', (event) => {
  console.log('Received:', event.data);
});

eventSource.addEventListener('model-progress', (event) => {
  console.log('Model update:', JSON.parse(event.data));
});

eventSource.onerror = (err) => {
  console.error('SSE error:', err);
  // EventSource auto-reconnects by default!
};
```

<div class="highlight-box" style="font-size: 0.85em; margin-top: 0.8em;">
  <strong>Key Feature:</strong> <code>EventSource</code> automatically reconnects if the connection drops. No manual retry logic needed.
</div>

---

<!-- .slide: data-auto-animate -->

## How It Works <span class="tag tag-warning">Part 3: Server-Side</span>

In Node.js, here's how our project implements it:

```typescript
// From opencode-proxy.ts in our codebase
const request = http.request({
  hostname: 'localhost',
  port: 8080,
  path: '/event?directory=/my/project',
  method: 'GET',
  headers: {
    'Accept': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  }
});

request.setTimeout(0); // No timeout — streams can run for minutes!
```

The server writes events as they happen:

```typescript
// Send an event
response.write('event: model-progress\n');
response.write('data: {"token": "hello", "progress": 0.1}\n\n');
```

Note: The `\n\n` (double newline) is critical — it tells the client "this event is complete."

---

## SSE vs WebSockets

<div class="two-column" style="margin-top: 1em;">

<div class="column">

### SSE (Server-Sent Events)

<div style="font-size: 0.82em;">

- **One-way** — server → client only
- Uses plain HTTP
- Built-in auto-reconnect
- Automatic fallback for older browsers via polyfill
- Lightweight, simple protocol
- Works through proxies/firewalls easily

</div>

</div>

<div class="column">

### WebSockets

<div style="font-size: 0.82em;">

- **Two-way** — full duplex, client ↔ server
- Uses `ws://` or `wss://` protocol
- No built-in reconnection (you handle it)
- More complex protocol
- Requires WebSocket-aware proxy support
- Bidirectional needed? Use this.

</div>

</div>

</div>

<div class="highlight-box" style="margin-top: 1em;">
  <strong>When to use SSE:</strong> Real-time updates where the server is the primary sender — chat receives, model streaming, notifications, dashboards.
</div>

Note: In our project, we use SSE because we mainly receive from the server (chat responses, LLM token streaming). We don't need to send commands back through the same stream — normal HTTP requests handle that.

---

## How Our Project Uses SSE

<div class="highlight-box">
  <strong>In a nutshell</strong>
  Our Electron app opens an SSE connection to the OpenCode server. The server pushes real-time events: chat message chunks, tool execution results, model progress updates.
</div>

**Where you'll see it:**

- <code>opencode-proxy.ts</code> — manages the SSE connection, handles reconnection logic <!-- .element: class="fragment fade-up" -->
- <code>session-service.ts</code> — processes incoming events, updates UI <!-- .element: class="fragment fade-up" -->
- <code>message-bubble.tsx</code> — renders streaming content as it arrives <!-- .element: class="fragment fade-up" -->

<div style="margin-top: 1em; font-family: var(--r-code-font); font-size: 0.75em; background: var(--os-bg-secondary); border: 1px solid rgba(99, 102, 241, 0.25); border-radius: 10px; padding: 1em;">
// Connection lifecycle in our code<br>
establishSSEConnection() → connect → handleSSEEvent() → disconnectSSE()
</div>

---

## Common Pitfalls

- <span class="tag tag-warning">Connection</span> **Browser connection limits** — browsers limit SSE connections (6 per domain). Multiple tabs + active SSE can hit this. <!-- .element: class="fragment fade-up" -->

- <span class="tag tag-warning">Reconnection</span> **Missing `last-event-id` header** — after reconnecting, the server needs to know where to resume. Our proxy handles this, but custom servers need the `Last-Event-ID` header. <!-- .element: class="fragment fade-up" -->

- <span class="tag tag-warning">Timeout</span> **Proxies kill idle connections** — set `keep-alive` headers, or use application-level heartbeats. Our code sets `request.setTimeout(0)` to prevent this. <!-- .element: class="fragment fade-up" -->

- <span class="tag tag-warning">Memory</span> **Forgetting to disconnect** — SSE connections hold resources. Always call `eventSource.close()` or our `disconnectSSE()` when done. <!-- .element: class="fragment fade-up" -->

Note: The connection limit is the most common production issue. If you open 7 tabs with active SSE to the same server, the 7th will fail to connect.

---

## Mental Model

<div class="highlight-box centered" style="padding: 1.8em 2em; margin: 0.5em 0 1em;">
  <strong>One Sentence</strong>
  <p style="font-size: 1.1em; color: var(--os-text-primary); font-weight: 600; margin: 0; line-height: 1.5;">SSE is like a dedicated newsletter subscription — you open one HTTP connection, and the server pushes updates to you as they happen, for as long as you stay subscribed.</p>
</div>

The newsletter, restated:

- **Subscribe** → `new EventSource('/events')` opens the connection <!-- .element: class="fragment fade-up" -->
- **Receive** → server writes `data:` events, client gets them instantly <!-- .element: class="fragment fade-up" -->
- **Auto-reconnect** → if connection drops, browser re-establishes automatically <!-- .element: class="fragment fade-up" -->
- **Unsubscribe** → `eventSource.close()` stops the stream <!-- .element: class="fragment fade-up" -->

Note: If someone can repeat this analogy tomorrow, the session worked.

---

<!-- .slide: data-background-gradient="linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)" -->

## What You Now Understand

- **Why SSE exists** — server-to-client push over plain HTTP, no WebSocket overhead <!-- .element: class="fragment fade-up" -->
- **The protocol** — simple text format with `event:`, `data:`, `id:` fields, blank line separators <!-- .element: class="fragment fade-up" -->
- **Client-side** — native `EventSource` API with automatic reconnection <!-- .element: class="fragment fade-up" -->
- **Server-side** — long-lived HTTP response, write events as they occur <!-- .element: class="fragment fade-up" -->
- **When to use it** — one-way streaming (chat, model output, notifications) vs WebSockets for bidirectional <!-- .element: class="fragment fade-up" -->
- **Gotchas** — connection limits, reconnection headers, proxy timeouts, cleanup <!-- .element: class="fragment fade-up" -->

<div style="margin-top: 1.2em; text-align: center;" class="fragment fade-up">
  <span class="tag tag-primary">One-Way Stream</span>
  <span class="tag tag-success">HTTP-Based</span>
  <span class="tag tag-warning">Auto-Reconnect</span>
</div>
