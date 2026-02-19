---
theme: openspace-modern
title: "The Problem: [What Went Wrong]"
description: Problem → diagnosis → solution narrative deck. Use for bug postmortems, tech debt proposals, refactor pitches, or incident reviews.
css-vars:
  --os-primary: "#6366f1"
  --os-primary-light: "#818cf8"
  --os-accent: "#ef4444"
  --os-accent-light: "#f87171"
  --os-success: "#10b981"
  --os-bg-primary: "#0f172a"
  --os-bg-secondary: "#1e293b"
---

<!-- ============================================================
  TEMPLATE: problem-solution.deck.md
  PURPOSE:  Problem → Diagnosis → Solution narrative presentations.
  USE FOR:  Bug postmortems, tech debt explanations, refactor proposals,
            incident reviews, "why this broke and how we fixed it" talks.

  CONCRETE EXAMPLE TOPIC: The N+1 Query Problem
    - A classic performance bug where fetching a list of posts triggers
      one extra DB query per post (to load each post's author).
    - Shown with Prisma/TypeORM. Fix uses `include` / eager loading.

  CUSTOMIZATION GUIDE:
    - Replace every [BRACKETED PLACEHOLDER] with your content.
    - CSS variable overrides are in the frontmatter above.
    - Each slide section below has a comment block explaining options.
    - Danger slides use: data-background-gradient red/dark
    - Success slides use: data-background-gradient green/dark
    - Auto-animate pairs share data-auto-animate on both <section> tags.
    - Matching data-id attributes on elements drives the morphing animation.
  ============================================================ -->

<!-- ============================================================
  EMBEDDED CSS
  Provides: .highlight-box, .highlight-box-danger, .metric,
            .metric-value, .metric-label, .tag variants,
            .two-column, .gradient-text, fragment polish,
            table styles, blockquote styles, code/pre resets.

  HOW TO CUSTOMIZE:
    - Adjust --os-* variables in the frontmatter (applied via :root).
    - .highlight-box-danger border/background can be tuned below.
    - .metric-value font-size can be increased for big "wow" numbers.
  ============================================================ -->
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

  /* ── Root variable injection (mirrors frontmatter for runtime) ── */
  :root {
    --os-primary:       #6366f1;
    --os-primary-light: #818cf8;
    --os-accent:        #ef4444;
    --os-accent-light:  #f87171;
    --os-success:       #10b981;
    --os-bg-primary:    #0f172a;
    --os-bg-secondary:  #1e293b;
    --os-error:         #ef4444;
    --os-text:          #e2e8f0;
    --os-text-muted:    #94a3b8;
    --os-border:        rgba(99,102,241,0.25);
  }

  /* ── Base reveal overrides ── */
  .reveal {
    font-family: "Inter", "Segoe UI", system-ui, sans-serif;
    color: var(--os-text);
    background-color: var(--os-bg-primary);
  }

  /* ── Headings ── */
  .reveal h1, .reveal h2, .reveal h3, .reveal h4 {
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--os-text);
    text-transform: none;
    margin-bottom: 0.5em;
  }
  .reveal h1 { font-size: 2.4em; }
  .reveal h2 { font-size: 1.8em; }
  .reveal h3 { font-size: 1.3em; color: var(--os-primary-light); }

  /* ── Lists ── */
  .reveal ul, .reveal ol {
    margin-left: 1.2em;
    line-height: 1.75;
  }
  .reveal li { margin-bottom: 0.35em; }
  .reveal ul li::marker { color: var(--os-primary); }

  /* ── Code / Pre ── */
  .reveal code {
    font-family: "JetBrains Mono", "Fira Code", monospace;
    font-size: 0.88em;
    background: rgba(30, 41, 59, 0.85);
    padding: 0.1em 0.35em;
    border-radius: 4px;
    color: var(--os-accent-light);
  }
  .reveal pre {
    background: var(--os-bg-secondary);
    border: 1px solid var(--os-border);
    border-radius: 8px;
    padding: 1em 1.2em;
    box-shadow: 0 4px 24px rgba(0,0,0,0.35);
    font-size: 0.78em;
    line-height: 1.6;
    overflow: auto;
    white-space: pre;
  }
  .reveal pre code {
    background: none;
    padding: 0;
    color: #e2e8f0;
    font-size: inherit;
  }

  /* ── Tables ── */
  .reveal table {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.9em;
  }
  .reveal th {
    background: var(--os-bg-secondary);
    color: var(--os-primary-light);
    font-weight: 600;
    padding: 0.55em 1em;
    border-bottom: 2px solid var(--os-primary);
    text-align: left;
  }
  .reveal td {
    padding: 0.5em 1em;
    border-bottom: 1px solid rgba(99,102,241,0.15);
  }
  .reveal tr:last-child td { border-bottom: none; }

  /* ── Blockquote ── */
  .reveal blockquote {
    background: rgba(99,102,241,0.08);
    border-left: 4px solid var(--os-primary);
    border-radius: 0 8px 8px 0;
    padding: 0.75em 1.2em;
    margin: 0.75em 0;
    font-style: italic;
    color: var(--os-text-muted);
  }

  /* ── .highlight-box ── */
  .highlight-box {
    border: 2px solid var(--os-primary);
    background: rgba(99,102,241,0.08);
    border-radius: 10px;
    padding: 1em 1.4em;
    margin: 0.75em 0;
  }

  /* ── .highlight-box-danger (red variant for problem slides) ── */
  .highlight-box-danger {
    border: 2px solid var(--os-error);
    background: rgba(239, 68, 68, 0.08);
    border-radius: 10px;
    padding: 1em 1.4em;
    margin: 0.75em 0;
  }
  .highlight-box-danger strong { color: var(--os-accent-light); }

  /* ── .metric (impact numbers / KPIs) ── */
  .metric {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15em;
    background: var(--os-bg-secondary);
    border: 1px solid var(--os-border);
    border-radius: 12px;
    padding: 0.9em 1.4em;
    min-width: 140px;
    text-align: center;
  }
  .metric-value {
    font-size: 2.6em;
    font-weight: 800;
    color: var(--os-accent);
    letter-spacing: -0.03em;
    line-height: 1;
  }
  .metric-label {
    font-size: 0.78em;
    color: var(--os-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 500;
  }

  /* Success metric variant (for "after the fix" slide) */
  .metric.metric-success .metric-value { color: var(--os-success); }

  /* ── Tags ── */
  .tag {
    display: inline-block;
    border-radius: 99px;
    padding: 0.2em 0.75em;
    font-size: 0.72em;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    background: rgba(99,102,241,0.15);
    color: var(--os-primary-light);
    border: 1px solid rgba(99,102,241,0.35);
    margin-right: 0.4em;
  }
  .tag-primary {
    background: rgba(99,102,241,0.22);
    color: var(--os-primary-light);
    border-color: rgba(99,102,241,0.5);
  }
  .tag-success {
    background: rgba(16,185,129,0.15);
    color: #34d399;
    border-color: rgba(16,185,129,0.4);
  }
  .tag-warning {
    background: rgba(245,158,11,0.15);
    color: #fbbf24;
    border-color: rgba(245,158,11,0.4);
  }
  .tag-danger {
    background: rgba(239,68,68,0.15);
    color: var(--os-accent-light);
    border-color: rgba(239,68,68,0.4);
  }

  /* ── Two-column layout ── */
  .two-column {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5em;
    align-items: start;
  }
  .two-column .col-label {
    font-size: 0.72em;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 700;
    margin-bottom: 0.4em;
  }
  .two-column .col-label.bad  { color: var(--os-accent); }
  .two-column .col-label.good { color: var(--os-success); }

  /* ── Gradient text ── */
  .gradient-text {
    background: linear-gradient(90deg, var(--os-accent) 0%, var(--os-primary-light) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  /* ── Fragments polish ── */
  .reveal .fragment { opacity: 0.25; transition: opacity 0.3s ease; }
  .reveal .fragment.visible { opacity: 1; }

  /* ── Metrics row utility ── */
  .metrics-row {
    display: flex;
    gap: 1.2em;
    justify-content: center;
    flex-wrap: wrap;
    margin-top: 0.75em;
  }
</style>

---

<!-- ============================================================
  SLIDE 1 — TITLE
  PURPOSE: Sets the ominous tone. Grabs attention immediately.
           "This is a story about something that went wrong."
  CUSTOMIZE:
    - Replace "The N+1 Query Problem" with your incident name.
    - Replace the subtitle with your one-line impact summary.
    - Change speaker/date in the footer <p>.
    - The dark red gradient is intentional: signals danger.
  ============================================================ -->
<section
  data-background-gradient="linear-gradient(135deg, #1a0000 0%, #3b0000 60%, #0f172a 100%)"
>
  <h1>
    <span class="gradient-text">The Problem:</span><br>
    The N+1 Query Problem
  </h1>
  <p style="font-size:1.15em; color: var(--os-accent-light); margin-top: 0.5em;">
    How one innocent loop brought our API to its knees
  </p>
  <p style="margin-top: 2em; font-size: 0.7em; color: var(--os-text-muted);">
    Postmortem · [Team Name] · [Date]
  </p>
</section>

---

<!-- ============================================================
  SLIDE 2 — THE PROBLEM
  PURPOSE: Describe what users/developers actually experienced.
           Stay concrete: symptoms, not root cause (that comes later).
  CUSTOMIZE:
    - Use the .highlight-box-danger for the core symptom quote.
    - Replace bullet points with what YOUR users reported.
    - The tags show severity/category — adjust as needed.
  ============================================================ -->
<section
  data-background-gradient="linear-gradient(135deg, #1a0000 0%, #2d0a0a 100%)"
>
  <h2>The Problem</h2>
  <span class="tag tag-danger">P1 Incident</span>
  <span class="tag tag-warning">Performance</span>

  <div class="highlight-box-danger" style="margin-top: 0.9em;">
    <strong>"Why does loading the blog homepage take 8 seconds?"</strong><br>
    <span style="color: var(--os-text-muted); font-size:0.9em;">
      — Customer support ticket, filed by 12 users in one hour
    </span>
  </div>

  <ul style="margin-top: 1em;">
    <li>The <code>GET /posts</code> endpoint degraded from <strong>120 ms → 8 200 ms</strong> after the v3.4 deploy</li>
    <li>Response times scaled linearly with the number of published posts</li>
    <li>No errors were thrown — just silence, then a timeout</li>
    <li>The database server's CPU spiked to 95 % during every page load</li>
  </ul>
</section>

---

<!-- ============================================================
  SLIDE 3 — IMPACT
  PURPOSE: Quantify the damage. Make the cost undeniable.
           Numbers > vague language. Use .metric for the big stats.
  CUSTOMIZE:
    - Replace the three .metric blocks with your real numbers.
    - Add or remove metrics as needed.
    - The paragraph below the metrics tells the business story.
    - Use .metric-value's red colour naturally — it signals cost.
  ============================================================ -->
<section
  data-background-gradient="linear-gradient(135deg, #1a0000 0%, #2d0a0a 100%)"
>
  <h2>Impact</h2>

  <div class="metrics-row" style="margin-top: 1em;">
    <div class="metric">
      <span class="metric-value">8.2s</span>
      <span class="metric-label">P95 Response Time</span>
    </div>
    <div class="metric">
      <span class="metric-value">N+1</span>
      <span class="metric-label">DB Queries per Request</span>
    </div>
    <div class="metric">
      <span class="metric-value">~200</span>
      <span class="metric-label">Extra Queries (100 posts)</span>
    </div>
  </div>

  <p style="margin-top: 1.2em; font-size: 0.9em; color: var(--os-text-muted);">
    With 100 published posts, every homepage load fired <strong style="color:var(--os-accent-light);">201 database queries</strong>
    instead of 1. Traffic spikes caused cascading connection pool exhaustion,
    taking down the recommendations sidebar and the search index writer.
  </p>

  <div class="highlight-box-danger" style="margin-top: 0.75em; font-size: 0.85em;">
    <strong>Business cost:</strong> Est. 14 % drop in session duration during the 4-hour degradation window.
    Two enterprise trial customers churned the same week.
  </div>
</section>

---

<!-- ============================================================
  SLIDE 4 — ROOT CAUSE
  PURPOSE: Diagnosis. Show THE BAD CODE. This is the moment of
           recognition for the audience — "oh, that's why."
  CUSTOMIZE:
    - Replace the code block with your actual bad code.
    - data-id="bad-code" is critical: it pairs with slide 5 and
      slide 7 for auto-animate morphing. Keep it consistent.
    - The comment arrows in the code highlight the exact culprit.
    - Keep code short enough to be readable at presentation size.
  ============================================================ -->
<section
  data-auto-animate
  data-background-gradient="linear-gradient(135deg, #0f172a 0%, #1e0a0a 100%)"
>
  <h2>Root Cause</h2>
  <span class="tag tag-danger">N+1 Queries</span>

  <pre data-id="bad-code"><code class="language-typescript" data-trim>
// ❌  Fetching posts — looks innocent, right?
async function getPostsWithAuthors() {
  const posts = await prisma.post.findMany(); // 1 query

  for (const post of posts) {
    post.author = await prisma.user.findUnique({  // ← N queries
      where: { id: post.authorId },               //   (one per post!)
    });
  }

  return posts;
}
  </code></pre>

  <p style="font-size: 0.85em; color: var(--os-text-muted); margin-top: 0.9em;">
    The loop looks harmless. But every <code>await prisma.user.findUnique(…)</code>
    is a <em>synchronous round-trip to the database</em>.
    With 100 posts → 101 queries. With 500 posts → 501 queries.
  </p>
</section>

---

<!-- ============================================================
  SLIDE 5 — ROOT CAUSE DEEP DIVE (auto-animate from slide 4)
  PURPOSE: Zoom in on the exact line that causes the problem.
           The auto-animate + matching data-id="bad-code" makes
           the code block appear to "zoom" or "morph" from slide 4.
  CUSTOMIZE:
    - The <mark> tag (or a <span> with highlight style) on the
      offending line draws the eye to the culprit.
    - Adjust the annotation arrows to match your bad line.
    - Keep h2 text the same or very similar for a smooth morph.
  ============================================================ -->
<section
  data-auto-animate
  data-background-gradient="linear-gradient(135deg, #0f172a 0%, #1e0a0a 100%)"
>
  <h2>Root Cause — Deep Dive</h2>

  <pre data-id="bad-code"><code class="language-typescript" data-trim data-line-numbers="6-8">
// ❌  Fetching posts — looks innocent, right?
async function getPostsWithAuthors() {
  const posts = await prisma.post.findMany(); // 1 query

  for (const post of posts) {
    post.author = await prisma.user.findUnique({  // ◄── HERE
      where: { id: post.authorId },               //  1 query × N posts
    });                                           //  = N extra queries
  }

  return posts;
}
  </code></pre>

  <div class="highlight-box-danger" style="font-size: 0.82em; margin-top: 0.75em;">
    <strong>The mechanism:</strong> The ORM does not know you will need authors. 
    It fetches posts lazily. Inside the loop, each <code>findUnique</code> 
    opens a new connection, executes, and closes — sequentially — 
    before the next iteration starts.
  </div>
</section>

---

<!-- ============================================================
  SLIDE 6 — THE FIX: APPROACH
  PURPOSE: Transition to the solution. The background shifts from
           dark red → dark blue/neutral to signal the turn.
           This slide covers STRATEGY, not code yet.
  CUSTOMIZE:
    - List the high-level approach before showing code.
    - Fragment reveals build tension: each step appears on click.
    - If your fix has multiple phases (short-term hotfix + long-term
      refactor), use two fragment groups.
  ============================================================ -->
<section
  data-background-gradient="linear-gradient(135deg, #0f172a 0%, #1e293b 100%)"
>
  <h2>The Fix — Approach</h2>
  <span class="tag tag-primary">Strategy</span>

  <p style="margin-top: 0.8em;">
    The fix is to tell the ORM about the relationship <em>before</em> the query executes,
    so it can join the data in a single SQL statement.
  </p>

  <ul>
    <li class="fragment">
      <strong>Use eager loading</strong> via Prisma's <code>include</code> option
      (or TypeORM's <code>relations</code> array) to JOIN authors in one query
    </li>
    <li class="fragment">
      <strong>Eliminate the loop</strong> — the ORM now returns posts with
      <code>author</code> already populated
    </li>
    <li class="fragment">
      <strong>Add a query-count assertion</strong> in tests using
      <code>prisma.$on('query', …)</code> to prevent regression
    </li>
    <li class="fragment">
      <strong>Enable query logging</strong> in staging so N+1 patterns
      surface before production deploy
    </li>
  </ul>
</section>

---

<!-- ============================================================
  SLIDE 7 — IMPLEMENTATION (before/after with two-column layout)
  PURPOSE: Show the code fix. Two-column before/after is maximally
           clear for an audience scanning quickly.
  CUSTOMIZE:
    - Left column = bad code (trimmed). Right column = fixed code.
    - The data-id="bad-code" on the left pre links back to slides
      4 and 5 via auto-animate if you add data-auto-animate to
      this <section> tag (optional — depends on your flow).
    - Use data-line-numbers on the right <code> to highlight the
      key change (the `include` line).
    - Adjust language tag for your stack (e.g., language-java,
      language-python, language-go).
  ============================================================ -->
<section
  data-background-gradient="linear-gradient(135deg, #0f172a 0%, #001a0a 100%)"
>
  <h2>Implementation</h2>

  <div class="two-column">
    <div>
      <p class="col-label bad">Before (N+1)</p>
      <pre data-id="bad-code"><code class="language-typescript" data-trim style="font-size:0.72em;">
async function getPostsWithAuthors() {
  const posts =
    await prisma.post.findMany();

  for (const post of posts) {
    post.author =
      await prisma.user.findUnique({
        where: { id: post.authorId },
      });
  }
  return posts;
}
      </code></pre>
    </div>

    <div>
      <p class="col-label good">After (1 Query)</p>
      <pre><code class="language-typescript" data-trim data-line-numbers="3-5" style="font-size:0.72em;">
async function getPostsWithAuthors() {
  return prisma.post.findMany({
    include: {
      author: true,   // ← one JOIN
    },
  });
  // No loop. No extra queries.
  // posts[0].author is populated.
}
      </code></pre>
    </div>
  </div>

  <p style="font-size:0.78em; color: var(--os-text-muted); margin-top: 0.75em;">
    Prisma translates <code>include: { author: true }</code> into a single
    <code>LEFT JOIN users ON posts.author_id = users.id</code>.
    201 round-trips become 1.
  </p>
</section>

---

<!-- ============================================================
  SLIDE 8 — AFTER THE FIX
  PURPOSE: The payoff. Green background = success signal.
           Mirror the impact slide's metrics, now showing improvement.
  CUSTOMIZE:
    - Use .metric.metric-success for the green number styling.
    - Match the exact same metric labels as slide 3 for visual continuity.
    - Add a quote from a stakeholder or support ticket closure if you have one.
  ============================================================ -->
<section
  data-background-gradient="linear-gradient(135deg, #001a00 0%, #003b00 100%)"
>
  <h2>After the Fix</h2>
  <span class="tag tag-success">Resolved</span>

  <div class="metrics-row" style="margin-top: 1em;">
    <div class="metric metric-success">
      <span class="metric-value">48ms</span>
      <span class="metric-label">P95 Response Time</span>
    </div>
    <div class="metric metric-success">
      <span class="metric-value">1</span>
      <span class="metric-label">DB Query per Request</span>
    </div>
    <div class="metric metric-success">
      <span class="metric-value">−99%</span>
      <span class="metric-label">DB CPU Load</span>
    </div>
  </div>

  <blockquote style="margin-top: 1.2em; font-size: 0.88em; border-left-color: var(--os-success);">
    "Homepage loads instantly now. Whatever you did — thank you."<br>
    <span style="font-size:0.85em; color: var(--os-text-muted);">— Support ticket closure, same day as deploy</span>
  </blockquote>

  <p style="font-size: 0.82em; color: var(--os-text-muted); margin-top: 0.5em;">
    Deploy took 3 minutes. Rollback risk: zero (additive ORM option only).
    Response time improvement held under 10× load test traffic.
  </p>
</section>

---

<!-- ============================================================
  SLIDE 9 — WHAT WE LEARNED
  PURPOSE: The actual lessons — honest, specific, actionable.
           Fragment reveals let you discuss each lesson before
           the next appears. Avoid generic platitudes.
  CUSTOMIZE:
    - 4–6 lessons is ideal. More than 6 loses the audience.
    - Lead with the most surprising or counterintuitive lesson.
    - Use <strong> to make the one-liner memorable; the rest is detail.
  ============================================================ -->
<section
  data-background-gradient="linear-gradient(135deg, #0f172a 0%, #1e293b 100%)"
>
  <h2>What We Learned</h2>

  <ul>
    <li class="fragment">
      <strong>ORMs abstract SQL, not performance.</strong>
      A loop with awaits is never free — count your queries.
    </li>
    <li class="fragment">
      <strong>Linear slowdowns are the most dangerous kind.</strong>
      They pass all tests on small fixtures and only appear in production.
    </li>
    <li class="fragment">
      <strong>Code review doesn't catch what you don't look for.</strong>
      We need a query-count linter, not just a second pair of eyes.
    </li>
    <li class="fragment">
      <strong>Staging needs realistic data volumes.</strong>
      Our staging DB had 8 posts. Production had 240.
    </li>
    <li class="fragment">
      <strong>Eager loading is not a premature optimisation.</strong>
      It should be the default when traversing relations.
    </li>
  </ul>
</section>

---

<!-- ============================================================
  SLIDE 10 — PREVENTION
  PURPOSE: Close the loop. What changes will stop this happening again?
           Be concrete: tools, process steps, code rules.
           A checklist format is immediately actionable.
  CUSTOMIZE:
    - Each checkbox item should be ownable by a specific role.
    - Fragment reveals let you walk through commitments one by one.
    - Link to the actual ADR, ticket, or PR if presenting async.
  ============================================================ -->
<section
  data-background-gradient="linear-gradient(135deg, #0f172a 0%, #1e293b 100%)"
>
  <h2>Prevention</h2>
  <span class="tag tag-primary">Action Items</span>

  <table style="margin-top: 1em; font-size: 0.82em;">
    <thead>
      <tr>
        <th>Action</th>
        <th>Owner</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      <tr class="fragment">
        <td>Add query-count assertions to all list endpoint tests</td>
        <td>Backend Guild</td>
        <td><span class="tag tag-success">Done</span></td>
      </tr>
      <tr class="fragment">
        <td>Enable <code>DEBUG=prisma:query</code> in staging CI</td>
        <td>Platform</td>
        <td><span class="tag tag-warning">In Progress</span></td>
      </tr>
      <tr class="fragment">
        <td>Add eslint-plugin-prisma rule: no <code>findUnique</code> inside loops</td>
        <td>[Assignee]</td>
        <td><span class="tag">Planned</span></td>
      </tr>
      <tr class="fragment">
        <td>Seed staging DB with production-scale fixtures (≥500 records)</td>
        <td>DevOps</td>
        <td><span class="tag">Planned</span></td>
      </tr>
      <tr class="fragment">
        <td>Add N+1 section to ORM onboarding guide</td>
        <td>Docs</td>
        <td><span class="tag">Planned</span></td>
      </tr>
    </tbody>
  </table>
</section>

---

<!-- ============================================================
  APPENDIX / OPTIONAL SLIDES
  Everything below this line is extra material — use as backup
  for Q&A or drop entirely. Not shown in the default flow.
  ============================================================ -->

<!-- ============================================================
  OPTIONAL: SQL COMPARISON SLIDE
  PURPOSE: Show the actual SQL diff for technical audiences who
           want to see exactly what changed at the database level.
  HOW TO ACTIVATE: Remove the HTML comment wrapper.
  ============================================================ -->
<!--
<section data-background-gradient="linear-gradient(135deg, #0f172a 0%, #1e293b 100%)">
  <h2>The SQL Difference</h2>

  <div class="two-column">
    <div>
      <p class="col-label bad">201 Queries (Before)</p>
      <pre><code class="language-sql" data-trim style="font-size:0.7em;">
SELECT * FROM posts;

SELECT * FROM users WHERE id = 1;
SELECT * FROM users WHERE id = 2;
SELECT * FROM users WHERE id = 3;
-- ... × N posts
      </code></pre>
    </div>
    <div>
      <p class="col-label good">1 Query (After)</p>
      <pre><code class="language-sql" data-trim style="font-size:0.7em;">
SELECT
  posts.*,
  users.*
FROM posts
LEFT JOIN users
  ON posts.author_id = users.id;
      </code></pre>
    </div>
  </div>
</section>
-->

<!-- ============================================================
  OPTIONAL: TIMELINE SLIDE
  PURPOSE: Show the incident timeline for postmortem audiences.
  HOW TO ACTIVATE: Remove the HTML comment wrapper and fill in times.
  ============================================================ -->
<!--
<section data-background-gradient="linear-gradient(135deg, #0f172a 0%, #1e293b 100%)">
  <h2>Incident Timeline</h2>

  <table style="font-size:0.8em; margin-top:0.75em;">
    <thead>
      <tr><th>Time (UTC)</th><th>Event</th><th>Who</th></tr>
    </thead>
    <tbody>
      <tr><td>14:02</td><td>v3.4 deployed to production</td><td>CI/CD</td></tr>
      <tr><td>14:09</td><td>P95 latency alert fired (>3 s threshold)</td><td>PagerDuty</td></tr>
      <tr><td>14:15</td><td>First customer support ticket received</td><td>Support</td></tr>
      <tr><td>14:28</td><td>Root cause identified via query log</td><td>On-call engineer</td></tr>
      <tr><td>14:41</td><td>Fix merged and deployed</td><td>On-call engineer</td></tr>
      <tr><td>14:44</td><td>Latency returned to baseline</td><td>Monitoring</td></tr>
    </tbody>
  </table>
</section>
-->
