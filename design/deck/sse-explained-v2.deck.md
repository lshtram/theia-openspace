---
title: "Server-Sent Events: Real-Time Made Simple"
theme: openspace-modern
transition: slide
transitionSpeed: default
backgroundTransition: fade
controls: true
progress: true
slideNumber: "c/t"
---

<!-- Slide 1: Title with background image -->

<!-- .slide: data-background-image="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1920" data-background-opacity="0.3" -->

<div class="centered" style="padding-top: 0.5em;">

# Server-Sent Events

<p class="slide-subtitle">Server-to-client streaming over HTTP</p>

<div style="margin-top: 1.5em;">
  <span class="tag tag-primary">One-Way Stream</span>
  <span class="tag tag-success">HTTP-Based</span>
  <span class="tag tag-warning">Real-Time</span>
</div>

</div>

Note: SSE is everywhere — live chat, stock tickers, notifications. Most devs use it without understanding the mechanics. By the end, you'll know when to choose SSE over WebSockets.

---

<!-- Slide 2: The Problem -->

## The Problem

<div class="highlight-box">
  <strong>HTTP is Request/Response Only</strong>
  The client asks. The server answers. But what if the server needs to push updates without being asked?
</div>

**Use cases:**
- Live chat messages
- Stock price updates  
- Progress notifications
- Real-time dashboards

---

<!-- Slide 3: Three Properties -->

## What Makes SSE Different?

<div style="display: flex; justify-content: space-around; margin-top: 1.5em;">
  <div style="text-align: center; padding: 1em;">
    <div style="font-size: 3em;">➡️</div>
    <h3 style="margin: 0.3em 0;">One-Way</h3>
    <p style="font-size: 0.7em; color: #94a3b8;">Server → Client only</p>
  </div>
  
  <div style="text-align: center; padding: 1em;">
    <div style="font-size: 3em;">🌐</div>
    <h3 style="margin: 0.3em 0;">HTTP</h3>
    <p style="font-size: 0.7em; color: #94a3b8;">Standard protocol</p>
  </div>
  
  <div style="text-align: center; padding: 1em;">
    <div style="font-size: 3em;">🔄</div>
    <h3 style="margin: 0.3em 0;">Auto-Reconnect</h3>
    <p style="font-size: 0.7em; color: #94a3b8;">Built-in resilience</p>
  </div>
</div>

---

<!-- Slide 4: Architecture Diagram -->

## How It Works

<div style="display: flex; align-items: center; justify-content: center; gap: 1em; margin-top: 1.5em;">
  <div style="text-align: center;">
    <div style="width: 120px; height: 100px; border: 3px solid #3b82f6; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(59, 130, 246, 0.15);">
      <span style="font-size: 2em;">🖥️</span>
      <span style="font-size: 0.7em; margin-top: 0.3em;">Browser</span>
    </div>
  </div>
  
  <div style="flex: 1; max-width: 300px;">
    <div style="height: 4px; background: linear-gradient(90deg, #3b82f6, #10b981); border-radius: 2px;"></div>
    <div style="display: flex; justify-content: center; margin-top: 0.5em;">
      <span style="font-size: 0.65em; color: #94a3b8; background: rgba(16, 185, 129, 0.2); padding: 0.2em 0.8em; border-radius: 12px;">Persistent HTTP Connection</span>
    </div>
  </div>
  
  <div style="text-align: center;">
    <div style="width: 120px; height: 100px; border: 3px solid #10b981; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(16, 185, 129, 0.15);">
      <span style="font-size: 2em;">⚙️</span>
      <span style="font-size: 0.7em; margin-top: 0.3em;">Server</span>
    </div>
  </div>
</div>

<div style="margin-top: 2em; text-align: center; font-size: 0.8em; color: #94a3b8;">
  Single HTTP request stays open • Server pushes events as text
</div>

---

<!-- Slide 5: Protocol -->

## The Protocol

**Simple text format:**

<div style="font-family: var(--r-code-font); font-size: 0.8em; background: var(--os-bg-secondary); border: 1px solid rgba(99, 102, 241, 0.25); border-radius: 10px; padding: 1em; margin: 0.8em 0;">
<span class="sse-event">event:</span> message<br>
<span class="sse-data">data:</span> Hello from server!<br>
id: 123<br>
<br>
<span class="sse-event">event:</span> update<br>
<span class="sse-data">data:</span> {"progress": 50}<br>
<br>
<span style="color: #64748b;">← Blank line separates events</span>
</div>

**HTTP Headers:**
```
Content-Type: text/event-stream
Cache-Control: no-cache
```

---

<!-- Slide 6: Client Code -->

## Client-Side Code

**Native browser API:**

```javascript
const source = new EventSource('/events');

source.addEventListener('message', (e) => {
  console.log('Received:', e.data);
});

source.onerror = (err) => {
  console.error('Connection error');
  // Auto-reconnect happens automatically!
};
```

<div class="highlight-box" style="font-size: 0.85em; margin-top: 0.8em;">
  <strong>Key Feature:</strong> EventSource automatically reconnects with exponential backoff.
</div>

---

<!-- Slide 7: Server Code -->

## Server-Side

```javascript
const http = require('http');

http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  setInterval(() => {
    res.write('data: ' + JSON.stringify({
      time: new Date().toISOString()
    }) + '\n\n');
  }, 1000);
}).listen(8080);
```

**Critical:** Double newline (`\n\n`) marks the end of an event.

---

<!-- Slide 8: Comparison - NO BACKGROUND IMAGE -->

## SSE vs WebSockets

<div class="two-column" style="margin-top: 1em;">

<div class="column">

### SSE

- **One-way** only
- Standard HTTP
- Auto-reconnect built-in
- Works through all proxies
- Lower complexity
- **Best for:** Notifications

</div>

<div class="column">

### WebSockets

- **Two-way** full duplex
- Custom protocol
- Manual reconnection
- Needs WS proxy support
- Higher complexity
- **Best for:** Games, chat

</div>

</div>

---

<!-- Slide 9: Decision Matrix -->

## When to Use What

<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1em; margin-top: 1em;">
  <div style="text-align: center; padding: 0.8em; border: 2px solid rgba(99, 102, 241, 0.3); border-radius: 8px;">
    <div style="font-size: 1.8em; margin-bottom: 0.3em;">📊</div>
    <div style="font-size: 0.8em; font-weight: bold;">HTTP Polling</div>
    <div style="font-size: 0.65em; color: #94a3b8; margin-top: 0.3em;">Simple but inefficient</div>
  </div>
  
  <div style="text-align: center; padding: 0.8em; border: 3px solid #6366f1; border-radius: 8px; background: rgba(99, 102, 241, 0.1);">
    <div style="font-size: 1.8em; margin-bottom: 0.3em;">➡️</div>
    <div style="font-size: 0.8em; font-weight: bold; color: #818cf8;">SSE</div>
    <div style="font-size: 0.65em; color: #94a3b8; margin-top: 0.3em;">Server push, simple</div>
  </div>
  
  <div style="text-align: center; padding: 0.8em; border: 2px solid rgba(99, 102, 241, 0.3); border-radius: 8px;">
    <div style="font-size: 1.8em; margin-bottom: 0.3em;">🔄</div>
    <div style="font-size: 0.8em; font-weight: bold;">WebSockets</div>
    <div style="font-size: 0.65em; color: #94a3b8; margin-top: 0.3em;">Bidirectional, complex</div>
  </div>
</div>

<div style="margin-top: 1.5em; text-align: center;">
  <span class="tag tag-success">SSE</span> = server → client streaming
  <br><span class="tag tag-warning">WebSockets</span> = two-way communication
</div>

---

<!-- Slide 10: Pitfalls -->

## Common Pitfalls

- <span class="tag tag-warning">Limits</span> **6 connections per domain** — browser limit
- <span class="tag tag-warning">Timeout</span> **Proxy idle timeouts** — use keep-alive
- <span class="tag tag-warning">Resume</span> **Handle Last-Event-ID** — reconnect properly
- <span class="tag tag-warning">Cleanup</span> **Close connections** — prevent memory leaks

---

<!-- Slide 11: Summary -->

## Summary

<div style="display: flex; justify-content: space-around; margin-top: 1em;">
  <div style="text-align: center;">
    <div style="font-size: 2em; color: #818cf8;">📡</div>
    <p style="font-size: 0.75em; margin-top: 0.5em;">One-way streaming</p>
  </div>
  <div style="text-align: center;">
    <div style="font-size: 2em; color: #818cf8;">🌐</div>
    <p style="font-size: 0.75em; margin-top: 0.5em;">Standard HTTP</p>
  </div>
  <div style="text-align: center;">
    <div style="font-size: 2em; color: #818cf8;">🔄</div>
    <p style="font-size: 0.75em; margin-top: 0.5em;">Auto-reconnect</p>
  </div>
  <div style="text-align: center;">
    <div style="font-size: 2em; color: #818cf8;">📄</div>
    <p style="font-size: 0.75em; margin-top: 0.5em;">Text protocol</p>
  </div>
</div>

<div class="highlight-box centered" style="margin-top: 1.5em;">
  <strong>Rule of Thumb</strong>
  Need server → client streaming without two-way? Use SSE.
</div>

---

<!-- Slide 12: Closing -->

<!-- .slide: data-background-gradient="linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)" -->

## Key Takeaways

- **What:** One-way server push over HTTP
- **Why:** Simpler than WebSockets for streaming
- **When:** Notifications, live updates, progress
- **How:** EventSource API + text/event-stream

<div style="margin-top: 2em; text-align: center;">
  <span class="tag tag-primary">Simple</span>
  <span class="tag tag-success">Reliable</span>
  <span class="tag tag-warning">Standard</span>
</div>

---

<!-- CSS goes at the END, after all slides -->

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

.reveal { font-family: var(--r-main-font); color: var(--r-main-color); }
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

.reveal code { font-family: var(--r-code-font); font-size: 0.88em; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 5px; padding: 0.15em 0.45em; color: #93c5fd; }
.reveal pre { background: var(--os-bg-secondary); border: 1px solid rgba(99, 102, 241, 0.25); border-radius: 10px; padding: 1em 1.2em; font-size: 0.78em; box-shadow: 0 4px 24px rgba(0,0,0,0.35); width: 100%; margin: 0.5em 0; }
.reveal pre code { background: transparent; border: none; padding: 0; font-size: 1em; color: #e2e8f0; }

.reveal .highlight-box { background: linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(233, 69, 96, 0.08) 100%); border: 1px solid rgba(99, 102, 241, 0.35); border-left: 4px solid var(--os-primary); border-radius: 10px; padding: 1.2em 1.5em; margin: 0.8em 0; color: var(--os-text-primary); font-size: 0.95em; line-height: 1.6; }
.reveal .highlight-box strong { color: var(--os-primary-light); display: block; margin-bottom: 0.4em; font-size: 0.8em; text-transform: uppercase; letter-spacing: 0.05em; }

.reveal .tag { display: inline-block; padding: 0.2em 0.7em; border-radius: 999px; font-size: 0.6em; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; vertical-align: middle; margin: 0 0.2em; line-height: 1.8; }
.reveal .tag-primary { background: rgba(99, 102, 241, 0.18); color: var(--os-primary-light); border: 1px solid rgba(99, 102, 241, 0.4); }
.reveal .tag-success { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35); }
.reveal .tag-warning { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35); }

.reveal .two-column { display: flex; gap: 2.5em; align-items: flex-start; text-align: left; width: 100%; }
.reveal .two-column .column { flex: 1; min-width: 0; }
.reveal .two-column .column h3 { font-size: 1em; font-weight: 700; margin-bottom: 0.6em; padding-bottom: 0.4em; border-bottom: 2px solid rgba(99, 102, 241, 0.3); color: var(--os-primary-light); }

.reveal .progress { background: rgba(255,255,255,0.08); }
.reveal .progress span { background: var(--os-primary); }
.reveal .slide-number { background: rgba(99, 102, 241, 0.15); color: var(--os-text-muted); font-size: 0.55em; border-radius: 6px; padding: 3px 8px; }
.reveal .centered { text-align: center; width: 100%; }
.reveal .slide-subtitle { font-size: 0.7em; color: var(--os-text-muted); font-weight: 400; margin-top: -0.3em; margin-bottom: 1em; letter-spacing: 0.01em; }

.reveal .sse-event { display: inline-block; padding: 0.15em 0.6em; border-radius: 6px; font-family: var(--r-code-font); font-size: 0.9em; font-weight: 600; background: rgba(59, 130, 246, 0.2); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.45); }
.reveal .sse-data { display: inline-block; padding: 0.15em 0.6em; border-radius: 6px; font-family: var(--r-code-font); font-size: 0.9em; font-weight: 600; background: rgba(16, 185, 129, 0.2); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.45); }
</style>
