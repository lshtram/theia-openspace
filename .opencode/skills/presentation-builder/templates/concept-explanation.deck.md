---
title: "How JWT Authentication Works"
author: Your Name
theme: openspace-modern
transition: slide
transitionSpeed: default
backgroundTransition: fade
controls: true
progress: true
slideNumber: "c/t"
---

<!--
  TEMPLATE: concept-explanation.deck.md
  ======================================
  Use this template when explaining a technical concept from first principles
  to developers who need to understand it, not just use it.
  Working example: How JWT Authentication Works.

  HOW TO ADAPT THIS TEMPLATE:
  1. Update frontmatter: change `title` to your concept
  2. Replace "JWT" / "authentication" with your concept throughout
  3. Swap the wristband analogy (slide 3) for one relevant to your concept
  4. Update the structure slides (4–6) with your concept's internal mechanics
  5. Replace the code example (slide 7) with real code for your concept
  6. Update pitfalls (slide 8) with the gotchas specific to your concept
  7. Restate the mental model (slide 9) in one sentence

  SLIDE COUNT: 10 slides (numbered in comments below)
  ESTIMATED DURATION: 10–15 minutes at 1–1.5 min/slide
-->

<style>
/* ============================================================
   MODERN DESIGN SYSTEM
   Base: openspace-modern theme (indigo tones for concept explanations)
   Color palette:
     --os-primary:       #6366f1  (indigo)
     --os-primary-light: #818cf8  (light indigo)
     --os-primary-dark:  #4f46e5  (dark indigo)
     --os-accent:        #e94560  (rose-red)
     --os-accent-light:  #ff6b6b  (light rose)
   ============================================================ */

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

  /* RevealJS overrides */
  --r-main-font:        'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --r-heading-font:     'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --r-code-font:        'JetBrains Mono', 'Fira Code', monospace;
  --r-background-color: var(--os-bg-primary);
  --r-main-color:       var(--os-text-primary);
  --r-heading-color:    var(--os-text-primary);
  --r-link-color:       var(--os-primary-light);
  --r-link-color-hover: var(--os-primary);
  --r-selection-background: var(--os-primary);
  --r-selection-color:  var(--os-text-primary);
  --r-main-font-size:   36px;
  --r-heading-font-size: 2.2em;
}

/* ── Base reveal styles ─────────────────────────────────────── */
.reveal {
  font-family: var(--r-main-font);
  font-size: var(--r-main-font-size);
  color: var(--r-main-color);
}

.reveal .slides section {
  text-align: left;
  padding: 0 1.5em;
}

.reveal h1, .reveal h2, .reveal h3, .reveal h4 {
  font-family: var(--r-heading-font);
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--r-heading-color);
  margin-bottom: 0.5em;
  line-height: 1.15;
  text-transform: none;
  text-shadow: none;
}

.reveal h1 {
  font-size: 2.4em;
  font-weight: 800;
  background: linear-gradient(135deg, var(--os-text-primary) 0%, var(--os-primary-light) 60%, var(--os-accent-light) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.reveal h2 { font-size: 1.6em; }
.reveal h3 { font-size: 1.2em; color: var(--os-text-secondary); }

.reveal p {
  color: var(--os-text-secondary);
  line-height: 1.7;
  margin: 0 0 0.8em;
}

/* ── Lists with ▸ bullets ────────────────────────────────────── */
.reveal ul, .reveal ol {
  display: block;
  text-align: left;
  color: var(--os-text-secondary);
  line-height: 1.8;
  margin-left: 1.2em;
  list-style: none;
}

.reveal ul li {
  margin-bottom: 0.3em;
  position: relative;
  padding-left: 1.2em;
}

.reveal ul li::before {
  content: '▸';
  position: absolute;
  left: 0;
  color: var(--os-primary-light);
  font-size: 0.85em;
  top: 0.1em;
}

.reveal ol {
  list-style: decimal;
  margin-left: 1.8em;
}

.reveal ol li { margin-bottom: 0.3em; }
.reveal li strong { color: var(--os-text-primary); }

.reveal a {
  color: var(--r-link-color);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s;
}
.reveal a:hover {
  color: var(--r-link-color-hover);
  border-bottom-color: var(--r-link-color-hover);
}

/* ── Code blocks ────────────────────────────────────────────── */
.reveal code {
  font-family: var(--r-code-font);
  font-size: 0.88em;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 5px;
  padding: 0.15em 0.45em;
  color: var(--os-accent-light);
}

.reveal pre {
  background: var(--os-bg-secondary);
  border: 1px solid rgba(99, 102, 241, 0.25);
  border-radius: 10px;
  padding: 1em 1.2em;
  font-size: 0.78em;
  box-shadow: 0 4px 24px rgba(0,0,0,0.35);
  width: 100%;
  margin: 0.5em 0;
}

.reveal pre code {
  background: transparent;
  border: none;
  padding: 0;
  font-size: 1em;
  color: var(--os-text-primary);
}

/* ── Tables ─────────────────────────────────────────────────── */
.reveal table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.72em;
  margin: 0.5em 0;
}

.reveal table th {
  background: rgba(99, 102, 241, 0.2);
  color: var(--os-primary-light);
  font-weight: 600;
  padding: 0.65em 0.9em;
  text-align: left;
  border-bottom: 2px solid rgba(99, 102, 241, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 0.85em;
}

.reveal table td {
  padding: 0.6em 0.9em;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  color: var(--os-text-secondary);
  vertical-align: middle;
}

.reveal table tr:last-child td { border-bottom: none; }
.reveal table tr:hover td { background: rgba(99, 102, 241, 0.05); }

/* ── Blockquote ─────────────────────────────────────────────── */
.reveal blockquote {
  background: rgba(99, 102, 241, 0.08);
  border-left: 4px solid var(--os-primary);
  border-radius: 0 8px 8px 0;
  padding: 0.8em 1.2em;
  margin: 0.6em 0;
  font-style: italic;
  color: var(--os-text-secondary);
}

/* ── Highlight box ──────────────────────────────────────────── */
/*
  Usage: wrap content in a <div class="highlight-box"> block.
  Use for key analogies, important callouts, mental models, and warnings.
  Example:
    <div class="highlight-box">
      <strong>The Analogy:</strong>
      A JWT is like a concert wristband...
    </div>
*/
.reveal .highlight-box {
  background: linear-gradient(135deg,
    rgba(99, 102, 241, 0.12) 0%,
    rgba(233, 69, 96, 0.08) 100%);
  border: 1px solid rgba(99, 102, 241, 0.35);
  border-left: 4px solid var(--os-primary);
  border-radius: 10px;
  padding: 1.2em 1.5em;
  margin: 0.8em 0;
  color: var(--os-text-primary);
  font-size: 0.95em;
  line-height: 1.6;
}

.reveal .highlight-box strong {
  color: var(--os-primary-light);
  display: block;
  margin-bottom: 0.4em;
  font-size: 0.8em;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ── Metric display ─────────────────────────────────────────── */
/*
  Usage: .metric as a container, .metric-value for the big number/word,
         .metric-label for the descriptor below it.
  Example:
    <div class="metric">
      <div class="metric-value">Stateless</div>
      <div class="metric-label">Key Property of JWT</div>
    </div>
*/
.reveal .metric {
  text-align: center;
  padding: 0.8em 1.2em;
}

.reveal .metric-value {
  font-size: 2.8em;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.03em;
  background: linear-gradient(135deg, var(--os-primary-light), var(--os-accent-light));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.reveal .metric-label {
  font-size: 0.65em;
  color: var(--os-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin-top: 0.3em;
  font-weight: 500;
}

/* ── Tags / badges ──────────────────────────────────────────── */
/*
  Usage: inline <span class="tag tag-primary">Label</span>
  Variants: tag-primary (indigo), tag-success (green), tag-warning (amber)
  Example:
    <span class="tag tag-success">✓ Verified</span>
    <span class="tag tag-warning">⚠ Risk</span>
*/
.reveal .tag {
  display: inline-block;
  padding: 0.2em 0.7em;
  border-radius: 999px;
  font-size: 0.6em;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  vertical-align: middle;
  margin: 0 0.2em;
  line-height: 1.8;
}

.reveal .tag-primary {
  background: rgba(99, 102, 241, 0.18);
  color: var(--os-primary-light);
  border: 1px solid rgba(99, 102, 241, 0.4);
}

.reveal .tag-success {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.35);
}

.reveal .tag-warning {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.35);
}

/* ── Two-column layout ──────────────────────────────────────── */
/*
  Usage: wrap two divs in .two-column for a 50/50 flex split.
  Each child div gets .column class.
  Example:
    <div class="two-column">
      <div class="column"><!-- left content --></div>
      <div class="column"><!-- right content --></div>
    </div>
*/
.reveal .two-column {
  display: flex;
  gap: 2.5em;
  align-items: flex-start;
  text-align: left;
  width: 100%;
}

.reveal .two-column .column {
  flex: 1;
  min-width: 0;
}

.reveal .two-column .column h3 {
  font-size: 1em;
  font-weight: 700;
  margin-bottom: 0.6em;
  padding-bottom: 0.4em;
  border-bottom: 2px solid rgba(99, 102, 241, 0.3);
  color: var(--os-primary-light);
}

.reveal .two-column .column ul {
  font-size: 0.82em;
  margin-left: 0;
  line-height: 1.7;
}

/* ── Gradient text ──────────────────────────────────────────── */
/*
  Usage: <span class="gradient-text">Key Phrase</span>
  Renders text with an indigo→rose gradient fill.
*/
.reveal .gradient-text {
  background: linear-gradient(135deg, var(--os-primary-light), var(--os-accent-light));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* ── Fragments smooth transitions ───────────────────────────── */
.reveal .fragment { opacity: 0; transition: opacity 0.4s ease, transform 0.4s ease; }
.reveal .fragment.visible { opacity: 1; }
.reveal .fragment.fade-up { transform: translateY(20px); }
.reveal .fragment.fade-up.visible { transform: translateY(0); }

/* ── Progress bar ───────────────────────────────────────────── */
.reveal .progress { background: rgba(255,255,255,0.08); }
.reveal .progress span { background: var(--os-primary); }

/* ── Slide number ───────────────────────────────────────────── */
.reveal .slide-number {
  background: rgba(99, 102, 241, 0.15);
  color: var(--os-text-muted);
  font-size: 0.55em;
  border-radius: 6px;
  padding: 3px 8px;
}

/* ── Utility: centered content ──────────────────────────────── */
.reveal .centered {
  text-align: center;
  width: 100%;
}

/* ── Utility: subtitle under big heading ────────────────────── */
.reveal .slide-subtitle {
  font-size: 0.7em;
  color: var(--os-text-muted);
  font-weight: 400;
  margin-top: -0.3em;
  margin-bottom: 1em;
  letter-spacing: 0.01em;
}

/* ── Utility: divider line ──────────────────────────────────── */
.reveal hr {
  border: none;
  border-top: 1px solid rgba(99, 102, 241, 0.2);
  margin: 0.8em 0;
}

/* ── JWT part labels (header / payload / signature) ─────────── */
.reveal .jwt-header    { display: inline-block; padding: 0.15em 0.6em; border-radius: 6px; font-family: var(--r-code-font); font-size: 0.9em; font-weight: 600; background: rgba(99, 102, 241, 0.25); color: #a5b4fc; border: 1px solid rgba(99, 102, 241, 0.5); }
.reveal .jwt-payload   { display: inline-block; padding: 0.15em 0.6em; border-radius: 6px; font-family: var(--r-code-font); font-size: 0.9em; font-weight: 600; background: rgba(16, 185, 129, 0.2);  color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.45); }
.reveal .jwt-signature { display: inline-block; padding: 0.15em 0.6em; border-radius: 6px; font-family: var(--r-code-font); font-size: 0.9em; font-weight: 600; background: rgba(233, 69, 96, 0.2);   color: #fca5a5; border: 1px solid rgba(233, 69, 96, 0.45); }
</style>

---

<!-- ============================================================
  SLIDE 1 — TITLE SLIDE
  ============================================================
  Purpose: Frame the session. Give the audience a precise promise
  of what they'll be able to do or explain after watching.

  HOW TO ADAPT:
  - Replace the h1 with your concept name
  - Rewrite the slide-subtitle as a 3-part "after this you'll understand..."
    sentence specific to your concept
  - Swap the three tags for the key dimensions of your concept
    (e.g., "Stateless", "Security", "HTTP" for JWT)

  GRADIENT OPTIONS:
  - Deep ocean:   linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)
  - Deep indigo:  linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)
  - Midnight:     linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)
  ============================================================ -->

<!-- .slide: data-background-gradient="linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)" -->

<div class="centered" style="padding-top: 0.5em;">

# How JWT Authentication Works

<p class="slide-subtitle">After this you'll understand: why JWTs are used, how they're verified without a database, and when they expire.</p>

<div style="margin-top: 1.5em;">
  <span class="tag tag-primary">Stateless Auth</span>
  <span class="tag tag-success">Security</span>
  <span class="tag tag-warning">HTTP / APIs</span>
</div>

</div>

Note: JWT shows up everywhere — REST APIs, SPAs, mobile apps. Most devs use it without understanding how the verification actually works. By the end, you'll be able to explain it to a colleague in 60 seconds.

---

<!-- ============================================================
  SLIDE 2 — WHY THIS MATTERS
  ============================================================
  Purpose: Motivate the audience before the mechanics. Answer "why
  should I care?" before answering "how does it work?"

  HOW TO ADAPT:
  - Change the highlight-box question to your concept's central tension
    (e.g., "Why can't the server just check sessions in the database?")
  - Replace the context bullets with the real-world situations where
    your concept is the right solution
  - Fragment items so each lands separately — let the "aha" build

  GOOD MOTIVATING QUESTIONS FOR OTHER CONCEPTS:
  - "Why doesn't the server remember who you are between requests?"
  - "Why do we need tokens at all if we already have cookies?"
  - "What breaks at scale that makes stateless auth necessary?"
  ============================================================ -->

## Why This Matters

<div class="highlight-box">
  <strong>The Problem It Solves</strong>
  HTTP is stateless — every request arrives with no memory of the last one. Without authentication tokens, every request would need to re-verify your identity against a database.
</div>

**You'll hit JWT in real projects when:**

- Building a REST API that a React or mobile app calls <!-- .element: class="fragment fade-up" -->
- Implementing login — the token is what proves "I already authenticated" <!-- .element: class="fragment fade-up" -->
- Debugging a `401 Unauthorized` and not knowing why the token is rejected <!-- .element: class="fragment fade-up" -->
- Designing session expiry and logout behavior <!-- .element: class="fragment fade-up" -->
- Working across multiple services that all need to trust the same identity <!-- .element: class="fragment fade-up" -->

Note: Show of hands — who has used jwt.sign or jwt.verify without fully understanding what they were doing? That's exactly what this session fixes.

---

<!-- ============================================================
  SLIDE 3 — THE CORE IDEA (ANALOGY)
  ============================================================
  Purpose: Before any code or diagrams, give the audience a mental
  model they can hold onto. A good analogy makes the mechanics stick.

  HOW TO ADAPT:
  - Replace the concert wristband analogy with one relevant to YOUR concept
  - The analogy should map onto the exact mechanism you'll explain later
  - .highlight-box carries the analogy — keep it to 3–5 sentences max
  - The two bullet points should name the EXACT properties the analogy
    demonstrates (here: self-contained + no central lookup)

  ANALOGY PATTERN FOR TECHNICAL CONCEPTS:
  "The [thing that creates] gives you a [token/key/artifact] when you [entry condition].
   [The thing that verifies] can check [the artifact] without [the expensive thing]."

  GOOD ANALOGIES FOR OTHER CONCEPTS:
  - Public-key crypto: "A padlock you can share publicly — only YOUR key opens it"
  - Event sourcing: "A bank statement — don't ask 'what's the balance?', replay the history"
  - Service mesh: "A post office sorting system — senders don't route, the mesh does"
  ============================================================ -->

## The Core Idea

<div class="highlight-box">
  <strong>The Concert Wristband Analogy</strong>
  The venue stamps your wristband when you enter — that's login, the server issues a token. From then on, security at every door just checks the stamp. They don't call the main gate to confirm you paid. The stamp itself contains the proof. When the venue closes (token expiry), the wristband stops working regardless of how valid it looks.
</div>

This maps directly onto JWT's two key properties:

- **Self-contained** — the token carries all the claims needed to verify identity <!-- .element: class="fragment fade-up" -->
- **Stateless verification** — the server doesn't look you up in a database on every request <!-- .element: class="fragment fade-up" -->

Note: Keep coming back to the wristband. Every JWT mechanic has a direct analogy here — the stamp is the signature, the wristband data is the payload, expiry is the venue closing.

---

<!-- ============================================================
  SLIDE 4 — HOW IT WORKS, PART 1: STRUCTURE (auto-animate start)
  ============================================================
  Purpose: Introduce the three-part structure of a JWT visually.
  auto-animate will carry the heading into the next two slides,
  creating a sense of progressive disclosure through the mechanism.

  HOW TO ADAPT:
  - Replace the header/payload/signature breakdown with the structural
    parts of YOUR concept
  - The color-coded .jwt-part spans are defined in the CSS above —
    rename or recolor them for your concept's parts
  - The two-column layout shows the raw format + labeled breakdown

  AUTO-ANIMATE NOTE:
  The h2 "How It Works" heading text must be IDENTICAL across slides 4–6
  for RevealJS to animate it smoothly. Only the subtitle tag changes.
  ============================================================ -->

<!-- .slide: data-auto-animate -->

## How It Works <span class="tag tag-primary">Part 1: Structure</span>

A JWT is three Base64URL-encoded JSON objects joined by dots:

<div style="text-align: center; margin: 0.8em 0; font-family: var(--r-code-font); font-size: 0.78em; letter-spacing: 0.02em; line-height: 2;">
  <span class="jwt-header">eyJhbGciOiJIUzI1NiJ9</span><span style="color: var(--os-text-muted);">.</span><span class="jwt-payload">eyJ1c2VySWQiOjEyM30</span><span style="color: var(--os-text-muted);">.</span><span class="jwt-signature">SflKxwRJSMeKKF2QT4fw</span>
</div>

<div class="two-column" style="margin-top: 0.8em; font-size: 0.82em;">

<div class="column">

### <span class="jwt-header" style="font-size:0.9em;">Header</span>
Algorithm + token type
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

</div>

<div class="column">

### <span class="jwt-payload" style="font-size:0.9em;">Payload</span>
Claims (user data + expiry)
```json
{
  "userId": 123,
  "role": "admin",
  "exp": 1735689600
}
```

</div>

</div>

<p style="font-size: 0.75em; color: var(--os-text-muted); margin-top: 0.5em;">
  <span class="jwt-signature" style="font-size:0.9em;">Signature</span> — covered on the next slide
</p>

Note: The payload is just Base64 encoded — not encrypted. Anyone can decode it. This is why you should NEVER put passwords, SSNs, or secrets in the payload. It's tamper-proof, not secret.

---

<!-- ============================================================
  SLIDE 5 — HOW IT WORKS, PART 2: SIGNING (auto-animate continuation)
  ============================================================
  Purpose: Show how the token is created and why the signature
  is the mechanism that makes the whole thing trustworthy.

  HOW TO ADAPT:
  - Replace the jwt.sign code with the "creation" step of YOUR concept
  - The formula line should show YOUR concept's core operation as a one-liner
  - Keep data-auto-animate on this slide so the h2 heading animates
    smoothly from slide 4

  NOTE: The h2 text "How It Works" must stay identical to slide 4
  for RevealJS auto-animate to morph it across slides.
  ============================================================ -->

<!-- .slide: data-auto-animate -->

## How It Works <span class="tag tag-success">Part 2: Signing</span>

When you log in, the server runs:

<div class="highlight-box" style="font-family: var(--r-code-font); font-size: 0.8em; text-align: center; padding: 0.8em 1em;">
  <strong>The Formula</strong>
  HMAC-SHA256( Base64(header) + "." + Base64(payload),  <span style="color: #fbbf24;">secretKey</span> )  →  <span class="jwt-signature">signature</span>
</div>

```javascript
const token = jwt.sign(
  { userId: 123, role: 'admin' },  // payload
  process.env.JWT_SECRET,          // secret key (stays on the server)
  { expiresIn: '1h' }              // exp claim added automatically
);
// → "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOjEyM30.SflKxwRJ..."
```

The server sends this token to the client. The **secret never leaves the server.**

Note: The secret key is what the wristband stamp is. Anyone can look at a wristband but only the venue with the real stamp can create a valid one — or verify one.

---

<!-- ============================================================
  SLIDE 6 — HOW IT WORKS, PART 3: VERIFICATION (auto-animate continuation)
  ============================================================
  Purpose: The "aha" moment — show that verification requires NO
  database lookup. The server recomputes the signature and compares.

  HOW TO ADAPT:
  - This is the payoff slide for the auto-animate trilogy
  - Show the verification step for YOUR concept (the "check" operation)
  - Emphasize what makes the verification CHEAP or SCALABLE compared
    to the naive approach (database lookup, central service call, etc.)
  - Fragment the numbered steps so they build one at a time
  ============================================================ -->

<!-- .slide: data-auto-animate -->

## How It Works <span class="tag tag-warning">Part 3: Verification</span>

On every protected request, the server:

1. **Splits** the token into header, payload, signature <!-- .element: class="fragment fade-up" -->
2. **Re-signs** header + payload with its own secret <!-- .element: class="fragment fade-up" -->
3. **Compares** the result to the token's signature <!-- .element: class="fragment fade-up" -->
4. **Checks `exp`** — rejects if the current time is past expiry <!-- .element: class="fragment fade-up" -->

```javascript
// No database call. Just cryptographic comparison.
const decoded = jwt.verify(token, process.env.JWT_SECRET);
// → { userId: 123, role: 'admin', iat: 1735686000, exp: 1735689600 }
// Throws TokenExpiredError or JsonWebTokenError if invalid
```
<!-- .element: class="fragment fade-up" -->

> If anyone tampers with the payload, the re-computed signature won't match. The token is rejected. <!-- .element: class="fragment fade-up" -->

Note: This is why JWT is "stateless" — the server doesn't store sessions. The signature IS the proof. Scale to 100 servers and none of them need shared session storage.

---

<!-- ============================================================
  SLIDE 7 — REAL CODE EXAMPLE
  ============================================================
  Purpose: Show a complete, production-relevant implementation so the
  audience can immediately apply what they've learned.

  HOW TO ADAPT:
  - Replace the Express middleware with the idiomatic "usage pattern"
    for YOUR concept in YOUR stack
  - data-line-numbers highlights guide attention through the code —
    use the pipe-separated format "1|5-7|9|11-13|14-18" to step through
  - The comment above the code block should name the framework/library
  - Keep the code realistic but minimal — strip anything not essential

  DATA-LINE-NUMBERS SYNTAX:
  "1-3"   = highlight lines 1 to 3 continuously
  "1|5|9" = step through line 1, then 5, then 9 on key presses
  ============================================================ -->

## Real Code Example

<p style="font-size: 0.75em; color: var(--os-text-muted); margin-bottom: 0.4em;">Express.js authentication middleware — the full pattern</p>

```javascript
import jwt from 'jsonwebtoken';

export function authenticate(req, res, next) {
  const header = req.headers['authorization'];
  const token  = header?.startsWith('Bearer ')
    ? header.slice(7)
    : null;

  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError'
      ? 'Token expired'
      : 'Invalid token';
    res.status(401).json({ error: msg });
  }
}
```
<!-- .element: data-line-numbers="1|3-7|9|11-13|14-18" -->

Note: Line 12 is where all the magic happens — jwt.verify both decrypts AND validates the signature and expiry in one call. The try/catch on lines 14–18 is where most bugs live — distinguish expired from invalid.

---

<!-- ============================================================
  SLIDE 8 — COMMON PITFALLS
  ============================================================
  Purpose: Inoculate the audience against the mistakes everyone makes
  when they first use this concept in production.

  HOW TO ADAPT:
  - Replace each pitfall with the real gotchas for YOUR concept
  - Order from most-common to most-dangerous
  - Each pitfall should state the mistake AND why it matters
  - Use .tag-warning for security/correctness risks
  - Fragment so the audience can absorb one mistake at a time

  PITFALL STRUCTURE:
  <span class="tag tag-warning">Category</span> **The mistake** — why it goes wrong
  ============================================================ -->

## Common Pitfalls

- <span class="tag tag-warning">XSS Risk</span> **Storing JWTs in `localStorage`** — JavaScript on the page can read it; a single XSS flaw exfiltrates every user's token. Use `httpOnly` cookies instead. <!-- .element: class="fragment fade-up" -->

- <span class="tag tag-warning">Security</span> **Not setting an expiry** — without `expiresIn`, a stolen token is valid forever. Always set a short TTL (15 min – 1 hour for access tokens). <!-- .element: class="fragment fade-up" -->

- <span class="tag tag-warning">Config</span> **Using the same secret in dev and prod** — if your dev secret leaks (it will), real user tokens become forgeable. Use separate secrets per environment. <!-- .element: class="fragment fade-up" -->

- <span class="tag tag-warning">Bug</span> **Not handling `TokenExpiredError` separately** — catching all JWT errors as `401 Invalid Token` means clients can't tell whether to re-authenticate or just refresh. <!-- .element: class="fragment fade-up" -->

- <span class="tag tag-warning">Privacy</span> **Putting sensitive data in the payload** — payloads are Base64 encoded, not encrypted. Never store passwords, secrets, SSNs, or PII in a JWT. <!-- .element: class="fragment fade-up" -->

Note: The localStorage one causes the most incidents in the wild. If you remember nothing else from this slide, remember: httpOnly cookies for JWTs.

---

<!-- ============================================================
  SLIDE 9 — MENTAL MODEL
  ============================================================
  Purpose: Give the audience one sentence they can carry out of the
  room and use to explain this concept to anyone.

  HOW TO ADAPT:
  - Replace the single-sentence mental model with yours — it should
    compress the entire concept into one memorable formulation
  - The highlight-box should contain JUST that sentence (large, centered)
  - Restate the analogy briefly — this is the "lock it in" moment
  - Do NOT add new information on this slide. Consolidation only.

  MENTAL MODEL FORMULA:
  "[Concept] is [what it is] that lets [who] [do what] without [the expensive/complex thing]."
  ============================================================ -->

## Mental Model

<div class="highlight-box centered" style="padding: 1.8em 2em; margin: 0.5em 0 1em;">
  <strong>One Sentence</strong>
  <p style="font-size: 1.1em; color: var(--os-text-primary); font-weight: 600; margin: 0; line-height: 1.5;">A JWT is a tamper-proof ticket your server issues at login — every request presents the ticket, and the server verifies the stamp without calling anyone.</p>
</div>

The wristband, restated concisely:

- **Login** → venue stamps your wristband (server issues signed token) <!-- .element: class="fragment fade-up" -->
- **Request** → security checks the stamp (server recomputes signature) <!-- .element: class="fragment fade-up" -->
- **Expiry** → venue closes (token's `exp` claim is in the past) <!-- .element: class="fragment fade-up" -->
- **Tampering** → wrong stamp, rejected at the door (signature mismatch) <!-- .element: class="fragment fade-up" -->

Note: If someone can repeat this analogy tomorrow morning, the session worked.

---

<!-- ============================================================
  SLIDE 10 — SUMMARY
  ============================================================
  Purpose: Bookend the session with a checkable list of what the
  audience now understands. The gradient background mirrors slide 1
  to signal "we've come full circle."

  HOW TO ADAPT:
  - Replace the checklist items with YOUR concept's learning outcomes
  - Each item should be a concrete capability: "I can now [do/explain/...]"
  - Use fragment so items appear one at a time — gives a sense of
    accumulation and lets the audience mentally tick each box
  - The gradient should match or mirror the title slide's gradient
  - The tags at the bottom should echo the three tags from slide 1

  CHECKLIST STRUCTURE:
  Each item = a thing the audience can now DO or EXPLAIN,
  not just a fact they now KNOW.
  ============================================================ -->

<!-- .slide: data-background-gradient="linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)" -->

## What You Now Understand

- **Why JWTs exist** — stateless HTTP needs a way to carry identity between requests without a central session store <!-- .element: class="fragment fade-up" -->
- **The three-part structure** — header (algorithm), payload (claims), signature (proof of integrity) <!-- .element: class="fragment fade-up" -->
- **How signing works** — HMAC of header + payload with a secret produces an unforgeable stamp <!-- .element: class="fragment fade-up" -->
- **How verification works** — recompute the signature and compare; no database required <!-- .element: class="fragment fade-up" -->
- **How to implement it** — `jwt.sign` to issue, `jwt.verify` in middleware to protect routes <!-- .element: class="fragment fade-up" -->
- **What can go wrong** — localStorage XSS, missing expiry, shared secrets, unhandled error types <!-- .element: class="fragment fade-up" -->

<div style="margin-top: 1.2em; text-align: center;" class="fragment fade-up">
  <span class="tag tag-primary">Stateless Auth</span>
  <span class="tag tag-success">Cryptographic Signature</span>
  <span class="tag tag-warning">Expiry & Rotation</span>
</div>

Note: The three tags at the bottom restate the three dimensions from slide 1 — a deliberate callback to show the promise was kept.
