---
title: "How Server-Sent Events Work"
theme: white
transition: slide
controls: true
progress: true
slideNumber: "c/t"
---

<!-- ============================================================
  SLIDE 1 — TITLE SLIDE
  ============================================================ -->

<!-- .slide: data-background-color="#faf8f5" -->

<div class="centered" style="padding-top: 0.5em;">

# How Server-Sent Events Work

<p class="slide-subtitle">After this you'll understand: why SSE exists, how the HTTP connection stays open, and when to choose it over WebSockets.</p>

<div style="margin-top: 1.5em;">
  <span class="tag tag-primary">Streaming</span>
  <span class="tag tag-success">HTTP</span>
  <span class="tag tag-warm">Real-time</span>
</div>

</div>

Note: SSE is the invisible pipe behind AI chat completions, live dashboards, and build log tails. Most devs use it every day without knowing it. By the end, you can explain the wire protocol in 60 seconds.

---

<!-- ============================================================
  SLIDE 2 — WHY THIS MATTERS
  ============================================================ -->

<!-- .slide: data-background-color="#faf8f5" -->

## Why This Matters

<div class="callout-box">
  <strong>The Problem</strong>
  HTTP is request-response — every response closes the connection. But AI assistants, live dashboards, and log tails need the server to push data continuously without the client polling every second.
</div>

**You'll hit SSE in the wild when:**

- An AI chat assistant streams its reply token by token <!-- .element: class="fragment fade-up" -->
- A trading dashboard updates stock prices in real time <!-- .element: class="fragment fade-up" -->
- A CI/CD system streams live build and test logs <!-- .element: class="fragment fade-up" -->
- A analytics tool pushes real-time event counts to a browser <!-- .element: class="fragment fade-up" -->

Note: OpenAI's streaming API, GitHub Copilot's completions, and Vercel's Edge streaming all use SSE or a very close cousin. Understanding the protocol demystifies all of them.

---

<!-- ============================================================
  SLIDE 3 — THE CORE IDEA (ANALOGY)
  ============================================================ -->

<!-- .slide: data-background-color="#faf8f5" -->

## The Core Idea

<div class="callout-box">
  <strong>The Radio Broadcast Analogy</strong>
  Think of SSE like a radio broadcast: you tune in (make one HTTP request), and the station keeps transmitting. You don't call the station every minute to ask for the next song — the signal just keeps coming until you turn off the radio.
</div>

This maps directly onto SSE's two defining properties:

- **One-way** — signal flows server → client only; the radio doesn't listen back <!-- .element: class="fragment fade-up" -->
- **Persistent connection** — one tune-in request, continuous stream, no re-dialing <!-- .element: class="fragment fade-up" -->

Note: Keep this radio analogy. It handles the obvious question — "why not WebSockets?" — because a radio doesn't need a phone line back to the station. Unidirectional is a feature, not a limitation.

---

<!-- ============================================================
  SLIDE 4 — HOW IT WORKS PART 1: THE CONNECTION
  ============================================================ -->

<!-- .slide: data-background-color="#faf8f5" data-auto-animate -->

## How It Works <span class="tag tag-primary">Part 1: The Connection</span>

The client makes **one** GET request; the server never closes it:

```http
GET /events HTTP/1.1
Accept: text/event-stream
Cache-Control: no-cache
```

```http
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
Transfer-Encoding: chunked
```

<div style="display: flex; align-items: center; justify-content: center; gap: 2em; margin-top: 1.2em;">
  <div class="arch-box arch-client">
    <div style="font-size: 1.8em;">🖥️</div>
    <div>Browser</div>
  </div>
  <div style="display: flex; flex-direction: column; align-items: center; gap: 0.3em;">
    <div style="font-size: 0.65em; color: var(--clr-muted);">GET /events →</div>
    <div style="width: 120px; height: 2px; background: var(--clr-accent);"></div>
    <div style="font-size: 0.65em; color: var(--clr-accent);">← event stream (open)</div>
  </div>
  <div class="arch-box arch-server">
    <div style="font-size: 1.8em;">⚙️</div>
    <div>Server</div>
  </div>
</div>

Note: The critical header is Content-Type: text/event-stream. That's what tells the browser to treat the response as an event stream rather than a normal body. The connection stays open indefinitely.

---

<!-- ============================================================
  SLIDE 5 — HOW IT WORKS PART 2: THE EVENT FORMAT
  ============================================================ -->

<!-- .slide: data-background-color="#faf8f5" data-auto-animate -->

## How It Works <span class="tag tag-success">Part 2: The Event Format</span>

Events are plain UTF-8 text lines. A **blank line** (`\n\n`) ends each event:

```
data: {"message": "Hello"}\n\n

id: 42\n
event: update\n
data: {"delta": "world"}\n\n

retry: 3000\n
```

<div style="display: flex; gap: 1.2em; flex-wrap: wrap; margin-top: 0.6em; font-size: 0.78em;">
  <div class="field-chip chip-data"><code>data</code> — the payload (required)</div>
  <div class="field-chip chip-id"><code>id</code> — event ID for reconnect cursor</div>
  <div class="field-chip chip-event"><code>event</code> — named event type</div>
  <div class="field-chip chip-retry"><code>retry</code> — reconnect delay (ms)</div>
</div>

Note: The double newline is the protocol's only delimiter. Multi-line data is supported by repeating the data: prefix. The id field is what enables loss-free reconnection — the browser sends Last-Event-ID on reconnect.

---

<!-- ============================================================
  SLIDE 6 — HOW IT WORKS PART 3: CLIENT CODE
  ============================================================ -->

<!-- .slide: data-background-color="#faf8f5" data-auto-animate -->

## How It Works <span class="tag tag-warm">Part 3: Client Code</span>

<p style="font-size: 0.75em; color: var(--clr-muted); margin-bottom: 0.4em;">The browser's built-in <code>EventSource</code> API — no library needed</p>

```javascript
const source = new EventSource('/events');

source.addEventListener('message', (e) => {
  const data = JSON.parse(e.data);
  updateUI(data);
});

source.addEventListener('update', (e) => {
  const delta = JSON.parse(e.data);
  appendDelta(delta);
});

source.addEventListener('error', (e) => {
  if (e.readyState === EventSource.CLOSED) reconnect();
});
```
<!-- .element: data-line-numbers="1|3-6|8-11|13-15" -->

Note: Line 1 is the only setup needed — the browser handles reconnect, Last-Event-ID tracking, and the text/event-stream parsing automatically. Named event types (line 8) map to addEventListener by event name.

---

<!-- ============================================================
  SLIDE 7 — SERVER CODE EXAMPLE
  ============================================================ -->

<!-- .slide: data-background-color="#faf8f5" -->

## Server Code Example

<p style="font-size: 0.75em; color: var(--clr-muted); margin-bottom: 0.4em;">Node.js / Express — a minimal SSE endpoint</p>

```javascript
app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let id = 0;
  const interval = setInterval(() => {
    const payload = JSON.stringify({ time: Date.now() });
    res.write(`id: ${++id}\ndata: ${payload}\n\n`);
  }, 1000);

  req.on('close', () => clearInterval(interval));
});
```
<!-- .element: data-line-numbers="1-4|5|7-11|13" -->

Note: Line 5 — flushHeaders sends the HTTP headers immediately, opening the stream. Without it, Express might buffer. Line 13 is critical: clean up timers/listeners when the client disconnects to prevent memory leaks.

---

<!-- ============================================================
  SLIDE 8 — SSE vs WEBSOCKETS vs POLLING
  ============================================================ -->

<!-- .slide: data-background-color="#faf8f5" -->

## SSE vs WebSockets vs Polling

<div style="overflow-x: auto; margin-top: 0.6em;">

| | HTTP Polling | SSE | WebSockets |
|---|---|---|---|
| **Direction** | client → server → client | server → client only | bidirectional |
| **Connection** | new request each time | single persistent | single persistent |
| **Complexity** | simple | simple | complex |
| **Protocol** | plain HTTP | plain HTTP | WS upgrade |
| **Use when** | rare updates OK | server push, AI streaming | bidirectional (chat, games) |

</div>

<div style="display: flex; justify-content: space-around; margin-top: 1em; font-size: 0.72em;">
  <div class="compare-card card-poll">
    <div style="font-size: 2em;">🔄</div>
    <strong>Polling</strong>
    <div style="color: var(--clr-muted);">Simple, wasteful</div>
  </div>
  <div class="compare-card card-sse">
    <div style="font-size: 2em;">📡</div>
    <strong>SSE</strong>
    <div style="color: var(--clr-accent);">Simple, efficient</div>
  </div>
  <div class="compare-card card-ws">
    <div style="font-size: 2em;">↔️</div>
    <strong>WebSockets</strong>
    <div style="color: var(--clr-muted);">Powerful, complex</div>
  </div>
</div>

Note: The key insight is that SSE and WebSockets share the persistent connection benefit but SSE stays on plain HTTP — works through load balancers, proxies, and firewalls without special configuration.

---

<!-- ============================================================
  SLIDE 9 — MENTAL MODEL
  ============================================================ -->

<!-- .slide: data-background-color="#faf8f5" -->

## Mental Model

<div class="callout-box centered" style="padding: 1.8em 2em; margin: 0.5em 0 1em;">
  <strong>One Sentence</strong>
  <p style="font-size: 1.05em; color: var(--clr-heading); font-weight: 600; margin: 0; line-height: 1.5;">SSE is a one-way radio: you tune in once, the server broadcasts until you close the connection, and the browser reconnects automatically if the signal drops.</p>
</div>

The radio, restated concisely:

- **Tune in** → one GET request opens the persistent channel <!-- .element: class="fragment fade-up" -->
- **Broadcast** → server writes `data: ...\n\n` lines continuously <!-- .element: class="fragment fade-up" -->
- **Auto-reconnect** → browser resumes with `Last-Event-ID` header <!-- .element: class="fragment fade-up" -->
- **Turn off** → client calls `source.close()` or navigates away <!-- .element: class="fragment fade-up" -->

Note: The auto-reconnect is the detail that makes SSE production-ready. The browser handles transient network drops automatically — no application-level retry logic needed.

---

<!-- ============================================================
  SLIDE 10 — WHAT YOU NOW UNDERSTAND
  ============================================================ -->

<!-- .slide: data-background-color="#faf8f5" -->

## What You Now Understand

- **The problem** — HTTP closes; SSE stays open <!-- .element: class="fragment fade-up" -->
- **The protocol** — plain text, double-newline delimited <!-- .element: class="fragment fade-up" -->
- **The client API** — `EventSource`, zero dependencies <!-- .element: class="fragment fade-up" -->
- **The server pattern** — headers, write loop, close handler <!-- .element: class="fragment fade-up" -->
- **The choice** — SSE for push; WebSockets for both directions <!-- .element: class="fragment fade-up" -->

<div style="margin-top: 1.4em; text-align: center;" class="fragment fade-up">
  <span class="tag tag-primary">Streaming</span>
  <span class="tag tag-success">HTTP</span>
  <span class="tag tag-warm">Real-time</span>
</div>

Note: The three tags repeat the title slide — a deliberate callback. The promise made on slide 1 has been kept.

<!-- ============================================================
  CLARITY EDITORIAL THEME
  All CSS goes at the END of the file, after all slides.
  ============================================================ -->

<style>
/* ============================================================
   CLARITY EDITORIAL DESIGN SYSTEM
   Base: theme: white (set in frontmatter)
   Palette:
     --clr-bg:        #faf8f5  (warm paper)
     --clr-heading:   #2c2820  (warm dark ink)
     --clr-body:      #4a3f35  (warm brown body)
     --clr-muted:     #8a7b6e  (warm gray-brown)
     --clr-accent:    #b5651d  (warm amber/brown)
     --clr-accent-lt: #d4845a  (lighter amber)
     --clr-rule:      #d9cfc4  (warm divider)
     --clr-callout:   #f2ede6  (cream for callout bg)
   ============================================================ */

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

:root {
  --clr-bg:        #faf8f5;
  --clr-heading:   #2c2820;
  --clr-body:      #4a3f35;
  --clr-muted:     #8a7b6e;
  --clr-accent:    #b5651d;
  --clr-accent-lt: #d4845a;
  --clr-rule:      #d9cfc4;
  --clr-callout:   #f2ede6;
  --clr-code-bg:   #f0ece5;
  --clr-code-text: #3a2e24;

  /* RevealJS variable overrides */
  --r-background-color:  var(--clr-bg);
  --r-main-color:        var(--clr-body);
  --r-heading-color:     var(--clr-heading);
  --r-main-font:         'Inter', system-ui, -apple-system, sans-serif;
  --r-heading-font:      Georgia, 'Times New Roman', serif;
  --r-code-font:         'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
  --r-link-color:        var(--clr-accent);
  --r-link-color-hover:  var(--clr-accent-lt);
  --r-selection-background: var(--clr-accent);
  --r-selection-color:   #fff;
  --r-main-font-size:    34px;
}

/* ── Base reveal styles ─────────────────────────────────────── */
.reveal {
  font-family: var(--r-main-font);
  font-size: var(--r-main-font-size);
  color: var(--clr-body);
  background: var(--clr-bg);
}

.reveal .slides section {
  text-align: left;
  padding: 0 1.4em;
}

/* ── Headings — serif editorial style ───────────────────────── */
.reveal h1,
.reveal h2,
.reveal h3,
.reveal h4 {
  font-family: var(--r-heading-font);
  color: var(--clr-heading);
  font-weight: 700;
  letter-spacing: -0.01em;
  text-transform: none;
  text-shadow: none;
  margin-bottom: 0.4em;
  line-height: 1.15;
}

.reveal h1 { font-size: 2.3em; }
.reveal h2 { font-size: 1.55em; border-bottom: 2px solid var(--clr-rule); padding-bottom: 0.25em; margin-bottom: 0.55em; }
.reveal h3 { font-size: 1.1em; color: var(--clr-accent); font-family: var(--r-main-font); font-weight: 600; letter-spacing: 0; }

.reveal p {
  color: var(--clr-body);
  line-height: 1.7;
  margin: 0 0 0.7em;
}

/* ── Lists — solid circle bullets in accent color ───────────── */
.reveal ul,
.reveal ol {
  display: block;
  text-align: left;
  color: var(--clr-body);
  line-height: 1.85;
  margin-left: 1em;
  list-style: none;
}

.reveal ul li {
  margin-bottom: 0.25em;
  position: relative;
  padding-left: 1.3em;
}

.reveal ul li::before {
  content: '•';
  position: absolute;
  left: 0;
  color: var(--clr-accent);
  font-size: 1.1em;
  top: -0.05em;
}

.reveal ol {
  list-style: decimal;
  margin-left: 1.8em;
}

.reveal ol li { margin-bottom: 0.25em; }
.reveal li strong { color: var(--clr-heading); }

.reveal a {
  color: var(--clr-accent);
  text-decoration: underline;
}
.reveal a:hover { color: var(--clr-accent-lt); }

/* ── Code — editorial, muted, not neon ─────────────────────── */
.reveal code {
  font-family: var(--r-code-font);
  font-size: 0.85em;
  background: var(--clr-code-bg);
  border: 1px solid var(--clr-rule);
  border-radius: 4px;
  padding: 0.12em 0.4em;
  color: var(--clr-code-text);
}

.reveal pre {
  background: var(--clr-code-bg);
  border: 1px solid var(--clr-rule);
  border-left: 3px solid var(--clr-accent);
  border-radius: 6px;
  padding: 0.9em 1.1em;
  font-size: 0.72em;
  box-shadow: 0 2px 12px rgba(44, 40, 32, 0.08);
  width: 100%;
  margin: 0.5em 0;
}

.reveal pre code {
  background: transparent;
  border: none;
  padding: 0;
  font-size: 1em;
  color: var(--clr-code-text);
}

/* Highlight.js token overrides — muted editorial palette */
.hljs-keyword,
.hljs-built_in       { color: #7c4b2e; }
.hljs-string         { color: #5a7a3a; }
.hljs-comment        { color: #9e8e7e; font-style: italic; }
.hljs-number         { color: #b5651d; }
.hljs-attr,
.hljs-attribute      { color: #4a6a8a; }
.hljs-title,
.hljs-name           { color: #6a4080; }
.hljs-variable,
.hljs-params         { color: var(--clr-code-text); }

/* ── Tables — clean lines, warm palette ────────────────────── */
.reveal table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.68em;
  margin: 0.4em 0;
}

.reveal table th {
  background: var(--clr-callout);
  color: var(--clr-heading);
  font-weight: 700;
  padding: 0.6em 0.85em;
  text-align: left;
  border-bottom: 2px solid var(--clr-accent);
  font-family: var(--r-main-font);
  font-size: 0.9em;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.reveal table td {
  padding: 0.55em 0.85em;
  border-bottom: 1px solid var(--clr-rule);
  color: var(--clr-body);
  vertical-align: middle;
}

.reveal table tr:last-child td { border-bottom: none; }
.reveal table tr:hover td { background: rgba(181, 101, 29, 0.04); }

/* ── Callout box — cream bg, brown left border ──────────────── */
.reveal .callout-box {
  background: var(--clr-callout);
  border: 1px solid var(--clr-rule);
  border-left: 4px solid var(--clr-accent);
  border-radius: 0 6px 6px 0;
  padding: 1em 1.3em;
  margin: 0.6em 0;
  color: var(--clr-body);
  font-size: 0.9em;
  line-height: 1.65;
}

.reveal .callout-box strong {
  color: var(--clr-accent);
  display: block;
  margin-bottom: 0.35em;
  font-size: 0.75em;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  font-family: var(--r-main-font);
}

/* ── Tags / badges ──────────────────────────────────────────── */
.reveal .tag {
  display: inline-block;
  padding: 0.2em 0.75em;
  border-radius: 999px;
  font-size: 0.58em;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  vertical-align: middle;
  margin: 0 0.2em;
  line-height: 1.9;
  font-family: var(--r-main-font);
}

.reveal .tag-primary {
  background: rgba(181, 101, 29, 0.12);
  color: #7c4418;
  border: 1px solid rgba(181, 101, 29, 0.35);
}

.reveal .tag-success {
  background: rgba(74, 105, 50, 0.12);
  color: #3a5a28;
  border: 1px solid rgba(74, 105, 50, 0.35);
}

.reveal .tag-warm {
  background: rgba(140, 80, 40, 0.1);
  color: #6a3a18;
  border: 1px solid rgba(140, 80, 40, 0.3);
}

/* ── Architecture diagram boxes ─────────────────────────────── */
.reveal .arch-box {
  text-align: center;
  padding: 0.7em 1.2em;
  border-radius: 8px;
  font-size: 0.72em;
  font-weight: 600;
  color: var(--clr-heading);
  min-width: 90px;
}

.reveal .arch-client {
  background: rgba(74, 100, 170, 0.1);
  border: 2px solid rgba(74, 100, 170, 0.4);
}

.reveal .arch-server {
  background: rgba(74, 130, 74, 0.1);
  border: 2px solid rgba(74, 130, 74, 0.4);
}

/* ── Event field chips ──────────────────────────────────────── */
.reveal .field-chip {
  display: inline-block;
  padding: 0.3em 0.8em;
  border-radius: 6px;
  font-size: 0.88em;
  border: 1px solid var(--clr-rule);
  background: var(--clr-callout);
  color: var(--clr-body);
  margin: 0.2em 0;
}

.reveal .chip-data   { border-left: 3px solid var(--clr-accent); }
.reveal .chip-id     { border-left: 3px solid #4a64aa; }
.reveal .chip-event  { border-left: 3px solid #4a8244; }
.reveal .chip-retry  { border-left: 3px solid #8a5a8a; }

/* ── Comparison cards ───────────────────────────────────────── */
.reveal .compare-card {
  text-align: center;
  padding: 0.8em 1em;
  border-radius: 8px;
  min-width: 100px;
  background: var(--clr-callout);
  border: 1px solid var(--clr-rule);
}

.reveal .card-sse {
  border: 2px solid var(--clr-accent);
  background: rgba(181, 101, 29, 0.06);
}

/* ── Fragments smooth transitions ───────────────────────────── */
.reveal .fragment { opacity: 0; transition: opacity 0.35s ease, transform 0.35s ease; }
.reveal .fragment.visible { opacity: 1; }
.reveal .fragment.fade-up { transform: translateY(18px); }
.reveal .fragment.fade-up.visible { transform: translateY(0); }

/* ── Progress bar — warm amber ──────────────────────────────── */
.reveal .progress { background: rgba(181, 101, 29, 0.12); }
.reveal .progress span { background: var(--clr-accent); }

/* ── Slide number ───────────────────────────────────────────── */
.reveal .slide-number {
  background: var(--clr-callout);
  color: var(--clr-muted);
  font-size: 0.52em;
  border-radius: 5px;
  padding: 3px 8px;
  border: 1px solid var(--clr-rule);
}

/* ── Utility: centered ───────────────────────────────────────── */
.reveal .centered {
  text-align: center;
  width: 100%;
}

/* ── Utility: slide subtitle ────────────────────────────────── */
.reveal .slide-subtitle {
  font-size: 0.7em;
  color: var(--clr-muted);
  font-weight: 400;
  margin-top: -0.2em;
  margin-bottom: 1em;
  line-height: 1.5;
  font-family: var(--r-main-font);
}

/* ── HR divider ─────────────────────────────────────────────── */
.reveal hr {
  border: none;
  border-top: 1px solid var(--clr-rule);
  margin: 0.8em 0;
}

/* ── Blockquote ─────────────────────────────────────────────── */
.reveal blockquote {
  background: var(--clr-callout);
  border-left: 4px solid var(--clr-accent);
  border-radius: 0 6px 6px 0;
  padding: 0.7em 1.1em;
  margin: 0.5em 0;
  font-style: italic;
  color: var(--clr-body);
  font-size: 0.9em;
}
</style>
