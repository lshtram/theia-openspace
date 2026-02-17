# Architecture Exploration: OpenCode Integration Analysis

## Overview

This document index provides links to comprehensive analysis of the Theia-OpenSpace architecture and comparison with OpenCode's VS Code extension implementation.

## Quick Links

📊 **[ARCHITECTURE_ANALYSIS.md](./ARCHITECTURE_ANALYSIS.md)** - Main analysis document  
📐 **[ARCHITECTURE_DIAGRAMS.md](./ARCHITECTURE_DIAGRAMS.md)** - Visual architecture diagrams  
🛠️ **[SDK_MIGRATION_GUIDE.md](./SDK_MIGRATION_GUIDE.md)** - Implementation guide for SDK adoption

---

## Executive Summary

### Current State

Theia-OpenSpace uses a **custom HTTP client** with manual:
- HTTP request/response handling (~600 lines)
- SSE parsing and reconnection logic
- JSON-RPC layer between frontend and backend

### Findings

OpenCode VS Code extension uses the **@opencode-ai/sdk** which provides:
- Type-safe API client (OpenAPI-generated)
- Built-in SSE streaming
- Zero runtime dependencies
- ~50KB bundle size

### Recommendation

**Adopt OpenCode SDK in backend** (Option 1) to achieve:
- ✅ **75% code reduction** (600 lines → 150 lines)
- ✅ **Type safety** from OpenAPI spec
- ✅ **Lower maintenance** burden
- ✅ **Better DX** with IDE autocomplete
- ✅ **Standard patterns** across OpenCode ecosystem

---

## Document Structure

### 1. ARCHITECTURE_ANALYSIS.md

**Purpose:** Comprehensive comparison of approaches

**Contents:**
1. Current Theia-OpenSpace architecture deep dive
2. OpenCode VS Code extension analysis
3. Detailed comparison table
4. Three migration options with pros/cons
5. Decision matrix
6. Recommendations

**Key Sections:**
- Communication flow diagrams
- Service interface documentation
- SSE implementation details
- Hub endpoints explanation
- Pros/cons analysis for each approach

**Read this if:** You need to understand the full context and make an informed decision

---

### 2. ARCHITECTURE_DIAGRAMS.md

**Purpose:** Visual representation of architectures

**Contents:**
1. Current architecture (detailed ASCII diagram)
2. OpenCode VS Code extension architecture
3. Proposed simplified architecture (SDK backend)
4. Proposed alternative (frontend direct)
5. Message flow comparisons
6. Code complexity comparisons

**Key Diagrams:**
- Full stack communication flows
- RPC layer visualization
- Message streaming sequences
- Code reduction metrics

**Read this if:** You're a visual learner or need to present to stakeholders

---

### 3. SDK_MIGRATION_GUIDE.md

**Purpose:** Step-by-step implementation guide

**Contents:**
1. Migration strategy (5 phases)
2. Day-by-day breakdown
3. Code examples for adapter implementation
4. Testing procedures
5. Troubleshooting guide
6. Rollback plan

**Key Sections:**
- Phase 1: Add SDK dependency
- Phase 2: Create adapter (with full code)
- Phase 3: Testing checklist
- Phase 4: Cleanup procedures
- Phase 5: Verification

**Read this if:** You're ready to implement the SDK migration

---

## Key Findings Summary

### Comparison Matrix

| Aspect | Current | OpenCode SDK | Winner |
|--------|---------|--------------|--------|
| Code Lines | ~600 | ~150 | 🏆 SDK (75% reduction) |
| Type Safety | Manual | OpenAPI-gen | 🏆 SDK |
| Maintenance | High burden | Low burden | 🏆 SDK |
| Bundle Size | ~0KB | ~50KB | Current |
| HTTP Handling | Manual | SDK automatic | 🏆 SDK |
| SSE Parsing | Manual parser | SDK built-in | 🏆 SDK |
| Error Messages | Custom | Standardized | 🏆 SDK |
| IDE Integration | Direct | Standard | Tie |
| Learning Curve | High | Low | 🏆 SDK |

### Three Migration Options

#### Option 1: SDK Backend (RECOMMENDED)
- Replace OpenCodeProxy with SDK adapter
- Keep RPC layer unchanged
- **Effort:** 1 week
- **Best balance** of simplicity and compatibility

#### Option 2: Frontend Direct
- Remove backend HTTP layer entirely
- Frontend uses SDK directly
- **Effort:** 1-2 weeks (includes CORS)
- **Most radical** but highest long-term benefit

#### Option 3: Hybrid
- SDK for REST, direct SSE for events
- **Effort:** 1-2 weeks
- **Most complex** implementation

---

## Decision Factors

### Choose Option 1 (SDK Backend) if:
- ✅ Want lowest-risk migration
- ✅ Prefer Theia-native patterns
- ✅ Need backend request interception
- ✅ Want quick wins (1 week timeline)

### Choose Option 2 (Frontend Direct) if:
- ✅ Can configure OpenCode CORS
- ✅ Want lowest latency
- ✅ Prefer simpler architecture long-term
- ✅ Have 1-2 weeks for migration

### Keep Current if:
- ✅ Can't add dependencies (unlikely blocker)
- ✅ Need absolute control over HTTP (rare)
- ✅ Have unlimited maintenance resources

---

## Implementation Timeline

### Recommended: Option 1 (SDK Backend)

```
Week 1:
  Day 1: Install SDK, explore API, create adapter skeleton
  Day 2: Implement all OpenCodeService methods
  Day 3: Write tests, integration testing
  Day 4: Manual testing, bug fixes
  Day 5: Cleanup, documentation, final verification

Total: 1 week
```

### Alternative: Option 2 (Frontend Direct)

```
Week 1:
  Day 1-2: Configure CORS on OpenCode
  Day 3-4: Implement frontend service with SDK
  Day 5: Remove backend layer

Week 2:
  Day 1-3: Testing and debugging
  Day 4-5: Cleanup and documentation

Total: 2 weeks
```

---

## Next Steps

1. **Review Documents**
   - [ ] Read ARCHITECTURE_ANALYSIS.md
   - [ ] Review ARCHITECTURE_DIAGRAMS.md
   - [ ] Scan SDK_MIGRATION_GUIDE.md

2. **Team Discussion**
   - [ ] Present findings to team
   - [ ] Discuss pros/cons of each option
   - [ ] Make decision: SDK vs. Current

3. **If Proceeding with SDK:**
   - [ ] Follow SDK_MIGRATION_GUIDE.md Phase 1
   - [ ] Create feature branch
   - [ ] Implement adapter
   - [ ] Test thoroughly
   - [ ] Deploy and monitor

4. **If Keeping Current:**
   - [ ] Consider improvements from Section 7 of ARCHITECTURE_ANALYSIS.md
   - [ ] Implement native Fetch
   - [ ] Add type generation from OpenAPI
   - [ ] Improve error handling

---

## Questions & Answers

### Q: Will SDK add too much to bundle size?

**A:** SDK adds ~50KB, which is minimal compared to Theia's base size (~10MB). The tradeoff is worth it for 75% code reduction and type safety.

### Q: Is the SDK maintained?

**A:** Yes, it's the official SDK used by OpenCode's own VS Code extension and maintained by the core team.

### Q: Can we use SDK in browser?

**A:** Yes, but requires CORS configuration on OpenCode server. SDK has browser-compatible version. See Option 2 in ARCHITECTURE_ANALYSIS.md.

### Q: What if OpenCode changes its API?

**A:** SDK is updated alongside API changes. We'd need to update SDK version, but types automatically reflect changes. Much safer than maintaining custom HTTP client.

### Q: How does error handling work with SDK?

**A:** SDK throws typed errors with standardized messages. Better than our current custom error handling spread across methods.

---

## References

### External Resources
- [OpenCode SDK Documentation](https://opencode.ai/docs/sdk/)
- [OpenCode Server Documentation](https://opencode.ai/docs/server/)
- [VS Code Extension Marketplace](https://marketplace.visualstudio.com/items?itemName=sst-dev.opencode)
- [Client-Server Model Guide](https://deepwiki.com/anomalyco/opencode/2.3-client-server-model)

### Internal Files
- `extensions/openspace-core/src/node/opencode-proxy.ts` - Current implementation
- `extensions/openspace-core/src/common/opencode-protocol.ts` - Service interfaces
- `extensions/openspace-core/src/browser/opencode-sync-service.ts` - RPC callbacks
- `extensions/openspace-core/src/node/hub.ts` - Hub endpoints

---

## Contact & Feedback

For questions about this analysis:
1. Review the three main documents
2. Check the Q&A section above
3. Consult with team lead
4. Open discussion in team chat

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-17 | Initial comprehensive analysis completed |

---

**Status:** ✅ Analysis Complete - Ready for Team Review  
**Recommendation:** Adopt OpenCode SDK (Option 1) - 1 week migration  
**Next Action:** Team review and decision
