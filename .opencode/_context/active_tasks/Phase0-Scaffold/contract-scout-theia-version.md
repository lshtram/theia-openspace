# Contract: Scout Research - Theia Version and AI Framework Maturity

**Task ID:** Phase0.1-TheiaVersionResearch  
**Assigned to:** Scout  
**Priority:** P0 (blocks all other Phase 0 tasks)  
**Created:** 2026-02-16  
**Oracle:** oracle_e3f7

---

## Objective

Research and recommend the exact Eclipse Theia version to use for Theia Openspace, with specific focus on the maturity and stability of `@theia/ai-*` packages (ai-core, ai-chat, ai-chat-ui).

## Background

We are building Theia Openspace, an AI-native IDE where the agent controls the IDE through Theia commands. We need:
- A stable Theia version that supports compile-time extensions
- The `@theia/ai-*` framework for chat, agents, and response rendering
- Evidence that the AI packages are production-ready or at least stable enough to build on

## Research Questions

1. **What is the latest stable Theia release?** (e.g., 1.48.x, 1.49.x, etc.)
2. **What version introduced `@theia/ai-core`, `@theia/ai-chat`, `@theia/ai-chat-ui`?**
3. **Are the AI packages stable/mature?** Look for:
   - Release notes mentioning breaking changes
   - GitHub issues labeled "ai" or "chat"
   - Any deprecation warnings or beta markers
   - Documentation completeness
4. **What version do we pin?** Recommend specific version numbers for:
   - `@theia/core` and base packages
   - `@theia/ai-core`
   - `@theia/ai-chat`
   - `@theia/ai-chat-ui`
   - Any other `@theia/ai-*` packages we should include
5. **Known issues or gotchas?** Any breaking changes, migration guides, or common pitfalls?

## Deliverables

Create `result.md` in this task directory with:

```markdown
# Research Result: Theia Version Recommendation

## Recommended Version
- **Theia base packages:** X.Y.Z
- **@theia/ai-core:** X.Y.Z
- **@theia/ai-chat:** X.Y.Z
- **@theia/ai-chat-ui:** X.Y.Z
- **Rationale:** [why this version]

## AI Framework Maturity Assessment
- **Stability:** [stable/beta/experimental]
- **Breaking changes in last 3 releases:** [list if any]
- **Documentation quality:** [good/adequate/poor]
- **Community activity:** [active/moderate/quiet]

## Risk Assessment
- **Risk level:** [low/medium/high]
- **Mitigation:** [how to handle potential issues]

## Version Pinning Strategy
- **Exact versions vs ^ranges:** [recommendation]
- **Upgrade path:** [how to handle future upgrades]

## References
- [links to release notes, docs, relevant issues]
```

## Sources to Check

1. Theia GitHub releases: https://github.com/eclipse-theia/theia/releases
2. Theia documentation: https://theia-ide.org/docs/
3. AI framework docs: https://theia-ide.org/docs/ai/
4. NPM registry for @theia/ai-* packages
5. Theia community Discord/forum for recent discussions

## Time Bound

Return within 30 minutes with initial findings. If research is complex, provide preliminary recommendation and note what needs deeper investigation.

## Success Criteria

- [ ] Specific version numbers provided for all packages
- [ ] Evidence-based maturity assessment
- [ ] Clear recommendation with rationale
- [ ] Risk/mitigation notes
- [ ] References for verification

---

**Oracle Note:** This research blocks all Phase 0 implementation. Scout should prioritize speed while maintaining accuracy. If the AI packages are too unstable, we need to know immediately as it may affect architecture decisions.
