---
title: Testing Strategy Review - Status & Recommendations
---

# Testing Strategy Review

## Status & Recommendations for Project Manager

---

## Current Test Landscape

### Unit Tests: 40+ test suites
- **Coverage**: Core services, chat, presentation, whiteboard, voice, settings
- **Technology**: Mocha + Chai + Sinon
- **Status**: ✅ Most passing, fast execution

### E2E Tests: 15+ test suites
- **Coverage**: App load, session management, MCP tools, permissions
- **Technology**: Playwright
- **Status**: ⚠️ Mixed - some infrastructure issues

---

## The Core Problem

### Architecture B1 Reality

```
Browser (Theia frontend)
  ↓ JSON-RPC over WebSocket
Node.js (Theia backend)
  ↓ HTTP requests to Hub
Hub (port 7890)
  ↓ HTTP requests to OpenCode
OpenCode Server (port 8000)
```

### Why Tests Are Failing

- **E2E tests assume** they can mock browser HTTP requests
- **Reality**: Backend HTTP calls happen in Node.js, not browser
- **Playwright's `page.route()`** only intercepts browser traffic

---

## Test Pyramid Gap

### Current State

<div style="display: flex; justify-content: space-around; text-align: center;">
  <div>
    <div style="font-size: 2em;">📊</div>
    <h3>E2E</h3>
    <p style="color: #f59e0b;">~15%</p>
  </div>
  <div>
    <div style="font-size: 2em;">🔗</div>
    <h3>Integration</h3>
    <p style="color: #f59e0b;">~5%</p>
  </div>
  <div>
    <div style="font-size: 2em;">🧪</div>
    <h3>Unit</h3>
    <p style="color: #10b981;">~80%</p>
  </div>
</div>

### Target: Unit-First Approach
- **75-85%** Unit tests
- **10-20%** Integration/Contract
- **≤10%** E2E (minimal sanity only)

---

## Key Issues Identified

### 1. E2E Infrastructure Gap
- ❌ Session autoload tests fail (4 of 7 tests)
- ❌ Browser mocks don't reach backend HTTP calls
- ✅ Manual testing confirms feature works

### 2. Test Quality Gaps
- Some tests check **source code patterns** instead of **behavior**
- Timing-sensitive tests cause flakiness
- Missing security regression tests

### 3. No CI Gating
- No automated PR lanes for fast/unit checks
- Full E2E suite required on every PR (slow)

---

## Proposed Solution: Unit-First Strategy

### Phase 1: Foundation (Week 1)
- ✅ Align docs with MCP/B1 architecture
- ✅ Create requirements-to-test traceability matrix
- ✅ Define CI lanes: unit-fast, integration, e2e-smoke

### Phase 2: Unit Expansion (Week 2-3)
- Build deterministic test utilities (fake clocks, fixtures)
- Upgrade structural → behavioral assertions
- Add security regression pack

### Phase 3: E2E Rationalization (Week 4)
- Rebuild E2E harness for B1 reality
- Limit to 6-8 sanity tests for PR gate
- Move rest to nightly/full suite

---

## Investment Required

### Estimated Effort

| Task | Days | Priority |
|------|------|----------|
| Doc alignment | 1 | High |
| Traceability matrix | 1 | High |
| CI lanes setup | 2 | High |
| Unit test utilities | 3 | Medium |
| Behavioral upgrades | 5 | Medium |
| Security tests | 3 | Medium |
| E2E rebuild | 4 | Medium |
| **Total** | **~19 days** | |

### Expected Outcomes
- PR fast lane: **< 8 min** (vs 20+ min now)
- Unit-first ratio: **80%+**
- Stable, deterministic tests
- Clear coverage gaps documented

---

## Recommendation

### Immediate Actions

1. **Adopt unit-first policy** for new features
2. **Create traceability matrix** to identify gaps
3. **Implement CI lanes** to speed up PRs
4. **Rebuild E2E** with real backend or mock

### Risk Mitigation

- Keep manual testing for critical paths
- Tag flaky tests, move to quarantine
- Document deferred work with owners

---

## Questions?

### Next Steps

- Review: `docs/plans/2026-02-23-test-suite-hardening-unit-first.md`
- Discuss: Priority and resource allocation
- Decide: Go/no-go on implementation plan

---

# Testing Strategy Review

## Status & Recommendations for PM

<div style="text-align: right; font-size: 0.6em; color: #94a3b8;">
OpenSpace - February 2026
</div>