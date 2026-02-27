---
title: "Pinecone vs Weaviate vs pgvector"
theme: white
transition: slide
controls: true
progress: true
slideNumber: "c/t"
---

<!-- .slide: data-background-image="design/assets/images/geometry-abstract-divider.jpg" data-background-opacity="0.2" data-background-gradient="linear-gradient(135deg, #fff7ed 0%, #fef3c7 50%, #fdf2f8 100%)" -->

# Pinecone vs Weaviate vs pgvector

<div style="height: 5px; width: 140px; background: linear-gradient(90deg, #f97316, #f59e0b); border-radius: 3px; margin: 0.6em 0 1em;"></div>

<p style="font-size: 0.85em; color: #6b6b7b; max-width: 700px;">After this: you'll know which vector database fits your stack — managed simplicity, open-source flexibility, or zero-new-infra pragmatism.</p>

<br>

<span class="tag tag-primary">Vector Search</span>
<span class="tag tag-success">AI Infrastructure</span>
<span class="tag tag-primary">Database</span>

Note:
Welcome. This deck compares three production-ready vector database options. We'll evaluate each fairly on its own merits before drilling into decision criteria and making a recommendation for a team with an existing Postgres stack and sub-10M vector workload. If your constraints differ, the recommendation may change — we'll make those inflection points explicit.

---

<!-- .slide: data-background-color="#fdfaf6" -->

## Vector Retrieval Flow

<img src="design/assets/diagrams/vector-db-flow.svg" style="width: 90%; border-radius: 14px; box-shadow: 0 10px 24px rgba(26, 26, 46, 0.12);">

Note: Show the minimal flow once so the rest of the options are grounded in the same pipeline.

---

<!-- .slide: data-background-color="#fdfaf6" -->

## How Vector Search Works

<div style="display: flex; gap: 1.5em; align-items: center;">
  <div style="flex: 1; font-size: 0.8em;">
    <p>Vectors are embedded representations of data. Similarity search finds nearest neighbors.</p>
  </div>
  <div style="flex: 1;">
    <img src="design/assets/diagrams/vector-db-flow.svg"
         style="width: 100%; max-height: 40vh; object-fit: contain;">
  </div>
</div>

---

<!-- .slide: data-background-color="#fdfaf6" -->

## The Problem We're Solving

<div class="two-column">
<div>

**Situation**

- Building an AI app that needs semantic/similarity search
- Embedding model produces 1536-dim vectors per document
- Users expect sub-100ms query latency at any scale
- Current data already lives in Postgres — moving it is costly

</div>
<div>

**Constraints**

- Small team (2–5 engineers), limited ops bandwidth
- Budget-conscious: vendor lock-in risk matters
- Existing Postgres infra — zero-new-infra is a real option
- Operational complexity tolerance is low at current stage

</div>
</div>

<br>

> "The right choice depends on your constraints — keep these in view."

Note:
Read each constraint aloud before moving on. These are the lens through which every option is evaluated. If someone in the audience has a different context — larger team, cloud-native budget, 100M+ vectors — flag it early. The recommendation will differ for them.

---

<!-- .slide: data-background-color="#fdfaf6" -->

## Option 1: Pinecone

<div class="two-column">
<div>

<div class="identity-card">
<div class="identity-card-accent"></div>
<h3 style="margin-top: 0.5em; margin-bottom: 0.2em;">Pinecone</h3>
<p style="font-size: 0.78em; color: #6b6b7b; margin: 0 0 0.8em;">Managed, serverless vector DB</p>
<p style="font-size: 0.78em; color: #1a1a2e; line-height: 1.6;">Purpose-built for ANN search. Zero infrastructure, fully managed indexes, horizontal scale with a single API call.</p>
</div>

<br>

**When it shines**
- Rapid prototyping to production
- No in-house ML infra team
- Need for instant scale without ops

<br>

<span class="tag tag-primary">Managed</span>
<span class="tag tag-warning">Proprietary</span>

</div>
<div>

**Pros**
- Zero operational burden — no servers to manage
- Purpose-built ANN with HNSW, sub-10ms queries at scale
- Metadata filtering built-in, performant at large scale
- SDKs for Python, JS/TS, Go — ergonomic developer UX

**Cons**
- Vendor lock-in: no export path, no self-host option
- Cost scales with vector count and query volume
- Data leaves your infrastructure (compliance concern)
- Limited query flexibility vs. full-featured DBs

</div>
</div>

Note:
Pinecone is the "just works" option. For teams that want to ship fast and have budget for managed services, it's genuinely excellent. The two watch-outs are vendor lock-in and data residency. If either of those is a hard requirement, Pinecone is off the table immediately.

---

<!-- .slide: data-background-color="#fdfaf6" -->

## Option 2: Weaviate

<div class="two-column">
<div>

<div class="identity-card">
<div class="identity-card-accent" style="background: var(--geo-teal);"></div>
<h3 style="margin-top: 0.5em; margin-bottom: 0.2em;">Weaviate</h3>
<p style="font-size: 0.78em; color: #6b6b7b; margin: 0 0 0.8em;">Open-source, graph-aware vector DB</p>
<p style="font-size: 0.78em; color: #1a1a2e; line-height: 1.6;">Combines vector search with object storage and a GraphQL API. Self-hosted or Weaviate Cloud (WCS). Built-in vectorizer modules.</p>
</div>

<br>

**When it shines**
- Hybrid search (vector + BM25 keyword)
- Multi-modal embeddings (text + image)
- Need for object storage alongside vectors

<br>

<span class="tag tag-success">Open Source</span>
<span class="tag tag-primary">Self-hosted option</span>

</div>
<div>

**Pros**
- True hybrid search: dense + sparse (BM25) in one query
- Built-in vectorizer modules (OpenAI, Cohere, Transformers)
- GraphQL + REST APIs, rich filtering on object properties
- Self-host on any infra or use Weaviate Cloud

**Cons**
- Operational complexity if self-hosted (Kubernetes recommended)
- Memory-heavy: entire HNSW index loaded into RAM
- GraphQL API has a learning curve vs. SQL
- Multi-tenancy at scale requires careful schema design

</div>
</div>

Note:
Weaviate shines when you need more than pure vector retrieval — hybrid search, multi-modal, or rich object graphs. The cost is operational complexity for self-hosting. Weaviate Cloud removes that burden but reintroduces a managed dependency. For teams building RAG pipelines with mixed keyword + semantic queries, Weaviate's hybrid search is genuinely hard to beat.

---

<!-- .slide: data-background-color="#fdfaf6" -->

## Option 3: pgvector

<div class="two-column">
<div>

<div class="identity-card">
<div class="identity-card-accent" style="background: var(--geo-amber);"></div>
<h3 style="margin-top: 0.5em; margin-bottom: 0.2em;">pgvector</h3>
<p style="font-size: 0.78em; color: #6b6b7b; margin: 0 0 0.8em;">Postgres extension — vector search where your data already lives</p>
<p style="font-size: 0.78em; color: #1a1a2e; line-height: 1.6;">Adds a <code>vector</code> type and ANN index (HNSW/IVFFlat) to Postgres. No new service, no new data pipeline.</p>
</div>

<br>

**When it shines**
- Data already in Postgres (avoid ETL cost)
- Team knows SQL — no new query language
- <10M vectors, moderate QPS requirements

<br>

<span class="tag tag-success">Zero new infra</span>
<span class="tag tag-warning">Limited scale</span>

</div>
<div>

**Pros**
- Lives in existing Postgres — no new service or ops
- Full SQL expressiveness: JOINs, transactions, ACLs
- HNSW index (pgvector ≥0.5) gives real ANN performance
- Managed via any Postgres provider (RDS, Supabase, Neon)

**Cons**
- Scale ceiling: performance degrades past ~5–10M vectors
- HNSW index built in memory — RAM pressure on large sets
- No built-in vectorizer: embeddings must be pre-computed
- Not purpose-built for ANN — tuning is manual

</div>
</div>

Note:
pgvector is the pragmatist's choice. If you already run Postgres, you can ship vector search today without adding a new service, a new deployment pipeline, or a new monitoring story. The catch is scale: at 10M+ vectors or high QPS, dedicated vector DBs will outperform pgvector meaningfully. Know your scale before committing.

---

<!-- .slide: data-background-color="#fdfaf6" -->

## Head-to-Head Comparison

<table class="comparison-table">
<thead>
<tr>
  <th>Criterion</th>
  <th>Pinecone</th>
  <th>Weaviate</th>
  <th>pgvector</th>
</tr>
</thead>
<tbody>
<tr>
  <td><strong>Setup time</strong></td>
  <td class="winner">Minutes (managed)</td>
  <td class="tie">Hours (Cloud) / Days (self-host)</td>
  <td class="winner">Minutes (extension)</td>
</tr>
<tr>
  <td><strong>Operational overhead</strong></td>
  <td class="winner">None</td>
  <td class="loser">High (self-host)</td>
  <td class="winner">Postgres-only</td>
</tr>
<tr>
  <td><strong>Scale ceiling</strong></td>
  <td class="winner">Billions of vectors</td>
  <td class="winner">100M+ (self-host)</td>
  <td class="loser">~5–10M vectors</td>
</tr>
<tr>
  <td><strong>Query speed (ANN)</strong></td>
  <td class="winner">Sub-10ms (managed)</td>
  <td class="tie">Fast (tunable)</td>
  <td class="tie">Good (HNSW ≥0.5)</td>
</tr>
<tr>
  <td><strong>Filtering on metadata</strong></td>
  <td class="winner">Built-in, fast</td>
  <td class="winner">GraphQL + BM25 hybrid</td>
  <td class="winner">Full SQL WHERE</td>
</tr>
<tr>
  <td><strong>Cost model</strong></td>
  <td class="loser">Usage-based, grows fast</td>
  <td class="tie">Free self-host / WCS paid</td>
  <td class="winner">Postgres instance only</td>
</tr>
<tr>
  <td><strong>Multi-modal support</strong></td>
  <td class="loser">Text/image (limited)</td>
  <td class="winner">Text, image, audio</td>
  <td class="loser">Manual (any vector)</td>
</tr>
<tr>
  <td><strong>Existing Postgres fit</strong></td>
  <td class="loser">Separate service needed</td>
  <td class="loser">Separate service needed</td>
  <td class="winner">Native Postgres</td>
</tr>
</tbody>
</table>

Note:
Walk through each row. Note that Pinecone wins on scale and ops simplicity, Weaviate wins on multi-modal and hybrid search, and pgvector wins on cost and Postgres fit. No single option dominates — the recommendation comes from filtering through our specific constraints on the next slide.

---

<!-- .slide: data-background-color="#fdfaf6" -->

## Trade-off Radar (Ops vs Scale vs Flexibility)

<div style="display: flex; justify-content: center; gap: 1.6em; margin-top: 1em;">
  <div style="flex: 1; min-width: 240px;">
    <div style="font-size: 0.7em; color: #6b6b7b; text-align: center; margin-bottom: 0.4em;">Low Ops → High Ops</div>
    <div style="height: 12px; background: linear-gradient(90deg, #f97316, #f59e0b); border-radius: 999px;"></div>
  </div>
  <div style="flex: 1; min-width: 240px;">
    <div style="font-size: 0.7em; color: #6b6b7b; text-align: center; margin-bottom: 0.4em;">Low Scale → Massive Scale</div>
    <div style="height: 12px; background: linear-gradient(90deg, #0f766e, #14b8a6); border-radius: 999px;"></div>
  </div>
  <div style="flex: 1; min-width: 240px;">
    <div style="font-size: 0.7em; color: #6b6b7b; text-align: center; margin-bottom: 0.4em;">Low Flex → High Flex</div>
    <div style="height: 12px; background: linear-gradient(90deg, #e11d48, #f97316); border-radius: 999px;"></div>
  </div>
</div>

<div style="display: flex; gap: 1.6em; margin-top: 1.2em;">
  <div style="flex: 1; background: #fff7ed; border: 1px solid #e5e0d8; border-radius: 10px; padding: 0.8em;">
    <strong>Pinecone</strong>
    <p style="font-size: 0.72em; color: #6b6b7b; margin: 0.3em 0;">Low ops, massive scale, mid flexibility.</p>
  </div>
  <div style="flex: 1; background: #fff7ed; border: 1px solid #e5e0d8; border-radius: 10px; padding: 0.8em;">
    <strong>Weaviate</strong>
    <p style="font-size: 0.72em; color: #6b6b7b; margin: 0.3em 0;">Higher ops, high scale, high flexibility.</p>
  </div>
  <div style="flex: 1; background: #fff7ed; border: 1px solid #e5e0d8; border-radius: 10px; padding: 0.8em;">
    <strong>pgvector</strong>
    <p style="font-size: 0.72em; color: #6b6b7b; margin: 0.3em 0;">Lowest ops, mid scale, high SQL flexibility.</p>
  </div>
</div>

Note: This is the visual distillation — show the three axes and where each option sits.

---

<!-- .slide: data-background-color="#fdfaf6" -->

## Capability Comparison

<canvas id="radar-chart" style="max-height: 45vh;"></canvas>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script>
new Chart(document.getElementById('radar-chart'), {
  type: 'radar',
  data: {
    labels: ['Query Speed','Scalability','Filtering','Ecosystem','Cost'],
    datasets: [
      { label: 'Pinecone', data: [9,9,7,8,5], borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.2)' },
      { label: 'Weaviate', data: [7,8,9,7,8], borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.2)' },
      { label: 'pgvector', data: [6,6,8,9,10], borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.2)' }
    ]
  },
  options: { responsive: true,
    plugins: { legend: { labels: { color: '#e2e8f0' } } },
    scales: { r: { ticks: { color: '#94a3b8', backdropColor: 'transparent' },
                   grid: { color: '#334155' }, pointLabels: { color: '#e2e8f0' } } } }
});
</script>

---

<!-- .slide: data-background-color="#fdfaf6" -->

## Decision Criteria

<div class="two-column" style="font-size: 0.82em;">
<div>

<div class="decision-box">
<strong>Choose Pinecone when...</strong>

- Vector count will exceed 10M
<!-- .element: class="fragment fade-up" -->
- Zero ops tolerance is non-negotiable
<!-- .element: class="fragment fade-up" -->
- Budget exists for managed vendor pricing
<!-- .element: class="fragment fade-up" -->
- Data residency / compliance is not a blocker
<!-- .element: class="fragment fade-up" -->

</div>

<br>

<div class="decision-box">
<strong>Choose Weaviate when...</strong>

- Hybrid search (vector + keyword) is required
<!-- .element: class="fragment fade-up" -->
- Multi-modal embeddings (image, audio) needed
<!-- .element: class="fragment fade-up" -->
- Team has Kubernetes infra already running
<!-- .element: class="fragment fade-up" -->

</div>

</div>
<div>

<div class="decision-box">
<strong>Choose pgvector when...</strong>

- Data already lives in Postgres
<!-- .element: class="fragment fade-up" -->
- Vector count stays under 5–10M
<!-- .element: class="fragment fade-up" -->
- Team knows SQL, no new query language budget
<!-- .element: class="fragment fade-up" -->
- Operational simplicity is the top priority
<!-- .element: class="fragment fade-up" -->

</div>

<br>

> **Our situation:** Small team, existing Postgres, <5M vectors, no Kubernetes. pgvector fits all four criteria.
<!-- .element: class="fragment fade-up" -->

</div>
</div>

Note:
Let each fragment land. Ask: "Does anyone weigh these differently?" If the audience has a 50M vector requirement or needs hybrid BM25 search, the decision flips to Weaviate or Pinecone. The framework here is durable even when the recommendation changes.

---

<!-- .slide: data-background-gradient="linear-gradient(135deg, #fff7ed 0%, #fef3c7 50%, #fdf2f8 100%)" -->

## The Recommendation

<br>

<div style="text-align: center; margin: 1em 0;">
  <div class="metric">
    <span class="metric-value gradient-text">pgvector</span>
    <span class="metric-label">Recommended for our context</span>
  </div>
</div>

<br>

<div class="two-column" style="font-size: 0.78em; margin-top: 0.5em;">
<div>

**Why it wins here**

- <span class="tag tag-success">Zero new infra</span> No new service, deployment pipeline, or on-call rotation
- <span class="tag tag-success">SQL native</span> Full JOIN and transaction support where our data lives
- <span class="tag tag-primary">HNSW ANN</span> Real approximate nearest-neighbour since pgvector 0.5
- <span class="tag tag-warning">Scale budget</span> 5M vectors comfortably — beyond that, we have a migration plan

</div>
<div>

**Confidence boosters**

- Supabase, Neon, RDS all support pgvector — managed Postgres options abound
- No embedding pipeline changes required — store vectors in the same DB
- Monitoring and backups: same tooling we already have
- If we outgrow it, the migration path is clear (see next slide)

</div>
</div>

Note:
This is the payoff. The recommendation follows directly from the criteria we agreed on in the previous slide. If someone disagrees, redirect to the decision criteria slide — the disagreement belongs there. Emphasize that this isn't "pgvector forever" — it's "pgvector until we have evidence we need more."

---

<!-- .slide: data-background-color="#fdfaf6" -->

## Migration Path

<p style="font-size: 0.82em; color: #6b6b7b;">If we outgrow pgvector — here's the decision ladder.</p>

<div class="two-column" style="font-size: 0.8em;">
<div>

<div class="identity-card">
<div class="identity-card-accent"></div>
<h3 style="margin-top: 0.5em;">Stage 1: pgvector</h3>
<p style="font-size: 0.85em; color: #1a1a2e;">Start here. Embeddings in Postgres, HNSW index, full SQL filtering. Good for 0–5M vectors.</p>
</div>

**Stay here while:**
- Vector count < 5M
<!-- .element: class="fragment fade-up" -->
- P95 query latency < 80ms
<!-- .element: class="fragment fade-up" -->
- No hybrid BM25 search needed
<!-- .element: class="fragment fade-up" -->

</div>
<div>

<div class="identity-card" style="border-top: 3px solid var(--geo-teal);">
<div class="identity-card-accent" style="background: var(--geo-teal);"></div>
<h3 style="margin-top: 0.5em;">Stage 2: Weaviate or Pinecone</h3>
<p style="font-size: 0.85em; color: #1a1a2e;">Migrate when pgvector's limits become measurable. Weaviate for hybrid search; Pinecone for pure scale.</p>
</div>

**Switch when:**
- Vector count crosses 5M
<!-- .element: class="fragment fade-up" -->
- Need hybrid search (BM25 + vector)
<!-- .element: class="fragment fade-up" -->
- Query latency becomes critical SLA
<!-- .element: class="fragment fade-up" -->

</div>
</div>

Note:
This slide neutralises the "but what if we need to scale?" objection. The migration is well-understood: export embeddings from Postgres, re-index in Weaviate or Pinecone, redirect queries. The key insight is that pgvector is not a dead-end — it buys us time and learning before committing to a more complex stack.

---

<!-- .slide: data-background-color="#fdfaf6" -->

## Next Steps

<br>

<ol class="steps-list">
  <li><strong>Install pgvector</strong> — <code>CREATE EXTENSION vector;</code> in your Postgres database (or enable via Supabase/Neon dashboard)</li>
  <li><strong>Build the embedding pipeline</strong> — add an embeddings column (<code>vector(1536)</code>) to your target table and backfill with your chosen embedding model</li>
  <li><strong>Benchmark at target scale</strong> — generate a representative dataset, build the HNSW index (<code>CREATE INDEX ... USING hnsw</code>), and measure P95 query latency</li>
  <li><strong>Set a migration trigger</strong> — agree on the metrics that will prompt a re-evaluation: vector count threshold (5M), latency SLA breach, or hybrid search requirement</li>
</ol>

<br>

<p style="text-align: center; font-size: 0.68em; color: #6b6b7b;">Questions? · Objections? · Edge cases? → Now is the time.</p>

Note:
Close with action. Step 1 and 2 are doable this sprint. Step 3 should happen before we hit production traffic. Step 4 is a team agreement — put it in an ADR so future engineers understand the decision boundary. If there are unresolved objections, capture them now and reflect them in the architecture decision record.

---

<!-- ══════════════════════════════════════════════════════════════
     GEOMETRY WARM THEME — CSS
     IMPORTANT: This block MUST remain at the END of the file.
     Placing <style> before the first slide separator creates an
     empty first slide and breaks the presentation structure.
     ══════════════════════════════════════════════════════════════ -->
<style>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

/* ── Color Tokens ─────────────────────────────────────────────── */
:root {
  --geo-bg:         #fdfaf6;
  --geo-surface:    #fff7ed;
  --geo-border:     #e5e0d8;
  --geo-text:       #1a1a2e;
  --geo-muted:      #6b6b7b;
  --geo-orange:     #f97316;
  --geo-amber:      #f59e0b;
  --geo-teal:       #0f766e;
  --geo-teal-light: #14b8a6;
  --geo-rose:       #e11d48;
  --geo-font-head:  'Outfit', 'DM Sans', 'Inter', sans-serif;
  --geo-font-body:  'Inter', system-ui, -apple-system, sans-serif;
  --geo-font-mono:  'JetBrains Mono', 'Fira Code', Consolas, 'Courier New', monospace;

  /* RevealJS overrides */
  --r-background-color: var(--geo-bg);
  --r-main-color:       var(--geo-text);
  --r-heading-color:    var(--geo-text);
  --r-main-font:        var(--geo-font-body);
  --r-heading-font:     var(--geo-font-head);
  --r-code-font:        var(--geo-font-mono);
  --r-main-font-size:   28px;
}

/* ── Base ────────────────────────────────────────────────────── */
.reveal {
  font-family: var(--geo-font-body);
  font-size: 28px;
  color: var(--geo-text);
  background: var(--geo-bg);
}

.reveal .slides {
  text-align: left;
}

.reveal .slides section {
  padding: 40px 64px;
}

/* ── Progress Bar ─────────────────────────────────────────────── */
.reveal .progress {
  color: var(--geo-orange);
}

/* ── Slide Number ─────────────────────────────────────────────── */
.reveal .slide-number {
  background: var(--geo-surface);
  color: var(--geo-muted);
  font-family: var(--geo-font-head);
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 4px 0 0 0;
  border-top: 1px solid var(--geo-border);
  border-left: 1px solid var(--geo-border);
}

/* ── Headings ─────────────────────────────────────────────────── */
.reveal h1,
.reveal h2,
.reveal h3,
.reveal h4 {
  text-transform: none;
  letter-spacing: -0.02em;
  line-height: 1.15;
}

.reveal h1 {
  font-family: var(--geo-font-head);
  font-size: 3.2em;
  font-weight: 800;
  color: var(--geo-text);
  margin-bottom: 0.2em;
}

.reveal h1::after {
  content: '';
  display: block;
  height: 4px;
  width: 64px;
  background: linear-gradient(90deg, var(--geo-orange), var(--geo-amber));
  border-radius: 2px;
  margin-top: 0.35em;
}

.reveal h2 {
  font-family: var(--geo-font-head);
  font-size: 2em;
  font-weight: 700;
  color: var(--geo-text);
  margin-bottom: 0.4em;
  padding-bottom: 0.25em;
  border-bottom: 2px solid var(--geo-orange);
}

.reveal h3 {
  font-family: var(--geo-font-head);
  font-size: 1.3em;
  font-weight: 700;
  color: var(--geo-teal);
  margin-bottom: 0.4em;
}

.reveal h4 {
  font-family: var(--geo-font-head);
  font-size: 0.8em;
  font-weight: 600;
  color: var(--geo-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 1em;
}

/* ── Body Text ────────────────────────────────────────────────── */
.reveal p {
  font-size: 1em;
  line-height: 1.7;
  color: var(--geo-text);
  margin-bottom: 0.8em;
}

/* ── Inline Code ──────────────────────────────────────────────── */
.reveal code {
  font-family: var(--geo-font-mono);
  font-size: 0.83em;
  background: rgba(15, 118, 110, 0.08);
  padding: 0.15em 0.5em;
  border-radius: 4px;
  color: var(--geo-teal);
  border: 1px solid rgba(15, 118, 110, 0.2);
}

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
  margin-bottom: 0.55em;
  color: var(--geo-text);
}

.reveal ul li::before {
  content: '◆';
  position: absolute;
  left: 0;
  color: var(--geo-orange);
  font-size: 0.6em;
  top: 0.4em;
}

/* ── Steps List ───────────────────────────────────────────────── */
.steps-list {
  counter-reset: steps-counter;
  list-style: none;
  padding-left: 0;
  margin: 0;
  font-size: 0.84em;
  line-height: 1.6;
}

.steps-list li {
  counter-increment: steps-counter;
  position: relative;
  padding-left: 3em;
  margin-bottom: 0.9em;
  color: var(--geo-text);
}

.steps-list li::before {
  content: counter(steps-counter);
  position: absolute;
  left: 0;
  top: 0;
  width: 1.8em;
  height: 1.8em;
  background: linear-gradient(135deg, var(--geo-orange), var(--geo-amber));
  color: #fff;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--geo-font-head);
  font-size: 0.82em;
  font-weight: 700;
  line-height: 1;
}

/* ── Blockquote ───────────────────────────────────────────────── */
.reveal blockquote {
  margin: 1.2em 0;
  padding: 1em 1.6em;
  background: linear-gradient(135deg, rgba(249,115,22,0.06), rgba(245,158,11,0.04));
  border-left: 4px solid var(--geo-orange);
  border-radius: 0 8px 8px 0;
  font-style: italic;
  color: var(--geo-muted);
  width: 100%;
  box-sizing: border-box;
}

.reveal blockquote p {
  margin: 0;
  font-size: 0.95em;
  line-height: 1.6;
}

/* ── Two-Column Layout ────────────────────────────────────────── */
.two-column {
  display: flex;
  gap: 2em;
  text-align: left;
  align-items: flex-start;
}

.two-column > * {
  flex: 1;
  min-width: 0;
}

/* ── Identity Card ────────────────────────────────────────────── */
.identity-card {
  background: var(--geo-surface);
  border: 1px solid var(--geo-border);
  border-radius: 10px;
  border-top: 3px solid var(--geo-orange);
  padding: 1em 1.2em;
  position: relative;
  overflow: hidden;
}

.identity-card-accent {
  position: absolute;
  top: 0;
  right: 0;
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, rgba(249,115,22,0.12), rgba(245,158,11,0.06));
  border-radius: 0 10px 0 60px;
}

/* ── Highlight Box / Decision Box ────────────────────────────── */
.highlight-box,
.decision-box {
  background: linear-gradient(135deg, rgba(249,115,22,0.06), rgba(245,158,11,0.04));
  border: 1px solid rgba(249,115,22,0.2);
  border-left: 4px solid var(--geo-orange);
  border-radius: 0 8px 8px 0;
  padding: 0.9em 1.2em;
  margin: 0.6em 0;
  font-size: 0.82em;
  line-height: 1.65;
  text-align: left;
}

.decision-box ul {
  margin: 0.4em 0 0;
  font-size: 1em;
}

/* ── Tags ─────────────────────────────────────────────────────── */
.tag {
  display: inline-block;
  font-size: 0.55em;
  font-weight: 700;
  font-family: var(--geo-font-head);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 0.28em 0.75em;
  border-radius: 999px;
  margin: 0 0.2em 0.3em 0;
  vertical-align: middle;
  border: 1px solid transparent;
  line-height: 1.4;
}

.tag-primary {
  background: rgba(249,115,22,0.12);
  color: var(--geo-orange);
  border-color: rgba(249,115,22,0.35);
}

.tag-success {
  background: rgba(15,118,110,0.1);
  color: var(--geo-teal);
  border-color: rgba(15,118,110,0.3);
}

.tag-warning {
  background: rgba(225,29,72,0.1);
  color: var(--geo-rose);
  border-color: rgba(225,29,72,0.3);
}

.tag-error {
  background: rgba(225,29,72,0.18);
  color: var(--geo-rose);
  border-color: var(--geo-rose);
}

/* ── Metric (Recommendation Display) ─────────────────────────── */
.metric {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25em;
  margin: 0 auto;
}

.metric-value {
  font-family: var(--geo-font-head);
  font-size: 3.2em;
  font-weight: 800;
  line-height: 1;
  color: var(--geo-orange);
}

.metric-label {
  font-family: var(--geo-font-head);
  font-size: 0.65em;
  color: var(--geo-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

/* ── Gradient Text ────────────────────────────────────────────── */
.gradient-text {
  background: linear-gradient(90deg, var(--geo-orange) 0%, var(--geo-amber) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* ── Comparison Table ─────────────────────────────────────────── */
.comparison-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.72em;
  margin: 0.8em 0;
}

.comparison-table th {
  background: linear-gradient(135deg, rgba(249,115,22,0.12), rgba(245,158,11,0.08));
  color: var(--geo-orange);
  font-family: var(--geo-font-head);
  font-weight: 700;
  text-align: left;
  padding: 0.75em 1em;
  border-bottom: 2px solid var(--geo-orange);
  text-transform: uppercase;
  font-size: 0.8em;
  letter-spacing: 0.05em;
}

.comparison-table td {
  padding: 0.65em 1em;
  border-bottom: 1px solid var(--geo-border);
  color: var(--geo-text);
  vertical-align: middle;
}

.comparison-table tr:hover td {
  background: rgba(249,115,22,0.03);
}

.comparison-table td.winner {
  color: var(--geo-teal);
  font-weight: 600;
}

.comparison-table td.loser {
  color: var(--geo-rose);
  opacity: 0.8;
}

.comparison-table td.tie {
  color: var(--geo-amber);
}
</style>
