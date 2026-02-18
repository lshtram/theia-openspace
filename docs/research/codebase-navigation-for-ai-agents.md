# Codebase Navigation for AI Agents: Research Report
**Date:** 2026-02-18  
**Author:** Scout (NSO Research Agent)  
**Context:** theia-openspace — ~31K lines TypeScript/React Theia IDE codebase  
**Objective:** Evaluate the best tools, MCP servers, and preprocessing strategies to improve AI agent codebase navigation  

---

## Executive Summary

The current NSO approach (`npm run map` → `codebase_map.md`) is a **Level 1** solution: better than nothing, but static and manually-regenerated. The 2025 ecosystem has moved significantly beyond this. **Five proven approaches** are available today, ranging from zero-ops drop-ins to full semantic search stacks.

**TL;DR Recommendation:** Upgrade the codebase_map to an **aider-style tree-sitter repo map** (auto-regenerated on save) + install **`ast-grep-mcp`** for structural TypeScript queries. For larger refactors, add **`repomix --compress`** for context-window-efficient snapshots. Do **not** invest in vector RAG unless the codebase grows past 200K lines.

---

## Section 1: The Problem Space

AI agents navigating a codebase face three distinct problems:

| Problem | Current NSO Solution | Gap |
|---|---|---|
| **Orientation** ("What exists?") | `codebase_map.md` (manually regenerated) | Stale on every PR; no call graphs |
| **Lookup** ("Where is `X`?") | `Grep` tool | Text-only, no semantic awareness |
| **Navigation** ("What calls `X`?") | Manual `grep` for references | No cross-file reference tracking |

The `codebase_map.md` solves Orientation but degrades unless regenerated. Lookup and Navigation are entirely reactive.

---

## Section 2: Approach Landscape

### 2.1 Approach Tiers

```
Tier 1 — Static Snapshot (current NSO)
  └── codebase_map.md (manually generated)
  
Tier 2 — Smart Static Snapshot (low effort upgrade)
  ├── repomix --compress (tree-sitter compressed, one command)
  └── aider repo-map algorithm (PageRank + tree-sitter, auto-updates)
  
Tier 3 — Structural Query Engine (medium effort)
  ├── ast-grep-mcp (AST pattern search via MCP)
  └── @nendo/tree-sitter-mcp (symbol search + usage tracking via MCP)
  
Tier 4 — Semantic Vector Search (high effort)
  ├── semantiq-mcp (MiniLM embeddings + tree-sitter + ripgrep, local)
  └── mcp-ragex (ChromaDB + sentence-transformers, Docker)
  
Tier 5 — IDE-native (SaaS only)
  └── Cursor codebase indexing (cloud, proprietary)
```

---

## Section 3: Top 5 Recommended Approaches

---

### 🥇 Approach 1: `ast-grep-mcp` — Structural TypeScript/TSX Search
**Category:** MCP Server (Tier 3)  
**Status:** Production-ready, 338 stars, MIT license, maintained by ast-grep org  
**Best For:** "Find all React components using hook X", "Find all async functions without try/catch"

#### What It Does
Exposes 4 MCP tools to any AI agent:
- `dump_syntax_tree` — visualize AST of any code snippet
- `test_match_code_rule` — test YAML rules before running on repo
- `find_code` — simple structural pattern search
- `find_code_by_rule` — complex YAML rules with `has`, `inside`, `precedes` relations

#### Pros
- ✅ **Syntax-aware, not text-aware** — `$FUNC($$$)` matches any function call, not just text "function"
- ✅ **Zero false positives** — no matching strings inside comments or string literals
- ✅ **Directly integrated into opencode** — registered as MCP, agents call it natively
- ✅ **No database, no Docker, no indexing** — pure AST query on demand
- ✅ **TypeScript + TSX natively supported**
- ✅ **AGENTS.md / system prompt integration** documented by the project

#### Cons
- ❌ No cross-file reference tracking (single-file AST only)
- ❌ Requires learning YAML rule syntax (minor, LLMs can generate these)
- ❌ Experimental label (but actively maintained by the ast-grep core team)

#### Install
```bash
# Install ast-grep CLI
brew install ast-grep  # macOS
# or: cargo install ast-grep --locked

# Install MCP server
uvx --from git+https://github.com/ast-grep/ast-grep-mcp ast-grep-server
```

#### opencode MCP config (`~/.opencode/config.json` or project `.mcp.json`)
```json
{
  "mcpServers": {
    "ast-grep": {
      "command": "uvx",
      "args": ["--from", "git+https://github.com/ast-grep/ast-grep-mcp", "ast-grep-server"]
    }
  }
}
```

#### Usage Example (agent can call)
```yaml
# Find all React useState hooks with loading state
id: find-loading-state
language: tsx
rule:
  pattern: const [$LOADING, $SET_LOADING] = useState($$$)
  has:
    pattern: loading
```

**Expected Improvement:** Agents can now answer "where are all the useState hooks" or "find all async functions missing error handling" in milliseconds with zero false positives.

---

### 🥈 Approach 2: `repomix --compress` — Tree-Sitter Compressed Snapshot
**Category:** Preprocessing / Skeleton Map (Tier 2)  
**Status:** Production-ready, 21.8K stars, MIT license, actively maintained  
**Best For:** Full-codebase snapshot for orientation tasks, pre-context injection

#### What It Does
Packs the entire repo into a single AI-optimized file. The `--compress` flag uses tree-sitter to **strip implementation details**, keeping only function signatures, class definitions, and structure — achieving **~70% token reduction**.

Without compression: full file contents concatenated  
With compression: skeleton only (signatures + structure)

#### Pros
- ✅ **Drop-in replacement for `codebase_map.md` generation**
- ✅ **MCP server mode** — agents can call `pack_codebase` tool directly
- ✅ **Claude Code plugin available** (`npx add-skill yamadashy/repomix --skill repomix-explorer`)
- ✅ **Respects `.gitignore`** automatically
- ✅ **Multiple output formats** (XML with metadata, Markdown, plain text)
- ✅ **Token counter built-in** — shows token cost of each file
- ✅ **Auto-indexing via MCP watcher** (with MCP server mode)

#### Cons
- ❌ Snapshot-based — not live (though MCP mode can update on demand)
- ❌ Compressed output loses implementation detail (intentional, but agents must fetch full file when needed)
- ❌ For large repos, even compressed output can be large (~15K tokens for this codebase)

#### Install
```bash
npm install -g repomix
```

#### Usage
```bash
# Generate compressed skeleton map (replaces codebase_map.md)
npx repomix --compress --output .opencode/context/codebase_map.md

# Add as npm script (replace current `npm run map`)
# In package.json:
# "map": "repomix --compress --output .opencode/context/codebase_map.md"
```

#### MCP server config
```json
{
  "mcpServers": {
    "repomix": {
      "command": "npx",
      "args": ["-y", "repomix", "--mcp"]
    }
  }
}
```

**Expected Improvement:** Compressed map is 3-4x smaller than current flat-symbol approach, contains more structural information (actual signatures vs just names), and can be regenerated with one command. MCP mode enables on-demand repacking.

---

### 🥉 Approach 3: `@nendo/tree-sitter-mcp` — Symbol Search + Usage Tracking
**Category:** MCP Server (Tier 3)  
**Status:** Published on npm, installable via `npm install -g @nendo/tree-sitter-mcp`  
**Best For:** "Where is `ButtonComponent` defined?", "Find all usages of `useAuth` across the project"

#### What It Does
Pure tree-sitter based MCP server providing:
- `search_code` — find functions/classes/variables by name across the project
- `find_usage` — find **all usages** of an identifier across all files
- `analyze_code` — quality, dead code, structure analysis
- `check_errors` — syntax errors with context

#### Pros
- ✅ **Cross-file usage tracking** (unlike ast-grep-mcp which is single-file AST)
- ✅ **npm installable, zero Python dependency**
- ✅ **Works as both CLI tool and MCP server**
- ✅ **Auto-configures with Claude Desktop** via `tree-sitter-mcp setup --auto`
- ✅ **Dead code detection** — high value for large codebase maintenance

#### Cons
- ❌ Newer/smaller project (less battle-tested than ast-grep)
- ❌ No semantic search (still symbolic)
- ❌ GPLv3 license (check compatibility)

#### Install
```bash
npm install -g @nendo/tree-sitter-mcp

# opencode MCP config
# command: "tree-sitter-mcp", args: ["--mcp"], cwd: "/path/to/project"
```

**Expected Improvement:** Answers "what calls `renderPane()`?" — which currently requires manual grep + reading each match. Especially valuable for refactoring decisions.

---

### 4: Aider Repo-Map Algorithm — PageRank-Ranked Symbol Map
**Category:** Preprocessing (Tier 2) — Algorithm/Approach, NOT a direct MCP  
**Status:** Battle-tested production algorithm, used by thousands daily  
**Best For:** Understanding the repo-map algorithm to port/extend current `codebase_map.md`

#### How It Works
1. **Parse all source files** with tree-sitter → extract all symbol definitions (functions, classes, types) AND all symbol references
2. **Build a directed graph** where each file is a node; edges connect files when file A references a symbol defined in file B
3. **Run PageRank** (graph ranking algorithm) on the graph — symbols referenced by many files rank higher
4. **Select top-N symbols** that fit within a token budget (default: ~1K tokens for repo map)
5. **Output hierarchical text** with signatures and `⋮...` for elided sections

**Key insight**: The map is **dynamically filtered per-conversation** — symbols relevant to the current task rank higher. This is fundamentally different from a static flat map.

#### Is It Portable?
**Partially.** The core algorithm is in Python (`aider/repomap.py`). It depends on `py-tree-sitter-languages`. You **cannot** easily run it as a TypeScript tool without porting. Options:
1. **Call aider CLI** to generate the map: `aider --show-repo-map` outputs the map to stdout (no interactive session needed)
2. **Port the algorithm** to TypeScript using `tree-sitter-typescript` npm package (significant effort)
3. **Use repomix `--compress`** as a simpler approximation of the same idea

#### Install (to use the map generation feature)
```bash
pip install aider-chat
# Generate map and save to file:
aider --show-repo-map > .opencode/context/codebase_map.md
```

#### Pros
- ✅ **Best-in-class static snapshot algorithm** — dynamically ranked
- ✅ **Proven at scale** — used on large monorepos
- ✅ **Token-budget aware** — map always fits within specified window

#### Cons
- ❌ Python dependency (adds pip install to workflow)
- ❌ Not real-time (requires re-run on change)
- ❌ Relevance ranking requires knowing which files are in context — harder to use standalone
- ❌ Does NOT solve cross-file references or semantic search

**Expected Improvement:** If we port/wrap the aider map algorithm, the `codebase_map.md` would be 30-50% smaller (token budget enforced) while containing the most-referenced symbols, making it more useful than the current flat alphabetical list.

---

### 5: `semantiq-mcp` — Local Semantic + Symbol + Dependency Graph
**Category:** MCP Server (Tier 4)  
**Status:** Community project, npm installable, local-only (no cloud API keys)  
**Best For:** Natural language code search, dependency graph analysis

#### What It Does
4 combined search strategies in one MCP server:
1. **Semantic search** (MiniLM embeddings, local model)
2. **Lexical search** (ripgrep-fast)
3. **Symbol search** (FTS — full-text symbol index)
4. **Dependency graph analysis**

Uses SQLite + sqlite-vec for storage. Auto-indexes and watches files.

#### Pros
- ✅ **Natural language queries** — "find authentication related functions" (no exact name needed)
- ✅ **19 languages** with tree-sitter parsing
- ✅ **Zero external services** — fully local
- ✅ **Auto-indexing** — no manual map regeneration
- ✅ **Dependency graph** — answers "what does this file depend on?"

#### Cons
- ❌ **Less battle-tested** than approaches 1-4
- ❌ Initial indexing time for large codebases (unknown for 31K lines)
- ❌ Local ML model adds ~50MB overhead
- ❌ Semantic search quality dependent on embedding model (MiniLM is good but not SOTA)

#### Install
```bash
npm install -g semantiq-mcp
cd /path/to/project
semantiq init  # configures automatically, creates index
```

**Expected Improvement:** If semantic search quality is high, agents can find code without knowing exact symbol names. High value for onboarding new agents to the codebase.

---

## Section 4: MCP Servers — Comparison Table

| MCP Server | Stars | Install | Search Type | TypeScript Support | Indexing | License |
|---|---|---|---|---|---|---|
| **ast-grep-mcp** | 338 | `uvx` from git | Structural AST | ✅ Native | On-demand | MIT |
| **wrale/mcp-server-tree-sitter** | 262 | `uvx` from git | Structural AST | ✅ Via grammar | On-demand | MIT |
| **@nendo/tree-sitter-mcp** | ~npm | `npm install -g` | Symbol + usage | ✅ | Per-project | GPL-3 |
| **semantiq-mcp** | Community | `npm install -g` | Semantic+Symbol+Regex | ✅ Via tree-sitter | Auto-watch | Unknown |
| **mcp-ragex** | 14 | Docker (3.2GB) | Semantic+Regex+AST | ✅ | Auto-watch | Unknown |
| **GitHub MCP** | Official | Built-in | Text + file nav | ✅ (remote repos) | Cloud | MIT |
| **repomix MCP** | 21.8K | `npx -y repomix --mcp` | Snapshot pack | ✅ | On-demand | MIT |

**Note on GitHub MCP:** Already known to the team. Best for remote repo browsing, PR management, and cross-repo search. Does NOT provide local structural search. Use for GitHub workflow integration, not codebase navigation.

---

## Section 5: How Industry Tools Handle This

### Cursor (2025-2026)
- **Local embedding index** — chunks code into function/class-level blocks, embeds with a proprietary model
- **7-step pipeline**: sync files → chunk semantically → embed → vector DB → query embedding → similarity search → return ranked chunks
- **Semantic search** launched in 2026 — previously was only RAG
- **Limitation:** Cloud-dependent, proprietary, not portable

### Aider
- **Static repo map** (PageRank-ranked tree-sitter skeleton), regenerated per-conversation
- **On-demand file loading** — agents request full files by name after seeing the map
- **No vector embeddings** by default (too slow for interactive use)

### Copilot Workspace
- **Context window management** via summarization — when context fills, it summarizes prior conversation
- **File-level context injection** — provides active files + relevant cross-referenced files
- **No structural search** — relies on LLM to navigate from provided context

### Sourcegraph Cody
- **Hybrid**: keyword search (Zoekt) + semantic embeddings (local or cloud)
- **Precise code intelligence** via SCIP (predecessor to LSIF) for go-to-definition, find-references
- **Most complete solution** but requires Sourcegraph server deployment

---

## Section 6: Context Window Efficiency Patterns

### Symbol-Level vs File-Level vs Line-Level

| Granularity | Token Cost | Best For | Limitation |
|---|---|---|---|
| **File-level** (send whole file) | 500-5000 tokens | Implementation tasks | Context fills fast |
| **Symbol-level** (send signatures only) | 20-200 tokens | Orientation, navigation | No implementation detail |
| **Line-level** (send specific ranges) | 50-500 tokens | Precise edits | Hard to discover without index |
| **Semantic chunk** (AST-bounded) | 100-800 tokens | Code understanding | Requires embedding index |

**NSO Recommendation:** Current `codebase_map.md` is symbol-level (good). The gap is that agents can't efficiently do line-level retrieval without first doing structural or semantic lookup.

### Chunking Strategies for 31K-Line TypeScript Codebase

The most effective strategies for TypeScript/React:

1. **Function-boundary chunking** — each exported function/component is one chunk
   - Works with: `ast-grep`, `@nendo/tree-sitter-mcp`, `repomix --compress`
   - Estimated chunks: ~800-1200 for this codebase

2. **Module-boundary chunking** — each `.ts`/`.tsx` file is one chunk (current approach)
   - Too coarse for search but good for orientation

3. **PageRank-ranked selection** (aider approach) — only top-N by reference frequency
   - Best token efficiency for orientation tasks

---

## Section 7: Concrete Next Steps

### Immediate (Zero-Risk Improvements)

#### Step 1: Replace `npm run map` with repomix compressed map
```bash
npm install -g repomix
```

Update `package.json` script:
```json
"map": "repomix --compress --include '**/*.ts,**/*.tsx' --ignore 'node_modules,lib,dist' --output .opencode/context/codebase_map.md"
```

**Expected:** Map is 60-70% smaller, contains full signatures instead of just names, respects gitignore automatically.

#### Step 2: Install ast-grep-mcp for structural TypeScript search
```bash
brew install ast-grep
pip install uv  # if not installed
```

Add to opencode MCP config:
```json
{
  "mcpServers": {
    "ast-grep": {
      "command": "uvx",
      "args": ["--from", "git+https://github.com/ast-grep/ast-grep-mcp", "ast-grep-server"]
    }
  }
}
```

Add to NSO agent system prompts / `AGENTS.md`:
```markdown
## Code Search Priority
1. Use `ast-grep` MCP for structural TypeScript searches (functions, classes, hooks, imports)
2. Use `Grep` tool for text/comment/string searches
3. Use `Glob` for file discovery
4. Consult `codebase_map.md` for orientation
```

**Expected:** Agents can now do "find all React components using useEffect without cleanup" structurally.

### Short-Term (1-2 days)

#### Step 3: Add aider-style map generation (optional, if repomix output is insufficient)
```bash
pip install aider-chat
# Test map output
aider --show-repo-map --no-auto-commits 2>/dev/null | head -200
```

Evaluate if PageRank-ranked output is better than repomix compressed output for this codebase.

#### Step 4: Evaluate `@nendo/tree-sitter-mcp` for cross-file usage tracking
```bash
npm install -g @nendo/tree-sitter-mcp
tree-sitter-mcp setup --auto  # auto-configures MCP
```

Test query: "find all usages of `PanelManager`" — if this works well, it solves the Navigation gap.

### Medium-Term (If Codebase Grows or Semantic Search Needed)

#### Step 5: Evaluate `semantiq-mcp` for semantic search
```bash
npm install -g semantiq-mcp
cd /path/to/theia-openspace
semantiq init
```

Test natural language queries. If indexing time < 2 minutes and results are relevant, adopt.

### What NOT To Do (Right Now)
- ❌ **Don't install mcp-ragex** — Docker-based, 3.2GB image, overkill for 31K lines
- ❌ **Don't build custom vector RAG** — too much maintenance overhead vs. value at this codebase size
- ❌ **Don't install universal-ctags** — ctags is obsolete; tree-sitter is strictly better
- ❌ **Don't use codesee/code2flow** — these are visualization tools for humans, not AI agents

---

## Section 8: Impact Assessment

| Improvement | Tokens Saved per Session | Agent Capability Unlocked | Effort |
|---|---|---|---|
| repomix compressed map | ~30-50% map size reduction | Better orientation | 30 min |
| ast-grep-mcp | Reduces grep iterations | Structural TS/TSX search | 1 hour |
| @nendo/tree-sitter-mcp | Reduces file-open cycles | Cross-file usage tracking | 1 hour |
| aider map algorithm | Additional 20% map reduction | Better relevance ranking | 2-4 hours |
| semantiq-mcp | Reduces search iterations | Natural language code search | 2 hours |

---

## Sources

1. Aider repo-map documentation: https://aider.chat/2023/10/22/repomap.html
2. Aider repo-map docs: https://aider.chat/docs/repomap.html
3. ast-grep MCP server: https://github.com/ast-grep/ast-grep-mcp
4. ast-grep AI tools integration: https://ast-grep.github.io/advanced/prompting.html
5. repomix GitHub (21.8K stars): https://github.com/yamadashy/repomix
6. repomix documentation: https://repomix.com/guide/
7. @nendo/tree-sitter-mcp on npm: https://www.npmjs.com/package/@nendo/tree-sitter-mcp
8. wrale/mcp-server-tree-sitter: https://github.com/wrale/mcp-server-tree-sitter
9. semantiq-mcp Reddit post: https://www.reddit.com/r/ClaudeAI/comments/1qi75uf/i_built_semantiq_a_universal_mcp_server_that/
10. mcp-ragex GitHub: https://github.com/jbenshetler/mcp-ragex
11. Cursor semantic search docs: https://cursor.com/docs/context/semantic-search
12. LanceDB RAG on codebases (tree-sitter chunking): https://lancedb.com/blog/building-rag-on-codebases-part-1/
13. MeetsMore blog (aider repo-map for large codebases): https://engineering.meetsmore.com/entry/2024/12/24/042333
14. Goose tree-sitter repo map feature request: https://github.com/block/goose/issues/3382
