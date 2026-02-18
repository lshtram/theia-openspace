# Research Result: Theia Version Recommendation

**Research Date:** 2026-02-16  
**Scout ID:** scout_research_001  
**Status:** Complete

---

## Executive Summary

Eclipse Theia's AI framework (`@theia/ai-*` packages) has reached a mature and stable state as of version 1.68.x. The framework is actively developed, well-documented, and production-ready for building AI-native tools. Theia 1.68.2 is the latest stable release and serves as the 2026-02 Community Release candidate.

---

## Recommended Version

| Package | Recommended Version | Notes |
|---------|---------------------|-------|
| **Theia base packages** (`@theia/core`, etc.) | `1.68.2` | Latest stable with patch fixes |
| **@theia/ai-core** | `1.68.2` | Core AI framework |
| **@theia/ai-chat** | `1.68.2` | Chat agent framework |
| **@theia/ai-chat-ui** | `1.68.2` | Chat UI components |
| **@theia/ai-ide** | `1.68.2` | Theia IDE agents (Coder, Architect, etc.) |
| **@theia/ai-openai** | `1.68.2` | OpenAI LLM provider |
| **@theia/ai-anthropic** | `1.68.2` | Anthropic Claude provider |

### Rationale

**Version 1.68.2** is recommended because:

1. **Latest stable release** with 2 patch releases (1.68.1, 1.68.2) fixing initial issues
2. **Community Release candidate** for 2026-02, indicating extra stability focus
3. **AI framework maturity** - The AI packages have been in active development for 4+ months
4. **Bug fixes** - Recent patches addressed chat session storage, tool call interruptions, and UI issues
5. **Feature completeness** - Includes agent skills, GitHub Copilot integration, mode selection, and todo tracking

---

## AI Framework Maturity Assessment

### Stability: **BETA → PRODUCTION-READY**

The `@theia/ai-*` framework has evolved from experimental (late 2024) to production-ready (early 2026):

| Version | Date | AI Framework Status |
|---------|------|---------------------|
| 1.54-1.55 | Oct-Nov 2024 | Initial AI framework introduction |
| 1.60-1.64 | Jul-Oct 2025 | Rapid feature expansion |
| 1.66-1.67 | Oct-Dec 2025 | Stabilization, bug fixes |
| 1.68.x | Jan-Feb 2026 | **Production-ready, mature** |

### Breaking Changes in Last 3 Releases

**Version 1.68.0 (Jan 29, 2026):**
- `[ai-core]` Tool handler context types refactored for better type safety [#16901]
  - *Impact:* Chat-dependent vs chat-independent tools now properly distinguished
  - *Migration:* Update tool implementations to use new context types
- `[ai-chat]` Chat session storage moved to workspace scope by default [#16847]
  - *Impact:* Persistent sessions now stored per-workspace instead of globally
  - *Migration:* Use new preference to configure storage location

**Version 1.67.0 (Dec 10, 2025):**
- No major AI-related breaking changes
- Minor API refinements to agent configuration

**Version 1.66.0 (Oct 30, 2025):**
- MCP SDK updated to v1.25.1 with Zod v4 migration [#16780]
  - *Impact:* Type validation changes for MCP server integrations
  - *Migration:* Update any custom MCP server implementations

### Documentation Quality: **GOOD**

- **Comprehensive docs:** https://theia-ide.org/docs/theia_ai/ 
- **API examples:** Full working examples in Theia repository
- **Architecture diagrams:** High-level and detailed architecture documentation
- **Video tutorials:** Available from EclipseSource
- **Blog posts:** Regular release announcements with feature highlights

### Community Activity: **ACTIVE**

- **Monthly releases:** Consistent release cadence
- **Active development:** 75+ PRs merged in 1.68 release alone
- **Contributor growth:** New contributors in recent releases
- **Commercial support:** Available from EclipseSource and others

---

## Risk Assessment

### Risk Level: **MEDIUM-LOW**

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| API changes in future releases | Medium | Low-Medium | Pin exact versions; review changelog before upgrades |
| AI framework evolution | High | Low | New features are additive; core APIs stable |
| Documentation gaps | Low | Low | Source code well-documented; examples available |
| Community support | Low | Low | Active community; commercial support available |

### Mitigation Strategy

1. **Pin exact versions** - Use exact version numbers (1.68.2) not `^` ranges
2. **Lock file** - Ensure yarn.lock/package-lock.json is committed
3. **Changelog review** - Review [CHANGELOG.md](https://github.com/eclipse-theia/theia/blob/master/CHANGELOG.md) before any upgrade
4. **Community release alignment** - Target community releases (every 3 months) for major upgrades
5. **Test coverage** - Build integration tests for AI agent functionality

---

## Version Pinning Strategy

### Recommendation: **EXACT VERSIONS**

```json
{
  "dependencies": {
    "@theia/core": "1.68.2",
    "@theia/ai-core": "1.68.2",
    "@theia/ai-chat": "1.68.2",
    "@theia/ai-chat-ui": "1.68.2",
    "@theia/ai-ide": "1.68.2",
    "@theia/ai-openai": "1.68.2"
  }
}
```

### Rationale

1. **Theia uses synchronized versioning** - All packages release together
2. **AI framework is evolving** - New features added monthly, some API refinements
3. **Deterministic builds** - Prevents unexpected breaks from automatic updates
4. **Tested combination** - 1.68.2 packages are tested together

### Upgrade Path

1. **Security patches:** Upgrade to next patch version (1.68.3 if released)
2. **Feature updates:** Upgrade to next community release (1.69.x or 1.71.x)
3. **Migration process:**
   - Review CHANGELOG for breaking changes
   - Update in development branch first
   - Run full test suite
   - Deploy to staging environment
   - Monitor for issues before production

---

## Additional AI Packages to Consider

| Package | Purpose | Recommended |
|---------|---------|-------------|
| `@theia/ai-copilot` | GitHub Copilot integration | Optional - only if users have Copilot |
| `@theia/ai-hugging-face` | HuggingFace models | Optional - for self-hosted models |
| `@theia/ai-google` | Google AI/Gemini | Optional - alternative provider |
| `@theia/ai-history` | Chat history management | **Recommended** - useful for persistence |
| `@theia/ai-code-completion` | AI-powered code completion | **Recommended** - core IDE feature |

---

## Known Issues and Gotchas

1. **Chat session storage location changed in 1.68**
   - Now stored in workspace by default (not global)
   - Can be configured via preference if global storage needed

2. **Tool handler context types refactored in 1.68**
   - Custom tools need to update to new context type signatures
   - See PR #16901 for migration details

3. **perfect-scrollbar dependency**
   - Some versions have scrollbar issues
   - Pin at 1.5.5 if encountered

4. **MCP SDK updated to Zod v4 in 1.66**
   - Custom MCP servers may need schema updates

5. **AI features marked "experimental" in UI**
   - Some UI elements show "experimental" tags
   - Framework itself is stable; tags indicate active refinement

---

## References

### Official Documentation
- [Theia AI Documentation](https://theia-ide.org/docs/theia_ai/)
- [Theia Releases](https://theia-ide.org/releases/)
- [GitHub Releases](https://github.com/eclipse-theia/theia/releases)
- [CHANGELOG](https://github.com/eclipse-theia/theia/blob/master/CHANGELOG.md)

### Release Announcements
- [Theia 1.68 Release Notes](https://eclipsesource.com/blogs/2026/02/12/eclipse-theia-1-68-release-news-and-noteworthy/)
- [Theia 1.67 Release Notes](https://eclipsesource.com/blogs/2025/12/18/eclipse-theia-1-67-release-news-and-noteworthy/)
- [Theia 1.66 Release Notes](https://newsroom.eclipse.org/news/announcements/eclipse-theia-166-release-news-and-noteworthy)

### AI Framework Resources
- [Introducing Theia AI](https://eclipsesource.com/blogs/2025/03/13/introducing-theia-ai/)
- [Custom Chat Agents Guide](https://eclipsesource.com/blogs/2024/11/06/custom-cat-agents-theia-ide/)
- [Building Custom AI Agents](https://eclipsesource.com/blogs/2025/06/18/how-to-build-custom-agents-in-theia-ai)
- [Getting Started with Theia AI](https://vogella.com/blog/theia_ai_getting_started/)

### NPM Registry
- [@theia/ai-core](https://www.npmjs.com/package/@theia/ai-core)
- [@theia/ai-chat](https://www.npmjs.com/package/@theia/ai-chat)
- [@theia/ai-chat-ui](https://www.npmjs.com/package/@theia/ai-chat-ui)

---

## Conclusion

**Theia 1.68.2 is recommended for Theia Openspace.** The AI framework has reached sufficient maturity for production use, with stable APIs, comprehensive documentation, and active community support. While the framework continues to evolve with new features, the core agent/chat APIs are stable.

Pin exact version `1.68.2` for all `@theia/*` packages to ensure deterministic builds and tested compatibility.

---

*Report generated by Scout (ID: scout_research_001) for Phase0-Scaffold task.*
