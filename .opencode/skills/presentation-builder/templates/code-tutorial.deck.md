---
title: "Building useDebounce: A Custom React Hook"
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
  TEMPLATE: code-tutorial.deck.md
  ==========================================
  Use this template when walking an audience through code step-by-step —
  teaching a pattern, API, or technique via live code evolution.
  Working example: Building useDebounce + useSearch in React/TypeScript.

  HOW TO ADAPT THIS TEMPLATE:
  1. Update frontmatter: change `title` to reflect your tutorial topic
  2. Replace the concrete hook example with your own code
  3. Keep data-id="main-code" on <pre> elements across slides 4→5→6→7
     so RevealJS auto-animate morphs the code block between steps
  4. Adjust data-line-numbers highlight ranges to match your code
     (format: "[A-B|C-D]" — each | = one right-arrow press)
  5. Update tags, highlight-box descriptions, and pitfalls to match your topic
  6. Swap the Summary checklist items to match your Step slides

  SLIDE COUNT: 10 slides (numbered in comments below)
  ESTIMATED DURATION: 10–15 minutes at 1 min/slide
-->

<style>
/* ============================================================
   MODERN DESIGN SYSTEM
   Base: openspace-modern theme (indigo tones for code tutorials)
   Colors:
     --os-primary:       #6366f1  (indigo)
     --os-primary-light: #818cf8  (light indigo)
     --os-accent:        #e94560  (rose)
     --os-bg-primary:    #0f172a  (dark navy)
     --os-bg-secondary:  #1e293b  (slate)
   ============================================================ */

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --os-primary:       #6366f1;
  --os-primary-light: #818cf8;
  --os-primary-dark:  #4f46e5;
  --os-accent:        #e94560;
  --os-accent-light:  #ff6b8a;
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
  background: linear-gradient(135deg, var(--os-text-primary), var(--os-primary-light));
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

.reveal ul, .reveal ol {
  display: block;
  text-align: left;
  color: var(--os-text-secondary);
  line-height: 1.8;
  margin-left: 1.2em;
}

.reveal li { margin-bottom: 0.3em; }
.reveal li strong { color: var(--os-text-primary); }

/* Custom bullet marker */
.reveal ul > li::marker { content: "▸ "; color: var(--os-primary); }

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
  color: var(--os-primary-light);
}

.reveal pre {
  background: var(--os-bg-secondary);
  border: 1px solid rgba(99, 102, 241, 0.25);
  border-radius: 10px;
  padding: 0;
  font-size: 0.72em;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
  width: 100%;
  margin: 0.6em 0;
}

.reveal pre code {
  background: transparent;
  border: none;
  padding: 1em 1.2em;
  font-size: 1em;
  color: var(--os-text-primary);
}

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

/* ── Tables ─────────────────────────────────────────────────── */
.reveal table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.72em;
  margin: 0.5em 0;
}

.reveal table th {
  background: rgba(99, 102, 241, 0.18);
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

/* ── Highlight box ──────────────────────────────────────────── */
/*
  Usage: wrap content in a <div class="highlight-box"> block.
  Use for key callouts, tips, warnings, and "under the hood" notes.
  Example:
    <div class="highlight-box">
      <strong>Under the Hood</strong>
      useSearch composes useDebounce to delay the fetch.
    </div>
*/
.reveal .highlight-box {
  background: linear-gradient(135deg,
    rgba(99, 102, 241, 0.12) 0%,
    rgba(129, 140, 248, 0.07) 100%);
  border: 1px solid rgba(99, 102, 241, 0.35);
  border-left: 4px solid var(--os-primary);
  border-radius: 10px;
  padding: 1.1em 1.4em;
  margin: 0.8em 0;
  color: var(--os-text-primary);
  font-size: 0.92em;
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
  Usage: .metric as a container, .metric-value for the big word/number,
         .metric-label for the descriptor below it.
  Example:
    <div class="metric">
      <div class="metric-value">300ms</div>
      <div class="metric-label">Default Debounce Delay</div>
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
    <span class="tag tag-success">✓ Pattern</span>
    <span class="tag tag-warning">⚠ Pitfall</span>
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

.reveal .two-column .column pre {
  font-size: 0.65em;
}

/* ── Gradient text ──────────────────────────────────────────── */
/*
  Usage: <span class="gradient-text">Impact Phrase</span>
  Renders text with an indigo→rose gradient fill.
*/
.reveal .gradient-text {
  background: linear-gradient(135deg, var(--os-primary-light), var(--os-accent-light));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* ── Fragments ──────────────────────────────────────────────── */
.reveal .fragment { opacity: 0; transition: opacity 0.4s ease, transform 0.4s ease; }
.reveal .fragment.visible { opacity: 1; }
.reveal .fragment.fade-up { transform: translateY(20px); }
.reveal .fragment.fade-up.visible { transform: translateY(0); }

/* ── Progress bar ───────────────────────────────────────────── */
.reveal .progress { background: rgba(255, 255, 255, 0.08); }
.reveal .progress span { background: var(--os-primary); }

/* ── Slide number ───────────────────────────────────────────── */
.reveal .slide-number {
  background: rgba(99, 102, 241, 0.15);
  color: var(--os-text-muted);
  font-size: 0.55em;
  border-radius: 6px;
  padding: 3px 8px;
}

/* ── Utility: slide subtitle ────────────────────────────────── */
.reveal .slide-subtitle {
  font-size: 0.72em;
  color: var(--os-text-muted);
  font-weight: 400;
  margin-top: -0.3em;
  margin-bottom: 1em;
  letter-spacing: 0.01em;
}
</style>

---

<!-- ============================================================
  SLIDE 1 — TITLE SLIDE
  ============================================================
  Purpose: Hook the audience. State the tutorial topic and exactly
  what they'll be able to build after the session ends.

  HOW TO FILL IN:
  - data-background-gradient: dark indigo gradient signals "code session".
    Bookended by the Summary slide (slide 10) which uses the same gradient.
  - h1: the hook or pattern name — keep it to ~5 words max
  - p: the "after this you'll know how to..." payoff sentence
  - tags: label the language, level, and time estimate
  ============================================================ -->

<!-- .slide: data-background-gradient="linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)" -->

<div style="padding-top: 0.4em;">

# Building useDebounce

## A Custom React Hook Tutorial

<p class="slide-subtitle">After this you'll know how to prevent unnecessary API calls with a clean, reusable hook pattern.</p>

<div style="margin-top: 1.5em;">
  <span class="tag tag-primary">React Hooks</span>
  <span class="tag tag-success">TypeScript</span>
  <span class="tag tag-warning">Beginner–Intermediate</span>
</div>

</div>

Note: Welcome. We're building two composable hooks from scratch — useDebounce and useSearch. By the end you'll have a production-ready debounce primitive and a search hook you can drop into any React project. ~10 minutes.

---

<!-- ============================================================
  SLIDE 2 — WHAT WE'RE BUILDING
  ============================================================
  Purpose: Show the finished API first so learners know the destination
  before the journey starts. "Start with the end" reduces anxiety.

  HOW TO FILL IN:
  - Replace the code block with your own finished call-site / API.
  - The highlight-box is for a one-paragraph "what it does" explanation.
  - Keep this slide to: one code snippet + one highlight-box only.
  ============================================================ -->

## What We're Building

<p>Two composable hooks — live debounced search with zero boilerplate at the call-site:</p>

```typescript
const { results, isLoading } = useSearch(query, { delay: 300 })
```

<div class="highlight-box">
  <strong>What It Does</strong>
  <code>useSearch</code> wraps <code>useDebounce</code> to wait until the user pauses
  typing before firing a <code>fetch</code> — preventing a network request on every
  keystroke. It returns typed results, a loading flag, and an error state. No extra
  dependencies. No manual cleanup.
</div>

Note: This is the destination. Notice the call-site is three words — all the complexity lives inside the two hooks we're about to build together.

---

<!-- ============================================================
  SLIDE 3 — SETUP & PREREQUISITES
  ============================================================
  Purpose: Ground the audience before code appears. State what you
  assume they already know and what files we'll be creating.

  HOW TO FILL IN:
  - Replace bullet points with YOUR actual prerequisites.
  - Replace the file list with your project's structure.
  - Use <!-- .element: class="fragment fade-up" --> on each <li>
    to reveal prereqs one at a time — gives slower readers a moment
    to process each item.
  - The highlight-box is for a quick "gotcha" callout (e.g. mocked API).
  ============================================================ -->

## Setup & Prerequisites

**You'll need:**

- React 18+ with hooks support <!-- .element: class="fragment fade-up" -->
- TypeScript 5+ <!-- .element: class="fragment fade-up" -->
- A `fetch`-capable environment (browser or Node 18+) <!-- .element: class="fragment fade-up" -->
- No extra libraries — we build from primitives <!-- .element: class="fragment fade-up" -->

**Files we'll create:** <!-- .element: class="fragment fade-up" -->

- `hooks/useDebounce.ts` — the debounce primitive <!-- .element: class="fragment fade-up" -->
- `hooks/useSearch.ts` — composed search hook <!-- .element: class="fragment fade-up" -->
- `components/SearchPage.tsx` — the consumer component <!-- .element: class="fragment fade-up" -->

<div class="highlight-box fragment fade-up">
  <strong>Note</strong>
  The API endpoint is mocked throughout — swap <code>/api/products</code> for your real URL when you integrate.
</div>

Note: Quick check — raise your hand if you haven't written a custom hook before. We'll cover the mental model as we go, so don't worry. The key concept is: hooks are just functions that call other hooks.

---

<!-- ============================================================
  SLIDE 4 — STEP 1: useDebounce HOOK (auto-animate start)
  ============================================================
  Purpose: Introduce the foundation primitive. This is the first slide
  in the code-evolution chain. data-id="main-code" on the <pre> element
  tells RevealJS to morph this block into the next slide's code block.

  HOW TO FILL IN:
  - data-auto-animate: enables the morphing animation
  - data-id="main-code" MUST match across slides 4→5→6→7 exactly
  - data-line-numbers format: "[A-B|C-D|E-F]"
    Each pipe | = one right-arrow press by the presenter
    [1-4]: highlight lines 1–4 on enter
    [6-12]: then highlight lines 6–12 on next press
  - Replace the code block with YOUR step 1 implementation
  ============================================================ -->

<!-- .slide: data-auto-animate -->

## Step 1 — `useDebounce`

<p>Delay a value update until the user pauses — the core building block.</p>

<pre data-id="main-code"><code data-trim data-line-numbers="[1-4|6-12]" class="language-typescript">
// hooks/useDebounce.ts
import { useState, useEffect } from 'react'

type Milliseconds = number

export function useDebounce<T>(
  value: T,
  delay: Milliseconds = 300
): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    // Cancel previous timer if value changed again (this is what makes it "debounce")
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}
</code></pre>

Note: Lines 1–4: imports + the Milliseconds alias keeps the signature self-documenting. Lines 6–12: the hook is generic — it works with strings, numbers, or any object. The cleanup function is what makes this "debounce" and not "delay" — every keystroke resets the clock. Simple. 20 lines.

---

<!-- ============================================================
  SLIDE 5 — STEP 2: useSearch SKELETON (auto-animate continues)
  ============================================================
  Purpose: Grow the code. The <pre data-id="main-code"> block morphs
  from slide 4's code into this slide's code. Existing lines animate
  into new positions; new lines fade in.

  HOW TO FILL IN:
  - data-auto-animate: must be present
  - data-id="main-code": must EXACTLY match slide 4
  - Start the highlight range on the NEW lines added in this step
  - Keep the code to this step's scope only — don't reveal step 3 yet
  ============================================================ -->

<!-- .slide: data-auto-animate -->

## Step 2 — `useSearch` Skeleton

<p>Define the hook's signature, state, and wire in <code>useDebounce</code>.</p>

<pre data-id="main-code"><code data-trim data-line-numbers="[1-6|8-15]" class="language-typescript">
// hooks/useSearch.ts
import { useState } from 'react'
import { useDebounce } from './useDebounce'

interface SearchResult { id: string; [key: string]: unknown }

interface UseSearchOptions { delay?: number }

interface UseSearchReturn<T> {
  results: T[]
  isLoading: boolean
  error: Error | null
}

export function useSearch<T extends SearchResult>(
  endpoint: string,
  options: UseSearchOptions = {}
): UseSearchReturn<T> {
  const { delay = 300 } = options

  const [query,     setQuery]   = useState('')
  const [results,   setResults] = useState<T[]>([])
  const [isLoading, setLoading] = useState(false)
  const [error,     setError]   = useState<Error | null>(null)

  // Debounce the raw query — fetch fires only when typing stops
  const debouncedQuery = useDebounce(query, delay)

  // ... fetch logic coming in Step 3
  return { results, isLoading, error }
}
</code></pre>

Note: The return type interface is the "contract" — I define it before the implementation. Notice useDebounce is already wired in at line 25. The debouncedQuery value will drive the fetch in the next step, not the raw query. This is the composition pattern.

---

<!-- ============================================================
  SLIDE 6 — STEP 3: FETCH LOGIC (auto-animate continues)
  ============================================================
  Purpose: Fill in the useEffect with the actual fetch + cleanup.
  This is the most important step — AbortController is the key pattern.

  HOW TO FILL IN:
  - data-auto-animate + data-id="main-code": must match slides 4 and 5
  - Highlight ranges: walk through the guard clause, AbortController
    setup, the async fetchResults function, and the cleanup return
  - The three highlight groups should correspond to your three
    most important teaching moments in this step
  ============================================================ -->

<!-- .slide: data-auto-animate -->

## Step 3 — Fetch Logic

<p>Fire the search when debounced query settles; cancel stale requests with <code>AbortController</code>.</p>

<pre data-id="main-code"><code data-trim data-line-numbers="[1-5|7-20|22-26]" class="language-typescript">
// hooks/useSearch.ts — replacing the placeholder comment from Step 2

useEffect(() => {
  // Guard: skip empty queries, clear results
  if (!debouncedQuery.trim()) { setResults([]); return }

  // AbortController cancels the fetch on unmount or re-render
  const controller = new AbortController()

  async function fetchResults() {
    setLoading(true)
    setError(null)
    try {
      const url = `${endpoint}?q=${encodeURIComponent(debouncedQuery)}`
      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setResults(await res.json())
    } catch (err) {
      // Ignore AbortError — that's an intentional cancellation, not an error
      if ((err as DOMException).name !== 'AbortError')
        setError(err instanceof Error ? err : new Error(String(err)))
    } finally { setLoading(false) }
  }

  fetchResults()
  // Cleanup: abort in-flight request on re-render or unmount
  return () => controller.abort()

}, [debouncedQuery, endpoint])
</code></pre>

Note: Lines 1–5: the empty-query guard is important — it prevents a fetch on initial render. Lines 7–20: AbortController is the most critical pattern here. Without it you get race conditions where a slow response arrives after a faster one and overwrites the correct results. Lines 22–26: the cleanup return is what connects this to the debounce — together they ensure exactly one fetch fires per typing pause.

---

<!-- ============================================================
  SLIDE 7 — COMPLETE CODE
  ============================================================
  Purpose: Show the full combined implementation in one place.
  The final step in the auto-animate chain. No more stepping needed —
  data-line-numbers="true" shows plain line numbers for reference only.

  HOW TO FILL IN:
  - data-auto-animate + data-id="main-code": must match slides 4–6
  - data-line-numbers="true": just shows line numbers, no stepping
  - This is the "full picture" moment — let it breathe, ask for questions
  ============================================================ -->

<!-- .slide: data-auto-animate -->

## Complete `useSearch.ts`

<pre data-id="main-code"><code data-trim data-line-numbers="true" class="language-typescript">
// hooks/useSearch.ts — full implementation
import { useState, useEffect, useCallback } from 'react'
import { useDebounce } from './useDebounce'

interface SearchResult { id: string; [key: string]: unknown }
interface UseSearchOptions { delay?: number }
interface UseSearchReturn<T> {
  query: string; setQuery: (q: string) => void
  results: T[]; isLoading: boolean; error: Error | null
}

export function useSearch<T extends SearchResult>(
  endpoint: string,
  options: UseSearchOptions = {}
): UseSearchReturn<T> {
  const { delay = 300 } = options
  const [query,     setQueryRaw] = useState('')
  const [results,   setResults]  = useState<T[]>([])
  const [isLoading, setLoading]  = useState(false)
  const [error,     setError]    = useState<Error | null>(null)
  const debouncedQuery = useDebounce(query, delay)

  useEffect(() => {
    if (!debouncedQuery.trim()) { setResults([]); return }
    const controller = new AbortController()
    async function fetchResults() {
      setLoading(true); setError(null)
      try {
        const url = `${endpoint}?q=${encodeURIComponent(debouncedQuery)}`
        const res = await fetch(url, { signal: controller.signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setResults(await res.json())
      } catch (err) {
        if ((err as DOMException).name !== 'AbortError')
          setError(err instanceof Error ? err : new Error(String(err)))
      } finally { setLoading(false) }
    }
    fetchResults()
    return () => controller.abort()
  }, [debouncedQuery, endpoint])

  const setQuery = useCallback((q: string) => setQueryRaw(q), [])
  return { query, setQuery, results, isLoading, error }
}
</code></pre>

Note: Full picture — 44 lines, two responsibilities: debounce (outsourced to useDebounce) and fetch lifecycle (owned here). Any questions before we see it used in a component?

---

<!-- ============================================================
  SLIDE 8 — USAGE IN A COMPONENT
  ============================================================
  Purpose: The "payoff" slide. Show how a consumer calls the hook.
  Two-column layout: left = hook call, right = JSX. This is the
  "it's actually that simple" moment.

  HOW TO FILL IN:
  - Replace the hook call snippet with your finished API call
  - Replace the JSX snippet with a realistic consumer example
  - The highlight-box tip is for a real-world adaptation hint
    (e.g. adjusting delay for slower connections)
  ============================================================ -->

## Usage in a Component

<div class="two-column">

<div class="column">

### The Hook Call

```typescript
const {
  query,
  setQuery,
  results,
  isLoading,
  error,
} = useSearch<Product>(
  '/api/products',
  { delay: 400 }
)
```

<div class="highlight-box">
  <strong>Tip</strong>
  Use <code>400</code>ms for slower mobile connections. Default <code>300</code>ms works well for fast desktop APIs.
</div>

</div>

<div class="column">

### The JSX

```tsx
return (
  <div>
    <input
      value={query}
      onChange={e =>
        setQuery(e.target.value)
      }
      placeholder="Search products…"
    />

    {isLoading && <Spinner />}
    {error && <ErrorBanner error={error} />}

    <ul>
      {results.map(p => (
        <li key={p.id}>{p.name}</li>
      ))}
    </ul>
  </div>
)
```

</div>

</div>

Note: Notice the component has zero fetch logic, zero timers, zero AbortController — all of that complexity lives in the hooks. The component just reacts to state. This is the goal of custom hooks: hide the mechanics, expose the data.

---

<!-- ============================================================
  SLIDE 9 — COMMON PITFALLS
  ============================================================
  Purpose: Pre-emptively answer "what goes wrong?" questions.
  Fragment reveals let each pitfall land before the next appears —
  the audience should be nodding or thinking "oh I've done that."

  HOW TO FILL IN:
  - Reorder by likelihood for your audience (most common first)
  - Keep each item to: <strong>Problem name</strong> — one-line description.
    Fix: one-line solution.
  - 4–5 pitfalls is ideal — fewer feels incomplete, more is exhausting
  - The fragment class on each li ensures items appear one at a time
  ============================================================ -->

## Common Pitfalls

<p>Things that bite developers the first time — and the one-line fix for each.</p>

- **Missing `clearTimeout` cleanup** — stale state updates after unmount cause memory leaks. Fix: always return the cleanup function from `useEffect`. <!-- .element: class="fragment fade-up" -->

- **Forgetting `AbortController`** — race conditions when the user types faster than the API responds. Fix: abort on re-render as shown in Step 3. <!-- .element: class="fragment fade-up" -->

- **State updates on unmounted component** — calling `setLoading(false)` after the component unmounts triggers a React warning. Fix: `AbortController` + the `AbortError` check prevents this. <!-- .element: class="fragment fade-up" -->

- **Debounce delay too short** — `50ms` feels instant but fires far too often on slow networks. Fix: `300ms` is a good default; `400–500ms` for mobile users. <!-- .element: class="fragment fade-up" -->

- **Unstable `endpoint` reference** — constructing the URL string inside the component on every render triggers the effect every render. Fix: pass a stable string constant, not a template literal from the component. <!-- .element: class="fragment fade-up" -->

Note: The AbortController pitfall is far and away the most common issue I see in code review. Worth pausing here for questions before moving on.

---

<!-- ============================================================
  SLIDE 10 — SUMMARY
  ============================================================
  Purpose: Close the loop on the opening promise from Slide 1.
  The gradient background bookends Slide 1 visually — signals "done."
  Fragment checklist items mirror the Steps in slides 4–7.

  HOW TO FILL IN:
  - data-background-gradient: use the SAME gradient as Slide 1
    for visual bookending (tells the audience the arc is complete)
  - Match checklist items to your Step slides (one item per step)
  - Add a final "bonus" item for the real-world extension concept
  - The fragment class on each li creates the satisfying reveal
  ============================================================ -->

<!-- .slide: data-background-gradient="linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)" -->

## <span class="gradient-text">What You Learned</span>

- **`useDebounce`** — delay a value update until the user pauses, with clean `clearTimeout` semantics that prevent stale updates. <!-- .element: class="fragment fade-up" -->

- **`useSearch`** — compose debounce + fetch into a single reusable hook with typed results, loading, and error state. <!-- .element: class="fragment fade-up" -->

- **`AbortController` pattern** — cancel in-flight requests on re-render and unmount to eliminate race conditions. <!-- .element: class="fragment fade-up" -->

- **Hook composition** — small, focused hooks that delegate to each other are easier to test and re-use than one monolithic hook. <!-- .element: class="fragment fade-up" -->

- **Clean call-site** — `useSearch<Product>(endpoint, { delay })` is the full API; consumers never touch timers or fetch. <!-- .element: class="fragment fade-up" -->

- **Next step** — extend `useSearch` with pagination, optimistic updates, or swap the `fetch` call for React Query / SWR once complexity grows. <!-- .element: class="fragment fade-up" -->

Note: That's it — two hooks, ~65 lines total, patterns applicable to any async data-fetching scenario. The finished code is on GitHub — link in the description. Questions?
