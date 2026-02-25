---
title: "Build a Safe Rate Limiter in Node.js"
theme: black
transition: slide
controls: true
progress: true
slideNumber: "c/t"
---

<!-- .slide: data-background-color="#0d0f0d" -->

# Build a Safe Rate Limiter in Node.js

<div class="term-rule"></div>

<p style="font-size: 0.85em; color: #4a7a4a; max-width: 720px; font-family: 'JetBrains Mono', monospace;">After this: you'll have a production-ready rate limiter using the token bucket and sliding window algorithms — with Redis persistence and Express middleware.</p>

<div style="margin-top: 1.5em;">
  <span class="tag tag-node">Node.js</span>
  <span class="tag tag-security">Security</span>
  <span class="tag tag-rate">Rate Limiting</span>
</div>

Note:
Welcome. Rate limiting is one of those security primitives that most tutorials get wrong — they show you a simple in-memory counter but skip Redis persistence, algorithm tradeoffs, and what happens under burst traffic. We'll cover all three: token bucket for smooth throughput, sliding window for fairness, and a full Express middleware that works in production. ~10–15 minutes.

---

<!-- .slide: data-background-color="#0d0f0d" -->

## What We're Building

<p class="term-label">// the finished API — clean middleware at the call-site</p>

<pre data-id="main-code"><code data-trim data-line-numbers="[1-5|7-11]" class="language-javascript">
// Attach rate limiter to any Express route
app.post('/api/chat',
  rateLimit({ windowMs: 60_000, max: 20 }),
  chatHandler
)

// Or globally for all routes
app.use(rateLimit({
  windowMs: 60_000,  // 1 minute window
  max: 100,          // 100 requests per window per IP
  keyGenerator: req => req.user?.id ?? req.ip,
}))
</code></pre>

<div class="term-callout">
  <span class="term-prompt">$</span> <strong>What it does</strong> — limits requests per key (IP or user ID) using a sliding window counter backed by Redis. Returns <code>429 Too Many Requests</code> with a <code>Retry-After</code> header when the limit is exceeded.
</div>

Note:
This is the destination. Notice the middleware is three lines — max and windowMs. The complexity lives inside the rate limiter itself. We'll build toward this API through five steps, starting with the algorithm before touching Express or Redis.

---

<!-- .slide: data-background-color="#0d0f0d" -->

## Prerequisites

<p class="term-label">// what to know before we start</p>

- **Node.js 18+** with `async/await` and `fetch` support <!-- .element: class="fragment fade-up" -->
- **Express 4+** — we'll write a standard middleware function <!-- .element: class="fragment fade-up" -->
- **Basic Redis familiarity** — `SET`, `INCR`, `EXPIRE` commands <!-- .element: class="fragment fade-up" -->
- **`ioredis` package** — `npm install ioredis` <!-- .element: class="fragment fade-up" -->

**Files we'll create:** <!-- .element: class="fragment fade-up" -->

- `lib/rateLimiter.js` — core algorithm + Redis adapter <!-- .element: class="fragment fade-up" -->
- `middleware/rateLimit.js` — Express middleware wrapper <!-- .element: class="fragment fade-up" -->
- `test/rateLimiter.test.js` — load test with assertions <!-- .element: class="fragment fade-up" -->

Note:
Quick check — has anyone used Redis in Node before? If not, that's fine — I'll call out every Redis command as we use it. The key mental model is: Redis is our distributed counter. It replaces the in-memory Map you'd use in a single-server setup.

---

<!-- .slide: data-background-color="#0d0f0d" -->

<!-- .slide: data-auto-animate -->

## Step 1 — Token Bucket Algorithm

<p class="term-label">// smooth throughput — refill tokens over time, consume on request</p>

<pre data-id="main-code"><code data-trim data-line-numbers="[1-8|10-22|24-32]" class="language-javascript">
// lib/rateLimiter.js — Token Bucket implementation

class TokenBucket {
  constructor({ capacity, refillRate }) {
    this.capacity  = capacity    // max tokens
    this.refillRate = refillRate // tokens added per second
    this.buckets = new Map()     // key → { tokens, lastRefill }
  }

  _refill(bucket) {
    const now     = Date.now()
    const elapsed = (now - bucket.lastRefill) / 1000  // seconds
    const added   = elapsed * this.refillRate

    bucket.tokens    = Math.min(this.capacity, bucket.tokens + added)
    bucket.lastRefill = now
  }

  consume(key) {
    if (!this.buckets.has(key)) {
      this.buckets.set(key, { tokens: this.capacity, lastRefill: Date.now() })
    }
    const bucket = this.buckets.get(key)
    this._refill(bucket)

    if (bucket.tokens < 1) {
      const retryAfterMs = Math.ceil((1 - bucket.tokens) / this.refillRate * 1000)
      return { allowed: false, retryAfterMs }
    }

    bucket.tokens -= 1
    return { allowed: true, remaining: Math.floor(bucket.tokens) }
  }
}
</code></pre>

Note:
Lines 1–8: the bucket holds tokens. Capacity is the burst limit; refillRate is the steady-state throughput. Lines 10–22: _refill calculates tokens earned since last request — proportional to elapsed time. This is what makes token bucket smooth: a user who was idle gets tokens back. Lines 24–32: consume checks and atomically decrements. If tokens < 1, we return retryAfterMs so the client knows exactly when to retry.

---

<!-- .slide: data-background-color="#0d0f0d" -->

<!-- .slide: data-auto-animate -->

## Step 2 — Sliding Window Counter

<p class="term-label">// fairness — no burst at window boundary, count requests in rolling window</p>

<pre data-id="main-code"><code data-trim data-line-numbers="[1-10|12-28]" class="language-javascript">
// lib/rateLimiter.js — Sliding Window (replaces TokenBucket for fairness)

class SlidingWindowCounter {
  constructor({ windowMs, max }) {
    this.windowMs = windowMs  // e.g. 60_000 for 1 minute
    this.max      = max       // max requests per window
    this.windows  = new Map() // key → [{ timestamp, count }]
  }

  // Returns { allowed, remaining, retryAfterMs }
  consume(key) {
    const now    = Date.now()
    const cutoff = now - this.windowMs

    // Get or init the request log for this key
    let log = this.windows.get(key) ?? []

    // Prune timestamps outside the current window
    log = log.filter(ts => ts > cutoff)

    const count = log.length

    if (count >= this.max) {
      // Oldest timestamp tells us when the window will slide enough to allow another
      const oldestTs    = log[0]
      const retryAfterMs = oldestTs + this.windowMs - now
      return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, retryAfterMs) }
    }

    log.push(now)
    this.windows.set(key, log)
    return { allowed: true, remaining: this.max - log.length }
  }
}
</code></pre>

Note:
Lines 1–10: sliding window keeps a log of request timestamps per key. No tokens, no refill rates. Lines 12–28: on each request, prune timestamps older than windowMs, then count what's left. If count >= max, reject and compute retryAfterMs from the oldest timestamp. This prevents the fixed-window boundary burst problem — a user can't fire 100 requests at 11:59 and another 100 at 12:00.

---

<!-- .slide: data-background-color="#0d0f0d" -->

<!-- .slide: data-auto-animate -->

## Step 3 — Adding Redis Persistence

<p class="term-label">// distributed — works across multiple Node processes and servers</p>

<pre data-id="main-code"><code data-trim data-line-numbers="[1-9|11-30|32-38]" class="language-javascript">
// lib/rateLimiter.js — Redis-backed sliding window
const Redis = require('ioredis')

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')

// Lua script: atomic INCR + EXPIRE in a single round-trip
const INCR_SCRIPT = `
  local current = redis.call('INCR', KEYS[1])
  if current == 1 then
    redis.call('PEXPIRE', KEYS[1], ARGV[1])
  end
  return current
`

async function slidingWindowRedis({ key, windowMs, max }) {
  const redisKey = `rl:${key}:${Math.floor(Date.now() / windowMs)}`

  // evalsha / eval: run Lua atomically — no race between INCR and EXPIRE
  const count = await redis.eval(
    INCR_SCRIPT,
    1,          // number of KEYS
    redisKey,   // KEYS[1]
    windowMs    // ARGV[1] — TTL in milliseconds
  )

  if (count > max) {
    const windowStart    = Math.floor(Date.now() / windowMs) * windowMs
    const retryAfterMs   = windowStart + windowMs - Date.now()
    return { allowed: false, remaining: 0, retryAfterMs }
  }

  return { allowed: true, remaining: max - count }
}

module.exports = { slidingWindowRedis }
</code></pre>

Note:
Lines 1–9: the Lua script is the key insight. INCR and PEXPIRE must be atomic — if you do them separately, a crashed process after INCR but before PEXPIRE leaves a key that never expires, and that IP is rate-limited forever. Lua eval runs as a single Redis transaction. Lines 11–30: we key on the current window slot (floor division by windowMs) so the key naturally expires with the window. Lines 32–38: export a clean function interface.

---

<!-- .slide: data-background-color="#0d0f0d" -->

<!-- .slide: data-auto-animate -->

## Step 4 — Express Middleware

<p class="term-label">// integration — wrap the rate limiter as a reusable middleware factory</p>

<pre data-id="main-code"><code data-trim data-line-numbers="[1-12|14-30|32-38]" class="language-javascript">
// middleware/rateLimit.js
const { slidingWindowRedis } = require('../lib/rateLimiter')

/**
 * @param {{ windowMs: number, max: number, keyGenerator?: Function }} options
 * @returns Express middleware
 */
function rateLimit({ windowMs, max, keyGenerator } = {}) {
  const genKey = keyGenerator ?? (req => req.ip)

  return async function rateLimitMiddleware(req, res, next) {
    const key = genKey(req)

    let result
    try {
      result = await slidingWindowRedis({ key, windowMs, max })
    } catch (err) {
      // Redis failure → fail open: don't block the request
      console.error('[rateLimit] Redis error, failing open:', err.message)
      return next()
    }

    // Set standard rate limit headers (RFC 6585 + draft-ietf-httpapi-ratelimit-headers)
    res.set('X-RateLimit-Limit',     String(max))
    res.set('X-RateLimit-Remaining', String(result.remaining))
    res.set('X-RateLimit-Reset',     String(Math.ceil((Date.now() + (result.retryAfterMs ?? windowMs)) / 1000)))

    if (!result.allowed) {
      res.set('Retry-After', String(Math.ceil(result.retryAfterMs / 1000)))
      return res.status(429).json({
        error:   'Too Many Requests',
        message: `Rate limit exceeded. Retry in ${Math.ceil(result.retryAfterMs / 1000)}s.`,
      })
    }

    next()
  }
}

module.exports = { rateLimit }
</code></pre>

Note:
Lines 1–12: the factory pattern — rateLimit() returns a middleware closure. keyGenerator defaults to req.ip but callers can pass req.user.id for per-user limits. Lines 14–30: fail open on Redis errors. In production, a Redis outage should not take down your API. Log the error and let the request through. Lines 32–38: standard headers. X-RateLimit-* lets clients display "you have N requests remaining" in their UI. Retry-After is required by RFC 6585 when returning 429.

---

<!-- .slide: data-background-color="#0d0f0d" -->

## Step 5 — Testing Under Load

<p class="term-label">// verify correctness under burst — fire 25 concurrent requests, expect 20 allowed</p>

```javascript
// test/rateLimiter.test.js
const assert  = require('assert')
const { slidingWindowRedis } = require('../lib/rateLimiter')

async function testBurstLimit() {
  const KEY       = `test:burst:${Date.now()}`
  const WINDOW_MS = 10_000  // 10 second test window
  const MAX       = 20

  // Fire 25 concurrent requests — should allow 20, reject 5
  const results = await Promise.all(
    Array.from({ length: 25 }, () =>
      slidingWindowRedis({ key: KEY, windowMs: WINDOW_MS, max: MAX })
    )
  )

  const allowed  = results.filter(r => r.allowed).length
  const rejected = results.filter(r => !r.allowed).length

  assert.strictEqual(allowed,  20, `Expected 20 allowed, got ${allowed}`)
  assert.strictEqual(rejected,  5, `Expected 5 rejected, got ${rejected}`)

  console.log(`✓ Burst test passed: ${allowed} allowed, ${rejected} rejected`)

  // Verify retryAfterMs is set on rejected responses
  const rejectedResults = results.filter(r => !r.allowed)
  rejectedResults.forEach(r => {
    assert.ok(r.retryAfterMs > 0, 'retryAfterMs must be positive on rejection')
  })
  console.log('✓ Retry-After values are valid')
}

testBurstLimit().catch(err => { console.error('Test failed:', err); process.exit(1) })
```

Note:
The key test pattern: fire Promise.all with 25 concurrent requests. Redis's Lua script handles the race condition — exactly 20 will increment below the threshold, 5 will find count > max. If your Redis INCR/EXPIRE were separate calls, this test would be flaky because concurrent requests could both read count=19 before either writes 20. The Lua script makes it deterministic.

---

<!-- .slide: data-background-color="#0d0f0d" -->

## Pitfalls to Avoid

<p class="term-label">// what goes wrong in production — and the one-line fix</p>

- **Non-atomic INCR + EXPIRE** — two separate Redis calls create a race: a process crash between them leaves a key that never expires. Fix: use a Lua script (as in Step 3). <!-- .element: class="fragment fade-up" -->

- **Failing closed on Redis errors** — if Redis is down and you return 503, your Redis outage takes down your entire API. Fix: fail open with `console.error` + `next()`. <!-- .element: class="fragment fade-up" -->

- **Fixed-window boundary burst** — users fire 100 requests at 11:59:59 and another 100 at 12:00:00. Fix: sliding window (timestamp log or floor-division key as in Step 3). <!-- .element: class="fragment fade-up" -->

- **Missing `Retry-After` header** — clients have no idea when to retry and will spam your endpoint. Fix: always set `Retry-After` on 429 responses (RFC 6585 requires it). <!-- .element: class="fragment fade-up" -->

- **Single key for all users** — using a static key means all users share one counter. Fix: `keyGenerator: req => req.user?.id ?? req.ip` to isolate per identity. <!-- .element: class="fragment fade-up" -->

Note:
The non-atomic pitfall is the most dangerous — it's a subtle bug that only surfaces under load or during a partial Redis failure. Show the Lua script from Step 3 if anyone is sceptical. The fail-open pattern is a deliberate choice: availability over strict enforcement during infrastructure incidents.

---

<!-- .slide: data-background-color="#0d0f0d" -->

## What You Built

<div class="term-rule"></div>

- **Token Bucket** — smooth per-second throughput with burst headroom <!-- .element: class="fragment fade-up" -->
- **Sliding Window** — fair, boundary-burst-proof counting in a rolling interval <!-- .element: class="fragment fade-up" -->
- **Redis-backed atomicity** — Lua script eliminates INCR/EXPIRE race conditions <!-- .element: class="fragment fade-up" -->
- **Express middleware** — factory pattern, fail-open on Redis errors, RFC-compliant headers <!-- .element: class="fragment fade-up" -->
- **Burst load test** — 25 concurrent requests, exactly 20 allowed, retryAfterMs verified <!-- .element: class="fragment fade-up" -->

<div style="margin-top: 1.8em;">
  <span class="tag tag-node">Node.js</span>
  <span class="tag tag-security">Security</span>
  <span class="tag tag-rate">Rate Limiting</span>
</div>

Note:
That's it — five steps, one Lua script, one middleware factory. The patterns here (atomic Redis operations, fail-open design, sliding windows) apply to throttling, quota enforcement, and abuse prevention throughout your stack. Questions?

<!-- ══════════════════════════════════════════════════════════════
     TERMINAL GREEN THEME — CSS
     IMPORTANT: This block MUST remain at the END of the file.
     Placing <style> before the first slide separator creates an
     empty first slide and breaks the presentation structure.
     ══════════════════════════════════════════════════════════════ -->
<style>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');

/* ── Color Tokens ───────────────────────────────────────────── */
:root {
  --term-bg:       #0d0f0d;
  --term-surface:  #141814;
  --term-border:   #1b5e20;
  --term-accent:   #00c853;
  --term-bright:   #69f0ae;
  --term-dim:      #1b5e20;
  --term-text:     #d4e6d4;
  --term-muted:    #4a7a4a;
  --term-cursor:   #00e676;
  --term-yellow:   #ffcc80;
  --term-red:      #ef5350;
  --term-font:     'JetBrains Mono', 'Fira Code', 'Source Code Pro', monospace;
  --term-font-body: 'Inter', system-ui, sans-serif;

  /* RevealJS overrides */
  --r-background-color: var(--term-bg);
  --r-main-color:       var(--term-text);
  --r-heading-color:    var(--term-accent);
  --r-main-font:        var(--term-font);
  --r-heading-font:     var(--term-font);
  --r-code-font:        var(--term-font);
  --r-main-font-size:   28px;
}

/* ── Base ────────────────────────────────────────────────────── */
.reveal {
  font-family: var(--term-font);
  font-size: 28px;
  color: var(--term-text);
  background: var(--term-bg);
}

.reveal::after {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  background: repeating-linear-gradient(
    to bottom,
    transparent 0px,
    transparent 3px,
    rgba(0, 0, 0, 0.06) 3px,
    rgba(0, 0, 0, 0.06) 4px
  );
}

.reveal .slides {
  text-align: left;
}

.reveal .slides section {
  padding: 40px 64px;
}

/* ── Progress Bar ─────────────────────────────────────────────── */
.reveal .progress {
  color: var(--term-accent);
}

/* ── Slide Number ─────────────────────────────────────────────── */
.reveal .slide-number {
  background: var(--term-surface);
  color: var(--term-muted);
  font-family: var(--term-font);
  font-size: 11px;
  padding: 4px 12px;
  border-radius: 3px 0 0 0;
  border-top: 1px solid var(--term-dim);
  border-left: 1px solid var(--term-dim);
}

/* ── Headings ─────────────────────────────────────────────────── */
.reveal h1,
.reveal h2,
.reveal h3,
.reveal h4 {
  text-transform: none;
  letter-spacing: -0.01em;
  line-height: 1.1;
}

.reveal h1 {
  font-family: var(--term-font);
  font-size: 3.0em;
  font-weight: 700;
  color: var(--term-accent);
  margin-bottom: 0.2em;
  text-shadow: 0 0 30px rgba(0, 200, 83, 0.2);
}

.reveal h2 {
  font-family: var(--term-font);
  font-size: 2.0em;
  font-weight: 600;
  color: var(--term-accent);
  margin-bottom: 0.35em;
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--term-dim);
}

.reveal h3 {
  font-family: var(--term-font);
  font-size: 1.3em;
  font-weight: 500;
  color: var(--term-bright);
  margin-bottom: 0.4em;
}

.reveal h4 {
  font-family: var(--term-font);
  font-size: 0.78em;
  font-weight: 400;
  color: var(--term-muted);
  letter-spacing: 0.06em;
  margin-bottom: 1em;
}

/* ── Body Text ────────────────────────────────────────────────── */
.reveal p {
  font-family: var(--term-font);
  font-size: 1em;
  line-height: 1.7;
  color: var(--term-text);
  margin-bottom: 0.8em;
}

/* ── Inline Code ──────────────────────────────────────────────── */
.reveal code {
  font-family: var(--term-font);
  font-size: 0.85em;
  background: rgba(27, 94, 32, 0.25);
  padding: 0.12em 0.45em;
  border-radius: 2px;
  color: var(--term-bright);
  border: 1px solid rgba(105, 240, 174, 0.2);
}

/* ── Code Blocks ──────────────────────────────────────────────── */
.reveal pre {
  background: rgba(13, 15, 13, 0.97);
  border: 1px solid var(--term-dim);
  border-radius: 3px;
  padding: 0;
  margin: 0.8em 0;
  font-size: 0.68em;
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(0, 200, 83, 0.05);
  width: 100%;
}

.reveal pre code {
  background: none;
  border: none;
  padding: 1em 1.2em;
  font-size: 1em;
  color: var(--term-text);
  line-height: 1.6;
}

/* Syntax tokens */
.reveal .token.keyword  { color: #80cbc4; }
.reveal .token.type     { color: var(--term-bright); }
.reveal .token.string   { color: var(--term-accent); }
.reveal .token.number   { color: var(--term-yellow); }
.reveal .token.function { color: var(--term-bright); }
.reveal .token.comment  { color: var(--term-muted); font-style: italic; }
.reveal .token.operator { color: #b2dfdb; }
.reveal .token.property { color: var(--term-accent); }

/* ── Lists — Terminal Prompt Style ───────────────────────────── */
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
  padding-left: 2.2em;
  margin-bottom: 0.55em;
  color: var(--term-text);
  font-family: var(--term-font);
}

.reveal ul li::before {
  content: '$';
  position: absolute;
  left: 0;
  color: var(--term-accent);
  font-family: var(--term-font);
  font-size: 0.85em;
  font-weight: 700;
  top: 0.12em;
}

.reveal ol {
  counter-reset: term-counter;
}

.reveal ol li {
  counter-increment: term-counter;
}

.reveal ol li::before {
  content: counter(term-counter, decimal-leading-zero) '>';
  position: absolute;
  left: 0;
  font-family: var(--term-font);
  font-size: 0.72em;
  font-weight: 600;
  color: var(--term-accent);
  top: 0.22em;
  letter-spacing: 0;
}

/* ── Blockquote ───────────────────────────────────────────────── */
.reveal blockquote {
  margin: 1.2em 0;
  padding: 1em 1.5em;
  background: rgba(20, 24, 20, 0.8);
  border-left: 3px solid var(--term-accent);
  border-radius: 0 3px 3px 0;
  font-style: normal;
  color: var(--term-muted);
  font-family: var(--term-font);
}

.reveal blockquote p {
  margin: 0;
  font-size: 1em;
  line-height: 1.6;
  color: var(--term-text);
}

/* ── Emphasis ─────────────────────────────────────────────────── */
.reveal strong {
  font-weight: 700;
  color: var(--term-bright);
}

.reveal em {
  font-style: italic;
  color: var(--term-accent);
}

/* ── Tags ─────────────────────────────────────────────────────── */
.tag {
  display: inline-block;
  font-family: var(--term-font);
  font-size: 0.52em;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 0.25em 0.8em;
  border-radius: 3px;
  margin: 0 0.3em 0.4em 0;
  vertical-align: middle;
  border: 1px solid transparent;
  line-height: 1.6;
}

.tag-node {
  background: rgba(0, 200, 83, 0.12);
  color: var(--term-accent);
  border-color: rgba(0, 200, 83, 0.35);
}

.tag-security {
  background: rgba(105, 240, 174, 0.1);
  color: var(--term-bright);
  border-color: rgba(105, 240, 174, 0.3);
}

.tag-rate {
  background: rgba(255, 204, 128, 0.1);
  color: var(--term-yellow);
  border-color: rgba(255, 204, 128, 0.3);
}

/* ── Terminal Rule Divider ────────────────────────────────────── */
.term-rule {
  height: 1px;
  background: linear-gradient(90deg, var(--term-accent) 0%, transparent 75%);
  margin: 0.5em 0 1em;
  opacity: 0.5;
}

/* ── Terminal Label ───────────────────────────────────────────── */
.term-label {
  font-family: var(--term-font);
  font-size: 0.72em;
  color: var(--term-muted);
  letter-spacing: 0.06em;
  margin-bottom: 0.8em;
  display: block;
}

/* ── Terminal Callout ─────────────────────────────────────────── */
.term-callout {
  border: 1px solid var(--term-dim);
  border-left: 3px solid var(--term-accent);
  border-radius: 0 3px 3px 0;
  padding: 0.9em 1.3em;
  background: rgba(20, 24, 20, 0.7);
  font-size: 0.82em;
  line-height: 1.65;
  color: var(--term-text);
  margin: 0.8em 0;
  font-family: var(--term-font);
}

.term-prompt {
  color: var(--term-accent);
  font-weight: 700;
  margin-right: 0.5em;
}

/* ── Blinking Cursor ──────────────────────────────────────────── */
@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}

.cursor {
  color: var(--term-cursor);
  animation: blink 1s step-end infinite;
  font-family: var(--term-font);
}

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
</style>
